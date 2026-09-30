import { prisma } from "./prisma";

/**
 * Discord announcements posted by the Nexus EMS bot.
 *
 * The site stores them; the bot delivers them. A post is created "Scheduled"
 * (or "Sending", for one posted right away), the bot claims due posts from
 * /api/announcements/claim, sends them, and reports back to
 * /api/announcements/[id]/result. Claiming is a conditional update, so two
 * bot processes — a restart overlapping the old one — never post twice.
 */

export const REPEATS = ["none", "daily", "weekly"] as const;
export type Repeat = (typeof REPEATS)[number];

const REPEAT_MS: Record<Repeat, number> = { none: 0, daily: 86_400_000, weekly: 7 * 86_400_000 };

/** A claim older than this is treated as a bot that died mid-send, and is re-offered. */
export const STALE_CLAIM_MS = 5 * 60_000;

/** Embed limits: Discord rejects the whole post past these. */
const MAX_TITLE = 256;
const MAX_MESSAGE = 4000;
const MAX_FOOTER = 200;
const MAX_AHEAD_MS = 366 * 86_400_000;

export interface AnnouncementInput {
  title: string;
  message: string;
  channelId: string;
  mention: string;
  color: number;
  imageUrl: string | null;
  footer: string | null;
  scheduledFor: Date;
  repeat: Repeat;
}

const SNOWFLAKE = /^\d{15,22}$/;

function isMention(value: string) {
  return value === "none" || value === "everyone" || value === "here" || /^role:\d{15,22}$/.test(value);
}

/**
 * Validates a create (partial: false) or an edit (partial: true). Returns the
 * clean fields, or the first problem in words a Discord user can act on.
 */
export function parseAnnouncement(
  body: Record<string, unknown>,
  partial: boolean
): { ok: true; data: Partial<AnnouncementInput> } | { ok: false; error: string } {
  const data: Partial<AnnouncementInput> = {};
  const has = (key: string) => body[key] !== undefined;

  if (!partial || has("title")) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return { ok: false, error: "A title is required." };
    if (title.length > MAX_TITLE) return { ok: false, error: `The title is over ${MAX_TITLE} characters.` };
    data.title = title;
  }

  if (!partial || has("message")) {
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return { ok: false, error: "A message is required." };
    if (message.length > MAX_MESSAGE) return { ok: false, error: `The message is over ${MAX_MESSAGE} characters.` };
    data.message = message;
  }

  if (!partial || has("channelId")) {
    const channelId = String(body.channelId ?? "");
    if (!SNOWFLAKE.test(channelId)) return { ok: false, error: "Pick a valid channel." };
    data.channelId = channelId;
  }

  if (!partial || has("mention")) {
    const mention = String(body.mention ?? "none");
    if (!isMention(mention)) return { ok: false, error: "Unknown mention option." };
    data.mention = mention;
  }

  if (!partial || has("color")) {
    const color = body.color === undefined ? 0xdc2626 : Number(body.color);
    if (!Number.isInteger(color) || color < 0 || color > 0xffffff) return { ok: false, error: "Invalid colour." };
    data.color = color;
  }

  if (!partial || has("imageUrl")) {
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    if (imageUrl && !/^https:\/\/\S+$/.test(imageUrl)) return { ok: false, error: "The image must be an https:// link." };
    data.imageUrl = imageUrl || null;
  }

  if (!partial || has("footer")) {
    const footer = typeof body.footer === "string" ? body.footer.trim() : "";
    if (footer.length > MAX_FOOTER) return { ok: false, error: `The footer is over ${MAX_FOOTER} characters.` };
    data.footer = footer || null;
  }

  if (!partial || has("repeat")) {
    const repeat = String(body.repeat ?? "none");
    if (!(REPEATS as readonly string[]).includes(repeat)) return { ok: false, error: "Repeat must be none, daily or weekly." };
    data.repeat = repeat as Repeat;
  }

  if (!partial || has("scheduledFor")) {
    const when = body.scheduledFor === undefined || body.scheduledFor === null ? new Date() : new Date(String(body.scheduledFor));
    if (Number.isNaN(when.getTime())) return { ok: false, error: "That date and time could not be read." };
    if (when.getTime() - Date.now() > MAX_AHEAD_MS) return { ok: false, error: "Announcements can be scheduled up to a year ahead." };
    data.scheduledFor = when;
  }

  return { ok: true, data };
}

/** The first occurrence of a repeating post that is still in the future. */
export function nextOccurrence(from: Date, repeat: Repeat, now = new Date()): Date | null {
  const step = REPEAT_MS[repeat];
  if (!step) return null;
  let next = from.getTime() + step;
  // A bot that was down for days posts the missed one once, then resumes the
  // cadence — rather than firing every missed occurrence back to back.
  while (next <= now.getTime()) next += step;
  return new Date(next);
}

/** Due posts, claimed for this caller. Safe to call concurrently. */
export async function claimDueAnnouncements(limit = 10) {
  const now = new Date();
  const candidates = await prisma.announcement.findMany({
    where: {
      OR: [
        { status: "Scheduled", scheduledFor: { lte: now } },
        { status: "Sending", claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
      ],
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
    select: { id: true, status: true, claimedAt: true },
  });

  const claimed: string[] = [];
  for (const c of candidates) {
    // Conditional on the state just read, so a second claimer loses the race
    // instead of posting the same announcement again.
    const won = await prisma.announcement.updateMany({
      where: { id: c.id, status: c.status, claimedAt: c.claimedAt },
      data: { status: "Sending", claimedAt: now },
    });
    if (won.count === 1) claimed.push(c.id);
  }

  if (claimed.length === 0) return [];
  return prisma.announcement.findMany({ where: { id: { in: claimed } }, orderBy: { scheduledFor: "asc" } });
}
