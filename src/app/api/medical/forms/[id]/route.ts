import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { MEDICAL_SECTION_PERMISSIONS } from "@/lib/constants";
import { normalizeFormStatus } from "@/lib/medical";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(MEDICAL_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const form = await prisma.medicalForm.findUnique({
      where: { id },
      include: {
        documentType: true,
        versions: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { documents: true } } },
        },
      },
    });
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(form);
  } catch (error) {
    return apiError("Failed to load form", error);
  }
}

/** Metadata and lifecycle status only — fields are versioned, so they go through ./versions. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.forms.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.department !== undefined) data.department = body.department?.trim() || null;

    if (body.status !== undefined) {
      const status = normalizeFormStatus(body.status);
      // Going Active is what publishing means, and publishing has to mint a
      // version — so it happens on ./publish, never as a status edit here.
      if (status === "Active") {
        const published = await prisma.medicalFormVersion.count({ where: { formId: id, published: true } });
        if (published === 0) {
          return NextResponse.json(
            { error: "Publish a version first", detail: "A form goes Active by publishing a version of it." },
            { status: 400 }
          );
        }
      }
      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const form = await prisma.medicalForm.update({ where: { id }, data });

    await logAudit({
      action: data.status === "Archived" ? "archive" : "update",
      entityType: "MedicalForm",
      entityId: form.id,
      entityLabel: form.name,
      details: { fields: Object.keys(data).join(", "), status: form.status },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(form);
  } catch (error) {
    return apiError("Failed to update form", error);
  }
}

/**
 * Deletes a form only while nothing has ever been filled in against it.
 * Once a document exists, the form's versions are the only record of what that
 * document asked — deleting them would strip a finalized medical record of its
 * own questions. Archive instead.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.forms.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const form = await prisma.medicalForm.findUnique({
      where: { id },
      include: { versions: { include: { _count: { select: { documents: true } } } } },
    });
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const documentCount = form.versions.reduce((n, v) => n + v._count.documents, 0);
    if (documentCount > 0) {
      return NextResponse.json(
        {
          error: "This form has been used",
          detail: `${documentCount} document(s) were filled in against it. Archive the form instead — deleting it would leave those records without the questions they answered.`,
        },
        { status: 409 }
      );
    }

    await prisma.medicalForm.delete({ where: { id } });

    await logAudit({
      action: "delete",
      entityType: "MedicalForm",
      entityId: id,
      entityLabel: form.name,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete form", error);
  }
}
