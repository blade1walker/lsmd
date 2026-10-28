export const SUPER_ADMIN_IDS = [
  "721646919222427648",
  "620175830123020291",
  "388728397771177988",
  "525942483692158976",
  "1170690398558097511",
];

export const RANK_SHAPES = ["none", "pip", "chevron", "bar", "star"] as const;
export type RankShape = (typeof RANK_SHAPES)[number];
/** How a badge's shapes sit: side by side, on top of each other, or in a triangle. */
export const RANK_LAYOUTS = ["row", "stack", "pyramid"] as const;
export type RankLayout = (typeof RANK_LAYOUTS)[number];
export const RANK_MAX_COUNT = 5;
export const DEFAULT_RANK_COLOR = "#dc2626";

export interface RankDef {
  name: string;
  tier: string;
  shape: RankShape;
  count: number;
  color: string;
  layout: RankLayout;
  /** Higher outranks lower. Derived from the position in the ladder, never stored. */
  weight: number;
}

/** What an admin can change on a rank (Admin → Ranks), stored as a RankSetting row. */
export interface RankOverride {
  name: string;
  position: number;
  shape: string;
  count: number;
  color: string | null;
  layout: string;
}

/**
 * The rank ladder as shipped, highest first. Names and tiers are fixed here;
 * the order and each badge can be changed in Admin → Ranks, and RANKS below
 * reflects those changes.
 */
export const DEFAULT_RANKS: readonly Omit<RankDef, "weight" | "color" | "layout">[] = [
  { name: "Medical Director", tier: "High Command", shape: "star", count: 5 },
  { name: "Director of EMS", tier: "High Command", shape: "star", count: 4 },
  { name: "Chief of EMS", tier: "High Command", shape: "star", count: 3 },
  { name: "Deputy Chief of EMS", tier: "High Command", shape: "star", count: 2 },
  { name: "Assistant Chief", tier: "High Command", shape: "star", count: 1 },
  { name: "Division Chief", tier: "Command", shape: "bar", count: 2 },
  { name: "EMS Captain", tier: "Command", shape: "bar", count: 1 },
  { name: "Lieutenant", tier: "Command", shape: "chevron", count: 3 },
  { name: "Senior Paramedic", tier: "NCO", shape: "chevron", count: 2 },
  { name: "Paramedic", tier: "Patrol", shape: "chevron", count: 1 },
  { name: "EMT", tier: "Patrol", shape: "pip", count: 2 },
  { name: "EMR", tier: "Patrol", shape: "pip", count: 1 },
  { name: "Medical Intern", tier: "Probationary", shape: "none", count: 0 },
];

/** The ladder with admin changes applied: ordered by position, weights from the order. */
export function buildRanks(overrides: readonly RankOverride[] = []): RankDef[] {
  const byName = new Map(overrides.map((o) => [o.name, o]));
  const ordered = DEFAULT_RANKS.map((rank, index) => ({ rank, o: byName.get(rank.name), index })).sort(
    (a, b) => (a.o?.position ?? a.index) - (b.o?.position ?? b.index) || a.index - b.index
  );
  return ordered.map(({ rank, o }, i) => ({
    name: rank.name,
    tier: rank.tier,
    shape: o && (RANK_SHAPES as readonly string[]).includes(o.shape) ? (o.shape as RankShape) : rank.shape,
    count: o ? Math.max(0, Math.min(RANK_MAX_COUNT, Math.round(o.count))) : rank.count,
    color: o?.color && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : DEFAULT_RANK_COLOR,
    layout: o && (RANK_LAYOUTS as readonly string[]).includes(o.layout) ? (o.layout as RankLayout) : "row",
    weight: ordered.length - i,
  }));
}

declare global {
  // Shared by every copy of this module in one process (Next bundles it into
  // several server layers) and, in the browser, set before the app loads by
  // the /api/rank-config script in the root layout.
  var __lsmdRanks: { ranks: RankDef[]; names: string[]; ftp?: string[] } | undefined;
  var __LSMD_RANK_OVERRIDES__: RankOverride[] | undefined;
}

