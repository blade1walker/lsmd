import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import { config } from "../config.js";
import type { Command } from "../command.js";
import { members } from "../data.js";
import { discordTime } from "../time.js";
import { COLORS, EPHEMERAL, actorOf, clip, embed, failure, respondError, success } from "../ui.js";
import { staffLog } from "../log.js";
import { pendingCounts } from "./applications.js";
import type { Announcement } from "../announcements.js";

// ─── /banner ────────────────────────────────────────────────────────────────

interface Banner {
  active: boolean;
  label: string;
  highlight: string;
  message: string;
  updatedBy: string | null;
}

export const banner: Command = {
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("The spotlight banner on the website's home page and roster")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(0n)
    .addSubcommand((s) => s.setName("show").setDescription("What the banner says now"))
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Set and show the banner")
        .addStringOption((o) => o.setName("message").setDescription("The main text").setRequired(true).setMaxLength(300))
        .addStringOption((o) => o.setName("label").setDescription('Bold lead-in, e.g. "DEPARTMENT SPOTLIGHT"').setMaxLength(60))
        .addStringOption((o) => o.setName("highlight").setDescription("A name or phrase in the accent colour").setMaxLength(80))
    )
    .addSubcommand((s) => s.setName("hide").setDescription("Take the banner down")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);
    try {
      await interaction.deferReply(EPHEMERAL);
      let b: Banner;
      if (sub === "show") {
        b = await api<Banner>(actor, "GET", "/api/roster-banner");
      } else if (sub === "hide") {
        b = await api<Banner>(actor, "PATCH", "/api/roster-banner", { active: false });
        await staffLog(interaction.client, actor, "Took the website banner down");
      } else {
        b = await api<Banner>(actor, "PATCH", "/api/roster-banner", {
          active: true,
          message: interaction.options.getString("message", true),
          label: interaction.options.getString("label") ?? "",
          highlight: interaction.options.getString("highlight") ?? "",
        });
        await staffLog(interaction.client, actor, "Set the website banner", b.message);
      }
      await interaction.editReply({
        embeds: [
          embed(b.active ? COLORS.brand : COLORS.neutral)
            .setTitle(`📣  Website banner · ${b.active ? "Showing" : "Hidden"}`)
            .addFields(
              { name: "Label", value: clip(b.label), inline: true },
              { name: "Highlight", value: clip(b.highlight), inline: true },
              { name: "Message", value: clip(b.message) },
              { name: "Last changed by", value: clip(b.updatedBy) }
            )
            .setURL(config.websiteUrl),
        ],
      });
    } catch (err) {
      await respondError(interaction, err);
    }
  },
};

// ─── /dm ────────────────────────────────────────────────────────────────────

export const dm: Command = {
  data: new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Message a member as the bot — kept in the website's conversation log")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(0n)
    .addUserOption((o) => o.setName("user").setDescription("Who to message").setRequired(true))
    .addStringOption((o) => o.setName("message").setDescription("What to say").setRequired(true).setMaxLength(1900)),

  async execute(interaction) {
    const actor = actorOf(interaction);
    const user = interaction.options.getUser("user", true);
    const message = interaction.options.getString("message", true);
    try {
      await interaction.deferReply(EPHEMERAL);
      await api(actor, "POST", `/api/messaging/threads/${user.id}`, { content: message });
      await staffLog(interaction.client, actor, `Sent a DM to ${user.tag}`, clip(message, 1500));
      await interaction.editReply({ embeds: [success(`Message sent to ${user.displayName}`, clip(message, 3000))] });
    } catch (err) {
      await respondError(interaction, err);
    }
  },
};

// ─── /duty ──────────────────────────────────────────────────────────────────

function hours(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export const duty: Command = {
  data: new SlashCommandBuilder()
    .setName("duty")
    .setDescription("Clock yourself on or off duty")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("on").setDescription("Clock on duty"))
    .addSubcommand((s) => s.setName("off").setDescription("Clock off duty"))
    .addSubcommand((s) => s.setName("status").setDescription("Your duty status and today's hours")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);
    try {
      await interaction.deferReply(EPHEMERAL);
      // Always the caller's own entry: the site only lets a member clock themselves.
      const me = (await members(actor)).find((m) => m.discordId === interaction.user.id);
      if (!me) {
        await interaction.editReply({ embeds: [failure("Not on the roster", "Your Discord account is not linked to a roster entry. Ask HR to add your Discord ID.")] });
        return;
      }

      if (sub === "on") await api(actor, "POST", "/api/clock/in", { memberId: me.id });
      if (sub === "off") await api(actor, "POST", "/api/clock/out", { memberId: me.id });

      const status = await api<{ isClockedIn: boolean; clockInAt: string | null; todayTotal: number }>(
        actor,
        "GET",
        `/api/clock/status?memberId=${encodeURIComponent(me.id)}`
      );
      const e = embed(status.isClockedIn ? COLORS.success : COLORS.neutral)
        .setTitle(status.isClockedIn ? "🟢  On duty" : "⚫  Off duty")
        .setDescription(`${me.callSign ? `**[${me.callSign}]** ` : ""}${me.name} · ${me.rank}`)
        .addFields(
          ...(status.isClockedIn && status.clockInAt ? [{ name: "Since", value: discordTime(status.clockInAt, "R"), inline: true }] : []),
          { name: "Today", value: hours(status.todayTotal ?? 0), inline: true }
        );
      await interaction.editReply({ embeds: [e] });
    } catch (err) {
      await respondError(interaction, err);
    }
  },
};

