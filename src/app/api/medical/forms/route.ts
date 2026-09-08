import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { MEDICAL_SECTION_PERMISSIONS } from "@/lib/constants";
import { DEFAULT_EXPORT_CONFIG } from "@/lib/medical";

/**
 * The Forms Library.
 *
 * Anyone in the module can list forms, but a doctor is only shown the ones
 * they could actually fill in — Active, with a published version. Command sees
 * every form in every state, because managing drafts is the job.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(MEDICAL_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const canManage = hasPermission(auth.access, "medical.forms.manage");
    const usableOnly = req.nextUrl.searchParams.get("usable") === "1" || !canManage;

    const forms = await prisma.medicalForm.findMany({
      where: usableOnly ? { status: "Active", versions: { some: { published: true } } } : {},
      orderBy: [{ name: "asc" }],
      include: {
        documentType: { select: { id: true, name: true, category: true, numberPrefix: true } },
        versions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            version: true,
            published: true,
            signatureMode: true,
            createdAt: true,
            createdBy: true,
            _count: { select: { documents: true } },
          },
        },
        _count: { select: { versions: true } },
      },
    });

    return NextResponse.json(forms);
  } catch (error) {
    return apiError("Failed to load forms", error);
  }
}

/**
 * Creates a form and its first version together. A form with no version is a
 * shell nothing can be built on, so the two are never separate states.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth("medical.forms.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const documentTypeId = String(body?.documentTypeId ?? "").trim();

    if (!name) return NextResponse.json({ error: "A form needs a name" }, { status: 400 });
    if (!documentTypeId) {
      return NextResponse.json({ error: "Pick the document type this form produces" }, { status: 400 });
    }

    const type = await prisma.medicalDocumentType.findUnique({ where: { id: documentTypeId } });
    if (!type) return NextResponse.json({ error: "That document type no longer exists" }, { status: 400 });

    const actor = actorLabel(auth.access);
    const form = await prisma.medicalForm.create({
      data: {
        name,
        description: body.description?.trim() || null,
        documentTypeId,
        department: body.department?.trim() || null,
        status: "Draft",
        createdBy: actor,
        versions: {
          create: {
            version: "1.0",
            fields: [],
            exportConfig: { ...DEFAULT_EXPORT_CONFIG, documentTitle: name },
            signatureMode: "optional",
            published: false,
            createdBy: actor,
          },
        },
      },
      include: { versions: true, documentType: true },
    });

    await logAudit({
      action: "create",
      entityType: "MedicalForm",
      entityId: form.id,
      entityLabel: form.name,
      details: { documentType: type.name, version: "1.0" },
      performedBy: actor,
    });

    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    return apiError("Failed to create form", error);
  }
}
