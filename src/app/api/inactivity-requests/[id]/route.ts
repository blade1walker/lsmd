import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("hr.inactivity.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();

    // Same atomic-claim guard as the other approval routes: only the
    // request that actually moves status away from its current value logs
    // the approve/decline.
    let wonTransition = true;
    if (body.status !== undefined) {
      const claim = await prisma.inactivityRequest.updateMany({
        where: { id, status: { not: body.status } },
        data: body,
      });
      wonTransition = claim.count === 1;
    } else {
      await prisma.inactivityRequest.update({ where: { id }, data: body });
    }

    const inactivityRequest = await prisma.inactivityRequest.findUnique({ where: { id }, include: { member: true } });
    if (!inactivityRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (wonTransition && (body.status === "Approved" || body.status === "Rejected")) {
      await logAudit({
        action: body.status === "Approved" ? "approve" : "decline",
        entityType: "InactivityRequest",
        entityId: inactivityRequest.id,
        entityLabel: inactivityRequest.member.name,
        details: { reason: inactivityRequest.reason || null },
        performedBy: actorLabel(auth.access),
      });
    }

    return NextResponse.json(inactivityRequest);
  } catch (error) {
    return apiError("Failed to update request", error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("hr.inactivity.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    await prisma.inactivityRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete request", error);
  }
}
