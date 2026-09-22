import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { parseEvaluationInput } from "@/lib/interviews";
import {
  INTERVIEW_INCLUDE,
  describeScoreChange,
  mayScore,
  readInterviewDetail,
  seatFor,
} from "@/lib/interviews-server";

/**
 * Saves or submits the caller's own evaluation.
 *
 * Writes exactly one row — the caller's panel seat, found by their Discord id
 * rather than taken from the request — so no interviewer can reach another's
 * assessment however the body is shaped. Saving keeps it a draft; submitting
 * is what makes it count toward the panel score.
 *
 * Every score movement is written to the audit log, before and after, because
 * a revised score after seeing the panel average is exactly the thing EMS
 * Command needs to be able to review.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("interviews.score");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const parsed = parseEvaluationInput(await req.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { data } = parsed;

    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (interview.status !== "Ongoing") {
      return NextResponse.json(
        { error: "This interview is finalized and its scores can no longer change" },
        { status: 409 }
      );
    }
    if (!mayScore(auth.access, interview)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          detail: "Join this panel as an interviewer before submitting an evaluation.",
        },
        { status: 403 }
      );
    }

    const seat = seatFor(auth.access, interview)!;
    const actor = actorLabel(auth.access);

    const updated = await prisma.interviewPanelist.update({
      where: { id: seat.id },
      data: {
        sopScore: data.sopScore,
        medicalScore: data.medicalScore,
        situationScore: data.situationScore,
        overallScore: data.overallScore,
        sopNotes: data.sopNotes,
        medicalNotes: data.medicalNotes,
        situationNotes: data.situationNotes,
        overallNotes: data.overallNotes,
        recommendation: data.recommendation,
        // A submitted evaluation keeps its original timestamp when it is
        // revised, so the panel table still shows when this interviewer first
        // committed — the audit log carries the revision.
        submittedAt: data.submit ? (seat.submittedAt ?? new Date()) : null,
      },
    });

    await logAudit({
      action: "update",
      entityType: "InterviewEvaluation",
      entityId: updated.id,
      entityLabel: `${interview.sessionId} — ${actor}`,
      details: {
        interview: interview.sessionId,
        candidate: interview.memberName,
        scores: describeScoreChange(seat, {
          sopScore: data.sopScore,
          medicalScore: data.medicalScore,
          situationScore: data.situationScore,
          overallScore: data.overallScore,
        }),
        revision: seat.submittedAt !== null,
        state: data.submit ? "submitted" : "saved as draft",
        recommendation: data.recommendation,
      },
      performedBy: actor,
    });

    return NextResponse.json(await readInterviewDetail(id));
  } catch (error) {
    return apiError("Failed to save your evaluation", error);
  }
}
