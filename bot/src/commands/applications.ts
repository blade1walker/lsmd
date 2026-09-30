import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type RepliableInteraction,
} from "discord.js";
import { api } from "../api.js";
import { customId, type Command } from "../command.js";
import { RANKS, invalidateRoster } from "../data.js";
import { discordTime } from "../time.js";
import { COLORS, EPHEMERAL, actorOf, clip, embed, failure, respondError, statusBadge, success } from "../ui.js";
import { staffLog } from "../log.js";

/**
 * The website's review queues — recruitment, onboarding, Leave of Absence and
 * department applications. They behave the same (list what is pending, open
 * one, approve or decline it), so one factory builds each; each is still its
 * own top-level command so Integrations can grant them separately.
 *
 * Approving here calls the same endpoint as the panel's button, so the member
 * gets the same DM and the channel the same webhook post.
 */

type Row = Record<string, unknown> & { id: string; status: string; createdAt: string };

interface Queue {
  name: string;
  label: string;
  description: string;
  listPath: string;
  itemPath: (id: string) => string;
  /** Name shown in lists and autocomplete. */
  title(row: Row): string;
  fields(row: Row): { name: string; value: string; inline?: boolean }[];
  /** Onboarding approval assigns a rank, so it needs one before it can go through. */
  needsRank?: boolean;
  /** Whether the review endpoint takes a note. LOA's does not. */
  takesNote: boolean;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const date = (v: unknown) => (typeof v === "string" ? new Date(v).toLocaleDateString("en-GB") : "—");
const user = (v: unknown) => (str(v) ? `<@${v}>` : "—");

const QUEUES: Queue[] = [
  {
    name: "recruit",
    label: "Recruitment",
    description: "Review recruitment applications",
    listPath: "/api/recruit",
    itemPath: (id) => `/api/recruit/${id}`,
    title: (r) => str(r.characterName) ?? str(r.discordUsername) ?? str(r.user) ?? "Unnamed applicant",
    fields: (r) => [
      { name: "Discord", value: user(r.discordId), inline: true },
      { name: "Username", value: clip(str(r.discordUsername), 100), inline: true },
      { name: "Steam", value: clip(str(r.steamId), 100), inline: true },
      { name: "Note", value: clip(str(r.reviewNote)) },
    ],
    takesNote: true,
  },
  {
    name: "onboarding",
    label: "Onboarding",
    description: "Review onboarding requests and assign a starting rank",
    listPath: "/api/onboarding",
    itemPath: (id) => `/api/onboarding/${id}`,
    title: (r) => str(r.name) ?? "Unnamed",
    fields: (r) => [
      { name: "Discord", value: user(r.discordId), inline: true },
      { name: "State ID", value: clip(str(r.stateId), 100), inline: true },
      { name: "Steam", value: clip(str(r.steamId), 100), inline: true },
      { name: "Reason", value: clip(str(r.reason)) },
      ...(str(r.assignedRank) ? [{ name: "Assigned rank", value: String(r.assignedRank), inline: true }] : []),
    ],
    needsRank: true,
    takesNote: true,
  },
  {
    name: "loa",
    label: "Leave of Absence",
    description: "Review Leave of Absence requests",
    listPath: "/api/loa",
    itemPath: (id) => `/api/loa/${id}`,
    title: (r) => {
      const m = r.member as { name?: string; callSign?: string } | undefined;
      return `${m?.callSign ? `[${m.callSign}] ` : ""}${m?.name ?? "Unknown member"}`;
    },
    fields: (r) => {
      const m = r.member as { rank?: string } | undefined;
      return [
        { name: "Rank", value: m?.rank ?? "—", inline: true },
        { name: "From", value: date(r.startDate), inline: true },
        { name: "Until", value: date(r.endDate), inline: true },
        { name: "Reason", value: clip(str(r.reason)) },
      ];
    },
    takesNote: false,
  },
  {
    name: "dept-app",
    label: "Department",
    description: "Review department join applications",
    listPath: "/api/department-applications",
    itemPath: (id) => `/api/department-applications/${id}`,
    title: (r) => {
      const d = r.department as { name?: string } | undefined;
      return `${str(r.characterName) ?? "Unnamed"} → ${d?.name ?? "department"}`;
    },
    fields: (r) => {
      const answers = Array.isArray(r.answers) ? (r.answers as { label?: string; answer?: string }[]) : [];
      return [
        { name: "Discord", value: user(r.discordId), inline: true },
        { name: "Current rank", value: clip(str(r.currentRank), 100), inline: true },
        ...answers.slice(0, 8).map((a) => ({ name: clip(a.label ?? "Question", 250), value: clip(a.answer) })),
      ];
    },
    takesNote: true,
  },
];

function detailEmbed(q: Queue, row: Row): EmbedBuilder {
  return embed(row.status === "Pending" ? COLORS.warning : row.status === "Approved" ? COLORS.success : COLORS.neutral)
    .setTitle(`${q.label} · ${clip(q.title(row), 200)}`)
    .addFields(
      { name: "Status", value: statusBadge(row.status), inline: true },
      { name: "Submitted", value: discordTime(row.createdAt, "R"), inline: true },
      ...q.fields(row)
    )
    .setFooter({ text: `ID ${row.id}` });
}

function reviewButtons(q: Queue, row: Row) {
  if (row.status !== "Pending") return [];
  const components = [];
  if (q.needsRank) {
    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(customId(q.name, "rank", row.id))
          .setPlaceholder("Approve with starting rank…")
          .addOptions(RANKS.map((r) => ({ label: r, value: r })))
      )
    );
  }
  const buttons = new ActionRowBuilder<ButtonBuilder>();
  if (!q.needsRank) {
    buttons.addComponents(
      new ButtonBuilder().setCustomId(customId(q.name, "approve", row.id)).setLabel("Approve").setStyle(ButtonStyle.Success)
    );
  }
  buttons.addComponents(
    new ButtonBuilder().setCustomId(customId(q.name, "decline", row.id)).setLabel("Decline").setStyle(ButtonStyle.Danger)
  );
  components.push(buttons);
  return components;
}

