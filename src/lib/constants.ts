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
  "shifts.view",
  "shifts.manage",
  "incidents.view",
  "incidents.manage",
  "audit.view",
  "roles.manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export function getRankInfo(rank: string) {
  return RANKS.find((r) => r.name === rank) ?? null;
}

export function getRankWeight(rank: string): number {
  const found = RANKS.find((r) => r.name === rank);
  return found?.weight ?? 0;
}

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

export const RANK_CALLSIGN: Record<string, { fixed?: number; start?: number; end?: number }> = {
  "Director of Medicine": { fixed: 999 },
  "Director of EMS": { fixed: 900 },
  "Chief of EMS": { fixed: 911 },
  "Deputy Chief of EMS": { fixed: 912 },
  "Assistant Chief": { fixed: 913 },
  "Division Chief": { fixed: 914 },
  "EMS Captain": { fixed: 915 },
  "Lieutenant": { start: 920, end: 929 },
  "Senior Paramedic": { start: 930, end: 949 },
  "Paramedic": { start: 950, end: 969 },
  "EMT": { start: 970, end: 979 },
  "EMR": { start: 980, end: 989 },
  "Medical Intern": { start: 990, end: 998 },
};
