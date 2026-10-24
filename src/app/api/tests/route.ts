import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { parseQuestions, totalPoints } from "@/lib/tests";
import { canTakeTest } from "@/lib/tests-server";

/**
 * The tests a signed-in member can take, with how their own attempts went.
 * Any roster member may take a published test — there is no permission for
 * it, the same way there is none for applying to a department.
 */
export async function GET() {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
    const [tests, attempts] = await Promise.all([
      prisma.test.findMany({ where: { status: "Published" }, orderBy: { title: "asc" } }),
      prisma.testAttempt.findMany({
        where: { discordId: auth.access.discordId, test: { status: "Published" } },
        orderBy: { startedAt: "desc" },
        select: { testId: true, status: true, score: true, passed: true },
      }),
    ]);

    return NextResponse.json(
      tests.map((t) => {
        const questions = parseQuestions(t.questions);
        const mine = attempts.filter((a) => a.testId === t.id);
        const submitted = mine.filter((a) => a.status !== "In Progress");
        const latest = submitted[0];
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          questionCount: questions.length,
          totalPoints: totalPoints(questions),
          passingScore: t.passingScore,
          timeLimitMinutes: t.timeLimitMinutes,
          maxAttempts: t.maxAttempts,
          minRank: t.minRank,
          eligible: canTakeTest(t, auth.access),
          attemptsUsed: submitted.length,
          inProgress: mine.some((a) => a.status === "In Progress"),
          passed: submitted.some((a) => a.passed === true),
          latest: latest
            ? {
                status: latest.status,
                score: t.showResults ? latest.score : null,
                passed: t.showResults ? latest.passed : null,
              }
            : null,
        };
      })
    );
  } catch (error) {
    return apiError("Failed to load tests", error);
  }
}
