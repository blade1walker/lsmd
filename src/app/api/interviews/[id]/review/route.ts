import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { REVIEW_OUTCOMES, awaitingReview, type InterviewResult } from "@/lib/interviews";
import {
  INTERVIEW_INCLUDE,
  getPromotionSettings,
  readInterviewDetail,
  toPanelistRecord,
} from "@/lib/interviews-server";
import { promote } from "@/lib/interviews-promote";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Settles a result the panel finalized as "Review Required".
 *
 * Before this existed that result was a dead end: the session was Finalized,
 * so nothing could ever promote the candidate or start their cooldown, and
 * they could not be re-interviewed either. Management now turns it into
 * Passed — which promotes exactly as a panel pass does — or Failed, which
 * starts the cooldown from today.
 *
 * The panel's own record is untouched. The frozen score, the category averages
 * and who finalized it all stay; the review is written beside them, with who
 * decided and why, so the record shows the panel held it and management
 * settled it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("interviews.review");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!awaitingReview(interview)) {
      return NextResponse.json(
        { error: "Only an interview finalized as Review Required can be reviewed" },
        { status: 409 }
      );
    }

    const result = body.result as InterviewResult;
    if (!REVIEW_OUTCOMES.includes(result)) {
      return NextResponse.json({ error: "Choose Passed or Failed" }, { status: 400 });
    }

    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
    if (!note) {
      return NextResponse.json(
        { error: "Record why", detail: "A review overrides the panel's hold, so it needs a reason on the record." },
        { status: 400 }
      );
    }

    const settings = await getPromotionSettings();
    const actor = actorLabel(auth.access);
    const now = new Date();
    const cooldownUntil =
      result === "Failed" && settings.cooldownDays > 0
        ? new Date(now.getTime() + settings.cooldownDays * DAY_MS)
        : null;

    // The same one-winner claim finalize uses: two reviewers deciding at once
    // settle it once, and the second is told it is already decided.
    const claim = await prisma.promotionInterview.updateMany({
      where: { id, status: "Finalized", result: "Review Required" },
      data: {
        result,
        cooldownUntil,
        reviewedByDiscordId: auth.access.discordId,
        reviewedByName: actor,
        reviewedAt: now,
        reviewNote: note,
      },
    });
    if (claim.count !== 1) {
      return NextResponse.json({ error: "Someone else reviewed this interview a moment ago" }, { status: 409 });
    }

    await logAudit({
      action: "approve",
      entityType: "PromotionInterview",
      entityId: interview.id,
      entityLabel: `${interview.sessionId} — ${interview.memberName}`,
      details: { review: `Review Required -> ${result}`, note: note.slice(0, 200) },
      performedBy: actor,
    });

    if (result === "Passed") {
      const panel = interview.panel.map(toPanelistRecord);
      await promote(interview, panel, interview.finalScore ?? 0, actor, now, settings);
    }

    return NextResponse.json(await readInterviewDetail(id));
  } catch (error) {
    return apiError("Failed to review the interview", error);
  }
}
