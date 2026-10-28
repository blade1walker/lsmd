import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import { prisma } from "../db/prisma";
import { resolveAccess, hasPermission } from "../auth/access";
import { cached } from "../db/cache";
import type { Prisma } from "@/generated/prisma/client";
import type { RosterMember, RosterPageData, RosterViewer, ViewerDuty } from "./";

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

/**
 * Reads every visitor shares. Cached (src/lib/db/cache.ts) — any database
 * write drops them, so edits still show on the next load — and started before
 * the viewer is known, so they run alongside the session check, not after it.
 */
const ROSTER_CACHE_MS = 60_000;
const rosterSections = (full: boolean) =>
  cached(full ? "roster:sections:full" : "roster:sections:public", ROSTER_CACHE_MS, () =>
    prisma.section.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, members: { orderBy: { order: "asc" }, select: full ? FULL_SELECT : PUBLIC_SELECT } },
    })
  );
const rosterDepartments = () =>
  cached("roster:departments", ROSTER_CACHE_MS, () =>
    prisma.departmentTemplate.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, tag: true, color: true },
    })
  );
// The banner is decoration. If its table has not been created yet — a deploy
// whose schema push failed — the roster must still load.
const rosterBanner = () =>
  cached("roster:banner", ROSTER_CACHE_MS, () =>
    prisma.rosterBanner.findUnique({ where: { id: "singleton" } }).catch(() => null)
  );
const openClockEntries = () =>
  cached("roster:on-duty", ROSTER_CACHE_MS, () =>
    prisma.clockEntry.findMany({ where: { clockOutAt: null }, select: { memberId: true, clockInAt: true } })
  );
const clockTotals = () =>
  cached("roster:clock-totals", ROSTER_CACHE_MS, () =>
    prisma.clockEntry.groupBy({ by: ["memberId"], _sum: { durationSec: true } })
  );

const homeCounts = () =>
  cached("home:counts", ROSTER_CACHE_MS, () =>
    Promise.all([
      prisma.member.count({ where: { sectionId: { not: null } } }),
      prisma.departmentTemplate.count(),
      prisma.clockEntry.groupBy({ by: ["memberId"], where: { clockOutAt: null } }),
    ])
  );

/**
 * Fills the shared roster and homepage reads, so the first visitor after a
 * restart does not wait for them. Called at server start (src/instrumentation.ts).
 */
export async function warmRosterCaches() {
  await Promise.all([
    rosterSections(false),
    rosterSections(true),
    rosterDepartments(),
    rosterBanner(),
    openClockEntries(),
    clockTotals(),
    homeCounts(),
  ]);
}

export async function getRosterPageData(): Promise<RosterPageData> {
  const shared = Promise.all([rosterDepartments(), rosterBanner(), openClockEntries()]);
  const viewer = await resolveViewer();
  const full = viewer.fullAccess;

  const [sectionRows, [departments, banner, openEntries], totals] = await Promise.all([
    rosterSections(full),
    shared,
    full ? clockTotals() : Promise.resolve([]),
  ]);

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
    const memberId = viewer.memberId;
    const [today, lifetime] = await cached(`duty:${memberId}:${startOfToday.getTime()}`, ROSTER_CACHE_MS, () =>
      Promise.all([
        prisma.clockEntry.aggregate({
          where: { memberId, clockInAt: { gte: startOfToday } },
          _sum: { durationSec: true },
        }),
        prisma.clockEntry.aggregate({ where: { memberId }, _sum: { durationSec: true } }),
      ])
    );
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

export interface HomeSummary {
  viewer: RosterViewer;
  banner: RosterPageData["banner"];
  stats: { personnel: number; onDuty: number; departments: number };
}

/**
 * What the landing page shows: headline counts, the banner and who is looking.
 * Counts only, never rows — the page is public, and these are the same numbers
 * the roster already shows to anyone. Null when the database is unreachable,
 * so the landing page can still render its links.
 */
export async function getHomeSummary(): Promise<HomeSummary | null> {
  try {
    const [viewer, [personnel, departments, onDuty], banner] = await Promise.all([
      resolveViewer(),
      homeCounts(),
      rosterBanner(),
    ]);

    const bannerText = banner && [banner.label, banner.highlight, banner.message].some((v) => v.trim());

    return {
      viewer,
      banner:
        banner?.active && bannerText
          ? { label: banner.label.trim(), highlight: banner.highlight.trim(), message: banner.message.trim() }
          : null,
      stats: { personnel, onDuty: onDuty.length, departments },
    };
  } catch (error) {
    console.error("Home summary failed to load:", error);
    return null;
  }
}
