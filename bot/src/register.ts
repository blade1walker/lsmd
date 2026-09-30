import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { commands } from "./commands/index.js";

/**
 * Registers the slash commands in DISCORD_GUILD_ID. Runs on every start, and
 * by hand with `npm run register`.
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
export async function registerCommands(applicationId: string) {
  const rest = new REST().setToken(config.token);
  const body = commands.map((c) => c.data.toJSON());

  await rest.put(Routes.applicationGuildCommands(applicationId, config.guildId), { body });

  const globals = (await rest.get(Routes.applicationCommands(applicationId))) as unknown[];
  if (globals.length > 0) {
    await rest.put(Routes.applicationCommands(applicationId), { body: [] });
    console.log(`[register] removed ${globals.length} old global command(s)`);
  }

  console.log(`[register] ${body.length} commands registered in guild ${config.guildId}`);
}

// `npm run register` — resolve the application id from the token itself.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("/register.ts")) {
  const rest = new REST().setToken(config.token);
  const app = (await rest.get(Routes.currentApplication())) as { id: string };
  await registerCommands(app.id);
}
