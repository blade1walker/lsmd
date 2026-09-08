import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { parseFields, parseExportConfig, nextVersion } from "@/lib/medical";
import { asJson } from "@/lib/medical-server";

const SIGNATURE_MODES = ["required", "optional", "disabled"];

/**
 * Saves a form's field set.
 *
 * This is the single place the version rule is enforced, and the rule is the
 * whole reason the module can be trusted with medical records:
 *
 *   - an unpublished version that nothing has been filled against is a working
 *     draft, so edits land on it directly;
 *   - anything else is history, so edits mint a new version instead and leave
 *     the old one exactly as the doctors who used it saw it.
 *
 * Because of that, a caller never has to know which case it is in — it always
 * POSTs the fields and reads back whichever version now holds them.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.forms.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();

    const form = await prisma.medicalForm.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { documents: true } } },
        },
      },
    });
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Round-tripped through the parser so a malformed field can't be stored:
    // whatever is written here is what a doctor will be asked months from now.
    const fields = parseFields(body.fields).map((f, index) => ({ ...f, order: index }));

    const duplicates = fields
      .map((f) => f.name)
      .filter((name, index, all) => all.indexOf(name) !== index);
    if (duplicates.length > 0) {
      return NextResponse.json(
        {
          error: "Duplicate field names",
          detail: `Answers are stored by field name, so each must be unique. Repeated: ${[...new Set(duplicates)].join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const exportConfig = parseExportConfig(body.exportConfig);
    const signatureMode = SIGNATURE_MODES.includes(body.signatureMode) ? body.signatureMode : "optional";
    const actor = actorLabel(auth.access);

    const latest = form.versions[0];
    const editableInPlace = latest && !latest.published && latest._count.documents === 0;

    if (editableInPlace) {
      const version = await prisma.medicalFormVersion.update({
        where: { id: latest.id },
        data: { fields: asJson(fields), exportConfig: asJson(exportConfig), signatureMode },
      });

      await logAudit({
        action: "update",
        entityType: "MedicalFormVersion",
        entityId: version.id,
        entityLabel: `${form.name} v${version.version}`,
        details: { fields: fields.length, draft: true },
        performedBy: actor,
      });

      return NextResponse.json(version);
    }

    const version = await prisma.medicalFormVersion.create({
      data: {
        formId: form.id,
        version: nextVersion(form.versions.map((v) => v.version)),
        fields: asJson(fields),
        exportConfig: asJson(exportConfig),
        signatureMode,
        published: false,
        createdBy: actor,
      },
    });

    await logAudit({
      action: "create",
      entityType: "MedicalFormVersion",
      entityId: version.id,
      entityLabel: `${form.name} v${version.version}`,
      details: { fields: fields.length, supersedes: latest?.version ?? null },
      performedBy: actor,
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    return apiError("Failed to save form version", error);
  }
}
