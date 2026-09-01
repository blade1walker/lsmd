import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { SHIFT_PERMISSIONS } from "@/lib/constants";

/** Clears a member's shift pick — for a coordinator fixing a wrong entry, not self-service. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const auth = await requireAuth(SHIFT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { memberId } = await params;

    const signup = await prisma.shiftSignup.findUnique({
      where: { memberId },
      include: { member: { select: { name: true } } },
    });
    if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.shiftSignup.delete({ where: { memberId } });

    await logAudit({
      action: "delete",
      entityType: "ShiftSignup",
      entityId: memberId,
      entityLabel: signup.member.name,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to clear shift signup", error);
  }
}
