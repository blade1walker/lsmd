import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { TEST_PERMISSIONS } from "@/lib/constants";
import { attemptSummary } from "@/lib/tests/server";

/** Every attempt at one test, newest first — the Results tab. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(TEST_PERMISSIONS.grade);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const attempts = await prisma.testAttempt.findMany({
      where: { testId: id },
      orderBy: { startedAt: "desc" },
    });
    return NextResponse.json(attempts.map(attemptSummary));
  } catch (error) {
    return apiError("Failed to load attempts", error);
  }
}
