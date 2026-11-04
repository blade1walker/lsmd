import {
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../command.js";
import { config } from "../config.js";
import { formatIST, discordTime } from "../time.js";
import { COLORS, EPHEMERAL, actorOf, embed, failure, respondError } from "../ui.js";
import {
  applyUpdate,
  checkForUpdate,
  getCurrentVersion,
  getUpdaterStatus,
} from "../updater.js";

export const botCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("bot")
    .setDescription("Bot status, version control, and auto-update management")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("status").setDescription("View current version, uptime, and update check"))
    .addSubcommand((s) =>
      s
        .setName("update")
        .setDescription("Check and immediately pull/apply the latest update from GitHub")
        .addBooleanOption((o) => o.setName("force").setDescription("Force re-pull and re-build even if up to date"))
    )
    .addSubcommand((s) => s.setName("restart").setDescription("Gracefully restart the bot")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);

    try {
      await interaction.deferReply(EPHEMERAL);

      if (sub === "status") {
        const version = getCurrentVersion();
        const status = getUpdaterStatus();
        const check = await checkForUpdate();
        const bootTime = new Date(Date.now() - (interaction.client.uptime ?? 0));

        const e = embed(check.available ? COLORS.brand : COLORS.info)
          .setTitle("🤖  Nexus EMS Bot · System Status")
          .setDescription(
            `Currently running commit \`${version.shortSha}\` on branch \`${config.githubBranch}\`.\n` +
              `Target repository: [${config.githubRepo}](https://github.com/${config.githubRepo})`
          )
          .addFields(
            {
              name: "Active Version",
              value: `\`${version.shortSha}\` (${version.commit})\n*${version.message}*`,
              inline: false,
            },
            {
              name: "Online Since (IST)",
              value: `${discordTime(bootTime, "R")}\n\`${formatIST(bootTime)}\``,
              inline: true,
            },
            {
              name: "Auto-Updater",
              value: status.enabled
                ? `🟢 Active (every ${status.intervalMinutes}m)`
                : "🔴 Disabled (`BOT_AUTO_UPDATE=false`)",
              inline: true,
            },
            {
              name: "Update Status",
              value: check.available
                ? `⚡ **Update Available!**\nNew: \`${check.shortSha}\` by ${check.author}\n*${check.message}*\nRun \`/bot update\` to deploy.`
                : "✅ **Up to Date** (latest commit running)",
              inline: false,
            }
          );

        if (status.lastCheckAt) {
          e.setFooter({ text: `Last checked: ${formatIST(status.lastCheckAt)}` });
        }

        await interaction.editReply({ embeds: [e] });
        return;
      }

      if (sub === "update") {
        const force = interaction.options.getBoolean("force") ?? false;
        const check = await checkForUpdate();

        if (!check.available && !force) {
          const v = getCurrentVersion();
          await interaction.editReply({
            embeds: [
              embed(COLORS.success)
                .setTitle("✅  Bot is Already Up to Date")
                .setDescription(
                  `Nexus EMS Bot is currently on the latest commit \`${v.shortSha}\`.\n` +
                    `Branch: \`${config.githubBranch}\`\n\n` +
                    `To force re-pull and recompile anyway, run: \`/bot update force:True\``
                )
                .addFields({ name: "Checked at (IST)", value: `\`${formatIST(new Date())}\`` }),
            ],
          });
          return;
        }

        await interaction.editReply({
          embeds: [
            embed(COLORS.brand)
              .setTitle("🔄  Applying Bot Update...")
              .setDescription(
                `Found update \`${check.shortSha || "latest"}\`. Pulling changes and building...\n` +
                  `The bot will automatically restart in a few moments.`
              )
              .addFields(
                { name: "Target Commit", value: `\`${check.shortSha || "latest"}\` — ${check.message || "Latest release"}` },
                { name: "Initiated At (IST)", value: `\`${formatIST(new Date())}\`` }
              ),
          ],
        });

        const res = await applyUpdate(interaction.client, actor.name, force);
        if (!res.success) {
          await interaction.followUp({
            embeds: [failure("Update Failed", res.error || "Unknown error occurred during update.")],
            ...EPHEMERAL,
          });
        }
        return;
      }

      if (sub === "restart") {
        await interaction.editReply({
          embeds: [
            embed(COLORS.brand)
              .setTitle("🔄  Restarting Bot...")
              .setDescription("Nexus EMS Bot is performing a clean restart now.")
              .addFields({ name: "Restart Time (IST)", value: `\`${formatIST(new Date())}\`` }),
          ],
        });

        setTimeout(async () => {
          try {
            await interaction.client.destroy();
          } catch {}
          process.exit(0);
        }, 1000);
        return;
      }
    } catch (err) {
      await respondError(interaction, err);
    }
  },
};
