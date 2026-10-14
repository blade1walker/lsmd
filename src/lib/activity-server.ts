import { prisma } from "./prisma";
import type { ActivitySettings } from "@/generated/prisma/client";
import type { ActivityData, ActivityPeriod, ActivityRow, ActivitySettingsView, ActivityStanding } from "./activity";

/** Server half of Activity: the settings row and the numbers. */

export async function ensureActivitySettings(): Promise<ActivitySettings> {
  return prisma.activitySettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
}

export function toActivitySettingsView(settings: ActivitySettings): ActivitySettingsView {
  return {
    weeklyHoursTarget: settings.weeklyHoursTarget,
    graceDays: settings.graceDays,
    updatedBy: settings.updatedBy,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

/** Seconds of [start, end) that fall inside [from, to). Open intervals run to `to`. */
function overlap(start: Date, end: Date | null, from: number, to: number): number {
  const s = Math.max(start.getTime(), from);
  const e = Math.min(end ? end.getTime() : to, to);
  return e > s ? Math.floor((e - s) / 1000) : 0;
}

export async function getActivity(periodDays: ActivityPeriod, canManage: boolean): Promise<ActivityData> {
  const now = Date.now();
  const from = now - periodDays * 86_400_000;
  const fromDate = new Date(from);

  const [settings, members, clock, city, calls, lastClock, lastCity, anyCity, callsInPeriod] = await Promise.all([
    ensureActivitySettings(),
    prisma.member.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, callSign: true, rank: true, activity: true, dateOfJoining: true, createdAt: true },
    }),
    // Every entry that touches the period — including one that began before
    // it and is still open — counted only for the part inside it.
    prisma.clockEntry.findMany({
      where: { clockInAt: { lt: new Date(now) }, OR: [{ clockOutAt: null }, { clockOutAt: { gt: fromDate } }] },
      select: { memberId: true, clockInAt: true, clockOutAt: true },
    }),
    prisma.citySession.findMany({
      where: { joinedAt: { lt: new Date(now) }, OR: [{ leftAt: null }, { leftAt: { gt: fromDate } }] },
      select: { memberId: true, joinedAt: true, leftAt: true },
    }),
    prisma.emsCallResponder.groupBy({
      by: ["memberId"],
      where: { call: { occurredAt: { gte: fromDate } } },
      _count: { _all: true },
    }),
    prisma.clockEntry.groupBy({ by: ["memberId"], _max: { clockInAt: true } }),
    prisma.citySession.groupBy({ by: ["memberId"], _max: { joinedAt: true } }),
    prisma.citySession.count(),
    prisma.emsCall.count({ where: { occurredAt: { gte: fromDate } } }),
  ]);

  const duty = new Map<string, number>();
  const onDutyNow = new Set<string>();
  for (const entry of clock) {
    duty.set(entry.memberId, (duty.get(entry.memberId) ?? 0) + overlap(entry.clockInAt, entry.clockOutAt, from, now));
    if (!entry.clockOutAt) onDutyNow.add(entry.memberId);
  }
  const cityTime = new Map<string, number>();
  const inCityNow = new Set<string>();
  for (const session of city) {
    cityTime.set(session.memberId, (cityTime.get(session.memberId) ?? 0) + overlap(session.joinedAt, session.leftAt, from, now));
    if (!session.leftAt) inCityNow.add(session.memberId);
  }
  const callCount = new Map(calls.map((c) => [c.memberId, c._count._all]));
  const lastOn = new Map(lastClock.map((c) => [c.memberId, c._max.clockInAt]));
  const lastIn = new Map(lastCity.map((c) => [c.memberId, c._max.joinedAt]));

  const targetHours = Math.round(((settings.weeklyHoursTarget * periodDays) / 7) * 10) / 10;
  const targetSeconds = targetHours * 3600;
  const graceMs = settings.graceDays * 86_400_000;
  const cityTracked = anyCity > 0;

  const rows: ActivityRow[] = members.map((m) => {
    const dutySeconds = duty.get(m.id) ?? 0;
    const joined = m.dateOfJoining ?? m.createdAt;
    let standing: ActivityStanding;
    if (m.activity === "LOA") standing = "LOA";
    else if (m.activity === "Reserve") standing = "Reserve";
    else if (now - joined.getTime() < graceMs) standing = dutySeconds >= targetSeconds ? "Meets" : "New";
    else standing = dutySeconds >= targetSeconds ? "Meets" : "Below";

    const measured = standing === "Meets" || standing === "Below";
    return {
      memberId: m.id,
      name: m.name,
      callSign: m.callSign,
      rank: m.rank,
      activity: m.activity,
      joinedAt: m.dateOfJoining?.toISOString() ?? null,
      dutySeconds,
      citySeconds: cityTracked ? (cityTime.get(m.id) ?? 0) : null,
      calls: callCount.get(m.id) ?? 0,
      lastOnDuty: onDutyNow.has(m.id) ? new Date(now).toISOString() : (lastOn.get(m.id)?.toISOString() ?? null),
      lastInCity: inCityNow.has(m.id) ? new Date(now).toISOString() : (lastIn.get(m.id)?.toISOString() ?? null),
      onDutyNow: onDutyNow.has(m.id),
      standing,
      progress: measured ? (targetSeconds > 0 ? Math.round((dutySeconds / targetSeconds) * 100) : 100) : null,
    };
  });

  return {
    periodDays,
    targetHours,
    settings: toActivitySettingsView(settings),
    cityTracked,
    canManage,
    rows,
    totals: {
      measured: rows.filter((r) => r.standing === "Meets" || r.standing === "Below").length,
      meets: rows.filter((r) => r.standing === "Meets").length,
      below: rows.filter((r) => r.standing === "Below").length,
      dutySeconds: rows.reduce((n, r) => n + r.dutySeconds, 0),
      citySeconds: rows.reduce((n, r) => n + (r.citySeconds ?? 0), 0),
      calls: callsInPeriod,
    },
  };
}
