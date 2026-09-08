import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { MEDICAL_SECTION_PERMISSIONS } from "@/lib/constants";
import { getMedicalSettings } from "@/lib/medical-server";

/**
 * The department letterhead every exported document is printed on. Readable
 * across the module because the export runs in the browser and needs it;
 * writable only by Medical Command.
 */
export async function GET() {
  const auth = await requireAuth(MEDICAL_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    return NextResponse.json(await getMedicalSettings());
  } catch (error) {
    return apiError("Failed to load medical settings", error);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth("medical.types.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await req.json();
    const text = (value: unknown) => String(value ?? "").trim() || null;

    /**
     * Every writable field, built once and used for both halves of the upsert.
     *
     * Previously the create branch set only departmentName, so the very first
     * PATCH against a database with no settings row — which is exactly what
     * uploading a logo before ever opening the tab does — created the row and
     * threw the logo away without a word.
     */
    const fields = {
      ...(body.departmentName !== undefined
        ? { departmentName: String(body.departmentName).trim() || "EMERGENCY MEDICAL SERVICES" }
        : {}),
      ...(body.subDepartment !== undefined ? { subDepartment: text(body.subDepartment) } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: text(body.logoUrl) } : {}),
      ...(body.address !== undefined ? { address: text(body.address) } : {}),
      ...(body.contact !== undefined ? { contact: text(body.contact) } : {}),
      ...(body.confidentialityNotice !== undefined
        ? { confidentialityNotice: String(body.confidentialityNotice).trim() }
        : {}),
      ...(body.disclaimer !== undefined ? { disclaimer: text(body.disclaimer) } : {}),
      ...(body.secondaryName !== undefined ? { secondaryName: text(body.secondaryName) } : {}),
      ...(body.secondaryLogoUrl !== undefined ? { secondaryLogoUrl: text(body.secondaryLogoUrl) } : {}),
      ...(body.secondaryAddress !== undefined ? { secondaryAddress: text(body.secondaryAddress) } : {}),
      ...(body.secondaryContact !== undefined ? { secondaryContact: text(body.secondaryContact) } : {}),
      ...(body.secondaryDetail !== undefined ? { secondaryDetail: text(body.secondaryDetail) } : {}),
    };

    const settings = await prisma.medicalSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...fields },
      update: fields,
    });

    await logAudit({
      action: "update",
      entityType: "MedicalSettings",
      entityId: settings.id,
      entityLabel: settings.departmentName,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(settings);
  } catch (error) {
    return apiError("Failed to save medical settings", error);
  }
}
