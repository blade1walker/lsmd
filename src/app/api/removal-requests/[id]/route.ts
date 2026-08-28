import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("removal.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const performedBy = actorLabel(auth.access);

    // Atomically claims the transition, same guard as the other approval
    // routes: only the request that actually moves status away from its
    // current value logs the approve/decline — a double-click or a race
    // shouldn't produce two audit entries for one decision.
    let wonTransition = true;
    if (body.status !== undefined) {
      const claim = await prisma.removalRequest.updateMany({
        where: { id, status: { not: body.status } },
        data: { ...body, reviewedBy: performedBy },
      });
      wonTransition = claim.count === 1;
    } else {
      await prisma.removalRequest.update({ where: { id }, data: { ...body, reviewedBy: performedBy } });
    }

    // reviewedBy always reflects who actually approved this, not whatever the
    // client sends — the previous code trusted a client-supplied string here.
    const removalRequest = await prisma.removalRequest.findUnique({ where: { id } });
    if (!removalRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (wonTransition && (body.status === "Approved" || body.status === "Rejected")) {
      await logAudit({
        action: body.status === "Approved" ? "approve" : "decline",
        entityType: "RemovalRequest",
        entityId: removalRequest.id,
        entityLabel: removalRequest.memberName,
        details: { reason: removalRequest.reason || null },
        performedBy,
      });
    }

    return NextResponse.json(removalRequest);
  } catch (error) {
    return apiError("Failed to update request", error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("removal.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    await prisma.removalRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete request", error);
  }
}
