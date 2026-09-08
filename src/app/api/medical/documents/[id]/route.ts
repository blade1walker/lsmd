import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { MEDICAL_SECTION_PERMISSIONS } from "@/lib/constants";
import { isLocked, type Answers } from "@/lib/medical";
import type { Prisma } from "@/generated/prisma/client";
import type { Access } from "@/lib/access";

const FULL_DOCUMENT = {
  documentType: true,
  formVersion: { include: { form: true } },
  patient: { select: { id: true, name: true, rank: true, callSign: true, stateId: true, dept: true } },
  attachments: true,
} as const;

/**
 * Whether this account may see a given document. Its author always can;
 * medical.review is the permission that widens it to everyone else's.
 */
function mayRead(access: Access, authorDiscordId: string): boolean {
  return access.discordId === authorDiscordId || hasPermission(access, "medical.review");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(MEDICAL_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const document = await prisma.medicalDocument.findUnique({ where: { id }, include: FULL_DOCUMENT });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!mayRead(auth.access, document.authorDiscordId)) {
      return NextResponse.json(
        { error: "Forbidden", detail: "This document was written by someone else." },
        { status: 403 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    return apiError("Failed to load document", error);
  }
}

/**
 * Saves a draft. Only the author edits their own draft, and only while it is
 * still a draft — a finalized document is the record of what was issued, and
 * the way back is ./reopen, which is permissioned and audited.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.create");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.medicalDocument.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.authorDiscordId !== auth.access.discordId && !hasPermission(auth.access, "medical.review")) {
      return NextResponse.json(
        { error: "Forbidden", detail: "Only the author can edit this draft." },
        { status: 403 }
      );
    }
    if (isLocked(existing.status)) {
      return NextResponse.json(
        {
          error: `This document is ${existing.status.toLowerCase()}`,
          detail: "Reopen it before making changes, so the change is recorded.",
        },
        { status: 409 }
      );
    }

    const data: Prisma.MedicalDocumentUpdateInput = {};
    if (body.answers && typeof body.answers === "object") {
      data.answers = body.answers as Answers as Prisma.InputJsonValue;
    }
    if (typeof body.patientName === "string" && body.patientName.trim()) {
      data.patientName = body.patientName.trim();
    }
    if (body.patientStateId !== undefined) {
      data.patientStateId = String(body.patientStateId ?? "").trim() || null;
    }
    // Moving to Review is the only status a save may set — Finalized and
    // Archived are transitions with their own rules and their own routes.
    if (body.status === "Review" || body.status === "Draft") {
      data.status = body.status;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const document = await prisma.medicalDocument.update({
      where: { id },
      data,
      include: FULL_DOCUMENT,
    });

    return NextResponse.json(document);
  } catch (error) {
    return apiError("Failed to save document", error);
  }
}

/**
 * Deletes a document.
 *
 * A draft is the author's own working copy and deletes on a plain request. An
 * issued document is a different thing entirely: it has a number that may
 * already be cited elsewhere, so destroying it needs medical.review *and* an
 * explicit `?permanent=1`, which is the caller stating it means this rather
 * than reaching the branch by accident.
 *
 * Archiving remains the better answer in almost every case — it keeps the
 * record readable. This exists for the cases archiving cannot serve: test data,
 * a document raised against the wrong patient, a record that must actually go.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.create");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const existing = await prisma.medicalDocument.findUnique({
      where: { id },
      include: {
        documentType: { select: { name: true } },
        formVersion: { select: { version: true, form: { select: { name: true } } } },
      },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const issued = existing.documentNumber !== null;

    if (issued) {
      if (!hasPermission(auth.access, "medical.review")) {
        return NextResponse.json(
          {
            error: "Forbidden",
            detail: `${existing.documentNumber} has been issued. Deleting an issued document needs the "medical.review" permission.`,
          },
          { status: 403 }
        );
      }
      if (req.nextUrl.searchParams.get("permanent") !== "1") {
        return NextResponse.json(
          {
            error: "This document has been issued",
            detail: `${existing.documentNumber} is on the record. Archiving keeps it readable; deleting destroys it and cannot be undone.`,
          },
          { status: 409 }
        );
      }
    } else if (
      existing.authorDiscordId !== auth.access.discordId &&
      !hasPermission(auth.access, "medical.review")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.medicalDocument.delete({ where: { id } });

    // The row is gone, so the audit entry is the only remaining trace of what
    // was destroyed — it carries enough to say what the record actually was.
    await logAudit({
      action: "delete",
      entityType: "MedicalDocument",
      entityId: id,
      entityLabel: issued
        ? `${existing.documentNumber} — ${existing.patientName}`
        : `Draft — ${existing.patientName}`,
      details: {
        issued,
        status: existing.status,
        patient: existing.patientName,
        stateId: existing.patientStateId,
        type: existing.documentType.name,
        form: `${existing.formVersion.form.name} v${existing.formVersion.version}`,
        author: existing.authorName,
        finalizedAt: existing.finalizedAt?.toISOString() ?? null,
      },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete document", error);
  }
}