const rankStore: NonNullable<typeof globalThis.__lsmdRanks> = (globalThis.__lsmdRanks ??= (() => {
  const ranks = buildRanks(globalThis.__LSMD_RANK_OVERRIDES__);
  return { ranks, names: ranks.map((r) => r.name) };
})());

/**
 * The ladder, highest first. The array is updated in place when an admin
 * changes the ranks (applyRankOverrides), so every importer sees the change
 * without re-importing.
 */
export const RANKS: readonly RankDef[] = rankStore.ranks;
export const RANK_LIST: readonly string[] = rankStore.names;
export const RANK_NAMES = RANK_LIST;

/** Puts admin rank changes into effect in this process (server) or page (browser). */
export function applyRankOverrides(overrides: readonly RankOverride[]) {
  const next = buildRanks(overrides);
  rankStore.ranks.splice(0, rankStore.ranks.length, ...next);
  rankStore.names.splice(0, rankStore.names.length, ...next.map((r) => r.name));
  if (rankStore.ftp) rankStore.ftp.splice(0, rankStore.ftp.length, ...ftpEligibleRanks());
}

export const SECTION_HINTS: Record<string, string[]> = {
  "High Command": ["Medical Director", "Director of EMS", "Chief of EMS", "Deputy Chief of EMS", "Assistant Chief"],
  Command: ["Division Chief", "EMS Captain", "Lieutenant"],
  Lead: ["Senior Paramedic"],
  "Medical Patrol": ["Paramedic", "EMT", "EMR"],
  Probationary: ["Medical Intern"],
};

/**
 * Roster ranks that count as a trainee. The Trainee Section lists exactly the
 * members on one of these ranks, read live from the roster — so changing a
 * member's rank to anything else takes them off it with nothing to clean up.
 */
export const TRAINEE_RANKS: string[] = ["Medical Intern"];

export function isTraineeRank(rank: string | null | undefined): boolean {
  return !!rank && TRAINEE_RANKS.includes(rank);
}

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
  "shifts.view",
  "shifts.manage",
  "export.data",
  // Medical documentation. Split along the three roles the module is built
  // for: a doctor writes and finalizes, a senior doctor reviews and reopens,
  // and medical command builds the forms everyone else fills in.
  "medical.view",
  "medical.create",
  "medical.finalize",
  "medical.review",
  "medical.export",
  "medical.forms.manage",
  "medical.types.manage",
  // Reading what changed on the site. Meant for every member, so it sits in
  // the EMS Member preset.
  "changelog.view",
  // Editing the spotlight strip across the public roster.
  "roster.announce",
  // Clocking yourself on and off duty. Distinct from clock.view, which is
  // reading everyone's hours and clocking other members.
  "clock.self",
  // EMS Call Log. create logs a call and sees your own calls; view reads the
  // whole log (calls carry patient details); manage edits or deletes any call.
  "calls.view",
  "calls.create",
  "calls.manage",
  // Trainee Section: every member still on a trainee rank, with days served.
  "trainees.view",
  // Promotion History: the permanent record of every rank change.
  "promotions.view",
  // Promotion & Interview. Split along what each person on a panel actually
  // does: an Observer reads, an Interviewer scores, a Lead finalizes, and
  // only management creates sessions or edits the thresholds.
  "interviews.view",
  "interviews.create",
  "interviews.score",
  "interviews.finalize",
  "interviews.manage",
  // Settling a result the panel held for review, and resending an
  // announcement Discord refused.
  "interviews.review",
  // The Promotion Readiness board: who is eligible for their next rank now,
  // and who will be shortly.
  "interviews.readiness",
  // Interview Analytics: pass rates, category weak spots and how each
  // interviewer scores against the panel.
  "interviews.analytics",
  // Downloading an examination as a PDF report for the record.
  "interviews.export",
  // Discord announcements the Nexus EMS bot posts, now or on a schedule.
  "announcements.view",
  "announcements.manage",
  // Who may use which Nexus EMS Bot command in Discord.
  "bot.permissions.view",
  "bot.permissions.manage",
  // FiveM City Link. view reads who is in the city, how they matched the
  // roster and where duty disagrees; manage sets the server address and what
  // the link is allowed to do.
  "fivem.view",
  "fivem.manage",
  // Duty Board: changing another medic's unit status. Setting your own only
  // needs you to be on duty.
  "duty.manage",
  // Activity: every member's duty hours, city time and calls measured against
  // the weekly requirement; manage sets the requirement.
  "activity.view",
  "activity.manage",
  // Tests & Quizzes. manage builds and publishes tests; grade reads every
  // member's attempts and marks the written answers. Taking a test needs no
  // permission beyond being signed in on the roster.
  "tests.manage",
  "tests.grade",
  // Rank ladder order and each rank's insignia (Admin → Ranks).
  "ranks.manage",
] as const;

