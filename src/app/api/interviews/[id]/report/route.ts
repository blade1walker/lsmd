import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { getPromotionSettings, mayViewInterview, readInterviewDetail } from "@/lib/interviews-server";

/**
 * Everything the printed examination report needs, in one read: the session in
 * full and the thresholds it is judged against.
 *
 * A separate route from GET /api/interviews/[id] so that downloading a copy is
 * its own permission and leaves its own audit entry — a report is the record
 * leaving the site, which reading it on screen is not.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("interviews.export");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: { panel: true },
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Exporting never reaches further than reading does.
    if (!mayViewInterview(auth.access, interview)) {
      return NextResponse.json(
        { error: "Forbidden", detail: "You are not on this interview panel." },
        { status: 403 }
      );
    }

    const [detail, settings] = await Promise.all([readInterviewDetail(id), getPromotionSettings()]);

    await logAudit({
      action: "export",
      entityType: "PromotionInterview",
      entityId: interview.id,
      entityLabel: `${interview.sessionId} — ${interview.memberName}`,
      details: { format: "pdf", result: interview.result },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ interview: detail, settings });
  } catch (error) {
    return apiError("Failed to prepare the interview report", error);
  }
}
