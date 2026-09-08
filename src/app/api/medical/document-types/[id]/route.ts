import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { normalizeCategory } from "@/lib/medical-server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.types.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.category !== undefined) data.category = normalizeCategory(body.category);
    if (typeof body.numberPrefix === "string" && body.numberPrefix.trim()) {
      data.numberPrefix = body.numberPrefix.trim().toUpperCase();
    }
    if (typeof body.order === "number") data.order = body.order;
    if (typeof body.active === "boolean") data.active = body.active;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const type = await prisma.medicalDocumentType.update({ where: { id }, data });

    await logAudit({
      action: "update",
      entityType: "MedicalDocumentType",
      entityId: type.id,
      entityLabel: type.name,
      details: { fields: Object.keys(data).join(", ") },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(type);
  } catch (error) {
    return apiError("Failed to update document type", error);
  }
}

/**
 * Only ever deletes a type nothing depends on. A type with documents behind it
 * is history — deactivating hides it from the create flow while leaving every
 * record that cites it intact, which is what the schema's onDelete: Restrict
 * enforces at the database level anyway.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.types.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const type = await prisma.medicalDocumentType.findUnique({
      where: { id },
      include: { _count: { select: { forms: true, documents: true } } },
    });
    if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (type._count.documents > 0 || type._count.forms > 0) {
      return NextResponse.json(
        {
          error: "This type is in use",
          detail: `It has ${type._count.forms} form(s) and ${type._count.documents} document(s). Deactivate it instead — deleting would orphan records that cite it.`,
        },
        { status: 409 }
      );
    }

    await prisma.medicalDocumentType.delete({ where: { id } });

    await logAudit({
      action: "delete",
      entityType: "MedicalDocumentType",
      entityId: id,
      entityLabel: type.name,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete document type", error);
  }
}
