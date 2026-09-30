import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import type { Access } from "./access";

/**
 * Requests from the Nexus EMS Discord bot.
 *
 * The bot calls the same API routes the panel does, so an approval made in
 * Discord sends the same DM, posts the same webhook and writes the same audit
 * entry as one made on the site. It names the Discord user who ran the
 * command, which is who the audit log credits.
 *
 * It proves who it is in one of two ways:
 *
 *  - Its own Discord bot token (x-nexus-bot-token). The site asks Discord
 *    which application the token belongs to, and trusts it when that is the
 *    site's own application (DISCORD_CLIENT_ID — the one "Login with Discord"
 *    already uses). Nothing extra to configure, and no new secret: whoever
 *    holds the bot token can already act as the bot everywhere.
 *  - NEXUS_BOT_API_KEY (x-nexus-bot-key), a shared secret set on both sides,
 *    for a bot that should not send its token to the site.
 *
 * Who may run which command is decided in Discord — Server Settings →
 * Integrations → Nexus EMS Bot — not here, so a bot request carries full access.
 */

const KEY_HEADER = "x-nexus-bot-key";
const TOKEN_HEADER = "x-nexus-bot-token";
const ACTOR_ID_HEADER = "x-nexus-actor-id";
const ACTOR_NAME_HEADER = "x-nexus-actor-name";

/** Below this the key is treated as unset — a short key is a guessable one. */
const MIN_KEY_LENGTH = 32;

function clean(value: string | undefined | null) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

function keyMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Token checks, cached per server instance by the token's hash so a bot
 * polling every few seconds costs one Discord call per ten minutes, not one
 * per request. Failures are cached briefly so a wrong token cannot be used to
 * hammer Discord through the site.
 */
const tokenCache = new Map<string, { appId: string | null; error: string | null; until: number }>();
const OK_TTL_MS = 10 * 60_000;
const FAIL_TTL_MS = 60_000;

async function applicationOf(token: string): Promise<{ appId: string | null; error: string | null }> {
  const key = createHash("sha256").update(token).digest("hex");
  const hit = tokenCache.get(key);
  if (hit && hit.until > Date.now()) return hit;

  let result: { appId: string | null; error: string | null };
  try {
    const res = await fetch("https://discord.com/api/v10/applications/@me", {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.ok) {
      const app = (await res.json()) as { id?: string };
      result = { appId: app.id ?? null, error: null };
    } else {
      result = { appId: null, error: res.status === 401 ? "Discord says the bot's token is invalid." : `Discord answered ${res.status} checking the bot's token.` };
    }
  } catch {
    // Not cached as a failure: a network blip should not lock the bot out for a minute.
    return { appId: null, error: "The website could not reach Discord to check the bot's token. Try again." };
  }

  if (tokenCache.size > 50) tokenCache.clear();
  tokenCache.set(key, { ...result, until: Date.now() + (result.appId ? OK_TTL_MS : FAIL_TTL_MS) });
  return result;
}

export type BotAuth = { access: Access } | { denied: string } | null;

/**
 * The bot's access for this request; `{ denied }` with the reason when a bot
 * request fails to prove itself; null when this is not a bot request at all.
 */
export async function resolveBotAccess(): Promise<BotAuth> {
  let list: Headers;
  try {
    list = await headers();
  } catch {
    return null;
  }

  const givenKey = clean(list.get(KEY_HEADER));
  const givenToken = clean(list.get(TOKEN_HEADER)).replace(/^Bot\s+/i, "");
  if (!givenKey && !givenToken) return null;

  let verified = false;
  const reasons: string[] = [];

  const expectedKey = clean(process.env.NEXUS_BOT_API_KEY);
  if (givenKey) {
    if (expectedKey.length >= MIN_KEY_LENGTH && keyMatches(givenKey, expectedKey)) verified = true;
    else if (!expectedKey) reasons.push("NEXUS_BOT_API_KEY is not set on the website.");
    else if (expectedKey.length < MIN_KEY_LENGTH) reasons.push("NEXUS_BOT_API_KEY on the website is shorter than 32 characters, so it is ignored.");
    else reasons.push("NEXUS_BOT_API_KEY on the bot does not match the one on the website.");
  }

  if (!verified && givenToken) {
    const ownApp = clean(process.env.DISCORD_CLIENT_ID);
    if (!ownApp) {
      reasons.push("DISCORD_CLIENT_ID is not set on the website, so the bot's token cannot be checked.");
    } else {
      const { appId, error } = await applicationOf(givenToken);
      if (appId === ownApp) verified = true;
      else if (error) reasons.push(error);
      else reasons.push(`The bot belongs to Discord application ${appId}, but the website logs in with application ${ownApp}. Use the same application's bot token.`);
    }
  }

  if (!verified) return { denied: reasons.join(" ") || "The bot's credentials were not accepted." };

  const actorId = clean(list.get(ACTOR_ID_HEADER));
  if (!/^\d{15,22}$/.test(actorId)) return { denied: "The bot did not say which Discord user it is acting for." };
  const actorName = decodeURIComponent(list.get(ACTOR_NAME_HEADER) ?? "").slice(0, 80) || actorId;

  const member = await prisma.member.findFirst({
    where: { discordId: actorId },
    select: { id: true, name: true, rank: true },
  });

  return {
    access: {
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
    },
  };
}
