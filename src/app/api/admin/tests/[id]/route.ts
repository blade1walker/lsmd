import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { TEST_PERMISSIONS } from "@/lib/constants";
import { MAX_QUESTIONS, parseQuestions } from "@/lib/tests";
import { publishProblems, readSettings } from "@/lib/tests/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(TEST_PERMISSIONS.grade);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    return NextResponse.json({ ...test, questions: parseQuestions(test.questions) });
  } catch (error) {
    return apiError("Failed to load test", error);
  }
}

/**
 * The builder's save: settings and the whole question list in one write.
 * Attempts already started keep their own copy of the questions, so editing a
 * live test never re-marks anyone.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(TEST_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const existing = await prisma.test.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    const settings = readSettings(body, { partial: true });
    if ("error" in settings) return NextResponse.json({ error: settings.error }, { status: 400 });

    if (Array.isArray(body.questions) && body.questions.length > MAX_QUESTIONS) {
      return NextResponse.json({ error: `A test can have at most ${MAX_QUESTIONS} questions` }, { status: 400 });
    }
    const questions = parseQuestions(body.questions !== undefined ? body.questions : existing.questions);

    // Checked on every save while published, not just the one that publishes,
    // so a live test cannot be edited into one nobody can answer.
    const status = settings.status ?? existing.status;
    if (status === "Published") {
      const problems = publishProblems(questions);
      if (problems.length) {
        return NextResponse.json(
          { error: "This test is not ready to publish", detail: problems.slice(0, 5).join("; ") },
          { status: 400 }
        );
      }
    }

    const test = await prisma.test.update({
      where: { id },
      data: {
        ...settings,
        ...(body.questions !== undefined ? { questions: questions as never } : {}),
        updatedBy: actorLabel(auth.access),
      },
    });

    await logAudit({
      action: settings.status === "Published" && existing.status !== "Published" ? "publish" : "update",
      entityType: "Test",
      entityId: test.id,
      entityLabel: test.title,
      details: { status: test.status, questions: questions.length },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ ...test, questions });
  } catch (error) {
    return apiError("Failed to save test", error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(TEST_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const test = await prisma.test.delete({ where: { id } }).catch(() => null);
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    await logAudit({
      action: "delete",
      entityType: "Test",
      entityId: test.id,
      entityLabel: test.title,
      performedBy: actorLabel(auth.access),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete test", error);
  }
}
