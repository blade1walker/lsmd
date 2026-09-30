import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { commandMap } from "./commands/index.js";
import { parseCustomId } from "./command.js";
import { registerCommands } from "./register.js";
import { startScheduler } from "./scheduler.js";
import { startJoinLink } from "./joinlink.js";
import { respondError } from "./ui.js";

/**
 * Nexus EMS Bot.
 *
 * Every command is a slash command, so the bot never reads messages. It asks
 * for Server Members (privileged) only so it hears about joins for the join
 * link; if that intent is not enabled in the Developer Portal, the bot starts
 * without it and everything except join-link roles keeps working.
 */
const BASE_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildInvites];

function createClient(withMembers: boolean) {
  const client = new Client({
    intents: withMembers ? [...BASE_INTENTS, GatewayIntentBits.GuildMembers] : BASE_INTENTS,
  });

  client.once(Events.ClientReady, async (ready) => {
    console.log(`[ready] signed in as ${ready.user.tag}`);
    try {
      await registerCommands(ready.application.id);
    } catch (err) {
      console.error("[register] failed — commands may be out of date:", err);
    }
    if (!ready.guilds.cache.has(config.guildId)) {
      console.warn(`[ready] the bot is not in DISCORD_GUILD_ID ${config.guildId} — invite it with the link in the README.`);
    }
    ready.user.setActivity({ name: config.brandName, type: ActivityType.Watching });
    startScheduler(ready);
    await startJoinLink(ready);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandMap.get(interaction.commandName);
        if (command) await command.execute(interaction);
        return;
      }

      if (interaction.isAutocomplete()) {
        const command = commandMap.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(interaction);
        return;
      }

      if (interaction.isModalSubmit() || interaction.isButton() || interaction.isStringSelectMenu()) {
        const { command: name, action, payload } = parseCustomId(interaction.customId);
        const command = commandMap.get(name);
        if (!command) return;
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
  return client;
}

let client = createClient(true);
try {
  await client.login(config.token);
} catch (err) {
  if (!(err instanceof Error) || !/disallowed intents/i.test(err.message)) throw err;
  console.warn(
    "[intents] Server Members Intent is not enabled for this bot — starting without it. Join-link roles are off until you enable it in the Developer Portal → Bot → Privileged Gateway Intents and restart."
  );
  await client.destroy();
  client = createClient(false);
  await client.login(config.token);
}

process.on("unhandledRejection", (err) => console.error("[unhandled]", err));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[shutdown] ${signal}`);
    void client.destroy().finally(() => process.exit(0));
  });
}
