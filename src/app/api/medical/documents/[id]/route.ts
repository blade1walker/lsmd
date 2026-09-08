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

/** Drafts can be deleted; anything that was ever finalized is archived instead. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.create");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const existing = await prisma.medicalDocument.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.authorDiscordId !== auth.access.discordId && !hasPermission(auth.access, "medical.review")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.documentNumber) {
      return NextResponse.json(
        {
          error: "This document has been issued",
          detail: `${existing.documentNumber} is on the record. Archive it instead of deleting it.`,
        },
        { status: 409 }
      );
    }

    await prisma.medicalDocument.delete({ where: { id } });

    await logAudit({
      action: "delete",
      entityType: "MedicalDocument",
      entityId: id,
      entityLabel: `Draft — ${existing.patientName}`,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete document", error);
  }
}
