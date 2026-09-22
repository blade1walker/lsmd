import { prisma } from "./prisma";
import { hasPermission, type Access } from "./access";
import { overallProgress, parseEmsProgress } from "./training";
import type { Prisma } from "@/generated/prisma/client";
import {
  CATEGORY_KEYS,
  DEFAULT_PROMOTION_SETTINGS,
  MAX_PANEL,
  SESSION_PREFIX,
  daysBetween,
  evaluateEligibility,
  formatSessionId,
  individualScore,
  isScoringRole,
  panelScores,
  parseWaivers,
  type CandidateSnapshot,
  type CategoryKey,
  type EligibilityVerdict,
  type EligibilityWaiver,
  type InterviewDetail,
  type InterviewSummary,
  type PanelistRecord,
  type PromotionSettingsValues,
} from "./interviews";

/**
 * Server half of the Promotion & Interview module: the settings row, session
 * numbering, the query shapes, serialization, the eligibility check and the
 * access rules. Split from ./interviews so the session page can import the
 * criteria and the scoring maths without pulling Prisma into the browser
 * bundle — the same split the medical module uses.
 */

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

/** The thresholds row, created on first read so the section works before anyone visits its settings. */
export async function getPromotionSettings(): Promise<PromotionSettingsValues> {
  try {
    const row = await prisma.promotionSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });
    return {
      passingScore: row.passingScore,
      minSopScore: row.minSopScore,
      minMedicalScore: row.minMedicalScore,
      minSituationScore: row.minSituationScore,
      minOverallScore: row.minOverallScore,
      minDaysInRank: row.minDaysInRank,
      minDaysInDepartment: row.minDaysInDepartment,
      minTrainingPercent: row.minTrainingPercent,
      requiredDepartments: row.requiredDepartments,
      requireActive: row.requireActive,
      cooldownDays: row.cooldownDays,
      requireTrainingCheck: row.requireTrainingCheck,
      announceWebhook: row.announceWebhook,
      announcementWebhookUrl: row.announcementWebhookUrl,
      announcementTemplate: row.announcementTemplate,
    };
  } catch {
    // A deployment that has not run `db:push` yet still gets a working section
    // on the documented defaults, rather than a 500 on every page.
    return { ...DEFAULT_PROMOTION_SETTINGS };
  }
}

/* ------------------------------------------------------------------ *
 * Session numbering
 * ------------------------------------------------------------------ */

/**
 * Claims the next session id for the year.
 *
 * Reuses MedicalNumberSequence — despite the name it is a plain per-prefix,
 * per-year counter, and its upsert compiles to a single INSERT … ON CONFLICT
 * DO UPDATE, so two sessions created at the same moment get consecutive ids
 * rather than the same one. A second counter table would be the same three
 * columns with a different name.
 */
