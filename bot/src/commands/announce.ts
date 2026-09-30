import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type GuildBasedChannel,
} from "discord.js";
import { api } from "../api.js";
import { config } from "../config.js";
import { customId, type Command } from "../command.js";
import {
  ANNOUNCE_CHANNEL_TYPES,
  COLOR_CHOICES,
  buildAnnouncement,
  cannotPost,
  deliver,
  mentionText,
  type Announcement,
} from "../announcements.js";
import { discordTime, parseWhen } from "../time.js";
import { COLORS, EPHEMERAL, actorOf, clip, embed, failure, respondError, statusBadge, success } from "../ui.js";
import { staffLog } from "../log.js";

const NAME = "announce";

/** What the slash options chose, held while the author writes the text in a modal. */
interface Draft {
  channelId: string;
  mention: string;
  color: number;
  imageUrl: string | null;
  scheduledFor: string | null;
  repeat: "none" | "daily" | "weekly";
  expires: number;
}

const drafts = new Map<string, Draft>();
const DRAFT_TTL_MS = 15 * 60_000;

function keepDraft(draft: Omit<Draft, "expires">) {
  const now = Date.now();
  for (const [k, d] of drafts) if (d.expires < now) drafts.delete(k);
  const key = randomUUID().slice(0, 12);
  drafts.set(key, { ...draft, expires: now + DRAFT_TTL_MS });
  return key;
}

const REPEAT_LABEL = { none: "Once", daily: "Every day", weekly: "Every week" } as const;

function withPostOptions(sub: import("discord.js").SlashCommandSubcommandBuilder) {
  return sub
    .addChannelOption((o) =>
      o.setName("channel").setDescription("Where to post it").addChannelTypes(...ANNOUNCE_CHANNEL_TYPES).setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("mention")
        .setDescription("Who to ping above the announcement")
        .addChoices({ name: "No ping", value: "none" }, { name: "@everyone", value: "everyone" }, { name: "@here", value: "here" })
    )
    .addRoleOption((o) => o.setName("role").setDescription("Ping a role instead (overrides mention)"))
    .addIntegerOption((o) =>
      o
        .setName("color")
        .setDescription("Accent colour")
        .addChoices(...COLOR_CHOICES.map((c) => ({ name: c.name, value: c.value })))
    )
    .addStringOption((o) => o.setName("image").setDescription("Banner image link (https://…)"));
}

const data = new SlashCommandBuilder()
  .setName(NAME)
  .setDescription("Post and schedule official announcements")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => withPostOptions(s.setName("now").setDescription("Post an announcement right away")))
  .addSubcommand((s) =>
    // Discord rejects a required option after an optional one, so `when`
    // goes first and `repeat` after the shared options.
    withPostOptions(
      s
        .setName("schedule")
        .setDescription("Schedule an announcement for later")
        .addStringOption((o) =>
          o
            .setName("when")
            .setDescription(`e.g. "in 2h", "18:30", "tomorrow 9am", "2026-10-05 18:30" (${config.timezone})`)
            .setRequired(true)
        )
    ).addStringOption((o) =>
      o
        .setName("repeat")
        .setDescription("Post it again on a cadence")
        .addChoices(
          { name: "Once", value: "none" },
          { name: "Every day", value: "daily" },
          { name: "Every week", value: "weekly" }
        )
    )
  )
  .addSubcommand((s) => s.setName("list").setDescription("Upcoming scheduled announcements"))
  .addSubcommand((s) =>
    s
      .setName("view")
      .setDescription("Details and a preview of one announcement")
      .addStringOption((o) => o.setName("id").setDescription("Announcement").setRequired(true).setAutocomplete(true))
  )
  .addSubcommand((s) =>
    s
      .setName("edit")
      .setDescription("Change a scheduled announcement's text or time")
      .addStringOption((o) => o.setName("id").setDescription("Announcement").setRequired(true).setAutocomplete(true))
  )
  .addSubcommand((s) =>
    s
      .setName("cancel")
      .setDescription("Cancel a scheduled announcement")
      .addStringOption((o) => o.setName("id").setDescription("Announcement").setRequired(true).setAutocomplete(true))
  )
  .addSubcommand((s) => s.setName("history").setDescription("Recently sent, failed and cancelled announcements"));

