import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { commandMap } from "./commands/index.js";
import { parseCustomId } from "./command.js";
import { registerCommands } from "./register.js";
import { startScheduler } from "./scheduler.js";
import { respondError } from "./ui.js";

/**
 * Nexus EMS Bot.
 *
 * Only the Guilds intent: every command is a slash command, so the bot never
 * needs to read messages or the member list, and needs no privileged intents.
 */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
  ready.user.setActivity({ name: `${config.brandName}`, type: ActivityType.Watching });
  startScheduler(ready);
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
process.on("unhandledRejection", (err) => console.error("[unhandled]", err));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[shutdown] ${signal}`);
    void client.destroy().finally(() => process.exit(0));
  });
}

await client.login(config.token);
