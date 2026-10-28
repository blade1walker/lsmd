/**
 * Activity: every member's duty hours, city time and calls over a period,
 * measured against the weekly requirement. Client-safe types and rules; the
 * numbers are worked out in ./activity-server.
 */

export const ACTIVITY_PERIODS = [7, 14, 30] as const;
export type ActivityPeriod = (typeof ACTIVITY_PERIODS)[number];

export function parseActivityPeriod(value: unknown): ActivityPeriod {
  const n = Number(value);
  return (ACTIVITY_PERIODS as readonly number[]).includes(n) ? (n as ActivityPeriod) : 7;
}

/**
 * Where a member stands against the requirement. LOA and Reserve are not
 * measured — being away is what those statuses are for — and New covers
 * someone still inside the grace period after joining.
 */
export type ActivityStanding = "Meets" | "Below" | "New" | "Reserve" | "LOA";

export const STANDING_STYLES: Record<ActivityStanding, string> = {
  Meets: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Below: "border-red-500/30 bg-red-500/10 text-red-300",
  New: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  Reserve: "border-white/10 bg-white/5 text-gray-400",
  LOA: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export interface ActivityRow {
  memberId: string;
  name: string;
  callSign: string | null;
  rank: string;
  activity: string;
  joinedAt: string | null;
  dutySeconds: number;
  /** Null when the City Link has never recorded anyone — nothing to compare against. */
  citySeconds: number | null;
  calls: number;
  /** Most recent clock-on, any time. */
  lastOnDuty: string | null;
  /** Most recent time in the city, any time. */
  lastInCity: string | null;
  onDutyNow: boolean;
  standing: ActivityStanding;
  /** Share of the period's target met, 0–100+. Null when not measured. */
  progress: number | null;
}

export interface ActivitySettingsView {
  weeklyHoursTarget: number;
  graceDays: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface ActivityData {
  periodDays: ActivityPeriod;
  /** The weekly target scaled to the period, in hours. */
  targetHours: number;
  settings: ActivitySettingsView;
  /** City time is shown only once the City Link has recorded some. */
  cityTracked: boolean;
  canManage: boolean;
  rows: ActivityRow[];
  totals: {
    measured: number;
    meets: number;
    below: number;
    dutySeconds: number;
    citySeconds: number;
    calls: number;
  };
}

export const ACTIVITY_LIMITS = { weeklyHoursTarget: { min: 0, max: 80 }, graceDays: { min: 0, max: 90 } } as const;
