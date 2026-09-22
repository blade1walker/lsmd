import { getRankWeight } from "./constants";

/**
 * The Promotion & Interview module's vocabulary, scoring maths and input
 * rules. Client-safe: the session page and the API validate against the same
 * definitions, so a score the form accepts is a score the server stores, and
 * the panel total shown live matches the one written at finalize.
 */

export const SESSION_PREFIX = "EMS-PROMO";

/** EMS-PROMO-2026-0042 — four digits, per year. */
export function formatSessionId(year: number, sequence: number): string {
  return `${SESSION_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ *
 * Evaluation criteria
 * ------------------------------------------------------------------ */

export interface EvaluationCategory {
  /** Column suffix: sopScore / sopNotes, medicalScore / medicalNotes, ... */
  key: "sop" | "medical" | "situation" | "overall";
  label: string;
  /** What the interviewer is being asked to judge. Shown beside the score box. */
  covers: string[];
}

export const EVALUATION_CATEGORIES: EvaluationCategory[] = [
  {
    key: "sop",
    label: "SOP Knowledge",
    covers: [
      "EMS SOP",
      "Department rules",
      "Chain of command",
      "Radio procedures",
      "Hospital procedures",
      "Scene procedures",
      "Treatment procedures",
      "Department policies",
      "Rank responsibilities",
      "Disciplinary procedures",
      "Current EMS updates",
    ],
  },
  {
    key: "medical",
    label: "Medical Knowledge",
    covers: [
      "Basic medical knowledge",
      "Advanced medical knowledge",
      "Treatment procedures",
      "Emergency response",
      "Medical equipment",
      "Patient assessment",
      "Trauma response",
      "CPR / BLS / ALS",
      "Medication knowledge",
      "Hospital procedures",
      "Medical decision-making",
    ],
  },
  {
    key: "situation",
    label: "Situation Knowledge",
    covers: [
      "Emergency scenes",
      "Multiple-patient situations",
      "Hostage and crime scenes",
      "Police interactions",
      "High-pressure situations",
      "Hospital emergencies",
      "Difficult patients",
      "Communication problems",
      "Appropriate escalation",
      "RP situations",
      "Decision-making under pressure",
    ],
  },
  {
    key: "overall",
    label: "Overall Performance",
    covers: [
      "Communication",
      "Professionalism",
      "Confidence",
      "Leadership",
      "Decision-making",
      "Teamwork",
      "Roleplay quality",
      "Knowledge application",
      "Attitude",
      "Readiness for the target rank",
    ],
  },
];

export type CategoryKey = EvaluationCategory["key"];

export const CATEGORY_KEYS: CategoryKey[] = EVALUATION_CATEGORIES.map((c) => c.key);

/* ------------------------------------------------------------------ *
 * Panel roles, statuses and results
 * ------------------------------------------------------------------ */

export const PANEL_ROLES = [
  {
    key: "Lead Interviewer",
    description: "Runs the session, reviews every submission and finalizes the result.",
  },
  { key: "Interviewer", description: "Scores the candidate and records their own notes." },
  { key: "Observer", description: "Reads the session. Cannot score or finalize." },
  {
    key: "Management Reviewer",
    description: "EMS management sitting in. Scores like an interviewer.",
  },
] as const;

export type PanelRole = (typeof PANEL_ROLES)[number]["key"];

export const PANEL_ROLE_KEYS: string[] = PANEL_ROLES.map((r) => r.key);

/** Roles whose evaluation counts toward the panel score. An Observer's never does. */
export const SCORING_ROLES: string[] = ["Lead Interviewer", "Interviewer", "Management Reviewer"];

export function isScoringRole(role: string): boolean {
  return SCORING_ROLES.includes(role);
}

export const RECOMMENDATIONS = [
  "Recommend Promotion",
  "Do Not Recommend",
  "Further Evaluation Required",
] as const;

export type Recommendation = (typeof RECOMMENDATIONS)[number];

/** Session lifecycle. "Finalized" is terminal — nothing about the record changes afterwards. */
export const INTERVIEW_STATUSES = ["Ongoing", "Finalized", "Cancelled"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_RESULTS = ["Pending", "Passed", "Failed", "Review Required"] as const;
export type InterviewResult = (typeof INTERVIEW_RESULTS)[number];

/** The results a Lead may actually settle on. "Pending" is the unfinalized state, not a choice. */
export const FINAL_RESULTS: InterviewResult[] = ["Passed", "Failed", "Review Required"];

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export interface PromotionSettingsValues {
  passingScore: number;
  minSopScore: number;
  minMedicalScore: number;
  minSituationScore: number;
  minOverallScore: number;
  minDaysInRank: number;
  minDaysInDepartment: number;
  minTrainingPercent: number;
  requiredDepartments: string[];
  requireActive: boolean;
  cooldownDays: number;
  requireTrainingCheck: boolean;
  announceWebhook: boolean;
  announcementWebhookUrl: string | null;
  announcementTemplate: string;
}

/** Used when the settings row cannot be read — keep in sync with the schema defaults. */
export const DEFAULT_PROMOTION_SETTINGS: PromotionSettingsValues = {
  passingScore: 70,
  minSopScore: 60,
  minMedicalScore: 60,
  minSituationScore: 60,
  minOverallScore: 60,
  minDaysInRank: 14,
  minDaysInDepartment: 30,
  minTrainingPercent: 0,
  requiredDepartments: [],
  requireActive: true,
  cooldownDays: 14,
  requireTrainingCheck: true,
  announceWebhook: true,
  announcementWebhookUrl: null,
  announcementTemplate:
    "**EMS PROMOTION ANNOUNCEMENT**\n\nCongratulations to <@{discordId}> **{name}** on successfully clearing the EMS Promotion Examination.\n\n**Previous Rank:** {fromRank}\n**New Rank:** {toRank}\n**Final Score:** {finalScore}%\n**Exam Status:** PASSED\n\nThe employee's EMS roster has been updated accordingly.\n\n**Interview Panel:**\n{panel}",
};

/** The minimum score a category average must clear, by category key. */
export function categoryFloor(settings: PromotionSettingsValues, key: CategoryKey): number {
  switch (key) {
    case "sop":
      return settings.minSopScore;
    case "medical":
      return settings.minMedicalScore;
    case "situation":
      return settings.minSituationScore;
    case "overall":
      return settings.minOverallScore;
  }
}

/* ------------------------------------------------------------------ *
 * Records as the API returns them
 * ------------------------------------------------------------------ */

export interface PanelistRecord {
  id: string;
  discordId: string;
  name: string;
  rank: string | null;
  memberId: string | null;
  role: string;
  sopScore: number | null;
  medicalScore: number | null;
  situationScore: number | null;
  overallScore: number | null;
  sopNotes: string | null;
  medicalNotes: string | null;
  situationNotes: string | null;
  overallNotes: string | null;
  recommendation: string | null;
  submittedAt: string | null;
  joinedAt: string;
  /** Average of the four category scores, or null before they submit. */
  individualScore: number | null;
}

export interface InterviewNoteRecord {
  id: string;
  authorDiscordId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface EligibilityVerdict {
  eligible: boolean;
  /** One line per failed rule, ready to show. Empty when eligible. */
  reasons: string[];
  /** Every rule that was checked, so the UI can show what passed as well as what failed. */
  checks: { label: string; ok: boolean; detail: string }[];
}

export interface CandidateSnapshot {
  memberId: string;
  name: string;
  callSign: string | null;
  rank: string;
  activity: string;
  discordId: string | null;
  joinedEmsAt: string | null;
  /** When they reached their current rank: last promotion, else their joining date. */
  rankSince: string | null;
  daysInRank: number;
  daysInDepartment: number;
  trainingPercent: number;
  departments: string[];
  /** Set when a failed attempt still has a cooldown running. */
  cooldownUntil: string | null;
  /** Set when they already have an interview open. */
  openSessionId: string | null;
}

export interface InterviewScores {
  /** Panel average across every submitted scoring evaluation, or null when none. */
  finalScore: number | null;
  categories: Record<CategoryKey, number | null>;
  submitted: number;
  expected: number;
}

export interface InterviewSummary {
  id: string;
  sessionId: string;
  memberId: string | null;
  memberName: string;
  callSign: string | null;
  currentRank: string;
  targetRank: string;
  status: string;
  result: string;
  finalScore: number | null;
  createdByName: string;
  createdAt: string;
  finalizedAt: string | null;
  panelCount: number;
  submittedCount: number;
  /** Live panel score while Ongoing; the frozen one once Finalized. */
  liveScore: number | null;
  panelNames: string[];
}

export interface InterviewDetail extends InterviewSummary {
  discordId: string | null;
  joinedEmsAt: string | null;
  rankSince: string | null;
  categoryScores: Partial<Record<CategoryKey, number>> | null;
  eligibility: EligibilityVerdict | null;
  eligibilityOverride: boolean;
  trainingVerified: boolean;
  trainingVerifiedBy: string | null;
  trainingVerifiedAt: string | null;
  cooldownUntil: string | null;
  improvementNotes: string | null;
  rosterUpdated: boolean;
  promotionRecordId: string | null;
  announcementStatus: string | null;
  announcementDetail: string | null;
  createdByDiscordId: string;
  finalizedByName: string | null;
  updatedAt: string;
  panel: PanelistRecord[];
  notes: InterviewNoteRecord[];
  scores: InterviewScores;
  /** Live candidate figures, recomputed on read so time-in-rank is never stale. */
  candidate: CandidateSnapshot | null;
  /** Earlier attempts by the same candidate, newest first. Never overwritten. */
  attempts: { id: string; sessionId: string; targetRank: string; result: string; status: string; finalScore: number | null; createdAt: string }[];
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

function scoreOf(panelist: PanelistRecord, key: CategoryKey): number | null {
  switch (key) {
    case "sop":
      return panelist.sopScore;
    case "medical":
      return panelist.medicalScore;
    case "situation":
      return panelist.situationScore;
    case "overall":
      return panelist.overallScore;
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * One interviewer's score: the mean of their four categories. Null until all
 * four are filled in, so a half-finished evaluation cannot drag a panel
 * average down by being counted as if it were complete.
 */
export function individualScore(panelist: {
  sopScore: number | null;
  medicalScore: number | null;
  situationScore: number | null;
  overallScore: number | null;
}): number | null {
  const values = [panelist.sopScore, panelist.medicalScore, panelist.situationScore, panelist.overallScore];
  if (values.some((v) => v === null || v === undefined)) return null;
  return average(values as number[]);
}

/**
 * The panel score: the mean of the submitted individual scores.
 *
 * Only submitted evaluations from scoring roles count. A draft an interviewer
 * is still typing, and an Observer's row, are both excluded — otherwise the
 * headline number would move every time somebody saved a box.
 */
export function panelScores(panel: PanelistRecord[]): InterviewScores {
  const scoring = panel.filter((p) => isScoringRole(p.role));
  const submitted = scoring.filter((p) => p.submittedAt !== null && p.individualScore !== null);

  const categories = {} as Record<CategoryKey, number | null>;
  for (const key of CATEGORY_KEYS) {
    categories[key] = average(
      submitted.map((p) => scoreOf(p, key)).filter((v): v is number => typeof v === "number")
    );
  }

  return {
    finalScore: average(submitted.map((p) => p.individualScore as number)),
    categories,
    submitted: submitted.length,
    expected: scoring.length,
  };
}

export interface ThresholdVerdict {
  /** What the thresholds say the result should be. The Lead still chooses. */
  suggested: InterviewResult;
  passes: boolean;
  /** One line per threshold that was not met. */
  failures: string[];
}

/**
 * Applies the configured thresholds to a panel score. Advisory only — it fills
 * in the Lead's default choice and explains it; the finalize route stores
 * whatever the Lead actually picked.
 */
export function evaluateThresholds(
  scores: InterviewScores,
  settings: PromotionSettingsValues
): ThresholdVerdict {
  if (scores.finalScore === null) {
    return { suggested: "Pending", passes: false, failures: ["No evaluation has been submitted yet"] };
  }

  const failures: string[] = [];
  if (scores.finalScore < settings.passingScore) {
    failures.push(`Final score ${scores.finalScore}% is below the ${settings.passingScore}% passing score`);
  }
  for (const category of EVALUATION_CATEGORIES) {
    const value = scores.categories[category.key];
    const floor = categoryFloor(settings, category.key);
    if (value !== null && value < floor) {
      failures.push(`${category.label} ${value}% is below the ${floor}% minimum`);
    }
  }

  return { suggested: failures.length === 0 ? "Passed" : "Failed", passes: failures.length === 0, failures };
}

/* ------------------------------------------------------------------ *
 * Durations
 * ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two dates, counted by calendar date in UTC. Shared with the Trainee section's rule. */
export function daysBetween(start: Date, end: Date): number {
  const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const to = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.round((to - from) / DAY_MS));
}

/**
 * "12 Days", "2 Months, 14 Days", "1 Year, 3 Months" — how long someone has
 * held a rank, in the units a reader actually thinks in. Months are calendar
 * months walked forward from the start date, not a 30-day approximation, so
 * "1 Year" lands on the anniversary rather than eleven days early.
 */
export function formatDuration(from: Date | string | null, to: Date | string = new Date()): string {
  if (!from) return "Unknown";
  const start = typeof from === "string" ? new Date(from) : from;
  const end = typeof to === "string" ? new Date(to) : to;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Unknown";
  if (end <= start) return "0 Days";

  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  const anniversary = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate())
  );
  if (anniversary > end) {
    months -= 1;
    anniversary.setUTCMonth(anniversary.getUTCMonth() - 1);
  }

  const days = daysBetween(anniversary, end);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} Year${years === 1 ? "" : "s"}`);
  if (remainingMonths > 0) parts.push(`${remainingMonths} Month${remainingMonths === 1 ? "" : "s"}`);
  // Days are dropped once the span is a year or more — "1 Year, 3 Months, 2
  // Days" is noise at that scale, and the exact date is shown beside it.
  if (days > 0 && years === 0) parts.push(`${days} Day${days === 1 ? "" : "s"}`);

  return parts.length ? parts.join(", ") : "0 Days";
}

