import { BOT_TOKEN_REJECTED, resolveBotToken } from "./discord-webhook";

/**
 * Adds/removes a Discord server (guild) role on a member — distinct from the
 * webhook posts and DMs in discord-webhook.ts, which never touch guild
 * membership. Requires a bot token with Manage Roles, positioned above the
 * target role in the server's role list, plus DISCORD_GUILD_ID. The token
 * itself is resolved the same way DMs resolve theirs — the one configured in
 * admin > notification settings wins, DISCORD_BOT_TOKEN is the fallback —
 * so a token set only in the admin UI still lets role grants work.
 *
 * Every function here degrades to a silent no-op when its configuration is
 * missing, matching how the rest of the app treats DISCORD_BOT_TOKEN — inert
 * rather than broken until it's set up.
 */

async function setGuildRole(discordId: string, roleId: string, action: "add" | "remove"): Promise<boolean> {
  const botToken = await resolveBotToken();
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!botToken || !guildId) return false;

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`,
      {
        method: action === "add" ? "PUT" : "DELETE",
        headers: { Authorization: `Bot ${botToken}` },
      }
    );
    // Discord returns 204 with an empty body on success for both verbs.
    if (!res.ok) {
      console.error(
        `Failed to ${action} Discord role ${roleId} for ${discordId}: ${res.status} ${await res.text()}`
      );
    }
    return res.ok;
  } catch (err) {
    console.error(`Failed to ${action} Discord role ${roleId} for ${discordId}:`, err);
    return false;
  }
}

/**
 * Grants a department's configured guild role. Departments each carry their
 * own optional discordRoleId, so this takes the role rather than reading one
 * fixed env var the way the FTP helpers below do.
 */
export async function addDepartmentDiscordRole(
  discordId: string,
  roleId: string | null | undefined
): Promise<boolean> {
  if (!discordId || !roleId) return false;
  return setGuildRole(discordId, roleId, "add");
}

export async function removeDepartmentDiscordRole(
  discordId: string,
  roleId: string | null | undefined
): Promise<boolean> {
  if (!discordId || !roleId) return false;
  return setGuildRole(discordId, roleId, "remove");
}

export async function addFtpDiscordRole(discordId: string): Promise<boolean> {
  const roleId = process.env.DISCORD_FTP_ROLE_ID;
  if (!roleId) return false;
  return setGuildRole(discordId, roleId, "add");
}

export async function removeFtpDiscordRole(discordId: string): Promise<boolean> {
  const roleId = process.env.DISCORD_FTP_ROLE_ID;
  if (!roleId) return false;
  return setGuildRole(discordId, roleId, "remove");
}

// ─── Discord REST, with reasons ─────────────────────────────────────────────

export interface DiscordResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Discord's JSON error code (50013 Missing Permissions, 10007 Unknown Member, …). */
  code: number | null;
  /** Readable reason for a failure, for showing to the person who asked. */
  error: string | null;
}

const DISCORD_REASONS: Record<number, string> = {
  10004: "The bot is not in that Discord server — check the server ID",
  10007: "Not in the Discord server",
  10011: "The role no longer exists in Discord",
  10013: "Unknown Discord user",
  50001: "The bot cannot see the Discord server",
  50013: "The bot is missing Manage Roles, or its own role is below the role it is trying to give — move the bot's role higher in Server Settings → Roles",
  50035: "Discord rejected the request",
};

/**
 * One call to the Discord API as the bot, waiting out a rate limit (up to
 * twice) rather than failing a roster change because Discord said "slow
 * down". Never throws: the result says what went wrong.
 */
export async function discordRest<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; reason?: string } = {}
): Promise<DiscordResult<T>> {
  const token = await resolveBotToken();
  if (!token) return { ok: false, status: 0, data: null, code: null, error: "No Discord bot token is set" };

  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`https://discord.com/api/v10${path}`, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bot ${token}`,
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(init.reason ? { "X-Audit-Log-Reason": encodeURIComponent(init.reason) } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch {
      return { ok: false, status: 0, data: null, code: null, error: "Discord could not be reached" };
    }

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (res.status === 429 && attempt < 2) {
      const wait = Math.min(5, Number((data as { retry_after?: number } | null)?.retry_after ?? 1));
      await new Promise((r) => setTimeout(r, Math.max(0.2, wait) * 1000));
      continue;
    }
    if (res.ok) return { ok: true, status: res.status, data: data as T, code: null, error: null };

    const code = typeof (data as { code?: unknown } | null)?.code === "number" ? (data as { code: number }).code : null;
    const error =
      res.status === 401
        ? BOT_TOKEN_REJECTED
        : (code !== null && DISCORD_REASONS[code]) || `Discord answered ${res.status}`;
    return { ok: false, status: res.status, data: null, code, error };
  }
  return { ok: false, status: 429, data: null, code: null, error: "Discord kept rate limiting the bot — try again in a minute" };
}
