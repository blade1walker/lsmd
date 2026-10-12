import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import {
  FINAL_RESULTS,
  evaluateThresholds,
  panelScores,
  type InterviewResult,
} from "@/lib/interviews";
import {
  INTERVIEW_INCLUDE,
  getPromotionSettings,
  mayFinalize,
  readInterviewDetail,
  toPanelistRecord,
} from "@/lib/interviews-server";
import { promote } from "@/lib/interviews-promote";
import type { Prisma } from "@/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Settles the result and, on a pass, carries out the promotion.
 *
 * The whole sequence hangs off one atomic claim: the session is moved out of
 * "Ongoing" with a conditional update, so of two Leads pressing Finalize at
 * the same moment exactly one proceeds and the other is told the result is
 * already recorded. Everything after that — the roster rank, the promotion
 * record, the announcement — happens once, for the same reason.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["interviews.finalize", "interviews.manage"]);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (interview.status !== "Ongoing") {
      return NextResponse.json(
        { error: `This interview was already finalized as ${interview.result}` },
        { status: 409 }
      );
    }
    if (!mayFinalize(auth.access, interview)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          detail: "Only the Lead Interviewer or EMS management can finalize an interview.",
        },
        { status: 403 }
      );
    }

    const settings = await getPromotionSettings();
    const panel = interview.panel.map(toPanelistRecord);
    const scores = panelScores(panel);

    if (scores.submitted === 0) {
      return NextResponse.json(
        { error: "No interviewer has submitted an evaluation yet" },
        { status: 400 }
      );
    }
    if (settings.requireTrainingCheck && !interview.trainingVerified) {
      return NextResponse.json(
        {
          error: "Required training has not been verified",
          detail: "Tick the training and certification check before finalizing.",
        },
        { status: 400 }
      );
    }

    // The thresholds propose a result; the Lead records the one they chose.
    const verdict = evaluateThresholds(scores, settings);
    const requested = typeof body.result === "string" ? (body.result as InterviewResult) : verdict.suggested;
    if (!FINAL_RESULTS.includes(requested)) {
      return NextResponse.json({ error: "Choose Passed, Failed or Review Required" }, { status: 400 });
    }

    const actor = actorLabel(auth.access);
    const now = new Date();
    const finalScore = scores.finalScore ?? 0;
    const categoryScores = scores.categories as unknown as Prisma.InputJsonValue;

    // A failed attempt starts the re-interview cooldown. "Review Required"
    // does not — it is a decision still to be made, not a refusal.
    const cooldownUntil =
      requested === "Failed" && settings.cooldownDays > 0
        ? new Date(now.getTime() + settings.cooldownDays * DAY_MS)
        : null;

    const claim = await prisma.promotionInterview.updateMany({
      where: { id, status: "Ongoing" },
      data: {
        status: "Finalized",
        result: requested,
        finalScore,
        categoryScores,
        cooldownUntil,
        finalizedByDiscordId: auth.access.discordId,
        finalizedByName: actor,
        finalizedAt: now,
      },
    });
    if (claim.count !== 1) {
      return NextResponse.json(
        { error: "Someone else finalized this interview a moment ago" },
        { status: 409 }
      );
    }

    await logAudit({
      action: "finalize",
      entityType: "PromotionInterview",
      entityId: interview.id,
      entityLabel: `${interview.sessionId} — ${interview.memberName}`,
      details: {
        result: requested,
        finalScore,
        suggested: verdict.suggested,
        overrode: requested !== verdict.suggested,
        submitted: scores.submitted,
        panel: panel.length,
      },
      performedBy: actor,
    });

    if (requested === "Passed") {
      await promote(interview, panel, finalScore, actor, now, settings);
    }

    const detail = await readInterviewDetail(id);
    return NextResponse.json(detail);
  } catch (error) {
    return apiError("Failed to finalize the interview", error);
  }
}
