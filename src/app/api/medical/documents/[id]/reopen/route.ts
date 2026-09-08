import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";

/**
 * Reopens a finalized or archived document for correction, or archives one
 * that should no longer be active.
 *
 * A reopened document keeps its document number. The number identifies the
 * record, and reissuing it under a new one would leave the original number
 * dangling in whatever already cites it — the audit trail is what makes the
 * change visible instead.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.review");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action === "archive" ? "archive" : "reopen";
    const reason = String(body?.reason ?? "").trim();

    const document = await prisma.medicalDocument.findUnique({
      where: { id },
      include: { documentType: true },
    });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "reopen" && document.status !== "Finalized" && document.status !== "Archived") {
      return NextResponse.json(
        { error: `This document is already ${document.status.toLowerCase()}` },
        { status: 409 }
      );
    }
    if (action === "archive" && document.status === "Archived") {
      return NextResponse.json({ error: "Already archived" }, { status: 409 });
    }

    const actor = actorLabel(auth.access);
    const updated = await prisma.medicalDocument.update({
      where: { id },
      data:
        action === "archive"
          ? { status: "Archived", archivedAt: new Date() }
          : { status: "Draft", archivedAt: null },
      include: {
        documentType: true,
        formVersion: { include: { form: true } },
        patient: { select: { id: true, name: true, rank: true, callSign: true, stateId: true, dept: true } },
        attachments: true,
      },
    });

    await logAudit({
      action,
      entityType: "MedicalDocument",
      entityId: updated.id,
      entityLabel: `${updated.documentNumber ?? "Draft"} — ${updated.patientName}`,
      details: {
        from: document.status,
        to: updated.status,
        reason: reason || null,
      },
      performedBy: actor,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError("Failed to change document state", error);
  }
}
