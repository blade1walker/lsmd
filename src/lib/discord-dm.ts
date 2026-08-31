import { prisma } from "./prisma";
import { resolveBotToken } from "./discord-webhook";
import { recordDirectMessage, upsertThread } from "./dm-threads";

/**
 * Reading a DM conversation back from Discord.
 *
 * A bot cannot list its existing DM channels — `GET /users/@me/channels`
 * returns an empty array for bots. Opening a DM is idempotent though, so
 * POSTing the recipient returns the existing channel, and its message history
 * can then be read over REST. That is how a reply reaches this panel without
 * a gateway connection, which a serverless deployment cannot hold open.
 *
 * The message content intent does not apply here: a bot always receives the
 * content of DMs sent to it, whether or not it is approved for the intent.
 */

const API = "https://discord.com/api/v10";

/** One page of history. Discord caps this at 100. */
const SYNC_LIMIT = 100;

export interface DiscordUserSummary {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}

interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  author: { id: string; username?: string; global_name?: string | null; bot?: boolean };
}

export type SyncResult =
  | { ok: true; added: number; channelId: string }
  | { ok: false; error: string };

function authHeaders(token: string) {
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

export async function lookupDiscordUser(discordId: string): Promise<DiscordUserSummary | null> {
  const token = await resolveBotToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API}/users/${discordId}`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    const user = await res.json();
    return {
      id: user.id,
      username: user.username,
      globalName: user.global_name ?? null,
      avatar: user.avatar ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * The DM channel for a user, opening it if this is the first contact. Cached
 * on the thread, since opening costs a round trip and the id never changes.
 */
export async function resolveDmChannel(
  discordId: string,
  token: string
): Promise<{ channelId: string } | { error: string }> {
  const thread = await prisma.dMThread.findUnique({
    where: { discordId },
    select: { channelId: true },
  });
  if (thread?.channelId) return { channelId: thread.channelId };

  try {
    const res = await fetch(`${API}/users/@me/channels`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ recipient_id: discordId }),
    });

    if (!res.ok) {
      return {
        error:
          res.status === 403
            ? "Cannot open a DM with this user — they share no server with the bot, or have DMs disabled"
            : `Discord returned ${res.status} opening the DM channel`,
      };
    }

    const channel = await res.json();
    if (!channel?.id) return { error: "Discord returned no channel id" };

    await upsertThread(discordId, { channelId: channel.id });
    return { channelId: channel.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message.slice(0, 200) : "Network error" };
  }
}

/**
 * Pulls recent history for one conversation and stores anything new.
 *
 * Both directions are stored: the bot's own messages come back too, which is
 * how a DM sent from somewhere other than this panel still shows up in the
 * transcript. recordDirectMessage dedupes on Discord's message id, so this is
 * safe to run as often as the panel likes.
 */
export async function syncThread(discordId: string): Promise<SyncResult> {
  const token = await resolveBotToken();
  if (!token) return { ok: false, error: "No bot token configured" };

  const channel = await resolveDmChannel(discordId, token);
  if ("error" in channel) return { ok: false, error: channel.error };

  try {
    const res = await fetch(
      `${API}/channels/${channel.channelId}/messages?limit=${SYNC_LIMIT}`,
      { headers: authHeaders(token) }
    );

    if (!res.ok) {
      return { ok: false, error: `Discord returned ${res.status} reading the conversation` };
    }

    const messages = (await res.json()) as DiscordMessage[];
    if (!Array.isArray(messages)) return { ok: false, error: "Unexpected response from Discord" };

    let added = 0;
    let username: string | null = null;

    // Oldest first, so lastMessageAt ends up on the newest one.
    for (const message of [...messages].reverse()) {
      const outbound = message.author?.bot === true;
      if (!outbound) username = message.author?.global_name || message.author?.username || username;

      // Discord keeps an empty content for attachment-only messages; store a
      // marker so the transcript shows that something arrived.
      const content = message.content?.trim() || (outbound ? "" : "[attachment or embed]");
      if (!content) continue;

      const stored = await recordDirectMessage({
        discordId,
        direction: outbound ? "out" : "in",
        content,
        discordMessageId: message.id,
        event: outbound ? "discord" : "reply",
        sentAt: new Date(message.timestamp),
        channelId: channel.channelId,
      });
      if (stored) added++;
    }

    if (username) await upsertThread(discordId, { username });

    return { ok: true, added, channelId: channel.channelId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "Network error" };
  }
}
