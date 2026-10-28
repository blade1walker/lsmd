import { prisma } from "../db/prisma";
import type { LoaSettings, Prisma } from "@/generated/prisma/client";
import { discordRest } from "../discord/roles";
import { resolveBotToken } from "../discord/webhook";

/**
 * The "EMS LOA" Discord role: held by every member while they are on leave.
 *
 * The roster is the source of truth — a member whose roster status is LOA
 * should hold the role, and nobody else on the roster should. Every place
 * that moves a member on or off leave calls setLoaRole; a full sync
 * (Admin → LOA, and the nightly LOA job) catches anything those missed and
 * gives the role to everyone already on leave when it is first set up.
 *
 * The role is found in the server by name, or created there, the first time
 * it is needed — nobody has to copy a role ID anywhere. DISCORD_LOA_ROLE_ID
 * pins a specific role instead.
 *
 * Nothing here throws. A roster change must never fail because Discord said
 * no; the result says why, and the page shows it.
 */

export const DEFAULT_LOA_ROLE_NAME = "EMS LOA";

/** Amber, the colour LOA has everywhere on the roster. */
const ROLE_COLOR = 0xf59e0b;

const AUDIT_REASON = "Leave of Absence — Nexus EMS website";

function snowflake(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return /^\d{15,22}$/.test(v) ? v : null;
}

export async function readLoaSettings(): Promise<LoaSettings | null> {
  try {
    return await prisma.loaSettings.findUnique({ where: { id: "singleton" } });
  } catch (error) {
    console.error("LOA settings could not be read:", error);
    return null;
  }
}

export async function ensureLoaSettings(): Promise<LoaSettings> {
  return prisma.loaSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
}

export function loaGuildId(settings: Pick<LoaSettings, "guildId"> | null): string | null {
  return snowflake(process.env.DISCORD_GUILD_ID) ?? snowflake(settings?.guildId);
}

function envRoleId(): string | null {
  return snowflake(process.env.DISCORD_LOA_ROLE_ID);
}

export type RoleResolution =
  | { ok: true; guildId: string; roleId: string; roleName: string; source: "env" | "saved" | "found" | "created" }
  | { ok: false; error: string };

/**
 * The role's id: pinned in the environment, saved from an earlier lookup,
 * found in the server by name, or — when the server has no such role —
 * created there. `verify` re-checks a saved id against the server's roles,
 * which the full sync does and a single change does not.
 */
async function resolveLoaRole(settings: LoaSettings, verify = false): Promise<RoleResolution> {
  const guildId = loaGuildId(settings);
  if (!guildId) {
    return { ok: false, error: "No Discord server is set — set DISCORD_GUILD_ID, or enter the server ID on Admin → LOA" };
  }
  const roleName = settings.roleName.trim() || DEFAULT_LOA_ROLE_NAME;

  const pinned = envRoleId();
  if (pinned) return { ok: true, guildId, roleId: pinned, roleName, source: "env" };
  if (settings.discordRoleId && !verify) return { ok: true, guildId, roleId: settings.discordRoleId, roleName, source: "saved" };

  const roles = await discordRest<{ id: string; name: string }[]>(`/guilds/${guildId}/roles`);
  if (!roles.ok || !Array.isArray(roles.data)) return { ok: false, error: roles.error ?? "Could not read the server's roles" };

  if (settings.discordRoleId && roles.data.some((r) => r.id === settings.discordRoleId)) {
    return { ok: true, guildId, roleId: settings.discordRoleId, roleName, source: "saved" };
  }

  const byName = roles.data.find((r) => r.name.trim().toLowerCase() === roleName.toLowerCase());
  if (byName) {
    await prisma.loaSettings.update({ where: { id: "singleton" }, data: { discordRoleId: byName.id } });
    return { ok: true, guildId, roleId: byName.id, roleName: byName.name, source: "found" };
  }

  // Created with no permissions and just above @everyone, so it is always
  // below the bot's own role and the bot can hand it out.
  const created = await discordRest<{ id: string; name: string }>(`/guilds/${guildId}/roles`, {
    method: "POST",
    body: { name: roleName, color: ROLE_COLOR, hoist: false, mentionable: false, permissions: "0" },
    reason: AUDIT_REASON,
  });
  if (!created.ok || !created.data?.id) {
    return { ok: false, error: `Could not create the ${roleName} role: ${created.error ?? "no reason given"}` };
  }
  await prisma.loaSettings.update({ where: { id: "singleton" }, data: { discordRoleId: created.data.id } });
  return { ok: true, guildId, roleId: created.data.id, roleName, source: "created" };
}

export interface RoleChange {
  ok: boolean;
  /** Why nothing was sent, when that is not a failure. */
  skipped?: "off" | "no-discord" | "not-in-server" | "not-configured";
  error?: string;
}

/**
 * Gives (onLeave) or takes away the role from one person. Safe to call when
 * nothing changed — Discord treats both as no-ops when the role is already
 * as asked.
 */