async function review(
  interaction: RepliableInteraction,
  q: Queue,
  id: string,
  status: "Approved" | "Declined",
  extra: { note?: string | null; rank?: string | null }
) {
  const actor = actorOf(interaction);
  const body: Record<string, unknown> = { status };
  if (q.takesNote && extra.note) body.reviewNote = extra.note;
  if (q.needsRank && extra.rank) body.assignedRank = extra.rank;

  await api(actor, "PATCH", q.itemPath(encodeURIComponent(id)), body);
  const row = await findRow(interaction, q, id);
  invalidateRoster();
  await staffLog(
    interaction.client,
    actor,
    `${status === "Approved" ? "Approved" : "Declined"} a ${q.label.toLowerCase()} application`,
    `${row ? q.title(row) : id}${extra.rank ? ` · rank ${extra.rank}` : ""}${extra.note ? `\nNote: ${extra.note}` : ""}`
  );
  return row;
}

async function findRow(interaction: RepliableInteraction, q: Queue, id: string) {
  const rows = await api<Row[]>(actorOf(interaction), "GET", q.listPath);
  return rows.find((r) => r.id === id) ?? null;
}

function build(q: Queue): Command {
  const data = new SlashCommandBuilder()
    .setName(q.name)
    .setDescription(q.description)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("pending").setDescription(`Everything waiting for review`))
    .addSubcommand((s) =>
      s
        .setName("view")
        .setDescription("Open one application, with approve and decline buttons")
        .addStringOption((o) => o.setName("id").setDescription("Application").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) => {
      s.setName("approve")
        .setDescription("Approve an application")
        .addStringOption((o) => o.setName("id").setDescription("Application").setRequired(true).setAutocomplete(true));
      if (q.needsRank) {
        s.addStringOption((o) =>
          o
            .setName("rank")
            .setDescription("Starting rank")
            .setRequired(true)
            .addChoices(...RANKS.map((r) => ({ name: r, value: r })))
        );
      }
      if (q.takesNote) s.addStringOption((o) => o.setName("note").setDescription("Review note (optional)").setMaxLength(500));
      return s;
    })
    .addSubcommand((s) => {
      s.setName("decline")
        .setDescription("Decline an application")
        .addStringOption((o) => o.setName("id").setDescription("Application").setRequired(true).setAutocomplete(true));
      if (q.takesNote) s.addStringOption((o) => o.setName("note").setDescription("Reason (optional)").setMaxLength(500));
      return s;
    });

  async function execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);
    try {
      await interaction.deferReply(EPHEMERAL);

      if (sub === "pending") {
        const rows = (await api<Row[]>(actor, "GET", q.listPath)).filter((r) => r.status === "Pending");
        const e = embed(rows.length ? COLORS.warning : COLORS.success).setTitle(`${q.label} · ${rows.length} pending`);
        e.setDescription(
          rows.length === 0
            ? "The queue is clear. 🎉"
            : rows
                .slice(0, 15)
                .map((r) => `🟡 **${clip(q.title(r), 90)}** · ${discordTime(r.createdAt, "R")}\n\`${r.id}\``)
                .join("\n\n") + (rows.length > 15 ? `\n\n…and ${rows.length - 15} more.` : "") + `\n\nOpen one with \`/${q.name} view\`.`
        );
        await interaction.editReply({ embeds: [e] });
        return;
      }

      const id = interaction.options.getString("id", true);

      if (sub === "view") {
        const row = await findRow(interaction, q, id);
        if (!row) {
          await interaction.editReply({ embeds: [failure("Not found", "No application with that ID.")] });
          return;
        }
        await interaction.editReply({ embeds: [detailEmbed(q, row)], components: reviewButtons(q, row) });
        return;
      }

      const status = sub === "approve" ? "Approved" : "Declined";
      const row = await review(interaction, q, id, status, {
        note: q.takesNote ? interaction.options.getString("note") : null,
        rank: q.needsRank && sub === "approve" ? interaction.options.getString("rank", true) : null,
      });
      await interaction.editReply({
        embeds: [success(`Application ${status.toLowerCase()}`, "The applicant has been notified as configured on the website."), ...(row ? [detailEmbed(q, row)] : [])],
      });
    } catch (err) {
      await respondError(interaction, err);
    }
  }

  return {
    data,
    execute,

    async autocomplete(interaction) {
      try {
        const sub = interaction.options.getSubcommand();
        const rows = await api<Row[]>(actorOf(interaction), "GET", q.listPath);
        const needle = interaction.options.getFocused().toLowerCase();
        const choices = rows
          .filter((r) => sub === "view" || r.status === "Pending")
          .filter((r) => !needle || q.title(r).toLowerCase().includes(needle) || r.id.includes(needle))
          .slice(0, 25)
          .map((r) => ({ name: clip(`${r.status} · ${q.title(r)} · ${date(r.createdAt)}`, 100), value: r.id }));
        await interaction.respond(choices);
      } catch {
        await interaction.respond([]).catch(() => {});
      }
    },

    async button(interaction, action, id) {
      if (action === "decline" && q.takesNote) {
        // Ask for a reason first; the modal submit does the decline.
        const modal = new ModalBuilder()
          .setCustomId(customId(q.name, "decline", id))
          .setTitle("Decline application")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("note")
                .setLabel("Reason (optional)")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(500)
            )
          );
        await interaction.showModal(modal);
        return;
      }
      if (action !== "approve" && action !== "decline") return;
      try {
        await interaction.deferUpdate();
        const row = await review(interaction, q, id, action === "approve" ? "Approved" : "Declined", {});
        await interaction.editReply({ embeds: row ? [detailEmbed(q, row)] : [success("Done")], components: [] });
      } catch (err) {
        await respondError(interaction, err);
      }
    },

    async select(interaction, action, id) {
      if (action !== "rank") return;
      try {
        await interaction.deferUpdate();
        const row = await review(interaction, q, id, "Approved", { rank: interaction.values[0] });
        await interaction.editReply({ embeds: row ? [detailEmbed(q, row)] : [success("Approved")], components: [] });
      } catch (err) {
        await respondError(interaction, err);
      }
    },

    async modal(interaction, action, id) {
      if (action !== "decline") return;
      try {
        await interaction.deferReply(EPHEMERAL);
        const note = interaction.fields.getTextInputValue("note").trim() || null;
        const row = await review(interaction, q, id, "Declined", { note });
        await interaction.editReply({ embeds: [success("Application declined"), ...(row ? [detailEmbed(q, row)] : [])] });
      } catch (err) {
        await respondError(interaction, err);
      }
    },
  };
}

export const applicationCommands = QUEUES.map(build);

/** Pending counts for the /ems overview. */
export async function pendingCounts(interaction: RepliableInteraction) {
  const actor = actorOf(interaction);
  return Promise.all(
    QUEUES.map(async (q) => {
      try {
        const rows = await api<Row[]>(actor, "GET", q.listPath);
        return { label: q.label, command: q.name, count: rows.filter((r) => r.status === "Pending").length };
      } catch {
        return { label: q.label, command: q.name, count: null as number | null };
      }
    })
  );
}
