import { ActivityType, Client, DiscordAPIError, Events, GatewayIntentBits, REST, Routes } from "discord.js";
import { config, configWarnings } from "./config.js";
import { commandMap } from "./commands/index.js";
import { parseCustomId } from "./command.js";
import { registerCommands } from "./register.js";
import { startScheduler } from "./scheduler.js";
import { startJoinLink } from "./joinlink.js";
import { api } from "./api.js";
import { EPHEMERAL, failure, respondError } from "./ui.js";
import { canUse, startPermissions } from "./permissions.js";

/**
 * Nexus EMS Bot.
 *
 * Every command is a slash command, so the bot never reads messages. It asks
 * for Server Members (privileged) only so it hears about joins for the join
 * link, and only when the Developer Portal has that intent switched on —
 * asking for a privileged intent that is off makes Discord refuse the whole
 * connection.
 */

/** Application flags that mean "Server Members Intent is on". */
const GATEWAY_GUILD_MEMBERS = 1 << 14;
const GATEWAY_GUILD_MEMBERS_LIMITED = 1 << 15;

/**
 * Prints why the bot cannot start. Sets the exit code rather than calling
 * process.exit(): exiting while Discord's HTTP connection is still open trips
 * a libuv assertion on Windows, and the process ends on its own once idle.
 */
function fatal(lines: string[]): null {
  console.error(["", ...lines.map((l) => `  ${l}`), ""].join("\n"));
  process.exitCode = 1;
  return null;
}

/**
 * Checks the token and reads the application's settings over plain HTTP
 * before opening the gateway, so a bad token or a missing intent is a clear
 * message instead of a crash deep inside the connection.
 */
async function preflight(): Promise<{ app: { id: string; name: string; flags?: number }; membersIntent: boolean } | null> {
  const rest = new REST().setToken(config.token);
  try {
    const app = (await rest.get(Routes.currentApplication())) as { id: string; name: string; flags?: number };
    const flags = app.flags ?? 0;
    return { app, membersIntent: (flags & (GATEWAY_GUILD_MEMBERS | GATEWAY_GUILD_MEMBERS_LIMITED)) !== 0 };
  } catch (err) {
    if (err instanceof DiscordAPIError && (err.status === 401 || err.code === 0)) {
      return fatal([
        "Nexus EMS Bot cannot start: Discord rejected DISCORD_TOKEN (401 Unauthorized).",
        "",
        "The token is wrong, incomplete, or was reset. Get a fresh one:",
        "Developer Portal → your application → Bot → Reset Token → Copy, then paste it into DISCORD_TOKEN.",
        "Paste the token alone — no quotes, no spaces, no \"Bot \" in front.",
      ]);
    }
    return fatal([
      "Nexus EMS Bot cannot start: could not reach Discord.",
      err instanceof Error ? err.message : String(err),
      "Check the host's internet connection, then try again.",
    ]);
  }
}

function createClient(withMembers: boolean) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildInvites,
      ...(withMembers ? [GatewayIntentBits.GuildMembers] : []),
    ],
  });

  client.once(Events.ClientReady, async (ready) => {
    console.log(`[ready] signed in as ${ready.user.tag}`);

    const guildIds = config.guildId ? [config.guildId] : [...ready.guilds.cache.keys()];
    if (guildIds.length === 0) {
      console.warn("[ready] the bot is not in any server yet — invite it with the link in the README, and the commands appear on its own.");
    } else if (config.guildId && !ready.guilds.cache.has(config.guildId)) {
      console.warn(`[ready] the bot is not in server ${config.guildId} (DISCORD_GUILD_ID) — invite it with the link in the README.`);
    }
    await registerCommands(ready.application.id, guildIds.filter((id) => ready.guilds.cache.has(id)));

    ready.user.setActivity({ name: config.brandName, type: ActivityType.Watching });
    await checkWebsite(ready);
    if (!config.websiteProblem) startScheduler(ready);
    if (!config.websiteProblem) startPermissions(ready);
    await startJoinLink(ready);
    console.log("[ready] Nexus EMS Bot is running.");
  });

  // A server added later gets the commands straight away when no single server is configured.
  client.on(Events.GuildCreate, async (guild) => {
    if (!config.guildId || config.guildId === guild.id) await registerCommands(guild.client.application.id, [guild.id]);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandMap.get(interaction.commandName);
        if (!command) return;
        if (!canUse(interaction, interaction.commandName)) {
          await interaction.reply({ embeds: [noAccess(interaction.commandName)], ...EPHEMERAL });
          return;
        }
        await command.execute(interaction);
        return;
      }

      if (interaction.isAutocomplete()) {
        const command = commandMap.get(interaction.commandName);
        // Suggestions show real data (names, applications), so they are gated too.
        if (!canUse(interaction, interaction.commandName)) {
          await interaction.respond([]);
          return;
        }
        if (command?.autocomplete) await command.autocomplete(interaction);
        return;
      }

      if (interaction.isModalSubmit() || interaction.isButton() || interaction.isStringSelectMenu()) {
        const { command: name, action, payload } = parseCustomId(interaction.customId);
        const command = commandMap.get(name);
        if (!command) return;
        // Checked again here: a button stays clickable after access is taken away.
        if (!canUse(interaction, name)) {
          await interaction.reply({ embeds: [noAccess(name)], ...EPHEMERAL });
          return;
        }
        if (interaction.isModalSubmit()) await command.modal?.(interaction, action, payload);
        else if (interaction.isButton()) await command.button?.(interaction, action, payload);
        else await command.select?.(interaction, action, payload);
      }
    } catch (err) {
      if (interaction.isRepliable()) await respondError(interaction, err);
      else console.error(err);
    }
  });

  client.on(Events.Error, (err) => console.error("[discord]", err));
  client.on(Events.ShardError, (err) => console.error("[gateway]", err.message));
  return client;
}

function noAccess(command: string) {
  return failure(
    "You don't have access to this command",
    `Ask a server administrator to run \`/permissions grant\` for \`/${command}\`, or to add it on the website under Admin → Bot Permissions.`
  );
}

/** One line saying whether the website link works, so a bad URL or key shows at startup. */
async function checkWebsite(client: Client<true>) {
  if (config.websiteProblem) {
    console.warn(`[website] not connected: ${config.websiteProblem}`);
    return;
  }
  try {
    await api({ id: client.user.id, name: "Startup check" }, "GET", "/api/announcements?limit=1");
    console.log(`[website] connected to ${config.websiteUrl}`);
  } catch (err) {
    console.warn(`[website] ${err instanceof Error ? err.message : err}`);
  }
}

console.log("Nexus EMS Bot — starting…");
for (const w of configWarnings) console.warn(`[config] ${w}`);

const checked = await preflight();
if (checked) {
  const { app, membersIntent } = checked;
  console.log(`[discord] token OK for application "${app.name}" (${app.id})`);
  if (!membersIntent) {
    console.warn(
      "[discord] Server Members Intent is off — join-link roles are disabled. Turn it on in the Developer Portal → Bot → Privileged Gateway Intents, then restart."
    );
  }

  const client = createClient(membersIntent);
  await client.login(config.token);

  process.on("unhandledRejection", (err) => console.error("[unhandled]", err));
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      console.log(`[shutdown] ${signal}`);
      void client.destroy().finally(() => process.exit(0));
    });
  }
}
