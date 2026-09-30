import type { Client } from "discord.js";
import { config } from "./config.js";
import { embed, COLORS, clip } from "./ui.js";

/**
 * A line in the staff log channel for every change made through the bot. The
 * website's audit log records the same actions; this is the copy staff see
 * without opening the panel. Never throws — a log channel the bot cannot post
 * in must not fail the action it describes.
 */
export async function staffLog(client: Client, actor: { id: string }, action: string, detail?: string) {
  if (!config.logChannelId) return;
  try {
    const channel = await client.channels.fetch(config.logChannelId);
    if (!channel?.isSendable()) return;
    const e = embed(COLORS.neutral)
      .setAuthor({ name: "Bot action" })
      .setDescription(`**${clip(action, 250)}**\nby <@${actor.id}>${detail ? `\n\n${clip(detail, 3500)}` : ""}`);
    await channel.send({ embeds: [e], allowedMentions: { parse: [] } });
  } catch (err) {
    console.warn("[log] could not post to LOG_CHANNEL_ID:", err instanceof Error ? err.message : err);
  }
}
