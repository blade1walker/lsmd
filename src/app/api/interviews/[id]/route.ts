import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { INTERVIEW_SECTION_PERMISSIONS } from "@/lib/constants";
import {
  INTERVIEW_INCLUDE,
  attemptsFor,
  candidateSnapshot,
  mayFinalize,
  mayViewInterview,
  readInterviewDetail,
  toDetail,
} from "@/lib/interviews-server";

/** One session in full: the candidate, the panel, every evaluation, the notes and the attempt history. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(INTERVIEW_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!mayViewInterview(auth.access, interview)) {
      return NextResponse.json(
        { error: "Forbidden", detail: "You are not on this interview panel." },
        { status: 403 }
      );
    }

    const [candidate, attempts] = await Promise.all([
      interview.memberId ? candidateSnapshot(interview.memberId) : Promise.resolve(null),
      attemptsFor(interview.memberId, interview.id),
    ]);

    return NextResponse.json(toDetail(interview, candidate, attempts));
  } catch (error) {
    return apiError("Failed to load the interview", error);
  }
}

/**
 * The parts of a session that change outside an evaluation: the required
 * training check, improvement notes for a failed candidate, and cancelling.
 *
 * Scores are never reachable from here — those go through the evaluation
 * route, which only ever writes the caller's own row.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(INTERVIEW_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Nothing was submitted" }, { status: 400 });

    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const actor = actorLabel(auth.access);
    const isManager = hasPermission(auth.access, "interviews.manage");
    const canSettle = mayFinalize(auth.access, interview) || isManager;
    const data: Record<string, unknown> = {};
    const changed: string[] = [];

    if (typeof body.trainingVerified === "boolean") {
      if (!canSettle) {
        return NextResponse.json(
          { error: "Forbidden", detail: "Only the Lead Interviewer or EMS management can verify training." },
          { status: 403 }
        );
      }
      if (interview.status !== "Ongoing") {
        return NextResponse.json({ error: "This interview is already finalized" }, { status: 409 });
      }
      data.trainingVerified = body.trainingVerified;
      data.trainingVerifiedBy = body.trainingVerified ? actor : null;
      data.trainingVerifiedAt = body.trainingVerified ? new Date() : null;
      changed.push(`training verification ${body.trainingVerified ? "given" : "withdrawn"}`);
    }

    if (typeof body.improvementNotes === "string") {
      if (!canSettle) {
        return NextResponse.json(
          { error: "Forbidden", detail: "Only the Lead Interviewer or EMS management can record recommendations." },
          { status: 403 }
        );
      }
      // Deliberately writable after finalizing: recording what a failed
      // candidate should work on is management's follow-up, not part of the
      // examination result, and the scores stay frozen either way.
      data.improvementNotes = body.improvementNotes.trim().slice(0, 4000) || null;
      changed.push("improvement notes");
    }

    if (body.cancel === true) {
      if (!isManager) {
        return NextResponse.json(
          { error: "Forbidden", detail: "Requires the \"interviews.manage\" permission." },
          { status: 403 }
        );
      }
      if (interview.status !== "Ongoing") {
        return NextResponse.json({ error: "This interview is no longer open" }, { status: 409 });
      }
      data.status = "Cancelled";
      changed.push("cancelled");
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    }

    const updated = await prisma.promotionInterview.update({
      where: { id },
      data,
      include: INTERVIEW_INCLUDE,
    });

    await logAudit({
      action: data.status === "Cancelled" ? "archive" : "update",
      entityType: "PromotionInterview",
      entityId: updated.id,
      entityLabel: `${updated.sessionId} — ${updated.memberName}`,
      details: { changed: changed.join(", ") },
      performedBy: actor,
    });

    return NextResponse.json(await readInterviewDetail(updated.id));
  } catch (error) {
    return apiError("Failed to update the interview", error);
  }
}

/**
 * Deletes a session. interviews.manage only, and a copy goes to the deletion
 * log first — a completed examination is the evidence behind a rank change, so
 * removing one is recoverable rather than final.
 *
 * A session that already moved the roster is never deleted: the PromotionRecord
 * it wrote points at it, and Promotion History would be left citing a session
 * that no longer exists.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("interviews.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (interview.rosterUpdated) {
      return NextResponse.json(
        {
          error: "This interview promoted the employee and cannot be deleted",
          detail: "Promotion History cites it as the reason for their rank change.",
        },
        { status: 409 }
      );
    }

    const performedBy = actorLabel(auth.access);

    await prisma.deletionLog.create({
      data: {
        entityType: "PromotionInterview",
        entityId: id,
        entityLabel: `${interview.sessionId} — ${interview.memberName}`,
        data: JSON.parse(JSON.stringify(interview)),
        deletedBy: performedBy,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.promotionInterview.delete({ where: { id } });

    await logAudit({
      action: "delete",
      entityType: "PromotionInterview",
      entityId: id,
      entityLabel: `${interview.sessionId} — ${interview.memberName}`,
      details: { result: interview.result, status: interview.status },
      performedBy,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete the interview", error);
  }
}
