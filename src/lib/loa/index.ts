/**
 * The LOA section's data shapes and day arithmetic. Client-safe; the board is
 * loaded in ./loa-board and the lifecycle lives in ./loa-server.
 */

export const DAY_MS = 86_400_000;

export interface LoaEntry {
  /** Null for a member whose roster status is LOA with no leave record behind it. */
  id: string | null;
  memberId: string;
  name: string;
  callSign: string | null;
  rank: string;
  hasDiscord: boolean;
  status: string;
  reason: string | null;
  notes: string | null;
  /** When the leave began — or, without a record, when the roster status was set to LOA, if the audit log says. */
  startDate: string | null;
  endDate: string | null;
  requestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
  createdAt: string | null;
}

export interface LoaRoleView {
  roleName: string;
  roleId: string | null;
  autoRole: boolean;
  /** Where the server ID comes from, if anywhere. */
  guildSource: "env" | "settings" | null;
  guildId: string | null;
  roleFromEnv: boolean;
  botTokenSet: boolean;
  lastSyncAt: string | null;
  lastSync: {
    ok: boolean;
    error: string | null;
    method: "member-list" | "roster" | null;
    createdRole: boolean;
    ranBy: string;
    added: string[];
    removed: string[];
    unchanged: number;
    skipped: { name: string; reason: string }[];
    failed: { name: string; reason: string }[];
  } | null;
}

export interface LoaBoard {
  onLeave: LoaEntry[];
  upcoming: LoaEntry[];
  pending: LoaEntry[];
  recent: LoaEntry[];
  /** Members who can be put on leave — everyone not on it now. */
  candidates: { id: string; name: string; callSign: string | null; rank: string; activity: string }[];
  role: LoaRoleView;
  canManage: boolean;
}

/** Whole days from `from` to `to`, rounded down. */
export function daysBetween(from: string | number | Date, to: string | number | Date): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);
}

/** "3 days", "1 day", "today". */
export function dayCount(days: number): string {
  if (days <= 0) return "today";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export const LOA_LIMITS = { reason: 500, notes: 1000 } as const;
