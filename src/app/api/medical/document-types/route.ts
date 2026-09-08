import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { MEDICAL_SECTION_PERMISSIONS } from "@/lib/constants";
import { normalizeCategory } from "@/lib/medical-server";

/**
 * The kinds of medical record the platform can produce. Readable by anyone in
 * the module — a doctor has to pick one to start a document — but only Medical
 * Command may add or change them.
 */
export async function GET() {
  const auth = await requireAuth(MEDICAL_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const types = await prisma.medicalDocumentType.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { _count: { select: { forms: true, documents: true } } },
    });
    return NextResponse.json(types);
  } catch (error) {
    return apiError("Failed to load document types", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth("medical.types.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "A document type needs a name" }, { status: 400 });
    }

    const count = await prisma.medicalDocumentType.count();
    const type = await prisma.medicalDocumentType.create({
      data: {
        name,
        description: body.description?.trim() || null,
        category: normalizeCategory(body.category),
        // Uppercased because it is printed verbatim into every document number
        // issued under this type, and a lowercase prefix reads like a typo on
        // an official record.
        numberPrefix: (String(body.numberPrefix ?? "").trim() || "EMS-MED").toUpperCase(),
        order: count,
        active: body.active !== false,
        createdBy: actorLabel(auth.access),
      },
    });

    await logAudit({
      action: "create",
      entityType: "MedicalDocumentType",
      entityId: type.id,
      entityLabel: type.name,
      details: { category: type.category, numberPrefix: type.numberPrefix },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    return apiError("Failed to create document type", error);
  }
}
