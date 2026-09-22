import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { INTERVIEW_SECTION_PERMISSIONS, } from "@/lib/constants";
import { MAX_NOTE_LENGTH } from "@/lib/interviews";
import { INTERVIEW_INCLUDE, readInterviewDetail, seatFor } from "@/lib/interviews-server";

/**
 * Adds a general note to the session.
 *
 * One row per note rather than one shared text box, so several interviewers
 * can record strengths, weaknesses and concerns at the same time without
 * overwriting each other — which is the whole reason this is not a field on
 * the interview.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(INTERVIEW_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const note = typeof body.body === "string" ? body.body.trim().slice(0, MAX_NOTE_LENGTH) : "";
    if (!note) return NextResponse.json({ error: "Write something before adding the note" }, { status: 400 });

    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (interview.status !== "Ongoing") {
      return NextResponse.json({ error: "This interview is no longer open" }, { status: 409 });
    }

    // A seat on the panel, or the authority to run sessions. An Observer's
    // seat counts — observing and writing down what you saw is the point of
    // the role; what an Observer cannot do is score or finalize.
    const onPanel = seatFor(auth.access, interview) !== null;
    if (!onPanel && !hasPermission(auth.access, "interviews.create") && !hasPermission(auth.access, "interviews.manage")) {
      return NextResponse.json(
        { error: "Forbidden", detail: "Join this panel before adding notes." },
        { status: 403 }
      );
    }

    const actor = actorLabel(auth.access);
    const created = await prisma.interviewNote.create({
      data: { interviewId: id, authorDiscordId: auth.access.discordId, authorName: actor, body: note },
    });

    await logAudit({
      action: "create",
      entityType: "InterviewNote",
      entityId: created.id,
      entityLabel: `${interview.sessionId} — ${actor}`,
      details: { interview: interview.sessionId, candidate: interview.memberName },
      performedBy: actor,
    });

    return NextResponse.json(await readInterviewDetail(id));
  } catch (error) {
    return apiError("Failed to add the note", error);
  }
}
