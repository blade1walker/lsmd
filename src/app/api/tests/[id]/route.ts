import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import {
  cleanAnswers,
  grade,
  parseQuestions,
  publicQuestions,
  seededShuffle,
  totalPoints,
  CHOICE_TYPES,
  minRankMessage,
  type TestQuestion,
} from "@/lib/tests";
import { canTakeTest, closeIfExpired, readNumberMap, readStringMap } from "@/lib/tests/server";

type Params = { params: Promise<{ id: string }> };

/**
 * The questions for an attempt in the order this member sees them. Seeded by
 * the attempt id, so a reload mid-test keeps the same order and a second
 * attempt gets a fresh one.
 */
function orderFor(questions: TestQuestion[], attemptId: string, test: { shuffleQuestions: boolean; shuffleOptions: boolean }) {
  const ordered = test.shuffleQuestions ? seededShuffle(questions, attemptId) : questions;
  return ordered.map((q) =>
    test.shuffleOptions && CHOICE_TYPES.includes(q.type) && q.type !== "truefalse"
      ? { ...q, options: seededShuffle(q.options, attemptId + q.id) }
      : q
  );
}

/**
 * A test from the member's side: the start screen, the attempt in progress
 * (questions without their answers), and past attempts with as much of the
 * result as the test is set to show.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test || test.status === "Draft") return NextResponse.json({ error: "Test not found" }, { status: 404 });

    const attempts = await Promise.all(
      (
        await prisma.testAttempt.findMany({
          where: { testId: id, discordId: auth.access.discordId },
          orderBy: { startedAt: "desc" },
        })
      ).map((a) => closeIfExpired(a, test))
    );
    const current = attempts.find((a) => a.status === "In Progress") ?? null;
    const submitted = attempts.filter((a) => a.status !== "In Progress");
    const questions = parseQuestions(test.questions);

    return NextResponse.json({
      id: test.id,
      title: test.title,
      description: test.description,
      instructions: test.instructions,
      status: test.status,
      passingScore: test.passingScore,
      timeLimitMinutes: test.timeLimitMinutes,
      maxAttempts: test.maxAttempts,
      questionCount: questions.length,
      totalPoints: totalPoints(questions),
      showResults: test.showResults,
      showCorrectAnswers: test.showCorrectAnswers,
      minRank: test.minRank,
      eligible: canTakeTest(test, auth.access),
      viewerRank: auth.access.memberRank,
      examMode: test.examMode,
      maxTabSwitches: test.maxTabSwitches,
      attemptsUsed: submitted.length,
      current: current
        ? {
            id: current.id,
            startedAt: current.startedAt.toISOString(),
            questions: publicQuestions(orderFor(parseQuestions(current.questions), current.id, test)),
            // What autosave stored, so a reload picks up where the member left off.
            answers: cleanAnswers(current.answers, parseQuestions(current.questions)),
            tabSwitches: current.tabSwitches,
          }
        : null,
      attempts: submitted.map((a) => {
        const asked = parseQuestions(a.questions);
        const answers = cleanAnswers(a.answers, asked);
        const manual = readNumberMap(a.manualPoints);
        const comments = readStringMap(a.comments);
        const points = grade(asked, answers, manual).points;
        return {
          id: a.id,
          status: a.status,
          submittedAt: a.submittedAt?.toISOString() ?? null,
          score: test.showResults ? a.score : null,
          passed: test.showResults ? a.passed : null,
          earned: test.showResults ? a.earned : null,
          total: a.total,
          feedback: test.showResults ? a.feedback : null,
          autoSubmittedReason: a.autoSubmittedReason,
          // The full marked paper, only when the test is set to hand it back.
          review:
            test.showResults && test.showCorrectAnswers
              ? asked.map((q) => ({ ...q, answer: answers[q.id] ?? null, awarded: points[q.id], comment: comments[q.id] ?? null }))
              : null,
        };
      }),
    });
  } catch (error) {
    return apiError("Failed to load test", error);
  }
}

/**
 * Starts an attempt, or hands back the one already running. The questions are
 * copied onto the attempt here, so the start time and the paper are fixed by
 * the server, not by the page.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test || test.status !== "Published") {
      return NextResponse.json({ error: "This test is not open" }, { status: 409 });
    }
    // The rank gate is checked here, not only on the page: the page shows the
    // test to everyone, so this is what actually keeps the questions back.
    if (!canTakeTest(test, auth.access)) {
      return NextResponse.json({ error: minRankMessage(test.minRank ?? "") }, { status: 403 });
    }

    const running = await prisma.testAttempt.findFirst({
      where: { testId: id, discordId: auth.access.discordId, status: "In Progress" },
    });
    const existing = running ? await closeIfExpired(running, test) : null;
    if (existing?.status === "In Progress") return NextResponse.json({ id: existing.id });

    if (test.maxAttempts !== null) {
      const used = await prisma.testAttempt.count({
        where: { testId: id, discordId: auth.access.discordId, status: { not: "In Progress" } },
      });
      if (used >= test.maxAttempts) {
        return NextResponse.json(
          { error: `You have used all ${test.maxAttempts} attempt${test.maxAttempts === 1 ? "" : "s"} at this test` },
          { status: 409 }
        );
      }
    }

    const member = auth.access.memberId
      ? await prisma.member.findUnique({ where: { id: auth.access.memberId }, select: { callSign: true } })
      : null;
    const questions = parseQuestions(test.questions);

    const attempt = await prisma.testAttempt.create({
      data: {
        testId: id,
        memberId: auth.access.memberId,
        memberName: actorLabel(auth.access),
        callSign: member?.callSign ?? null,
        discordId: auth.access.discordId,
        questions: questions as never,
        total: totalPoints(questions),
      },
    });
    return NextResponse.json({ id: attempt.id }, { status: 201 });
  } catch (error) {
    return apiError("Failed to start test", error);
  }
}