/* ------------------------------------------------------------------ *
 * Input validation
 * ------------------------------------------------------------------ */

export const MAX_PANEL = 10;
export const MAX_NOTE_LENGTH = 4000;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

/** A 0-100 integer, or null when the box is empty. Anything else is rejected, not clamped. */
export function parseScore(value: unknown): { score: number | null } | { error: string } {
  if (value === null || value === undefined || value === "") return { score: null };
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { error: "Scores must be whole numbers" };
  if (n < 0 || n > 100) return { error: "Scores must be between 0 and 100" };
  return { score: n };
}

export interface EvaluationInput {
  sopScore: number | null;
  medicalScore: number | null;
  situationScore: number | null;
  overallScore: number | null;
  sopNotes: string | null;
  medicalNotes: string | null;
  situationNotes: string | null;
  overallNotes: string | null;
  recommendation: string | null;
  /** True to submit the evaluation; false saves it as a draft. */
  submit: boolean;
}

export function parseEvaluationInput(body: unknown): { data: EvaluationInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Nothing was submitted" };
  const b = body as Record<string, unknown>;

  const scores: Partial<Record<`${CategoryKey}Score`, number | null>> = {};
  for (const key of CATEGORY_KEYS) {
    const parsed = parseScore(b[`${key}Score`]);
    if ("error" in parsed) return { error: parsed.error };
    scores[`${key}Score`] = parsed.score;
  }

  const submit = b.submit === true;
  if (submit && CATEGORY_KEYS.some((key) => scores[`${key}Score`] === null)) {
    return { error: "Score all four categories before submitting" };
  }

  const recommendation = typeof b.recommendation === "string" ? b.recommendation : null;
  if (recommendation && !(RECOMMENDATIONS as readonly string[]).includes(recommendation)) {
    return { error: "Choose a valid promotion recommendation" };
  }

  return {
    data: {
      sopScore: scores.sopScore ?? null,
      medicalScore: scores.medicalScore ?? null,
      situationScore: scores.situationScore ?? null,
      overallScore: scores.overallScore ?? null,
      sopNotes: text(b.sopNotes, 2000),
      medicalNotes: text(b.medicalNotes, 2000),
      situationNotes: text(b.situationNotes, 2000),
      overallNotes: text(b.overallNotes, 2000),
      recommendation,
      submit,
    },
  };
}

