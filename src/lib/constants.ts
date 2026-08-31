export const SUPER_ADMIN_IDS = [
  "721646919222427648",
  "620175830123020291",
  "388728397771177988",
  "525942483692158976",
  "1170690398558097511",
];

export const RANKS = [
  { name: "Director of Medicine", tier: "High Command", shape: "star", count: 4, weight: 12 },
  { name: "Chief of EMS", tier: "High Command", shape: "star", count: 3, weight: 11 },
  { name: "Deputy Chief of EMS", tier: "High Command", shape: "star", count: 2, weight: 10 },
  { name: "Assistant Chief", tier: "High Command", shape: "star", count: 1, weight: 9 },
  { name: "Division Chief", tier: "Command", shape: "bar", count: 2, weight: 8 },
  { name: "EMS Captain", tier: "Command", shape: "bar", count: 1, weight: 7 },
  { name: "Lieutenant", tier: "Command", shape: "chevron", count: 3, weight: 6 },
  { name: "Senior Paramedic", tier: "NCO", shape: "chevron", count: 2, weight: 5 },
  { name: "Paramedic", tier: "Patrol", shape: "chevron", count: 1, weight: 4 },
  { name: "EMT", tier: "Patrol", shape: "pip", count: 2, weight: 3 },
  { name: "EMR", tier: "Patrol", shape: "pip", count: 1, weight: 2 },
  { name: "Medical Intern", tier: "Probationary", shape: "none", count: 0, weight: 1 },
] as const;

export const RANK_LIST = RANKS.map((r) => r.name);
export const RANK_NAMES = RANK_LIST;

export const SECTION_HINTS: Record<string, string[]> = {
  "High Command": ["Director of Medicine", "Chief of EMS", "Deputy Chief of EMS", "Assistant Chief"],
  Command: ["Division Chief", "EMS Captain", "Lieutenant"],
  Lead: ["Senior Paramedic"],
  "Medical Patrol": ["Paramedic", "EMT", "EMR"],
  Probationary: ["Medical Intern"],
};

export const ACTIVITY_STATUSES = ["Active", "Reserve", "LOA"] as const;

/**
 * The call sign pool. Call signs carry no rank meaning — 912-998 is the
 * allocatable range; the rest of 900-999 (900-911 and 999) is reserved and
 * never auto-assigned.
 */
export const CALLSIGN_MIN = 900;
export const CALLSIGN_MAX = 999;
export const CALLSIGN_FLOOR = 912;
export const CALLSIGN_CEILING = 998;

export function isReservedCallSign(n: number): boolean {
  return n < CALLSIGN_FLOOR || n > CALLSIGN_CEILING;
}

export const FTO_ROLES = ["FTO", "FTA", "FTI", "Probationary FTI", "PTD Lead"] as const;

export const ALL_PERMISSIONS = [
  "roster.view",
  "roster.add",
  "roster.edit",
  "roster.delete",
  "roster.promote",
  "roster.promote.cadet",
  "hr.view",
  "hr.loa",
  "hr.inactivity",
  "hr.inactivity.approve",
  "removal.request",
  "removal.approve",
  "removal.ptd.approve",
  "sop.view",
  "sop.edit",
  "training.view",
  "training.manage",
  "training.signoff.manage",
  "clock.view",
  "notifications",
  "templates",
  "radio.edit",
  "onboarding.view",
  "onboarding.approve",
  "departments.view",
  "departments.approve",
  "departments.manage",
  "departments.members",
  "roles.manage",
  "audit.view",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export function getRankInfo(rank: string) {
  return RANKS.find((r) => r.name === rank) ?? null;
}

export function getRankWeight(rank: string): number {
  const found = RANKS.find((r) => r.name === rank);
  return found?.weight ?? 0;
}

/**
 * Rank comparison by weight. An unrecognised rank weighs 0, so it fails every
 * threshold rather than passing one by accident.
 */
export function isRankAtLeast(rank: string | null | undefined, minRank: string): boolean {
  if (!rank) return false;
  return getRankWeight(rank) >= getRankWeight(minRank);
}

/** Minimum roster rank permitted to apply for the Field Training Program. */
export const FTP_MIN_RANK = "Paramedic";

/** Ranks that meet FTP_MIN_RANK, highest first — for explaining the rule in the UI. */
export const FTP_ELIGIBLE_RANKS = RANKS
  .filter((r) => r.weight >= getRankWeight(FTP_MIN_RANK))
  .map((r) => r.name);

/**
 * Department permissions, and the older permission each one still accepts.
 *
 * Departments grew out of the FTP form and the Templates page, so before this
 * split their routes were guarded by `onboarding.*`, `templates` and
 * `roster.*`. Those stay valid alongside the new ones: a deployment upgrading
 * to this release must not silently lose access to a section its admins
 * already had, and the roles page has no way to know which permission was
 * meant to imply which. Grant the dedicated permission to narrow access.
 */
export const DEPARTMENT_PERMISSIONS = {
  view: ["departments.view", "onboarding.view"],
  approve: ["departments.approve", "onboarding.approve"],
  manage: ["departments.manage", "templates"],
  members: ["departments.members", "roster.edit"],
} as const satisfies Record<string, readonly string[]>;

/** Every permission that opens the departments console, for the sidebar check. */
export const DEPARTMENT_SECTION_PERMISSIONS: string[] = [
  ...new Set(Object.values(DEPARTMENT_PERMISSIONS).flat()),
];

export function canSeeRosterPages(permissions: string[]): boolean {
  return permissions.includes("roster.view");
}

export function canSeeHRPages(permissions: string[]): boolean {
  return (
    permissions.includes("hr.view") ||
    permissions.includes("hr.loa") ||
    permissions.includes("hr.inactivity") ||
    permissions.includes("hr.inactivity.approve")
  );
}

export function canSeeTrainingPages(permissions: string[]): boolean {
  return (
    permissions.includes("training.view") ||
    permissions.includes("training.manage") ||
    permissions.includes("training.signoff.manage")
  );
}
