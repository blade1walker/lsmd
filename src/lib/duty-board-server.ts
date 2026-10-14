import { prisma } from "./prisma";
import { hasPermission, type Access } from "./access";
import {
  DEFAULT_UNIT_STATUS,
  UNIT_LIMITS,
  parseUnitStatus,
  type DutyBoardData,
  type DutyBoardUnit,
  type UnitStatusKey,
} from "./duty-board";
import { getCitySnapshot, presentMemberIds } from "./fivem-server";

/** Server half of the Duty Board: reading it, and setting a unit's status. */

export interface UnitStatusInput {
  status: UnitStatusKey;
  /** Undefined leaves the stored value as it is; null clears it. */
  unit?: string | null;
  note?: string | null;
}

function text(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

export function parseUnitStatusInput(body: unknown): { data: UnitStatusInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Nothing was submitted" };
  const b = body as Record<string, unknown>;
  const status = parseUnitStatus(b.status);
  if (!status) return { error: "Choose a status" };
  return { data: { status, unit: text(b.unit, UNIT_LIMITS.unit), note: text(b.note, UNIT_LIMITS.note) } };
}

export async function setUnitStatus(memberId: string, input: UnitStatusInput, source: "site" | "fivem", updatedBy: string) {
  const fields = {
    status: input.status,
    ...(input.unit !== undefined ? { unit: input.unit } : {}),
    // A new status without a note clears the old one: "On Scene · Vinewood"
    // should not still be showing once they are Available again.
    note: input.note ?? null,
    source,
    updatedBy,
  };
  return prisma.unitStatus.upsert({
    where: { memberId },
    create: { memberId, ...fields },
    update: fields,
  });
}

/** Whether the member has an open duty entry — the board only takes statuses from medics on duty. */
export async function isOnDuty(memberId: string): Promise<boolean> {
  return (await prisma.clockEntry.count({ where: { memberId, clockOutAt: null } })) > 0;
}

const LEADER_WINDOW_DAYS = 7;

export async function getDutyBoard(access: Access): Promise<DutyBoardData> {
  const since = new Date(Date.now() - LEADER_WINDOW_DAYS * 86_400_000);

  const [open, snapshot, hours, calls] = await Promise.all([
    prisma.clockEntry.findMany({
      where: { clockOutAt: null },
      orderBy: { clockInAt: "asc" },
      select: {
        memberId: true,
        clockInAt: true,
        source: true,
        member: {
          select: {
            name: true,
            callSign: true,
            rank: true,
            unitStatus: { select: { status: true, unit: true, note: true, source: true, updatedAt: true, updatedBy: true } },
          },
        },
      },
    }),
    getCitySnapshot().catch(() => null),
    prisma.clockEntry.groupBy({
      by: ["memberId"],
      where: { clockInAt: { gte: since }, durationSec: { not: null } },
      _sum: { durationSec: true },
    }),
    prisma.emsCallResponder.groupBy({
      by: ["memberId"],
      where: { call: { occurredAt: { gte: since } } },
      _count: { _all: true },
    }),
  ]);

  const linked = !!snapshot?.configured;
  const present = snapshot ? presentMemberIds(snapshot) : new Set<string>();

  const seen = new Set<string>();
  const units: DutyBoardUnit[] = [];
  for (const entry of open) {
    // A missed clock-out can leave two open entries; the earliest is the shift.
    if (seen.has(entry.memberId)) continue;
    seen.add(entry.memberId);

    const stored = entry.member.unitStatus;
    // A status set before this shift began belongs to the last shift: start
    // every shift Available, keeping only the unit designation.
    const current = stored && stored.updatedAt >= entry.clockInAt ? stored : null;
    units.push({
      memberId: entry.memberId,
      name: entry.member.name,
      callSign: entry.member.callSign,
      rank: entry.member.rank,
      onDutySince: entry.clockInAt.toISOString(),
      status: (parseUnitStatus(current?.status) ?? DEFAULT_UNIT_STATUS),
      unit: stored?.unit ?? null,
      note: current?.note ?? null,
      statusUpdatedAt: current?.updatedAt.toISOString() ?? null,
      statusUpdatedBy: current?.updatedBy ?? null,
      statusSource: current?.source ?? null,
      // Only said when the link can tell: without identifiers, missing from
      // the player list may just mean playing under another name.
      inCity: snapshot?.online && snapshot.reliable ? present.has(entry.memberId) : null,
      clockSource: entry.source,
    });
  }

  // Live on-duty time counts toward the leaderboard too, so whoever has been
  // on all afternoon is not missing from it until they clock off.
  const seconds = new Map(hours.map((h) => [h.memberId, h._sum.durationSec ?? 0]));
  const now = Date.now();
  for (const unit of units) {
    const started = Math.max(Date.parse(unit.onDutySince), since.getTime());
    seconds.set(unit.memberId, (seconds.get(unit.memberId) ?? 0) + Math.floor((now - started) / 1000));
  }
  const callCount = new Map(calls.map((c) => [c.memberId, c._count._all]));
  const topIds = [...seconds.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
  const leaderRows = topIds.length
    ? await prisma.member.findMany({ where: { id: { in: topIds } }, select: { id: true, name: true, callSign: true } })
    : [];
  const leaderById = new Map(leaderRows.map((m) => [m.id, m]));

  const viewerOnDuty = !!access.memberId && seen.has(access.memberId);

  return {
    units,
    viewerMemberId: access.memberId,
    viewerOnDuty,
    canManage: hasPermission(access, "duty.manage"),
    city: {
      linked,
      online: !!snapshot?.online,
      emsInCity: present.size,
      reliable: !!snapshot?.reliable,
    },
    leaders: topIds.flatMap((id) => {
      const member = leaderById.get(id);
      return member
        ? [{ memberId: id, name: member.name, callSign: member.callSign, seconds: seconds.get(id) ?? 0, calls: callCount.get(id) ?? 0 }]
        : [];
    }),
  };
}
