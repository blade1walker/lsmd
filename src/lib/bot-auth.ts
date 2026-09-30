import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import type { Access } from "./access";

/**
 * Requests from the Nexus EMS Discord bot.
 *
 * The bot calls the same API routes the panel does, so an approval made in
 * Discord sends the same DM, posts the same webhook and writes the same audit
 * entry as one made on the site. It proves itself with NEXUS_BOT_API_KEY and
 * names the Discord user who ran the command, which is who the audit log
 * credits.
 *
 * Who may run which command is decided in Discord — Server Settings →
 * Integrations → Nexus EMS Bot — not here. A bot request therefore carries
 * full access, which makes the key a master credential: it lives only in the
 * site's and the bot's environment, and the path is off unless it is set to
 * something long enough to be unguessable.
 */

const KEY_HEADER = "x-nexus-bot-key";
const ACTOR_ID_HEADER = "x-nexus-actor-id";
const ACTOR_NAME_HEADER = "x-nexus-actor-name";

/** Below this the key is treated as unset — a short key is a guessable one. */
const MIN_KEY_LENGTH = 32;

function keyMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The bot's access for this request, or null when it is not a bot request.
 * A request that presents a wrong key is also null — it falls through to the
 * normal session check and fails there like any other unauthenticated call.
 */
export async function resolveBotAccess(): Promise<Access | null> {
  const expected = process.env.NEXUS_BOT_API_KEY?.trim() ?? "";
  if (expected.length < MIN_KEY_LENGTH) return null;

  let list: Headers;
  try {
    list = await headers();
  } catch {
    return null;
  }

  const given = list.get(KEY_HEADER)?.trim();
  if (!given || !keyMatches(given, expected)) return null;

  const actorId = list.get(ACTOR_ID_HEADER)?.trim();
  if (!actorId || !/^\d{15,22}$/.test(actorId)) return null;
  const actorName = decodeURIComponent(list.get(ACTOR_NAME_HEADER) ?? "").slice(0, 80) || actorId;

  const member = await prisma.member.findFirst({
    where: { discordId: actorId },
    select: { id: true, name: true, rank: true },
  });

  return {
    discordId: actorId,
    allowed: true,
    denialReason: null,
    isSuperAdmin: true,
    isMember: !!member,
    memberId: member?.id ?? null,
    // Audit entries read "<name> (via Discord)", so a change made through the
    // bot is told apart from one made on the site.
    memberName: `${member?.name ?? actorName} (via Discord)`,
    memberRank: member?.rank ?? null,
    roleName: "Nexus EMS Bot",
    roleNames: ["Nexus EMS Bot"],
    permissions: [],
  };
}