export async function setLoaRole(discordId: string | null | undefined, onLeave: boolean): Promise<RoleChange> {
  try {
    if (!snowflake(discordId)) return { ok: true, skipped: "no-discord" };
    const settings = await ensureLoaSettings();
    if (!settings.autoRole) return { ok: true, skipped: "off" };
    if (!loaGuildId(settings) || !(await resolveBotToken())) return { ok: true, skipped: "not-configured" };

    let role = await resolveLoaRole(settings);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!role.ok) return { ok: false, error: role.error };
      const res = await discordRest(`/guilds/${role.guildId}/members/${discordId}/roles/${role.roleId}`, {
        method: onLeave ? "PUT" : "DELETE",
        reason: AUDIT_REASON,
      });
      if (res.ok) return { ok: true };
      if (res.code === 10007) return { ok: true, skipped: "not-in-server" };
      // The saved role was deleted in Discord: look it up (or recreate it) once more.
      if (res.code === 10011 && role.source !== "env" && attempt === 0) {
        await prisma.loaSettings.update({ where: { id: "singleton" }, data: { discordRoleId: null } });
        role = await resolveLoaRole({ ...settings, discordRoleId: null }, true);
        continue;
      }
      return { ok: false, error: res.error ?? "Discord refused the role change" };
    }
    return { ok: false, error: "Discord refused the role change" };
  } catch (error) {
    console.error("EMS LOA role change failed:", error);
    return { ok: false, error: "The role change failed unexpectedly" };
  }
}

export interface LoaRoleSyncSummary {
  ranAt: string;
  ranBy: string;
  ok: boolean;
  error: string | null;
  roleId: string | null;
  roleName: string;
  createdRole: boolean;
  /**
   * "member-list": the server's member list was read, so the role holders are
   * known exactly. "roster": the bot cannot list members (Server Members
   * Intent off), so the role was given to everyone on leave and taken from
   * everyone whose leave has ended.
   */
  method: "member-list" | "roster" | null;
  added: string[];
  removed: string[];
  unchanged: number;
  skipped: { name: string; reason: string }[];
  failed: { name: string; reason: string }[];
}

/** Every member of the server holding the role, or null when the bot may not list members. */
async function roleHolders(guildId: string, roleId: string): Promise<Set<string> | null> {
  const holders = new Set<string>();
  let after = "0";
  for (let page = 0; page < 25; page++) {
    const res = await discordRest<{ user?: { id: string }; roles: string[] }[]>(
      `/guilds/${guildId}/members?limit=1000&after=${after}`
    );
    if (!res.ok || !Array.isArray(res.data)) return null;
    for (const m of res.data) if (m.user?.id && m.roles.includes(roleId)) holders.add(m.user.id);
    if (res.data.length < 1000) return holders;
    after = res.data[res.data.length - 1].user?.id ?? after;
  }
  return holders;
}

function label(m: { name: string; callSign: string | null }) {
  return m.callSign ? `${m.name} (${m.callSign})` : m.name;
}

/**
 * Makes Discord match the roster: everyone on leave holds the role, and no
 * roster member who is back does. Run from Admin → LOA, automatically the
 * first time the page is opened, and every night with the LOA job.
 */
export async function syncAllLoaRoles(ranBy: string): Promise<LoaRoleSyncSummary> {
  const settings = await ensureLoaSettings();
  const summary: LoaRoleSyncSummary = {
    ranAt: new Date().toISOString(),
    ranBy,
    ok: false,
    error: null,
    roleId: null,
    roleName: settings.roleName.trim() || DEFAULT_LOA_ROLE_NAME,
    createdRole: false,
    method: null,
    added: [],
    removed: [],
    unchanged: 0,
    skipped: [],
    failed: [],
  };

  const finish = async () => {
    await prisma.loaSettings.update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date(summary.ranAt), lastSyncSummary: summary as unknown as Prisma.InputJsonValue },
    });
    return summary;
  };

  if (!settings.autoRole) {
    summary.error = "The EMS LOA role is switched off";
    return finish();
  }
  if (!(await resolveBotToken())) {
    summary.error = "No Discord bot token is set — add it in Notification settings → Bot, or DISCORD_BOT_TOKEN";
    return finish();
  }

  const role = await resolveLoaRole(settings, true);
  if (!role.ok) {
    summary.error = role.error;
    return finish();
  }
  summary.roleId = role.roleId;
  summary.roleName = role.roleName;
  summary.createdRole = role.source === "created";

  const members = await prisma.member.findMany({
    select: {
      id: true,
      name: true,
      callSign: true,
      discordId: true,
      activity: true,
      // Anyone who has ever been on leave may still hold the role.
      loas: { where: { OR: [{ approvedAt: { not: null } }, { status: { in: ["Approved", "Active", "Expired", "Ended", "Cancelled"] } }] }, select: { id: true }, take: 1 },
    },
  });

  const change = async (m: (typeof members)[number], give: boolean) => {
    const res = await discordRest(`/guilds/${role.guildId}/members/${m.discordId}/roles/${role.roleId}`, {
      method: give ? "PUT" : "DELETE",
      reason: AUDIT_REASON,
    });
    if (res.ok) (give ? summary.added : summary.removed).push(label(m));
    else if (res.code === 10007) summary.skipped.push({ name: label(m), reason: "Not in the Discord server" });
    else summary.failed.push({ name: label(m), reason: res.error ?? "Discord refused" });
  };

  for (const m of members) {
    if (m.activity === "LOA" && !snowflake(m.discordId)) summary.skipped.push({ name: label(m), reason: "No Discord ID on the roster" });
  }

  const holders = await roleHolders(role.guildId, role.roleId);
  summary.method = holders ? "member-list" : "roster";

  for (const m of members) {
    if (!snowflake(m.discordId)) continue;
    const onLeave = m.activity === "LOA";
    if (holders) {
      const has = holders.has(m.discordId!);
      if (has === onLeave) summary.unchanged++;
      else await change(m, onLeave);
    } else if (onLeave) {
      await change(m, true);
    } else if (m.loas.length > 0) {
      await change(m, false);
    }
  }

  // Without the member list Discord answers a change the same whether or not
  // the member already had the role, so "added" and "removed" then mean "now
  // has it" and "no longer has it" — the page words them that way.
  summary.ok = summary.failed.length === 0;
  return finish();
}
