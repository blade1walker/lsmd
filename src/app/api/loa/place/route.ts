import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { LOA_PERMISSIONS } from "@/lib/constants";
import { LOA_LIMITS } from "@/lib/loa";
import { announceLoaApproved, beginLeave, roleNotice, RUNNING_LOA } from "@/lib/loa-server";

/**
 * HR puts a member on leave directly, without a request from them — the
 * same outcome as approving one: the leave is recorded as approved by whoever
 * placed it, the roster shows LOA, the EMS LOA role is given, and the member
 * is told the way an approval tells them (unless HR chooses not to).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(LOA_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Nothing was submitted" }, { status: 400 });

    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, LOA_LIMITS.reason) : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, LOA_LIMITS.notes) || null : null;
    const startDate = typeof body.startDate === "string" && body.startDate ? new Date(body.startDate) : new Date();
    const endDate = typeof body.endDate === "string" ? new Date(body.endDate) : new Date(NaN);
    const notify = body.notify !== false;

    if (!memberId) return NextResponse.json({ error: "Choose who is going on leave" }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "Enter the reason for the leave" }, { status: 400 });
    if (Number.isNaN(startDate.getTime())) return NextResponse.json({ error: "Enter a valid start date" }, { status: 400 });
    if (Number.isNaN(endDate.getTime())) return NextResponse.json({ error: "Enter when the leave ends" }, { status: 400 });
    if (endDate <= startDate) return NextResponse.json({ error: "The end date must be after the start date" }, { status: 400 });
    if (endDate.getTime() < Date.now()) return NextResponse.json({ error: "The end date has already passed" }, { status: 400 });

    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, name: true } });
    if (!member) return NextResponse.json({ error: "That member is no longer on the roster" }, { status: 404 });

    const running = await prisma.lOA.findFirst({
      where: { memberId, status: { in: [...RUNNING_LOA] } },
      select: { endDate: true },
    });
    if (running) {
      return NextResponse.json(
        { error: `${member.name} is already on leave until ${running.endDate.toLocaleDateString()} — extend that leave instead` },
        { status: 409 }
      );
    }

    const actor = actorLabel(auth.access);
    const loa = await prisma.lOA.create({
      data: {
        memberId,
        reason,
        notes,
        startDate,
        endDate,
        status: "Approved",
        createdBy: actor,
        approvedBy: actor,
        approvedAt: new Date(),
      },
      include: { member: true },
    });

    const role = await beginLeave(memberId);
    if (notify) await announceLoaApproved(loa, "Placed on LOA");

    await logAudit({
      action: "create",
      entityType: "LOA",
      entityId: loa.id,
      entityLabel: member.name,
      details: {
        placedBy: actor,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        reason,
        notified: notify,
      },
      performedBy: actor,
    });

    return NextResponse.json({ ...loa, discordRole: roleNotice(role) }, { status: 201 });
  } catch (error) {
    return apiError("Failed to put the member on leave", error);
  }
}
