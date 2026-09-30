import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type RepliableInteraction,
} from "discord.js";
import { config } from "./config.js";
import { ApiError, type Actor } from "./api.js";

/** The website's palette, so a post reads as part of the same department. */
export const COLORS = {
  brand: 0xdc2626,
  success: 0x16a34a,
  warning: 0xd97706,
  danger: 0xb91c1c,
  info: 0x2563eb,
  neutral: 0x3f3f46,
} as const;

export function actorOf(interaction: Interaction): Actor {
  const member = interaction.member;
  const nick = member && "displayName" in member ? member.displayName : null;
  return { id: interaction.user.id, name: nick || interaction.user.globalName || interaction.user.username };
}

/** A branded embed with the department footer. */
export function embed(color: number = COLORS.brand) {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: config.brandName, iconURL: config.logoUrl })
    .setTimestamp();
}

export function success(title: string, description?: string) {
  const e = embed(COLORS.success).setTitle(`✅  ${title}`);
  return description ? e.setDescription(description) : e;
}

export function failure(title: string, description?: string) {
  const e = embed(COLORS.danger).setTitle(`⛔  ${title}`);
  return description ? e.setDescription(description) : e;
}

/** Truncates to Discord's per-field limits instead of letting the whole reply fail. */
export function clip(text: string | null | undefined, max = 1024) {
  const value = (text ?? "").trim() || "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export const EPHEMERAL = { flags: MessageFlags.Ephemeral } as const;

type Replyable = ChatInputCommandInteraction | ModalSubmitInteraction;

/** Replies, or edits the deferred reply — whichever the interaction is ready for. */
export async function respond(interaction: Replyable, embeds: EmbedBuilder[], ephemeral = true) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds });
  } else {
    await interaction.reply({ embeds, ...(ephemeral ? EPHEMERAL : {}) });
  }
}

/** Turns a thrown error into a reply the user can act on. */
export async function respondError(interaction: RepliableInteraction, err: unknown) {
  const message =
    err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong.";
  if (!(err instanceof ApiError)) console.error(err);
  const payload = { embeds: [failure("Could not complete that", clip(message, 4000))] };
  try {
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.reply({ ...payload, ...EPHEMERAL });
  } catch {
    // The interaction expired; nothing left to tell the user through.
  }
}

/** "Pending" → "🟡 Pending", for status fields across every command. */
export function statusBadge(status: string) {
  const icon: Record<string, string> = {
    Pending: "🟡",
    Scheduled: "🗓️",
    Sending: "📤",
    Approved: "🟢",
    Active: "🟢",
    Sent: "🟢",
    Declined: "🔴",
    Failed: "🔴",
    Cancelled: "⚪",
    Expired: "⚪",
    Reserve: "🔵",
    LOA: "🟠",
  };
  return `${icon[status] ?? "▫️"} ${status}`;
}
