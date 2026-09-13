import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { resolveAccess, hasPermission } from "./access";
import type { Prisma } from "@/generated/prisma/client";
import type { RosterMember, RosterPageData, RosterViewer, ViewerDuty } from "./roster-shared";

/**
 * Loads the public roster. Server-only.
 *
 * What a visitor receives depends on who they are, and that is decided here
 * rather than in the components: a visitor without roster.view is served a
 * projection that never selects Discord IDs, time zones, dates, shifts or duty
 * hours at all. Hiding a column in the UI would still ship the value inside the
 * page payload — which is exactly what the previous roster did, sending every
 * member's full row, State and Steam IDs included, to anyone who loaded "/".
 */

const ACTIVE_LOA = {
  where: { status: { in: ["Approved", "Active"] } },
  orderBy: { endDate: "desc" as const },
  take: 1,
  select: { endDate: true },
};

const PUBLIC_SELECT = {
  id: true,
  name: true,
  rank: true,
  callSign: true,
  dept: true,
  activity: true,
  order: true,
  category: true,
  tempRank: true,
  ftoRole: true,
  position: true,
  loas: ACTIVE_LOA,
  departmentMemberships: { select: { departmentId: true, role: true } },
} satisfies Prisma.MemberSelect;

const FULL_SELECT = {
  ...PUBLIC_SELECT,
  timezone: true,
  dateOfJoining: true,
  lastPromotion: true,
  discordId: true,
  shiftSignup: { select: { primarySlot: true, secondarySlot: true } },
} satisfies Prisma.MemberSelect;

type PublicRow = Prisma.MemberGetPayload<{ select: typeof PUBLIC_SELECT }>;
type FullRow = Prisma.MemberGetPayload<{ select: typeof FULL_SELECT }>;

const ANONYMOUS: RosterViewer = {
  signedIn: false,
  name: null,
  memberId: null,
  fullAccess: false,
  canClock: false,
  hasPanel: false,
};

/**
 * Re-resolves access from the database instead of trusting the session's
 * cached claims, the same as every API route does — so a member removed from
 * the roster or stripped of a role stops seeing member-only data on their next
 * page load, not whenever their token happens to refresh.
 */
async function resolveViewer(): Promise<RosterViewer> {
  let discordId: string | undefined;
  let sessionName: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    discordId = session?.user?.discordId;
    sessionName = session?.user?.name ?? null;
  } catch {
    return ANONYMOUS;
  }
  if (!discordId) return ANONYMOUS;

  const access = await resolveAccess(discordId);
  if (!access.allowed) return { ...ANONYMOUS, signedIn: true, name: sessionName };

  return {
    signedIn: true,
    name: access.memberName ?? sessionName,
    memberId: access.memberId,
    fullAccess: hasPermission(access, "roster.view"),
    canClock: !!access.memberId && hasPermission(access, "clock.self"),
    hasPanel: access.isSuperAdmin || access.permissions.length > 0,
  };
}

export async function getRosterPageData(): Promise<RosterPageData> {
  const viewer = await resolveViewer();
  const full = viewer.fullAccess;

  const [sectionRows, departments, banner, openEntries] = await Promise.all([
    full
      ? prisma.section.findMany({
          orderBy: { order: "asc" },
          select: { id: true, name: true, members: { orderBy: { order: "asc" }, select: FULL_SELECT } },
        })
      : prisma.section.findMany({
          orderBy: { order: "asc" },
          select: { id: true, name: true, members: { orderBy: { order: "asc" }, select: PUBLIC_SELECT } },
        }),
    prisma.departmentTemplate.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, tag: true, color: true },
    }),
    // The banner is decoration. If its table has not been created yet — a
    // deploy whose schema push failed — the roster must still load.
    prisma.rosterBanner.findUnique({ where: { id: "singleton" } }).catch(() => null),
    prisma.clockEntry.findMany({
      where: { clockOutAt: null },
      select: { memberId: true, clockInAt: true },
    }),
  ]);

  const totals = full
    ? await prisma.clockEntry.groupBy({ by: ["memberId"], _sum: { durationSec: true } })
    : [];

  // Earliest open entry per member, in case a missed clock-out left two.
  const onDuty = new Map<string, Date>();
  for (const entry of openEntries) {
    const previous = onDuty.get(entry.memberId);
    if (!previous || entry.clockInAt < previous) onDuty.set(entry.memberId, entry.clockInAt);
  }
  const totalsById = new Map(totals.map((t) => [t.memberId, t._sum.durationSec ?? 0]));

  const toMember = (row: PublicRow | FullRow): RosterMember => {
    const base = {
      id: row.id,
      name: row.name,
      rank: row.rank,
      callSign: row.callSign,
      dept: row.dept,
      activity: row.activity,
      order: row.order,
      category: row.category,
      tempRank: row.tempRank,
      ftoRole: row.ftoRole,
      position: row.position,
      loaEndsAt: row.activity === "LOA" ? (row.loas[0]?.endDate.toISOString() ?? null) : null,
      departments: row.departmentMemberships,
    };

    if (!("discordId" in row)) {
      return {
        ...base,
        timezone: null,
        joinedAt: null,
        promotedAt: null,
        discordId: null,
        shift: null,
        onDutySince: null,
        totalSeconds: null,
      };
    }

    return {
      ...base,
      timezone: row.timezone,
      joinedAt: row.dateOfJoining?.toISOString() ?? null,
      promotedAt: row.lastPromotion?.toISOString() ?? null,
      discordId: row.discordId,
      shift: row.shiftSignup,
      onDutySince: onDuty.get(row.id)?.toISOString() ?? null,
      totalSeconds: totalsById.get(row.id) ?? null,
    };
  };

  const sections = (sectionRows as { id: string; name: string; members: (PublicRow | FullRow)[] }[]).map(
    (section) => ({ id: section.id, name: section.name, members: section.members.map(toMember) })
  );

  const everyone = sections.flatMap((s) => s.members);
  const count = (activity: string) => everyone.filter((m) => m.activity === activity).length;

  let viewerDuty: ViewerDuty | null = null;
  if (viewer.canClock && viewer.memberId) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [today, lifetime] = await Promise.all([
      prisma.clockEntry.aggregate({
        where: { memberId: viewer.memberId, clockInAt: { gte: startOfToday } },
        _sum: { durationSec: true },
      }),
      prisma.clockEntry.aggregate({ where: { memberId: viewer.memberId }, _sum: { durationSec: true } }),
    ]);
    viewerDuty = {
      onDutySince: onDuty.get(viewer.memberId)?.toISOString() ?? null,
      todaySeconds: today._sum.durationSec ?? 0,
      totalSeconds: lifetime._sum.durationSec ?? 0,
    };
  }

  const bannerText = banner && [banner.label, banner.highlight, banner.message].some((v) => v.trim());

  return {
    sections,
    departments,
    banner:
      banner?.active && bannerText
        ? { label: banner.label.trim(), highlight: banner.highlight.trim(), message: banner.message.trim() }
        : null,
    stats: {
      total: everyone.length,
      active: count("Active"),
      reserve: count("Reserve"),
      loa: count("LOA"),
      onDuty: onDuty.size,
    },
    viewer,
    viewerDuty,
  };
}
