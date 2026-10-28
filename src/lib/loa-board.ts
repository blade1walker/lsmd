import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import { DAY_MS, type LoaBoard, type LoaEntry, type LoaRoleView } from "./loa";
import { DEFAULT_LOA_ROLE_NAME, loaGuildId, readLoaSettings } from "./loa-role";
import { RUNNING_LOA } from "./loa-server";
import { resolveBotToken } from "./discord-webhook";

/** Server half of the LOA section: everything the page shows, in one read. */

const RECENT_DAYS = 30;

const MEMBER = { select: { id: true, name: true, callSign: true, rank: true, discordId: true } } as const;

type LoaRow = Prisma.LOAGetPayload<{ include: { member: typeof MEMBER } }>;

function toEntry(loa: LoaRow): LoaEntry {
  return {
    id: loa.id,
    memberId: loa.memberId,
    name: loa.member.name,
    callSign: loa.member.callSign,
    rank: loa.member.rank,
    hasDiscord: !!loa.member.discordId,
    status: loa.status,
    reason: loa.reason || null,
    notes: loa.notes,
    startDate: loa.startDate.toISOString(),
    endDate: loa.endDate.toISOString(),
    requestedBy: loa.createdBy,
    approvedBy: loa.approvedBy,
    approvedAt: loa.approvedAt?.toISOString() ?? null,
    endedAt: loa.endedAt?.toISOString() ?? null,
    endedBy: loa.endedBy,
    createdAt: loa.createdAt.toISOString(),
  };
}

function snowflake(value: string | null | undefined): boolean {
  return /^\d{15,22}$/.test((value ?? "").trim());
}

export async function getLoaBoard(canManage: boolean): Promise<LoaBoard> {
  const now = new Date();
  const recentFrom = new Date(now.getTime() - RECENT_DAYS * DAY_MS);

  const [running, pending, recent, members, settings, token] = await Promise.all([
    prisma.lOA.findMany({ where: { status: { in: [...RUNNING_LOA] } }, include: { member: MEMBER }, orderBy: { endDate: "asc" } }),
    prisma.lOA.findMany({ where: { status: "Pending" }, include: { member: MEMBER }, orderBy: { createdAt: "asc" } }),
    prisma.lOA.findMany({
      where: {
        status: { in: ["Expired", "Ended", "Cancelled"] },
        OR: [{ endedAt: { gte: recentFrom } }, { endedAt: null, updatedAt: { gte: recentFrom } }],
      },
      include: { member: MEMBER },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.member.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, callSign: true, rank: true, activity: true, discordId: true },
    }),
    readLoaSettings(),
    resolveBotToken(),
  ]);

  // Members whose roster status is LOA with no leave behind it — set by hand
  // on the roster or with the bot. When they went on leave comes from the
  // audit log's record of that status change, where there is one.
  const withRecord = new Set(running.map((l) => l.memberId));
  const rosterOnly = members.filter((m) => m.activity === "LOA" && !withRecord.has(m.id));
  const since = new Map<string, Date>();
  if (rosterOnly.length) {
    const changes = await prisma.auditLog.findMany({
      where: { entityType: "Member", entityId: { in: rosterOnly.map((m) => m.id) } },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, createdAt: true, details: true },
    });
    // The change that put them on leave records "<old> -> LOA" under activity.
    const toLoa = (details: unknown) => {
      const activity = (details as { activity?: unknown } | null)?.activity;
      return typeof activity === "string" && activity.endsWith("-> LOA");
    };
    for (const c of changes) if (toLoa(c.details) && !since.has(c.entityId)) since.set(c.entityId, c.createdAt);
  }

  const started = running.filter((l) => l.startDate <= now).map(toEntry);
  const flagged: LoaEntry[] = rosterOnly.map((m) => ({
    id: null,
    memberId: m.id,
    name: m.name,
    callSign: m.callSign,
    rank: m.rank,
    hasDiscord: !!m.discordId,
    status: "Roster",
    reason: null,
    notes: null,
    startDate: since.get(m.id)?.toISOString() ?? null,
    endDate: null,
    requestedBy: null,
    approvedBy: null,
    approvedAt: null,
    endedAt: null,
    endedBy: null,
    createdAt: null,
  }));

  const guildFromEnv = snowflake(process.env.DISCORD_GUILD_ID);
  const guildId = loaGuildId(settings);
  const summary = settings?.lastSyncSummary as LoaRoleView["lastSync"] | null | undefined;

  return {
    onLeave: [...started, ...flagged],
    upcoming: running.filter((l) => l.startDate > now).sort((a, b) => a.startDate.getTime() - b.startDate.getTime()).map(toEntry),
    pending: pending.map(toEntry),
    recent: recent.map(toEntry),
    candidates: members
      .filter((m) => m.activity !== "LOA")
      .map((m) => ({ id: m.id, name: m.name, callSign: m.callSign, rank: m.rank, activity: m.activity })),
    role: {
      roleName: settings?.roleName?.trim() || DEFAULT_LOA_ROLE_NAME,
      roleId: snowflake(process.env.DISCORD_LOA_ROLE_ID) ? process.env.DISCORD_LOA_ROLE_ID!.trim() : (settings?.discordRoleId ?? null),
      autoRole: settings?.autoRole ?? true,
      guildSource: guildFromEnv ? "env" : guildId ? "settings" : null,
      guildId,
      roleFromEnv: snowflake(process.env.DISCORD_LOA_ROLE_ID),
      botTokenSet: !!token,
      lastSyncAt: settings?.lastSyncAt?.toISOString() ?? null,
      lastSync: summary && typeof summary === "object" ? summary : null,
    },
    canManage,
  };
}