function textModal(id: string, title: string, values?: { title?: string; message?: string; footer?: string; when?: string }) {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);
  const rows = [
    new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Headline")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(256)
      .setRequired(true)
      .setPlaceholder("e.g. Mandatory Department Meeting"),
    new TextInputBuilder()
      .setCustomId("message")
      .setLabel("Announcement")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(4000)
      .setRequired(true)
      .setPlaceholder("Supports Discord markdown: **bold**, lists, links…"),
    new TextInputBuilder()
      .setCustomId("footer")
      .setLabel("Signed off by (optional)")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(200)
      .setRequired(false)
      .setPlaceholder("e.g. Office of the Chief of EMS"),
  ];
  if (values?.title) rows[0].setValue(values.title);
  if (values?.message) rows[1].setValue(values.message.slice(0, 4000));
  if (values?.footer) rows[2].setValue(values.footer);
  if (values?.when !== undefined) {
    rows.push(
      new TextInputBuilder()
        .setCustomId("when")
        .setLabel(`When (${config.timezone})`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(values.when)
    );
  }
  modal.addComponents(...rows.map((r) => new ActionRowBuilder<TextInputBuilder>().addComponents(r)));
  return modal;
}

/** "2026-10-05 18:30" in the configured zone, for pre-filling the edit form. */
function wallClock(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function describe(a: Announcement) {
  const e = embed(a.color)
    .setTitle(`📢  ${clip(a.title, 240)}`)
    .addFields(
      { name: "Status", value: statusBadge(a.status), inline: true },
      { name: "Channel", value: `<#${a.channelId}>`, inline: true },
      { name: "Ping", value: mentionText(a.mention) || "None", inline: true },
      {
        name: a.status === "Sent" ? "Sent" : "Scheduled for",
        value: `${discordTime(a.sentAt ?? a.scheduledFor)} (${discordTime(a.sentAt ?? a.scheduledFor, "R")})`,
        inline: true,
      },
      { name: "Repeats", value: REPEAT_LABEL[a.repeat], inline: true },
      { name: "Created by", value: clip(a.createdByName, 100), inline: true }
    )
    .setFooter({ text: `ID ${a.id}` });
  if (a.messageUrl) e.addFields({ name: "Message", value: `[Jump to announcement](${a.messageUrl})` });
  if (a.error) e.addFields({ name: "Error", value: clip(a.error) });
  if (a.cancelledByName) e.addFields({ name: "Cancelled by", value: clip(a.cancelledByName, 100) });
  return e;
}

async function checkChannel(interaction: ChatInputCommandInteraction, mention: string) {
  const channel = interaction.options.getChannel("channel", true);
  const resolved = (await interaction.guild?.channels.fetch(channel.id).catch(() => null)) as GuildBasedChannel | null;
  if (!resolved) return { error: "The bot cannot see that channel." };
  const blocked = cannotPost(resolved, mention);
  return blocked ? { error: blocked } : { channelId: channel.id };
}

async function openComposer(interaction: ChatInputCommandInteraction, scheduled: boolean) {
  const role = interaction.options.getRole("role");
  const mention = role ? `role:${role.id}` : (interaction.options.getString("mention") ?? "none");

  const image = interaction.options.getString("image")?.trim() || null;
  if (image && !/^https:\/\/\S+$/.test(image)) {
    await interaction.reply({ embeds: [failure("Invalid image link", "The image must be an https:// link.")], ...EPHEMERAL });
    return;
  }

  let scheduledFor: string | null = null;
  if (scheduled) {
    const when = parseWhen(interaction.options.getString("when", true));
    if (!when) {
      await interaction.reply({
        embeds: [
          failure(
            "Could not read that time",
            `Try \`in 2h\`, \`18:30\`, \`tomorrow 9am\` or \`2026-10-05 18:30\`. Times are in **${config.timezone}**.`
          ),
        ],
        ...EPHEMERAL,
      });
      return;
    }
    if (when.getTime() < Date.now() + 30_000) {
      await interaction.reply({ embeds: [failure("That time has passed", "Pick a time at least a minute from now, or use `/announce now`.")], ...EPHEMERAL });
      return;
    }
    scheduledFor = when.toISOString();
  }

  const channel = await checkChannel(interaction, mention);
  if ("error" in channel) {
    await interaction.reply({ embeds: [failure("Cannot post there", channel.error)], ...EPHEMERAL });
    return;
  }

  const key = keepDraft({
    channelId: channel.channelId!,
    mention,
    color: interaction.options.getInteger("color") ?? COLORS.brand,
    imageUrl: image,
    scheduledFor,
    repeat: (interaction.options.getString("repeat") as Draft["repeat"]) ?? "none",
  });
  await interaction.showModal(textModal(customId(NAME, "new", key), scheduled ? "Schedule an announcement" : "Post an announcement"));
}

export const announce: Command = {
  data,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);

    try {
      if (sub === "now" || sub === "schedule") return await openComposer(interaction, sub === "schedule");

      if (sub === "list" || sub === "history") {
        await interaction.deferReply(EPHEMERAL);
        const view = sub === "list" ? "scheduled" : "history";
        const rows = await api<Announcement[]>(actor, "GET", `/api/announcements?view=${view}&limit=15`);
        const e = embed().setTitle(sub === "list" ? "🗓️  Scheduled announcements" : "📜  Announcement history");
        if (rows.length === 0) {
          e.setDescription(sub === "list" ? "Nothing is scheduled. Use `/announce schedule` to add one." : "No announcements yet.");
        } else {
          e.setDescription(
            rows
              .map((a) => {
                const when = discordTime(a.sentAt ?? a.scheduledFor, "f");
                const repeat = a.repeat !== "none" ? ` · 🔁 ${REPEAT_LABEL[a.repeat]}` : "";
                const link = a.messageUrl ? ` · [view](${a.messageUrl})` : "";
                return `${statusBadge(a.status)} **${clip(a.title, 80)}**\n<#${a.channelId}> · ${when}${repeat}${link}\n\`${a.id}\``;
              })
              .join("\n\n")
              .slice(0, 4000)
          );
        }
        await interaction.editReply({ embeds: [e] });
        return;
      }

      const id = interaction.options.getString("id", true);

      if (sub === "view") {
        await interaction.deferReply(EPHEMERAL);
        const a = await api<Announcement>(actor, "GET", `/api/announcements/${encodeURIComponent(id)}`);
        const preview = buildAnnouncement(a);
        await interaction.editReply({
          content: "**Preview** — this is how it looks in the channel:",
          embeds: [describe(a), ...(preview.embeds ?? [])],
        });
        return;
      }

      if (sub === "edit") {
        const a = await api<Announcement>(actor, "GET", `/api/announcements/${encodeURIComponent(id)}`);
        if (a.status !== "Scheduled") {
          await interaction.reply({ embeds: [failure("Cannot edit", `This announcement is **${a.status}** — only scheduled ones can be edited.`)], ...EPHEMERAL });
          return;
        }
        await interaction.showModal(
          textModal(customId(NAME, "edit", a.id), "Edit announcement", {
            title: a.title,
            message: a.message,
            footer: a.footer ?? "",
            when: wallClock(a.scheduledFor),
          })
        );
        return;
      }

      if (sub === "cancel") {
        await interaction.deferReply(EPHEMERAL);
        const a = await api<Announcement>(actor, "GET", `/api/announcements/${encodeURIComponent(id)}`);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(customId(NAME, "cancel", a.id)).setLabel("Cancel announcement").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(customId(NAME, "keep", a.id)).setLabel("Keep it").setStyle(ButtonStyle.Secondary)
        );
        await interaction.editReply({ content: "Cancel this announcement?", embeds: [describe(a)], components: [row] });
        return;
      }
    } catch (err) {
      await respondError(interaction, err);
    }
  },

  async autocomplete(interaction) {
    try {
      const rows = await api<Announcement[]>(actorOf(interaction), "GET", "/api/announcements?view=scheduled&limit=50");
      const sub = interaction.options.getSubcommand();
      // View also reaches recent history; edit and cancel only make sense for what is still scheduled.
      const history = sub === "view" ? await api<Announcement[]>(actorOf(interaction), "GET", "/api/announcements?view=history&limit=25") : [];
      const q = interaction.options.getFocused().toLowerCase();
      const choices = [...rows, ...history]
        .filter((a) => sub === "view" || a.status === "Scheduled")
        .filter((a) => !q || a.title.toLowerCase().includes(q) || a.id.includes(q))
        .slice(0, 25)
        .map((a) => ({ name: clip(`${a.status} · ${a.title} · ${wallClock(a.scheduledFor)}`, 100), value: a.id }));
      await interaction.respond(choices);
    } catch {
      await interaction.respond([]).catch(() => {});
    }
  },

  async modal(interaction, action, payload) {
    const actor = actorOf(interaction);
    const title = interaction.fields.getTextInputValue("title").trim();
    const message = interaction.fields.getTextInputValue("message").trim();
    const footer = interaction.fields.getTextInputValue("footer").trim() || null;

    try {
      if (action === "new") {
        const draft = drafts.get(payload);
        if (!draft) {
          await interaction.reply({ embeds: [failure("This form expired", "Run the command again — drafts are kept for 15 minutes.")], ...EPHEMERAL });
          return;
        }
        drafts.delete(payload);
        await interaction.deferReply(EPHEMERAL);

        const sendNow = draft.scheduledFor === null;
        const created = await api<Announcement>(actor, "POST", "/api/announcements", {
          title,
          message,
          footer,
          channelId: draft.channelId,
          mention: draft.mention,
          color: draft.color,
          imageUrl: draft.imageUrl,
          repeat: draft.repeat,
          scheduledFor: draft.scheduledFor,
          sendNow,
        });

        if (sendNow) {
          const result = await deliver(interaction.client, actor, created);
          if (!result.ok) {
            await interaction.editReply({ embeds: [failure("Announcement not posted", result.error)] });
            return;
          }
          await staffLog(interaction.client, actor, "Posted an announcement", `**${title}** in <#${draft.channelId}>\n${result.url}`);
          await interaction.editReply({
            embeds: [success("Announcement posted", `**${clip(title, 200)}** is live in <#${draft.channelId}>.\n[Jump to it](${result.url})`)],
          });
          return;
        }

        await staffLog(
          interaction.client,
          actor,
          "Scheduled an announcement",
          `**${title}** in <#${draft.channelId}> for ${discordTime(created.scheduledFor)}${created.repeat !== "none" ? ` · ${REPEAT_LABEL[created.repeat]}` : ""}`
        );
        const preview = buildAnnouncement(created);
        await interaction.editReply({
          content: `🗓️ Scheduled for ${discordTime(created.scheduledFor)} (${discordTime(created.scheduledFor, "R")}). Preview:`,
          embeds: [...(preview.embeds ?? [])],
        });
        return;
      }

      if (action === "edit") {
        const when = parseWhen(interaction.fields.getTextInputValue("when"));
        if (!when) {
          await interaction.reply({ embeds: [failure("Could not read that time", `Times are in **${config.timezone}**, e.g. \`2026-10-05 18:30\`.`)], ...EPHEMERAL });
          return;
        }
        await interaction.deferReply(EPHEMERAL);
        const updated = await api<Announcement>(actor, "PATCH", `/api/announcements/${encodeURIComponent(payload)}`, {
          title,
          message,
          footer,
          scheduledFor: when.toISOString(),
        });
        await staffLog(interaction.client, actor, "Edited a scheduled announcement", `**${title}** · now ${discordTime(updated.scheduledFor)}`);
        await interaction.editReply({ embeds: [success("Announcement updated"), describe(updated)] });
      }
    } catch (err) {
      await respondError(interaction, err);
    }
  },

  async button(interaction, action, payload) {
    if (action === "keep") {
      await interaction.update({ content: "Kept — nothing was changed.", components: [] });
      return;
    }
    if (action !== "cancel") return;
    const actor = actorOf(interaction);
    try {
      const a = await api<Announcement>(actor, "DELETE", `/api/announcements/${encodeURIComponent(payload)}`);
      await staffLog(interaction.client, actor, "Cancelled a scheduled announcement", `**${a.title}**`);
      await interaction.update({ content: "", embeds: [success("Announcement cancelled"), describe(a)], components: [] });
    } catch (err) {
      await respondError(interaction, err);
    }
  },
};
