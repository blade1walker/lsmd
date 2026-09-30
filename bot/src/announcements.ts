import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type GuildBasedChannel,
  type MessageCreateOptions,
} from "discord.js";
import { api, type Actor } from "./api.js";
import { config } from "./config.js";
import { embed } from "./ui.js";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  channelId: string;
  mention: string;
  color: number;
  imageUrl: string | null;
  footer: string | null;
  scheduledFor: string;
  repeat: "none" | "daily" | "weekly";
  status: "Scheduled" | "Sending" | "Sent" | "Failed" | "Cancelled";
  sentAt: string | null;
  messageUrl: string | null;
  error: string | null;
  createdByName: string;
  createdByDiscordId: string;
  cancelledByName: string | null;
}

export const COLOR_CHOICES = [
  { name: "EMS Red", value: 0xdc2626 },
  { name: "Medical Blue", value: 0x2563eb },
  { name: "Success Green", value: 0x16a34a },
  { name: "Advisory Amber", value: 0xd97706 },
  { name: "Command Gold", value: 0xca8a04 },
  { name: "Neutral Grey", value: 0x52525b },
] as const;

/** The channel kinds an announcement can go to. */
export const ANNOUNCE_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;

export function mentionText(mention: string) {
  if (mention === "everyone") return "@everyone";
  if (mention === "here") return "@here";
  if (mention.startsWith("role:")) return `<@&${mention.slice(5)}>`;
  return "";
}

/** The post itself: a formal notice embed, with the ping above it so it notifies. */
export function buildAnnouncement(a: Pick<Announcement, "title" | "message" | "color" | "imageUrl" | "footer" | "mention">) {
  const e = embed(a.color)
    .setAuthor({ name: `${config.brandName} · Official Announcement`, iconURL: config.logoUrl })
    .setTitle(a.title)
    .setDescription(a.message)
    .setFooter({ text: a.footer || config.brandName, iconURL: config.logoUrl });
  if (a.imageUrl) e.setImage(a.imageUrl);
  if (config.logoUrl) e.setThumbnail(config.logoUrl);

  const ping = mentionText(a.mention);
  const options: MessageCreateOptions = {
    content: ping || undefined,
    embeds: [e],
    allowedMentions:
      a.mention === "everyone" || a.mention === "here"
        ? { parse: ["everyone"] }
        : a.mention.startsWith("role:")
          ? { roles: [a.mention.slice(5)] }
          : { parse: [] },
  };
  return options;
}

/**
 * Why the bot could not post in a channel, or null when it can. Checked before
 * scheduling, so a post that would fail at 09:00 tomorrow fails now instead,
 * while the person scheduling it is still looking.
 */
export function cannotPost(channel: GuildBasedChannel, mention: string): string | null {
  const me = channel.guild.members.me;
  if (!me) return "The bot is not in that server.";
  const perms = channel.permissionsFor(me);
  const missing: string[] = [];
  if (!perms.has(PermissionFlagsBits.ViewChannel)) missing.push("View Channel");
  if (!perms.has(PermissionFlagsBits.SendMessages)) missing.push("Send Messages");
  if (!perms.has(PermissionFlagsBits.EmbedLinks)) missing.push("Embed Links");
  if ((mention === "everyone" || mention === "here") && !perms.has(PermissionFlagsBits.MentionEveryone)) {
    missing.push("Mention @everyone, @here and All Roles");
  }
  return missing.length ? `The bot is missing ${missing.join(", ")} in <#${channel.id}>.` : null;
}

/**
 * Posts one claimed announcement and reports the outcome to the website.
 * Returns the message link on success. Always reports — a post left in
 * "Sending" would otherwise wait out the stale-claim window and go out twice.
 */
export async function deliver(client: Client, actor: Actor, a: Announcement): Promise<{ ok: boolean; url?: string; error?: string }> {
  let outcome: { ok: boolean; url?: string; error?: string };
  try {
    const channel = await client.channels.fetch(a.channelId);
    if (!channel || channel.isDMBased() || !channel.isSendable()) {
      outcome = { ok: false, error: "The channel no longer exists, or is not a text channel." };
    } else {
      const blocked = cannotPost(channel, a.mention);
      if (blocked) {
        outcome = { ok: false, error: blocked };
      } else {
        const message = await channel.send(buildAnnouncement(a));
        // Announcement channels can push to following servers.
        if (channel.type === ChannelType.GuildAnnouncement) await message.crosspost().catch(() => {});
        outcome = { ok: true, url: message.url };
      }
    }
  } catch (err) {
    outcome = { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }

  try {
    await api(actor, "POST", `/api/announcements/${a.id}/result`, {
      ok: outcome.ok,
      messageUrl: outcome.url,
      error: outcome.error,
    });
  } catch (err) {
    console.error(`[announce] posted ${a.id} but could not record the result:`, err);
  }
  return outcome;
}
