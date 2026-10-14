/**
 * Duty Board vocabulary. Client-safe — the board, the API and the in-game
 * /unitstatus command all read the same list, so a status set in the city is
 * one the board knows how to show.
 */

export const UNIT_STATUSES = [
  { key: "Available", description: "In service and free for a call", tone: "emerald", aliases: ["available", "avail", "free", "10-8", "108", "inservice"] },
  { key: "En Route", description: "Responding to a call", tone: "sky", aliases: ["enroute", "responding", "10-76", "1076"] },
  { key: "On Scene", description: "With a patient on scene", tone: "amber", aliases: ["onscene", "scene", "10-23", "1023", "arrived"] },
  { key: "Transporting", description: "Taking a patient to hospital", tone: "orange", aliases: ["transporting", "transport", "10-15"] },
  { key: "At Hospital", description: "Handing over at a facility", tone: "violet", aliases: ["athospital", "hospital", "handover"] },
  { key: "Busy", description: "Committed and not taking calls", tone: "red", aliases: ["busy", "unavailable", "10-6", "106"] },
  { key: "On Break", description: "Clocked on but on a break", tone: "gray", aliases: ["onbreak", "break", "10-7", "107"] },
] as const;

export type UnitStatusKey = (typeof UNIT_STATUSES)[number]["key"];
export type UnitTone = (typeof UNIT_STATUSES)[number]["tone"];

export const DEFAULT_UNIT_STATUS: UnitStatusKey = "Available";

/** Tailwind classes per tone. Literal strings, so Tailwind's scanner keeps them. */
export const UNIT_TONE_CLASSES: Record<UnitTone, { chip: string; dot: string; border: string; text: string }> = {
  emerald: { chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400", border: "border-emerald-500/30", text: "text-emerald-300" },
  sky: { chip: "bg-sky-500/15 text-sky-300 border-sky-500/30", dot: "bg-sky-400", border: "border-sky-500/30", text: "text-sky-300" },
  amber: { chip: "bg-amber-500/15 text-amber-300 border-amber-500/30", dot: "bg-amber-400", border: "border-amber-500/30", text: "text-amber-300" },
  orange: { chip: "bg-orange-500/15 text-orange-300 border-orange-500/30", dot: "bg-orange-400", border: "border-orange-500/30", text: "text-orange-300" },
  violet: { chip: "bg-violet-500/15 text-violet-300 border-violet-500/30", dot: "bg-violet-400", border: "border-violet-500/30", text: "text-violet-300" },
  red: { chip: "bg-red-500/15 text-red-300 border-red-500/30", dot: "bg-red-400", border: "border-red-500/30", text: "text-red-300" },
  gray: { chip: "bg-white/5 text-gray-300 border-white/10", dot: "bg-gray-400", border: "border-white/10", text: "text-gray-300" },
};

export function unitStatusInfo(status: string | null | undefined) {
  return UNIT_STATUSES.find((s) => s.key === status) ?? UNIT_STATUSES[0];
}

/**
 * A status from what someone typed — the label itself in any case, or a
 * short alias like "enroute" or "10-8" from the in-game command. Null when it
 * names no status.
 */
export function parseUnitStatus(value: unknown): UnitStatusKey | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/[\s_]+/g, "");
  if (!key) return null;
  for (const status of UNIT_STATUSES) {
    if (status.key.toLowerCase().replace(/\s+/g, "") === key) return status.key;
    if ((status.aliases as readonly string[]).includes(key)) return status.key;
  }
  return null;
}

export const UNIT_LIMITS = { unit: 24, note: 120 } as const;

/** One medic on the board. */
export interface DutyBoardUnit {
  memberId: string;
  name: string;
  callSign: string | null;
  rank: string;
  onDutySince: string;
  status: UnitStatusKey;
  unit: string | null;
  note: string | null;
  statusUpdatedAt: string | null;
  statusUpdatedBy: string | null;
  statusSource: string | null;
  /** In the FiveM server right now. Null when the City Link cannot tell. */
  inCity: boolean | null;
  /** Clocked on by in-game duty rather than on the site. */
  clockSource: string;
}

export interface DutyBoardData {
  units: DutyBoardUnit[];
  /** The viewer's own member id, so the board can offer their status controls. */
  viewerMemberId: string | null;
  /** The viewer is clocked on, and may set their own status. */
  viewerOnDuty: boolean;
  /** duty.manage — may change anyone's status. */
  canManage: boolean;
  city: { linked: boolean; online: boolean; emsInCity: number; reliable: boolean };
  /** The busiest medics over the last 7 days, for the board's sidebar. */
  leaders: { memberId: string; name: string; callSign: string | null; seconds: number; calls: number }[];
}
