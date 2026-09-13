import { RANKS, SECTION_HINTS, FTO_ROLES, getRankWeight } from "./constants";
import { SHIFT_BANDS, shiftBandOf } from "./shifts";

/**
 * The public roster's shared vocabulary: the data shape the server page hands
 * down, and the filtering, grouping and formatting both sides agree on.
 *
 * Client-safe — nothing here touches the database. The loading half lives in
 * ./roster, which is server-only.
 */

/** Who is looking at the roster, decided on the server from their session. */
export interface RosterViewer {
  signedIn: boolean;
  name: string | null;
  memberId: string | null;
  /** roster.view — unlocks the member-only columns. */
  fullAccess: boolean;
  /** clock.self, and on the roster — shows the duty card. */
  canClock: boolean;
  /** Holds any panel permission, so the Admin button leads somewhere. */
  hasPanel: boolean;
}

export interface RosterDepartment {
  id: string;
  name: string;
  tag: string | null;
  color: string;
}

export interface RosterMember {
  id: string;
  name: string;
  rank: string;
  callSign: string | null;
  dept: string;
  activity: string;
  order: number;
  category: string | null;
  tempRank: string | null;
  ftoRole: string | null;
  position: string | null;
  /** When the leave they are currently on ends, for members on LOA. */
  loaEndsAt: string | null;
  departments: { departmentId: string; role: string }[];

  // Member-only. Null for a visitor without roster.view — and never read from
  // the database for them in the first place, not merely hidden in the UI.
  timezone: string | null;
  joinedAt: string | null;
  promotedAt: string | null;
  discordId: string | null;
  shift: { primarySlot: number; secondarySlot: number } | null;
  onDutySince: string | null;
  /** Closed duty time. Null when they have never clocked on. */
  totalSeconds: number | null;
}

export interface RosterSection {
  id: string;
  name: string;
  members: RosterMember[];
}

export interface RosterBannerData {
  label: string;
  highlight: string;
  message: string;
}

export interface RosterStats {
  total: number;
  active: number;
  reserve: number;
  loa: number;
  onDuty: number;
}

/** The signed-in member's own hours, for the duty card. */
export interface ViewerDuty {
  onDutySince: string | null;
  todaySeconds: number;
  totalSeconds: number;
}

export interface RosterPageData {
  sections: RosterSection[];
  departments: RosterDepartment[];
  banner: RosterBannerData | null;
  stats: RosterStats;
  viewer: RosterViewer;
  viewerDuty: ViewerDuty | null;
}

export interface RosterFilters {
  q: string;
  status: string;
  dept: string;
  shift: string;
  fto: string;
}

export const EMPTY_FILTERS: RosterFilters = { q: "", status: "", dept: "", shift: "", fto: "" };

export const STATUS_FILTERS = ["Active", "Reserve", "LOA"] as const;

/**
 * Filters read from the page link. Anything unrecognised is dropped rather
 * than trusted — the link is user input, and a stale or hand-edited one should
 * land on a working roster, not an empty one.
 */
export function parseRosterFilters(params: Record<string, string | string[] | undefined>): RosterFilters {
  const one = (key: string) => {
    const value = params[key];
    return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
  };
  const status = one("status");
  const shift = one("shift");
  const fto = one("fto");

  return {
    q: one("q").slice(0, 100),
    status: (STATUS_FILTERS as readonly string[]).includes(status) ? status : "",
    // Checked against the loaded department list once it is known.
    dept: one("dept").slice(0, 64),
    shift: shift === "none" || SHIFT_BANDS.some((b) => b.key === shift) ? shift : "",
    fto: (FTO_ROLES as readonly string[]).includes(fto) ? fto : "",
  };
}

export function filtersToQuery(filters: RosterFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function hasActiveFilters(filters: RosterFilters): boolean {
  return Object.values(filters).some(Boolean);
}

export function matchesFilters(member: RosterMember, filters: RosterFilters): boolean {
  if (filters.status && member.activity !== filters.status) return false;
  if (filters.dept && !member.departments.some((d) => d.departmentId === filters.dept)) return false;
  if (filters.fto && member.ftoRole !== filters.fto) return false;

  if (filters.shift === "none") {
    if (member.shift) return false;
  } else if (filters.shift) {
    // Either pick counts: someone whose secondary shift is evenings is still
    // someone you can find on evenings.
    const bands = member.shift
      ? [shiftBandOf(member.shift.primarySlot), shiftBandOf(member.shift.secondarySlot)]
      : [];
    if (!bands.includes(filters.shift as (typeof bands)[number])) return false;
  }

  const q = filters.q.trim().toLowerCase();
  if (!q) return true;
  return [member.name, member.callSign, member.rank, member.tempRank, member.ftoRole, member.position, member.discordId].some(
    (value) => value && value.toLowerCase().includes(q)
  );
}

/**
 * Where a rank sits in the chain of command — the roster section it belongs
 * to ("Command", "Medical Patrol"), which reads better than the raw tier names
 * RANKS still carries from before those sections were renamed.
 */
export function rankTier(rank: string): string {
  for (const [section, ranks] of Object.entries(SECTION_HINTS)) {
    if (ranks.includes(rank)) return section;
  }
  return RANKS.find((r) => r.name === rank)?.tier ?? "—";
}

/**
 * Splits a list into one group per rank, most senior first. Members keep their
 * own order inside a group; a rank the ladder does not recognise sorts last, by
 * name, rather than being dropped.
 */
export function groupByRank<T extends { rank: string }>(members: T[]): { rank: string; members: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const member of members) {
    const existing = groups.get(member.rank);
    if (existing) existing.push(member);
    else groups.set(member.rank, [member]);
  }
  return [...groups.entries()]
    .map(([rank, grouped]) => ({ rank, members: grouped }))
    .sort((a, b) => getRankWeight(b.rank) - getRankWeight(a.rank) || a.rank.localeCompare(b.rank));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "14 Aug 26". Formatted from UTC fields on purpose: this text is rendered on
 * the server and again in the browser, and a locale- or timezone-dependent
 * format would differ between the two and break hydration.
 */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()]} ${String(
    date.getUTCFullYear()
  ).slice(-2)}`;
}

/** "< 1m", "45m", "12h 05m". */
export function formatHours(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return "< 1m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}
