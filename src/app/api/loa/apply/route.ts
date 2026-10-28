import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAuth, isDenied, hasPermission, actorLabel } from "@/lib/api-auth";
import { postToLOAWebhook } from "@/lib/discord-webhook";

/**
 * A member asks for leave. Signed-in roster members only, and only for
 * themselves — this route used to accept any memberId from anyone, so a
 * stranger could file (and announce in Discord) leave for any member. HR
 * (hr.loa) may still file on someone else's behalf.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;
  const { access } = auth;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const memberId = typeof body.memberId === "string" && body.memberId ? body.memberId : access.memberId;
  if (!memberId) {
    return NextResponse.json({ error: "Your account is not linked to a roster member" }, { status: 403 });
  }
  if (memberId !== access.memberId && !hasPermission(access, "hr.loa")) {
    return NextResponse.json({ error: "You can only request leave for yourself" }, { status: 403 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  const startDate = new Date(String(body.startDate));
  const endDate = new Date(String(body.endDate));
  if (!reason) return NextResponse.json({ error: "Give a reason for the leave" }, { status: 400 });
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Pick a start and an end date" }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "The end date is before the start date" }, { status: 400 });
  }

  try {
    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const loa = await prisma.lOA.create({
      data: {
        memberId,
        reason,
        startDate,
        endDate,
        status: "Pending",
        notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : undefined,
        createdBy: memberId === access.memberId ? "self" : actorLabel(access),
      },
      include: { member: true },
    });

    await postToLOAWebhook({
      title: "LOA Requested",
      description: `<@${loa.member.discordId}> **${loa.member.name}** has requested a Leave of Absence.`,
      color: 0xf59e0b,
      fields: [
        { name: "Member", value: loa.member.name, inline: true },
        { name: "Rank", value: loa.member.rank, inline: true },
        { name: "Call Sign", value: loa.member.callSign || "N/A", inline: true },
        { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
        { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true },
        { name: "Reason", value: loa.reason || "Not specified", inline: false },
        { name: "Status", value: "Pending", inline: true },
      ],
    }, "loa.requested");

    return NextResponse.json(loa, { status: 201 });
  } catch (error) {
    return apiError("Failed to apply for LOA", error);
  }
}
