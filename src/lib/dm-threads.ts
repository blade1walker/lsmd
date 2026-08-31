import { prisma } from "./prisma";

/**
 * Persistence for bot DM conversations.
 *
 * Deliberately holds no Discord calls and imports nothing but Prisma, so
 * discord-webhook.ts can record every DM it sends through here without a
 * circular import. The Discord side lives in discord-dm.ts, which imports
 * both.
 */

export type Direction = "in" | "out";

/** Discord refuses a message body over 2000 characters. */
export const DM_MAX_LENGTH = 2000;

export interface RecordedMessage {
  discordId: string;
  direction: Direction;
  content: string;
  /** Discord's own message id, when known — the dedupe key for re-syncs. */
  discordMessageId?: string | null;
  /** The DM channel, when the caller already opened it — cached for later syncs. */
  channelId?: string | null;
  /** Dotted automation name ("recruit.approved"), or "manual". */
  event?: string;
  /** Panel user behind a manual send. */
  sentBy?: string | null;
  ok?: boolean;
  error?: string | null;
  sentAt?: Date;
}

/**
 * Finds or creates the thread for a Discord user, filling in the roster name
 * when one matches. Called on every recorded message, so a conversation
 * appears in the panel the first time the bot writes to someone — an admin
 * does not have to open a thread before automated DMs are captured.
 */
export async function upsertThread(
  discordId: string,
  patch: { channelId?: string | null; username?: string | null } = {}
) {
  const member = await prisma.member.findFirst({
    where: { discordId },
    select: { id: true, name: true },
  });

  const data = {
    ...(patch.channelId !== undefined ? { channelId: patch.channelId } : {}),
    // Never blank a name we already have just because this caller didn't look it up.
    ...(patch.username ? { username: patch.username } : {}),
    memberId: member?.id ?? null,
    memberName: member?.name ?? null,
  };

  return prisma.dMThread.upsert({
    where: { discordId },
    create: { discordId, ...data },
    update: data,
  });
}

/**
 * Stores one message and moves the thread's clock forward.
 *
 * Never throws: this runs alongside sends that have already happened, and a
 * bookkeeping failure must not turn a delivered DM into a 500 for the caller.
 * Returns null when nothing was written.
 */
export async function recordDirectMessage(entry: RecordedMessage) {
  if (!entry.discordId) return null;

  try {
    const thread = await upsertThread(entry.discordId, { channelId: entry.channelId ?? undefined });
    const sentAt = entry.sentAt ?? new Date();

    // A re-sync re-reads messages it has already stored. Discord's id is the
    // dedupe key; outbound automated sends have none and are always new rows.
    if (entry.discordMessageId) {
      const existing = await prisma.directMessage.findUnique({
        where: { discordMessageId: entry.discordMessageId },
        select: { id: true },
      });
      if (existing) return null;
    }

    const message = await prisma.directMessage.create({
      data: {
        threadId: thread.id,
        direction: entry.direction,
        content: entry.content.slice(0, DM_MAX_LENGTH),
        discordMessageId: entry.discordMessageId ?? null,
        event: entry.event ?? "manual",
        sentBy: entry.sentBy ?? null,
        ok: entry.ok ?? true,
        error: entry.error ?? null,
        sentAt,
      },
    });

    // A failed send still belongs in the transcript, but it is not activity —
    // bumping the thread for it would float dead conversations to the top.
    if (entry.ok !== false) {
      await prisma.dMThread.updateMany({
        where: { id: thread.id, lastMessageAt: { lt: sentAt } },
        data: { lastMessageAt: sentAt },
      });
    }

    return message;
  } catch (error) {
    console.error("Failed to record direct message:", error);
    return null;
  }
}

/** Marks everything currently in the thread as read. */
export async function markThreadRead(discordId: string) {
  try {
    await prisma.dMThread.updateMany({
      where: { discordId },
      data: { lastReadAt: new Date() },
    });
  } catch (error) {
    console.error("Failed to mark thread read:", error);
  }
}
