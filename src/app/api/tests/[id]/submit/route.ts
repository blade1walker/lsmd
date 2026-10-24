import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { cleanAnswers, isAnswered, parseQuestions } from "@/lib/tests";
import { closeAttempt, isPastDeadline, isTimeUp } from "@/lib/tests-server";

type Params = { params: Promise<{ id: string }> };

async function findOwnAttempt(id: string, attemptId: string, discordId: string) {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { select: { passingScore: true, timeLimitMinutes: true, showResults: true, examMode: true, maxTabSwitches: true } },
    },
  });
  return attempt && attempt.testId === id && attempt.discordId === discordId ? attempt : null;
}

/**
 * Saves answers as the member goes, so a closed tab or a timer running out
 * loses nothing. Not marked — that happens on submit.
 *
 * In exam mode the page also reports here each time the member leaves it
 * (`left: true`). The count is kept on the attempt, and once it passes the
 * test's allowance the attempt is handed in from here, on the answers sent
 * with that report — the page cannot talk its way out of it by not
 * submitting.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const attempt = await findOwnAttempt(id, String(body.attemptId ?? ""), auth.access.discordId);
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.status !== "In Progress") {
      return NextResponse.json({ error: "This attempt was already submitted" }, { status: 409 });
    }
    if (isPastDeadline(attempt.startedAt, attempt.test.timeLimitMinutes)) {
      return NextResponse.json({ error: "The time limit for this attempt has passed" }, { status: 409 });
    }

    const answers = cleanAnswers(body.answers, parseQuestions(attempt.questions));

    if (body.left === true && attempt.test.examMode) {
      const tabSwitches = attempt.tabSwitches + 1;
      if (tabSwitches > attempt.test.maxTabSwitches) {
        const closed = await closeAttempt(attempt, answers, {
          tabSwitches,
          autoSubmittedReason: `Left the test page ${tabSwitches} time${tabSwitches === 1 ? "" : "s"} (allowed ${attempt.test.maxTabSwitches})`,
        });
        return NextResponse.json({ saved: true, closed: true, tabSwitches, status: closed.status });
      }
      await prisma.testAttempt.update({ where: { id: attempt.id }, data: { answers: answers as never, tabSwitches } });
      return NextResponse.json({ saved: true, tabSwitches, remaining: attempt.test.maxTabSwitches - tabSwitches });
    }

    await prisma.testAttempt.update({ where: { id: attempt.id }, data: { answers: answers as never } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiError("Failed to save answers", error);
  }
}

/**
 * Hands in an attempt. Marked here, against the copy of the questions taken
 * when it started — the page never sees the answer key, so it cannot send a
 * score of its own.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const attempt = await findOwnAttempt(id, String(body.attemptId ?? ""), auth.access.discordId);
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.status !== "In Progress") {
      return NextResponse.json({ error: "This attempt was already submitted" }, { status: 409 });
    }

    const questions = parseQuestions(attempt.questions);
    const limit = attempt.test.timeLimitMinutes;

    // Well past the limit, the answers sent now are ignored and the attempt is
    // marked on what autosave had stored by the deadline.
    const lateBeyondGrace = isPastDeadline(attempt.startedAt, limit);
    const answers = lateBeyondGrace ? cleanAnswers(attempt.answers, questions) : cleanAnswers(body.answers, questions);

    // Once time is up there is no time left to fill in a missed question, so
    // the paper is marked as it stands rather than refused.
    if (!isTimeUp(attempt.startedAt, limit)) {
      const missing = questions.filter((q) => q.required && !isAnswered(answers[q.id]));
      if (missing.length) {
        return NextResponse.json(
          { error: `Answer every required question first (${missing.length} left)`, missing: missing.map((q) => q.id) },
          { status: 400 }
        );
      }
    }

    const updated = await closeAttempt(attempt, answers);
    const show = attempt.test.showResults;
    return NextResponse.json({
      status: updated.status,
      score: show ? updated.score : null,
      passed: show ? updated.passed : null,
      earned: show ? updated.earned : null,
      total: updated.total,
      late: lateBeyondGrace,
    });
  } catch (error) {
    return apiError("Failed to submit test", error);
  }
}
