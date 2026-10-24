import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { TEST_PERMISSIONS } from "@/lib/constants";
import { parseQuestions, totalPoints } from "@/lib/tests";
import { readSettings } from "@/lib/tests-server";

/** Every test, with enough of its results to read the list at a glance. */
export async function GET() {
  const auth = await requireAuth(TEST_PERMISSIONS.grade);
  if (isDenied(auth)) return auth.error;

  try {
    const [tests, counts] = await Promise.all([
      prisma.test.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.testAttempt.groupBy({
        by: ["testId", "status", "passed"],
        _count: { _all: true },
        where: { status: { not: "In Progress" } },
      }),
    ]);

    return NextResponse.json(
      tests.map((t) => {
        const questions = parseQuestions(t.questions);
        const mine = counts.filter((c) => c.testId === t.id);
        const sum = (pick: (c: (typeof mine)[number]) => boolean) =>
          mine.filter(pick).reduce((n, c) => n + c._count._all, 0);
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          passingScore: t.passingScore,
          timeLimitMinutes: t.timeLimitMinutes,
          questionCount: questions.length,
          totalPoints: totalPoints(questions),
          attempts: sum(() => true),
          passed: sum((c) => c.passed === true),
          awaitingGrading: sum((c) => c.status === "Awaiting Grading"),
          updatedAt: t.updatedAt.toISOString(),
        };
      })
    );
  } catch (error) {
    return apiError("Failed to load tests", error);
  }
}

/** Creates a draft — blank, or a copy of an existing test. Questions are added in the builder. */
export async function POST(request: Request) {
  const auth = await requireAuth(TEST_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const settings = readSettings(body, { partial: true });
    if ("error" in settings) return NextResponse.json({ error: settings.error }, { status: 400 });
    if (!settings.title) return NextResponse.json({ error: "Give the test a title" }, { status: 400 });

    const sourceId = typeof body.duplicateOf === "string" ? body.duplicateOf : null;
    const source = sourceId ? await prisma.test.findUnique({ where: { id: sourceId } }) : null;

    const test = await prisma.test.create({
      data: {
        ...(source
          ? {
              description: source.description,
              instructions: source.instructions,
              questions: source.questions as never,
              passingScore: source.passingScore,
              timeLimitMinutes: source.timeLimitMinutes,
              maxAttempts: source.maxAttempts,
              shuffleQuestions: source.shuffleQuestions,
              shuffleOptions: source.shuffleOptions,
              showResults: source.showResults,
              showCorrectAnswers: source.showCorrectAnswers,
            }
          : {}),
        ...settings,
        title: settings.title,
        status: "Draft",
        createdBy: actorLabel(auth.access),
      },
    });

    await logAudit({
      action: "create",
      entityType: "Test",
      entityId: test.id,
      entityLabel: test.title,
      details: source ? { duplicatedFrom: source.title } : undefined,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ id: test.id }, { status: 201 });
  } catch (error) {
    return apiError("Failed to create test", error);
  }
}