// ─── /ems ───────────────────────────────────────────────────────────────────

const HELP: [string, string][] = [
  ["/announce", "Post now, schedule, list, edit and cancel official announcements"],
  ["/recruit · /onboarding · /loa · /dept-app", "Review queues — pending, view, approve, decline"],
  ["/member", "Roster lookup, rank changes, call signs and status"],
  ["/config", "Notification toggles, message text, webhooks and tests"],
  ["/joinlink", "An invite link that gives new members the EMS Recruit and EMS roles"],
  ["/banner", "The website's spotlight banner"],
  ["/dm", "Message a member as the bot"],
  ["/duty", "Clock yourself on and off duty"],
  ["/ems", "Overview, help and status"],
];

export const ems: Command = {
  data: new SlashCommandBuilder()
    .setName("ems")
    .setDescription("Nexus EMS Bot — overview, help and status")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("overview").setDescription("Pending reviews, roster strength and what is scheduled"))
    .addSubcommand((s) => s.setName("help").setDescription("What every command does"))
    .addSubcommand((s) => s.setName("ping").setDescription("Bot and website response times")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);
    try {
      if (sub === "help") {
        await interaction.reply({
          embeds: [
            embed()
              .setTitle("🚑  Nexus EMS Bot")
              .setDescription(
                `Runs the [${config.brandName} website](${config.websiteUrl}) from Discord.\n\n` +
                  "**Who can use what** is set by server admins in **Server Settings → Integrations → Nexus EMS Bot**, per command, by role, member or channel."
              )
              .addFields(HELP.map(([name, value]) => ({ name, value }))),
          ],
          ...EPHEMERAL,
        });
        return;
      }

      await interaction.deferReply(EPHEMERAL);

      if (sub === "ping") {
        const started = Date.now();
        let site = "unreachable";
        try {
          await api(actor, "GET", "/api/announcements?limit=1");
          site = `${Date.now() - started} ms`;
        } catch (err) {
          site = err instanceof Error ? clip(err.message, 200) : "unreachable";
        }
        await interaction.editReply({
          embeds: [
            embed(COLORS.info)
              .setTitle("🩺  Status")
              .addFields(
                { name: "Discord gateway", value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true },
                { name: "Website API", value: site, inline: true },
                { name: "Online since", value: discordTime(new Date(Date.now() - (interaction.client.uptime ?? 0)), "R"), inline: true }
              ),
          ],
        });
        return;
      }

      const [queues, roster, upcoming] = await Promise.all([
        pendingCounts(interaction),
        members(actor).catch(() => null),
        api<Announcement[]>(actor, "GET", "/api/announcements?view=scheduled&limit=3").catch(() => null),
      ]);
      const e = embed()
        .setTitle(`📋  ${config.brandName} · Overview`)
        .setURL(config.websiteUrl)
        .addFields({
          name: "Waiting for review",
          value: queues
            .map((q) => `${q.count === null ? "▫️ —" : q.count > 0 ? `🟡 **${q.count}**` : "🟢 0"} ${q.label} · \`/${q.command} pending\``)
            .join("\n"),
        });
      if (roster) {
        const count = (a: string) => roster.filter((m) => m.activity === a).length;
        e.addFields({
          name: "Roster",
          value: `**${roster.length}** personnel · 🟢 ${count("Active")} active · 🔵 ${count("Reserve")} reserve · 🟠 ${count("LOA")} on leave`,
        });
      }
      if (upcoming) {
        e.addFields({
          name: "Next announcements",
          value: upcoming.length
            ? upcoming.map((a) => `${discordTime(a.scheduledFor, "f")} · **${clip(a.title, 60)}** in <#${a.channelId}>`).join("\n")
            : "Nothing scheduled.",
        });
      }
      await interaction.editReply({ embeds: [e] });
    } catch (err) {
      await respondError(interaction, err);
    }
  },
};