/**
 * Any permission that should open the Medical Documentation section — a
 * doctor who can only fill forms and a commander who only builds them both
 * belong in there.
 */
export const MEDICAL_SECTION_PERMISSIONS: string[] = [
  "medical.view",
  "medical.create",
  "medical.finalize",
  "medical.review",
  "medical.export",
  "medical.forms.manage",
  "medical.types.manage",
];

/** Permissions that open the Form Builder and the rest of the admin side of the module. */
export const MEDICAL_ADMIN_PERMISSIONS: string[] = ["medical.forms.manage", "medical.types.manage"];

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

function ftpEligibleRanks(): string[] {
  return RANKS.filter((r) => r.weight >= getRankWeight(FTP_MIN_RANK)).map((r) => r.name);
}

/** Ranks that meet FTP_MIN_RANK, highest first — for explaining the rule in the UI. */
export const FTP_ELIGIBLE_RANKS: string[] = (rankStore.ftp ??= ftpEligibleRanks());

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

/**
 * Shift signup permissions. `view` covers both submitting a shift pick and
 * reading the schedule — this is meant to be granted broadly to EMS members,
 * not just admin staff. `manage` is only needed to clear someone else's entry.
 */
export const SHIFT_PERMISSIONS = {
  view: ["shifts.view"],
  manage: ["shifts.manage"],
} as const satisfies Record<string, readonly string[]>;

/** Every permission that opens the shifts section, for the sidebar check. */
export const SHIFT_SECTION_PERMISSIONS: string[] = [
  ...new Set(Object.values(SHIFT_PERMISSIONS).flat()),
];

/**
 * EMS Call Log permissions. Split three ways because a call carries a patient's
 * name and State ID: every medic can log calls and see their own, but reading
 * the whole log is a supervisor's view.
 */
export const CALL_PERMISSIONS = {
  create: ["calls.create"],
  view: ["calls.view"],
  manage: ["calls.manage"],
} as const satisfies Record<string, readonly string[]>;

/** Any permission that opens the Call Log, for the sidebar check. */
export const CALL_SECTION_PERMISSIONS: string[] = [
  ...new Set(Object.values(CALL_PERMISSIONS).flat()),
];

/**
 * Data export. Held deliberately narrow and granted to nobody by default: one
 * download carries every Discord ID, state ID, DM transcript and HR note in
 * the panel, so this is a "who may take the whole database out of the
 * building" permission, not a convenience.
 */
export const EXPORT_PERMISSIONS = {
  data: ["export.data"],
} as const satisfies Record<string, readonly string[]>;

/** Every permission that opens the export section, for the sidebar check. */
export const EXPORT_SECTION_PERMISSIONS: string[] = [
  ...new Set(Object.values(EXPORT_PERMISSIONS).flat()),
];

/**
 * Promotion & Interview permissions.
 *
 * `view` is the Observer's read of a session; `score` lets someone join a
 * panel and submit their own evaluation; `finalize` is the Lead Interviewer's
 * authority to settle the result and trigger the promotion; `create` opens a
 * session, schedules it and builds its panel; `manage` covers the thresholds,
 * cancelling a session and deleting one; `review` settles a result the panel
 * held as "Review Required" and resends a failed announcement; `readiness`
 * and `analytics` open their own pages; `export` downloads a session report.
 *
 * Deliberately separate from `roster.promote`: a panel member scores a
 * candidate without ever being able to edit the roster by hand, and the roster
 * rank change on a pass is made by the finalize route on the panel's behalf.
 */
