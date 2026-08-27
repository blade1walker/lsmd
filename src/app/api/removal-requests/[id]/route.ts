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

    // reviewedBy always reflects who actually approved this, not whatever the
    // client sends — the previous code trusted a client-supplied string here.
    const removalRequest = await prisma.removalRequest.update({
      where: { id },
      data: { ...body, reviewedBy: performedBy },
    });

    if (body.status === "Approved" || body.status === "Rejected") {
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