export async function claimSessionId(now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const sequence = await prisma.medicalNumberSequence.upsert({
    where: { prefix_year: { prefix: SESSION_PREFIX, year } },
    create: { prefix: SESSION_PREFIX, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return formatSessionId(year, sequence.lastNumber);
}

/* ------------------------------------------------------------------ *
 * Query shapes and serialization
 * ------------------------------------------------------------------ */

export const INTERVIEW_INCLUDE = {
  panel: { orderBy: { joinedAt: "asc" as const } },
  notes: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.PromotionInterviewInclude;

type InterviewWithPanel = Prisma.PromotionInterviewGetPayload<{ include: typeof INTERVIEW_INCLUDE }>;

export function toPanelistRecord(p: InterviewWithPanel["panel"][number]): PanelistRecord {
  return {
    id: p.id,
    discordId: p.discordId,
    name: p.name,
    rank: p.rank,
    memberId: p.memberId,
    role: p.role,
    sopScore: p.sopScore,
    medicalScore: p.medicalScore,
    situationScore: p.situationScore,
    overallScore: p.overallScore,
    sopNotes: p.sopNotes,
    medicalNotes: p.medicalNotes,
    situationNotes: p.situationNotes,
    overallNotes: p.overallNotes,
    recommendation: p.recommendation,
    submittedAt: p.submittedAt?.toISOString() ?? null,
    joinedAt: p.joinedAt.toISOString(),
    individualScore: individualScore(p),
  };
}

export function toSummary(interview: InterviewWithPanel): InterviewSummary {
  const panel = interview.panel.map(toPanelistRecord);
  const live = panelScores(panel);
  return {
    id: interview.id,
    sessionId: interview.sessionId,
    memberId: interview.memberId,
    memberName: interview.memberName,
    callSign: interview.callSign,
    currentRank: interview.currentRank,
    targetRank: interview.targetRank,
    status: interview.status,
    result: interview.result,
    finalScore: interview.finalScore,
    createdByName: interview.createdByName,
    createdAt: interview.createdAt.toISOString(),
    finalizedAt: interview.finalizedAt?.toISOString() ?? null,
    panelCount: panel.length,
    submittedCount: live.submitted,
    // The frozen score once finalized, the running one while the panel is
    // still working — so a finished record never moves if someone's row is
    // read differently later.
    liveScore: interview.finalScore ?? live.finalScore,
    panelNames: panel.map((p) => p.name),
  };
}

function parseJsonObject<T>(value: unknown, fallback: T): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : fallback;
}

export function toDetail(
  interview: InterviewWithPanel,
  candidate: CandidateSnapshot | null,
  attempts: InterviewDetail["attempts"],
  /** The current thresholds, for re-running the eligibility rules as they stand today. */
  settings?: PromotionSettingsValues
): InterviewDetail {
  const panel = interview.panel.map(toPanelistRecord);
  const summary = toSummary(interview);
  const stored = parseJsonObject<Partial<Record<CategoryKey, number>> | null>(interview.categoryScores, null);
  const eligibility = parseJsonObject<EligibilityVerdict | null>(interview.eligibility, null);
  const waivers = parseWaivers(interview.eligibilityWaivers);

  // Only worth re-running while the session is open: once finalized, what
  // matters is what was true when the panel decided, not today.
  const liveEligibility =
    candidate && settings && interview.status === "Ongoing"
      ? evaluateEligibility(candidate, interview.targetRank, settings, waivers)
      : null;

  return {
    ...summary,
    discordId: interview.discordId,
    joinedEmsAt: interview.joinedEmsAt?.toISOString() ?? null,
    rankSince: interview.rankSince?.toISOString() ?? null,
    categoryScores: stored && Object.keys(stored).length ? stored : null,
    eligibility: eligibility && Array.isArray(eligibility.checks) ? eligibility : null,
    liveEligibility,
    eligibilityWaivers: waivers,
    eligibilityOverride: interview.eligibilityOverride,
    trainingVerified: interview.trainingVerified,
    trainingVerifiedBy: interview.trainingVerifiedBy,
    trainingVerifiedAt: interview.trainingVerifiedAt?.toISOString() ?? null,
    cooldownUntil: interview.cooldownUntil?.toISOString() ?? null,
    improvementNotes: interview.improvementNotes,
    rosterUpdated: interview.rosterUpdated,
    promotionRecordId: interview.promotionRecordId,
    announcementStatus: interview.announcementStatus,
    announcementDetail: interview.announcementDetail,
    createdByDiscordId: interview.createdByDiscordId,
    finalizedByName: interview.finalizedByName,
    updatedAt: interview.updatedAt.toISOString(),
    panel,
    notes: interview.notes.map((n) => ({
      id: n.id,
      authorDiscordId: n.authorDiscordId,
      authorName: n.authorName,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
    scores: panelScores(panel),
    candidate,
    attempts,
  };
}

/* ------------------------------------------------------------------ *
 * The candidate
 * ------------------------------------------------------------------ */

const CANDIDATE_SELECT = {
  id: true,
  name: true,
  callSign: true,
  rank: true,
  activity: true,
  discordId: true,
  dateOfJoining: true,
  lastPromotion: true,
  createdAt: true,
  departmentMemberships: { select: { department: { select: { name: true } } } },
  trainingRecord: { select: { emsProgress: true } },
} satisfies Prisma.MemberSelect;

type CandidateRow = Prisma.MemberGetPayload<{ select: typeof CANDIDATE_SELECT }>;

/**
 * Everything the eligibility rules and the employee panel read, computed live
 * rather than from the snapshot on the interview — time in rank has to be
 * right on the day the panel sits, not on the day the session was opened.
 *
 * A member with no joining date still has a start: the day their roster row
 * was created, the same fallback the Trainee section uses.
 */
export async function candidateSnapshot(
  memberId: string,
  now = new Date(),
  /**
   * A session to leave out of the "already has an open interview" and cooldown
   * lookups. Passed when re-checking a candidate for the session they are
   * already sitting — otherwise every open interview would report itself as
   * the thing blocking it.
   */
  excludeInterviewId?: string
): Promise<CandidateSnapshot | null> {
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: CANDIDATE_SELECT });
  if (!member) return null;

  const exclude = excludeInterviewId ? { id: { not: excludeInterviewId } } : {};

  const [cooldown, open] = await Promise.all([
    prisma.promotionInterview.findFirst({
      where: { memberId, cooldownUntil: { gt: now }, ...exclude },
      orderBy: { cooldownUntil: "desc" },
      select: { cooldownUntil: true },
    }),
    prisma.promotionInterview.findFirst({
      where: { memberId, status: "Ongoing", ...exclude },
      orderBy: { createdAt: "desc" },
      select: { sessionId: true },
    }),
  ]);

  return buildSnapshot(member, now, cooldown?.cooldownUntil ?? null, open?.sessionId ?? null);
}

export function buildSnapshot(
  member: CandidateRow,
  now: Date,
  cooldownUntil: Date | null,
  openSessionId: string | null
): CandidateSnapshot {
  const joined = member.dateOfJoining ?? member.createdAt;
  const rankSince = member.lastPromotion ?? joined;
  const progress = parseEmsProgress(member.trainingRecord?.emsProgress ?? {});

  return {
    memberId: member.id,
    name: member.name,
    callSign: member.callSign,
    rank: member.rank,
    activity: member.activity,
    discordId: member.discordId,
    joinedEmsAt: joined.toISOString(),
    rankSince: rankSince.toISOString(),
    daysInRank: daysBetween(rankSince, now),
    daysInDepartment: daysBetween(joined, now),
    trainingPercent: overallProgress(progress).percent,
    departments: member.departmentMemberships.map((m) => m.department.name),
    cooldownUntil: cooldownUntil?.toISOString() ?? null,
    openSessionId,
  };
}

/** The select used by the candidate list, so the picker and the checker read the same fields. */
export { CANDIDATE_SELECT };

/**
 * The eligibility rules live in ./interviews so the Create Interview form can
 * explain a verdict before anything is submitted, and re-export from here so
 * the routes keep one import for the module's server side.
 */
export { evaluateEligibility };
export type { EligibilityWaiver };

/* ------------------------------------------------------------------ *
 * Reading a session back
 * ------------------------------------------------------------------ */

/**
 * Every other attempt by the same candidate, newest first. Separate rows, never
 * merged into the current one — a re-interview must not overwrite the attempt
 * it follows.
 */
export async function attemptsFor(memberId: string | null, excludeId: string): Promise<InterviewDetail["attempts"]> {
  if (!memberId) return [];
  const rows = await prisma.promotionInterview.findMany({
    where: { memberId, id: { not: excludeId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      sessionId: true,
      targetRank: true,
      result: true,
      status: true,
      finalScore: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/**
 * Re-reads a session in the shape GET returns, so every route that changes one
 * can hand the page a whole replacement rather than leaving it to re-fetch and
 * briefly show stale scores.
 */
export async function readInterviewDetail(id: string): Promise<InterviewDetail | null> {
  const interview = await prisma.promotionInterview.findUnique({
    where: { id },
    include: INTERVIEW_INCLUDE,
  });
  if (!interview) return null;

  const [candidate, attempts, settings] = await Promise.all([
    interview.memberId ? candidateSnapshot(interview.memberId, new Date(), interview.id) : Promise.resolve(null),
    attemptsFor(interview.memberId, interview.id),
    getPromotionSettings(),
  ]);
  return toDetail(interview, candidate, attempts, settings);
}

/* ------------------------------------------------------------------ *
 * Access
 * ------------------------------------------------------------------ */

export type PanelSeat = InterviewWithPanel["panel"][number];

/** The caller's seat on a panel, or anyone's when a discordId is given explicitly. */
export function seatFor(
  who: Access | string,
  interview: { panel: PanelSeat[] }
): PanelSeat | null {
  const discordId = typeof who === "string" ? who : who.discordId;
  return interview.panel.find((p) => p.discordId === discordId) ?? null;
}

/**
 * Who may open a session at all.
 *
 * Anyone on the panel can read the session they are sitting on — that is what
 * joining means — and `interviews.view` reads every session, which is what the
 * dashboard and Promotion History need.
 */
export function mayViewInterview(access: Access, interview: { panel: PanelSeat[] }): boolean {
  return hasPermission(access, "interviews.view") || seatFor(access, interview) !== null;
}

/**
 * Who may submit an evaluation: a panel seat in a scoring role, held by
 * someone with interviews.score, on a session that is still open.
 *
 * Both halves are required. The seat alone is not enough — an Observer sits on
 * the panel and must never score — and the permission alone is not enough, or
 * anyone who could score could score any session in the department.
 */
export function mayScore(access: Access, interview: { status: string; panel: PanelSeat[] }): boolean {
  if (interview.status !== "Ongoing") return false;
  if (!hasPermission(access, "interviews.score")) return false;
  const seat = seatFor(access, interview);
  return seat !== null && isScoringRole(seat.role);
}

/**
 * Who may settle the result: the Lead Interviewer on the panel holding
 * interviews.finalize, or EMS management holding interviews.manage.
 *
 * Two routes on purpose. The Lead is the ordinary one — they ran the session.
 * Management is the recovery path for a session whose Lead has left or gone
 * quiet, which is what "or authorized EMS management" in the workflow means;
 * without it a panel could be stranded with a result nobody can record.
 */
export function mayFinalize(access: Access, interview: { status: string; panel: PanelSeat[] }): boolean {
  if (interview.status !== "Ongoing") return false;
  if (hasPermission(access, "interviews.manage")) return true;
  const seat = seatFor(access, interview);
  return seat?.role === "Lead Interviewer" && hasPermission(access, "interviews.finalize");
}

/** Whether the panel is at capacity, so the error is a readable 400 rather than a silent truncation. */
export function panelIsFull(interview: { panel: PanelSeat[] }): boolean {
  return interview.panel.length >= MAX_PANEL;
}

/* ------------------------------------------------------------------ *
 * Audit details
 * ------------------------------------------------------------------ */

/**
 * A one-line summary of what an evaluation changed, for the audit entry.
 * Every score movement is logged, so a panel's own record shows who revised
 * what rather than only the final numbers.
 */
export function describeScoreChange(
  before: Pick<PanelSeat, "sopScore" | "medicalScore" | "situationScore" | "overallScore"> | null,
  after: Record<`${CategoryKey}Score`, number | null>
): string {
  const parts: string[] = [];
  for (const key of CATEGORY_KEYS) {
    const from = before?.[`${key}Score`] ?? null;
    const to = after[`${key}Score`];
    if (from !== to) parts.push(`${key}: ${from ?? "—"} → ${to ?? "—"}`);
  }
  return parts.length ? parts.join(", ") : "no score change";
}