export interface CreateInterviewInput {
  memberId: string;
  targetRank: string;
  /** Panel to seed the session with, beyond the creator. */
  panel: { discordId: string; role: string }[];
  /** Proceed despite a failed eligibility check. Needs interviews.manage. */
  overrideEligibility: boolean;
}

export function parseCreateInput(
  body: unknown,
  rankNames: readonly string[]
): { data: CreateInterviewInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Nothing was submitted" };
  const b = body as Record<string, unknown>;

  const memberId = text(b.memberId, 60);
  if (!memberId) return { error: "Choose the EMS employee being interviewed" };

  const targetRank = typeof b.targetRank === "string" ? b.targetRank : "";
  if (!rankNames.includes(targetRank)) return { error: "Choose the rank they are being evaluated for" };

  const rawPanel = Array.isArray(b.panel) ? b.panel : [];
  const panel: { discordId: string; role: string }[] = [];
  for (const entry of rawPanel) {
    if (!entry || typeof entry !== "object") continue;
    const discordId = text((entry as { discordId?: unknown }).discordId, 40);
    if (!discordId || panel.some((p) => p.discordId === discordId)) continue;
    const role = (entry as { role?: unknown }).role;
    panel.push({
      discordId,
      role: typeof role === "string" && PANEL_ROLE_KEYS.includes(role) ? role : "Interviewer",
    });
  }
  if (panel.length > MAX_PANEL) return { error: `A panel can hold at most ${MAX_PANEL} people` };

  return {
    data: { memberId, targetRank, panel, overrideEligibility: b.overrideEligibility === true },
  };
}

