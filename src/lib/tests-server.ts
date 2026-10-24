import type { TestAttempt } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import type { Access } from "./access";
import { RANKS } from "./constants";
import {
  TEST_STATUSES,
  meetsMinRank,
  TIME_LIMIT_GRACE_SECONDS,
  cleanAnswers,
  grade,
  parseQuestions,
  questionProblems,
  type Answers,
  type AttemptStatus,
  type AttemptSummary,
  type TestQuestion,
  type TestSettings,
} from "./tests";

/** The timer has run out — answers are no longer required to be complete. */
export function isTimeUp(startedAt: Date, limitMinutes: number | null): boolean {
  return limitMinutes !== null && Date.now() - startedAt.getTime() > limitMinutes * 60_000;
}

/** Past the limit and the grace period too — nothing sent now is accepted. */
export function isPastDeadline(startedAt: Date, limitMinutes: number | null): boolean {
  return (
    limitMinutes !== null &&
    Date.now() - startedAt.getTime() > limitMinutes * 60_000 + TIME_LIMIT_GRACE_SECONDS * 1000
  );
}

/** Marks and closes an attempt on the given answers. */
export async function closeAttempt(
  attempt: TestAttempt & { test: { passingScore: number } },
  answers: Answers,
  extra: { tabSwitches?: number; autoSubmittedReason?: string } = {}
): Promise<TestAttempt> {
  const { data } = gradedColumns(parseQuestions(attempt.questions), answers, {}, attempt.test.passingScore);
  return prisma.testAttempt.update({
    where: { id: attempt.id },
    data: { ...data, ...extra, answers: answers as never, submittedAt: new Date() },
  });
}

/** Whether this caller may take a test with the given rank requirement. */
export function canTakeTest(test: { minRank: string | null }, access: Access): boolean {
  return meetsMinRank(test.minRank, { rank: access.memberRank, isSuperAdmin: access.isSuperAdmin });
}

/**
 * An attempt left running past its deadline — the tab was closed, the timer
 * ran out offline — is handed in on whatever autosave stored, so it does not
 * sit "In Progress" forever and block the member from the test.
 */
export async function closeIfExpired(
  attempt: TestAttempt,
  test: { passingScore: number; timeLimitMinutes: number | null }
): Promise<TestAttempt> {
  if (attempt.status !== "In Progress" || !isPastDeadline(attempt.startedAt, test.timeLimitMinutes)) return attempt;
  return closeAttempt({ ...attempt, test }, cleanAnswers(attempt.answers, parseQuestions(attempt.questions)));
}

/**
 * Reads the settings half of a builder save. `partial` leaves out what the
 * body does not mention, for a PATCH that only flips the status.
 */
export function readSettings(
  body: Record<string, unknown>,
  { partial }: { partial: boolean }
): Partial<TestSettings> | { error: string } {
  const data: Partial<TestSettings> = {};
  const has = (k: string) => body[k] !== undefined || !partial;
  const text = (v: unknown, max: number) => {
    const s = String(v ?? "").trim().slice(0, max);
    return s || null;
  };
  const optionalInt = (v: unknown, min: number, max: number) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
  };

  if (has("title")) {
    const title = text(body.title, 200);
    if (!title) return { error: "Give the test a title" };
    data.title = title;
  }
  if (has("description")) data.description = text(body.description, 4000);
  if (has("instructions")) data.instructions = text(body.instructions, 8000);
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!(TEST_STATUSES as readonly string[]).includes(status)) return { error: `"${status}" is not a test status` };
    data.status = status as TestSettings["status"];
  }
  if (has("passingScore")) data.passingScore = optionalInt(body.passingScore, 0, 100) ?? 70;
  if (has("timeLimitMinutes")) data.timeLimitMinutes = optionalInt(body.timeLimitMinutes, 1, 600);
  if (has("maxAttempts")) data.maxAttempts = optionalInt(body.maxAttempts, 1, 100);
  for (const key of ["shuffleQuestions", "shuffleOptions", "showResults", "showCorrectAnswers", "showOnHomepage", "examMode"] as const) {
    if (body[key] !== undefined) data[key] = Boolean(body[key]);
  }
  if (body.minRank !== undefined) {
    const minRank = text(body.minRank, 100);
    if (minRank && !RANKS.some((r) => r.name === minRank)) return { error: `"${minRank}" is not a rank` };
    data.minRank = minRank;
  }
  if (body.maxTabSwitches !== undefined) data.maxTabSwitches = optionalInt(body.maxTabSwitches, 0, 20) ?? 0;
  return data;
}

/** Why a test cannot be published yet, or an empty list when it can. */
export function publishProblems(questions: TestQuestion[]): string[] {
  if (questions.length === 0) return ["Add at least one question"];
  return questions.flatMap((q, i) => questionProblems(q).map((p) => `Question ${i + 1}: ${p.toLowerCase()}`));
}

/** The columns a graded (or auto-graded) attempt writes back. */
export function gradedColumns(
  questions: TestQuestion[],
  answers: Answers,
  manual: Record<string, number>,
  passingScore: number
) {
  const result = grade(questions, answers, manual);
  const status: AttemptStatus = result.score === null ? "Awaiting Grading" : "Graded";
  return {
    result,
    data: {
      earned: result.earned,
      total: result.total,
      score: result.score,
      passed: result.score === null ? null : result.score >= passingScore,
      status,
    },
  };
}



export function attemptSummary(a: TestAttempt): AttemptSummary {
  return {
    id: a.id,
    memberName: a.memberName,
    callSign: a.callSign,
    discordId: a.discordId,
    status: a.status as AttemptStatus,
    score: a.score,
    passed: a.passed,
    earned: a.earned,
    total: a.total,
    startedAt: a.startedAt.toISOString(),
    submittedAt: a.submittedAt?.toISOString() ?? null,
    gradedBy: a.gradedBy,
    tabSwitches: a.tabSwitches,
    autoSubmittedReason: a.autoSubmittedReason,
  };
}

export function readNumberMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v !== null && v !== "" && Number.isFinite(Number(v))) out[k] = Number(v);
  }
  return out;
}

export function readStringMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const s = String(v ?? "").trim().slice(0, 2000);
    if (s) out[k] = s;
  }
  return out;
}
