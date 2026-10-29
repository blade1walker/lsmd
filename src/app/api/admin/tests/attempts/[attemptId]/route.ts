import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { TEST_PERMISSIONS } from "@/lib/constants";
import { cleanAnswers, grade, parseQuestions } from "@/lib/tests";
import { attemptSummary, gradedColumns, readNumberMap, readStringMap } from "@/lib/tests/server";

type Params = { params: Promise<{ attemptId: string }> };

/** One attempt in full: the questions as asked, the answers, and the marks. */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(TEST_PERMISSIONS.grade);
  if (isDenied(auth)) return auth.error;

  try {
    const { attemptId } = await params;
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: { test: { select: { title: true, passingScore: true } } },
    });
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

    const questions = parseQuestions(attempt.questions);
    const answers = cleanAnswers(attempt.answers, questions);
    const manualPoints = readNumberMap(attempt.manualPoints);
    return NextResponse.json({
      ...attemptSummary(attempt),
      testTitle: attempt.test.title,
      passingScore: attempt.test.passingScore,
      questions,
      answers,
      manualPoints,
      comments: readStringMap(attempt.comments),
      feedback: attempt.feedback,
      points: grade(questions, answers, manualPoints).points,
    });
  } catch (error) {
    return apiError("Failed to load attempt", error);
  }
}

/**
 * Marks an attempt by hand: points for written answers (or a correction to an
 * auto mark), a comment per question and overall feedback. The score is
 * recomputed here rather than trusted from the page.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(TEST_PERMISSIONS.grade);
  if (isDenied(auth)) return auth.error;

  try {
    const { attemptId } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: { test: { select: { title: true, passingScore: true } } },
    });
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.status === "In Progress") {
      return NextResponse.json({ error: "This attempt has not been submitted yet" }, { status: 409 });
    }

    const questions = parseQuestions(attempt.questions);
    const ids = new Set(questions.map((q) => q.id));
    const manual = Object.fromEntries(Object.entries(readNumberMap(body.manualPoints)).filter(([k]) => ids.has(k)));
    const comments = Object.fromEntries(Object.entries(readStringMap(body.comments)).filter(([k]) => ids.has(k)));
    const feedback =
      typeof body.feedback === "string" ? body.feedback.trim().slice(0, 4000) || null : attempt.feedback;

    const { data } = gradedColumns(questions, cleanAnswers(attempt.answers, questions), manual, attempt.test.passingScore);

    const updated = await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        ...data,
        manualPoints: manual as never,
        comments: comments as never,
        feedback,
        gradedBy: actorLabel(auth.access),
        gradedAt: new Date(),
      },
    });

    await logAudit({
      action: "update",
      entityType: "TestAttempt",
      entityId: updated.id,
      entityLabel: `${attempt.test.title} — ${attempt.memberName}`,
      details: { score: updated.score, passed: updated.passed, status: updated.status },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(attemptSummary(updated));
  } catch (error) {
    return apiError("Failed to save marks", error);
  }
}

/** Removes an attempt, which gives the member that attempt back. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(TEST_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { attemptId } = await params;
    const attempt = await prisma.testAttempt
      .delete({ where: { id: attemptId }, include: { test: { select: { title: true } } } })
      .catch(() => null);
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

    await logAudit({
      action: "delete",
      entityType: "TestAttempt",
      entityId: attempt.id,
      entityLabel: `${attempt.test.title} — ${attempt.memberName}`,
      details: { score: attempt.score },
      performedBy: actorLabel(auth.access),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete attempt", error);
  }
}
