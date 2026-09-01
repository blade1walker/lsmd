import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { SHIFT_PERMISSIONS } from "@/lib/constants";
import { isValidShiftSlot } from "@/lib/shifts";

const MEMBER_SELECT = { id: true, name: true, callSign: true, rank: true } as const;

/** Every member's current shift pick, for the schedule page to group by slot. */
export async function GET() {
  const auth = await requireAuth(SHIFT_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const signups = await prisma.shiftSignup.findMany({
      include: { member: { select: MEMBER_SELECT } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(signups);
  } catch (error) {
    return apiError("Failed to fetch shift signups", error);
  }
}

/**
 * Submits or replaces a member's shift pick. One row per member — this is
 * "what is my current shift", not a history, so a resubmission overwrites
 * the previous pick rather than adding to it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(SHIFT_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json()) as {
      memberId?: string;
      primarySlot?: number;
      secondarySlot?: number;
    };
    const memberId = String(body.memberId ?? "");

    if (!memberId) {
      return NextResponse.json({ error: "Select your name from the roster" }, { status: 400 });
    }
    if (!isValidShiftSlot(body.primarySlot)) {
      return NextResponse.json({ error: "Select a valid primary shift" }, { status: 400 });
    }
    if (!isValidShiftSlot(body.secondarySlot)) {
      return NextResponse.json({ error: "Select a valid secondary shift" }, { status: 400 });
    }

    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, name: true } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const signup = await prisma.shiftSignup.upsert({
      where: { memberId },
      create: { memberId, primarySlot: body.primarySlot, secondarySlot: body.secondarySlot },
      update: { primarySlot: body.primarySlot, secondarySlot: body.secondarySlot },
      include: { member: { select: MEMBER_SELECT } },
    });

    await logAudit({
      action: "update",
      entityType: "ShiftSignup",
      entityId: memberId,
      entityLabel: member.name,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(signup);
  } catch (error) {
    return apiError("Failed to submit shift", error);
  }
}
