import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { INTERVIEW_SECTION_PERMISSIONS } from "@/lib/constants";
import { PANEL_ROLE_KEYS, isScoringRole } from "@/lib/interviews";
import { INTERVIEW_INCLUDE, panelIsFull, readInterviewDetail, seatFor } from "@/lib/interviews-server";

/** The updated session, in the shape GET returns, so the page replaces its state wholesale. */
async function respond(id: string) {
  const detail = await readInterviewDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}

/**
 * Takes a seat on the panel — either the caller joining, or management adding
 * someone else.
 *
 * Joining is self-service because that is what a shared session means: an
 * interviewer opens the session and takes their own seat. Seating anyone else
 * is an authority over other people's records, so it needs interviews.create.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(INTERVIEW_SECTION_PERMISSIONS);
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
      return NextResponse.json({ error: "This interview is no longer open" }, { status: 409 });
    }

    const targetDiscordId =
      typeof body.discordId === "string" && body.discordId.trim() ? body.discordId.trim() : auth.access.discordId;
    const isSelf = targetDiscordId === auth.access.discordId;

    if (!isSelf && !hasPermission(auth.access, "interviews.create") && !hasPermission(auth.access, "interviews.manage")) {
      return NextResponse.json(
        { error: "Forbidden", detail: "Requires the \"interviews.create\" permission to seat someone else." },
        { status: 403 }
      );
    }

    const requested = typeof body.role === "string" && PANEL_ROLE_KEYS.includes(body.role) ? body.role : "Interviewer";
    // Someone joining themselves cannot hand themselves the Lead's authority —
    // a Lead is appointed by whoever opened the session.
    const role = isSelf && !hasPermission(auth.access, "interviews.create") && requested === "Lead Interviewer"
      ? "Interviewer"
      : requested;

    // Which seats someone may take for themselves depends on their permission:
    // scoring needs interviews.score, and anyone who can open the section can
    // observe. Seating others is already gated above, so this only guards the
    // self-service path.
    if (isSelf && isScoringRole(role) && !hasPermission(auth.access, "interviews.score")) {
      return NextResponse.json(
        { error: "Forbidden", detail: "Requires the \"interviews.score\" permission to score. You can join as an Observer." },
        { status: 403 }
      );
    }

    if (seatFor(targetDiscordId, interview)) {
      return NextResponse.json({ error: "They are already on this panel" }, { status: 409 });
    }
    if (panelIsFull(interview)) {
      return NextResponse.json({ error: "This panel is full" }, { status: 400 });
    }

    const member = await prisma.member.findFirst({
      where: { discordId: targetDiscordId },
      select: { id: true, name: true, rank: true },
    });

    await prisma.interviewPanelist.create({
      data: {
        interviewId: id,
        discordId: targetDiscordId,
        name: member?.name ?? (isSelf ? actorLabel(auth.access) : targetDiscordId),
        rank: member?.rank ?? null,
        memberId: member?.id ?? null,
        role,
      },
    });

    await logAudit({
      action: "update",
      entityType: "PromotionInterview",
      entityId: id,
      entityLabel: `${interview.sessionId} — ${interview.memberName}`,
      details: { panel: `${member?.name ?? targetDiscordId} joined as ${role}`, self: isSelf },
      performedBy: actorLabel(auth.access),
    });

    return respond(id);
  } catch (error) {
    return apiError("Failed to join the interview panel", error);
  }
}

/** Changes a panelist's role. Management only — a role is what decides whose score counts. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["interviews.create", "interviews.manage"]);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const panelistId = typeof body.panelistId === "string" ? body.panelistId : "";
    const role = typeof body.role === "string" && PANEL_ROLE_KEYS.includes(body.role) ? body.role : null;
    if (!panelistId || !role) return NextResponse.json({ error: "Choose a panel role" }, { status: 400 });

    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (interview.status !== "Ongoing") {
      return NextResponse.json({ error: "This interview is no longer open" }, { status: 409 });
    }

    const seat = interview.panel.find((p) => p.id === panelistId);
    if (!seat) return NextResponse.json({ error: "They are not on this panel" }, { status: 404 });

    // Moving a scorer to Observer would silently drop their submitted
    // evaluation out of the panel average — a rewrite of the record, not a
    // role correction.
    if (seat.submittedAt && isScoringRole(seat.role) && !isScoringRole(role)) {
      return NextResponse.json(
        { error: "They have already submitted an evaluation and cannot be moved to Observer" },
        { status: 409 }
      );
    }

    // The session must keep someone who can settle it.
    const leads = interview.panel.filter((p) => p.role === "Lead Interviewer");
    if (seat.role === "Lead Interviewer" && role !== "Lead Interviewer" && leads.length === 1) {
      return NextResponse.json(
        { error: "Appoint another Lead Interviewer before changing this one's role" },
        { status: 409 }
      );
    }

    await prisma.interviewPanelist.update({ where: { id: panelistId }, data: { role } });

    await logAudit({
      action: "update",
      entityType: "PromotionInterview",
      entityId: id,
      entityLabel: `${interview.sessionId} — ${interview.memberName}`,
      details: { panel: `${seat.name}: ${seat.role} → ${role}` },
      performedBy: actorLabel(auth.access),
    });

    return respond(id);
  } catch (error) {
    return apiError("Failed to change the panel role", error);
  }
}

/**
 * Removes a seat. A submitted evaluation is part of the examination record, so
 * it is never removed this way — the panelist's role can be corrected instead.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["interviews.create", "interviews.manage"]);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const panelistId = req.nextUrl.searchParams.get("panelistId") ?? "";
    if (!panelistId) return NextResponse.json({ error: "No panelist given" }, { status: 400 });

    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (interview.status !== "Ongoing") {
      return NextResponse.json({ error: "This interview is no longer open" }, { status: 409 });
    }

    const seat = interview.panel.find((p) => p.id === panelistId);
    if (!seat) return NextResponse.json({ error: "They are not on this panel" }, { status: 404 });

    if (seat.submittedAt) {
      return NextResponse.json(
        { error: "They have already submitted an evaluation, which stays part of the record" },
        { status: 409 }
      );
    }

    const leads = interview.panel.filter((p) => p.role === "Lead Interviewer");
    if (seat.role === "Lead Interviewer" && leads.length === 1) {
      return NextResponse.json(
        { error: "Appoint another Lead Interviewer before removing this one" },
        { status: 409 }
      );
    }

    await prisma.interviewPanelist.delete({ where: { id: panelistId } });

    await logAudit({
      action: "update",
      entityType: "PromotionInterview",
      entityId: id,
      entityLabel: `${interview.sessionId} — ${interview.memberName}`,
      details: { panel: `${seat.name} removed from the panel` },
      performedBy: actorLabel(auth.access),
    });

    return respond(id);
  } catch (error) {
    return apiError("Failed to remove the panelist", error);
  }
}
