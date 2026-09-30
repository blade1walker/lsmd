import { DiscordAPIError, REST, Routes } from "discord.js";
import { config } from "./config.js";
import { commands } from "./commands/index.js";

/**
 * Registers the slash commands in each server the bot runs in (just
 * DISCORD_GUILD_ID when it is set). Server commands appear instantly, unlike
 * global ones. Runs on every start, and by hand with `npm run register`.
 *
 * Staff commands register with no default access (only server administrators
 * see them) until someone grants them in Server Settings → Integrations →
 * Nexus EMS Bot. Re-registering keeps those grants: Discord stores them per
 * command and only resets them if a command is deleted and recreated.
 *
 * Global commands are cleared, because the earlier Python bot on this same
 * application registered its own; left in place they would show up beside
 * these as duplicates that no longer respond.
 */
export async function registerCommands(applicationId: string, guildIds: string[]) {
  const rest = new REST().setToken(config.token);
  const body = commands.map((c) => c.data.toJSON());

  for (const guildId of guildIds) {
    try {
      await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body });
      console.log(`[register] ${body.length} commands registered in server ${guildId}`);
    } catch (err) {
      if (err instanceof DiscordAPIError && err.code === 50001) {
        console.error(
          `[register] Discord refused to add commands to server ${guildId} — the bot was invited without the "applications.commands" scope. Re-invite it with the link in the README; no need to kick it first.`
        );
      } else {
        console.error(`[register] could not register commands in server ${guildId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  try {
    const globals = (await rest.get(Routes.applicationCommands(applicationId))) as unknown[];
    if (globals.length > 0) {
      await rest.put(Routes.applicationCommands(applicationId), { body: [] });
      console.log(`[register] removed ${globals.length} old global command(s)`);
    }
  } catch (err) {
    console.warn("[register] could not check old global commands:", err instanceof Error ? err.message : err);
  }
}

// `npm run register` — register without starting the bot.
if (/register\.(ts|js)$/.test(process.argv[1] ?? "")) {
  const rest = new REST().setToken(config.token);
  const app = (await rest.get(Routes.currentApplication())) as { id: string };
  const guilds = config.guildId
    ? [config.guildId]
    : ((await rest.get(Routes.userGuilds())) as { id: string }[]).map((g) => g.id);
  if (guilds.length === 0) console.error("[register] the bot is not in any server yet — invite it first.");
  await registerCommands(app.id, guilds);
}