/* ------------------------------------------------------------------ *
 * Display helpers
 * ------------------------------------------------------------------ */

export const RESULT_STYLES: Record<string, string> = {
  Passed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Failed: "bg-red-500/10 text-red-400 border-red-500/20",
  Pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Review Required": "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export const STATUS_STYLES: Record<string, string> = {
  Ongoing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Finalized: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  Cancelled: "bg-gray-700/40 text-gray-500 border-gray-700",
};

/** Green above the passing score, amber within 10 points of it, red below. */
export function scoreColor(score: number | null, passingScore: number): string {
  if (score === null) return "text-gray-500";
  if (score >= passingScore) return "text-emerald-400";
  if (score >= passingScore - 10) return "text-amber-400";
  return "text-red-400";
}

/* ------------------------------------------------------------------ *
 * Eligibility
 * ------------------------------------------------------------------ */

/**
 * Whether a candidate meets the configured promotion requirements for a target
 * rank. Every rule is reported whether it passed or failed, so "Not Yet
 * Eligible" always comes with the exact reason rather than a bare verdict.
 *
 * Advisory by design: interviews.manage may open a session anyway, and the
 * verdict is stored on the record so the override is visible afterwards.
 */
export function evaluateEligibility(
  candidate: CandidateSnapshot,
  targetRank: string,
  settings: PromotionSettingsValues
): EligibilityVerdict {
  const checks: EligibilityVerdict["checks"] = [];

  const targetWeight = getRankWeight(targetRank);
  const currentWeight = getRankWeight(candidate.rank);
  checks.push({
    label: "Target rank",
    ok: targetWeight > currentWeight,
    detail:
      targetWeight > currentWeight
        ? `${candidate.rank} → ${targetRank}`
        : `${targetRank} is not above ${candidate.rank}`,
  });

  checks.push({
    label: "Time in current rank",
    ok: candidate.daysInRank >= settings.minDaysInRank,
    detail: `${candidate.daysInRank} of ${settings.minDaysInRank} days required`,
  });

  checks.push({
    label: "Total EMS tenure",
    ok: candidate.daysInDepartment >= settings.minDaysInDepartment,
    detail: `${candidate.daysInDepartment} of ${settings.minDaysInDepartment} days required`,
  });

  if (settings.minTrainingPercent > 0) {
    checks.push({
      label: "Training completion",
      ok: candidate.trainingPercent >= settings.minTrainingPercent,
      detail: `${candidate.trainingPercent}% of ${settings.minTrainingPercent}% required`,
    });
  }

  for (const department of settings.requiredDepartments) {
    checks.push({
      label: `${department} membership`,
      ok: candidate.departments.includes(department),
      detail: candidate.departments.includes(department) ? "Member" : `Not a member of ${department}`,
    });
  }

  if (settings.requireActive) {
    checks.push({
      label: "Roster status",
      ok: candidate.activity === "Active",
      detail: candidate.activity === "Active" ? "Active" : `Currently ${candidate.activity}`,
    });
  }

  if (candidate.cooldownUntil) {
    checks.push({
      label: "Re-interview cooldown",
      ok: false,
      detail: `A failed attempt blocks a new interview until ${new Date(candidate.cooldownUntil).toLocaleDateString()}`,
    });
  }

  if (candidate.openSessionId) {
    checks.push({
      label: "Open interview",
      ok: false,
      detail: `${candidate.openSessionId} is still ongoing`,
    });
  }

  const reasons = checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`);
  return { eligible: reasons.length === 0, reasons, checks };
}