export const INTERVIEW_PERMISSIONS = {
  view: ["interviews.view"],
  create: ["interviews.create"],
  score: ["interviews.score"],
  finalize: ["interviews.finalize"],
  manage: ["interviews.manage"],
  review: ["interviews.review"],
  readiness: ["interviews.readiness"],
  analytics: ["interviews.analytics"],
  export: ["interviews.export"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Any permission that opens the Promotion & Interview dashboard and its
 * sessions, for the sidebar check. Readiness and Analytics are left out: they
 * are pages of their own with their own sidebar entries, and holding only one
 * of them says nothing about reading examinations.
 */
export const INTERVIEW_SECTION_PERMISSIONS: string[] = [
  ...INTERVIEW_PERMISSIONS.view,
  ...INTERVIEW_PERMISSIONS.create,
  ...INTERVIEW_PERMISSIONS.score,
  ...INTERVIEW_PERMISSIONS.finalize,
  ...INTERVIEW_PERMISSIONS.manage,
  ...INTERVIEW_PERMISSIONS.review,
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

/**
 * Discord announcements. `view` reads the schedule and history; `manage`
 * posts, schedules, edits and cancels. In Discord itself, who may run the
 * bot's /announce command is set in Server Settings → Integrations — these
 * cover the same data reached from the site's API.
 */
export const ANNOUNCEMENT_PERMISSIONS = {
  view: ["announcements.view", "announcements.manage"],
  manage: ["announcements.manage"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Nexus EMS Bot command access. `view` lists who can use which bot command;
 * `manage` grants and revokes it. In Discord the same grants are managed with
 * the bot's /permissions command, which server administrators can always use.
 */
export const BOT_PERMISSION_PERMISSIONS = {
  view: ["bot.permissions.view", "bot.permissions.manage"],
  manage: ["bot.permissions.manage"],
} as const satisfies Record<string, readonly string[]>;

/** Any permission that opens the Bot Permissions page, for the sidebar check. */
export const BOT_PERMISSION_SECTION_PERMISSIONS: string[] = [...BOT_PERMISSION_PERMISSIONS.view];

/**
 * FiveM City Link. `view` opens the live player list, roster matches and the
 * duty mismatches; `manage` edits the server address and toggles. What the
 * public sees of the server is decided by the settings, not by a permission.
 */
export const FIVEM_PERMISSIONS = {
  view: ["fivem.view", "fivem.manage"],
  manage: ["fivem.manage"],
} as const satisfies Record<string, readonly string[]>;

/** Any permission that opens the City Link page, for the sidebar check. */
export const FIVEM_SECTION_PERMISSIONS: string[] = [...FIVEM_PERMISSIONS.view];

/**
 * Duty Board. Reading it is part of being on the roster, so it rides on
 * roster.view like the roster's own Duty column. `manage` sets other medics'
 * unit status — a supervisor's or dispatcher's job.
 */
export const DUTY_BOARD_PERMISSIONS = {
  view: ["roster.view"],
  manage: ["duty.manage"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Activity. `view` reads every member's hours and calls against the weekly
 * requirement; `manage` changes the requirement.
 */
export const ACTIVITY_PERMISSIONS = {
  view: ["activity.view", "activity.manage"],
  manage: ["activity.manage"],
} as const satisfies Record<string, readonly string[]>;

/** Any permission that opens the Activity page, for the sidebar check. */
export const ACTIVITY_SECTION_PERMISSIONS: string[] = [...ACTIVITY_PERMISSIONS.view];

/**
 * Tests & Quizzes. `manage` builds, edits and publishes tests; `grade` reads
 * the results and marks answers that need a person. A builder can always see
 * the results of the tests they build.
 */
export const TEST_PERMISSIONS = {
  manage: ["tests.manage"],
  grade: ["tests.grade", "tests.manage"],
} as const satisfies Record<string, readonly string[]>;

/** Admin → Ranks: reorder the ladder and set each rank's insignia. */
export const RANK_PERMISSIONS = {
  manage: ["ranks.manage"],
} as const satisfies Record<string, readonly string[]>;

/** Any permission that opens the Tests page, for the sidebar check. */
export const TEST_SECTION_PERMISSIONS: string[] = [...TEST_PERMISSIONS.grade];
