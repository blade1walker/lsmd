import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { parseFields, PRESENTATIONAL_TYPES } from "@/lib/medical";

/**
 * Publishes the form's newest version and makes the form Active, so doctors
 * can use it from the next page load.
 *
 * Publishing is the point of no return for a version: from here it is only
 * ever superseded, never edited, because documents filled against it must keep
 * rendering with the questions they actually answered.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.forms.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const form = await prisma.medicalForm.findUnique({
      where: { id },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const version = form.versions[0];
    if (!version) {
      return NextResponse.json({ error: "This form has no version to publish" }, { status: 400 });
    }
    if (version.published) {
      return NextResponse.json(
        {
          error: `Version ${version.version} is already published`,
          detail: "Change the fields to start a new version, then publish that.",
        },
        { status: 409 }
      );
    }

    // A form that asks nothing produces an empty record, which is worse than
    // no form at all — it looks official and says nothing.
    const answerable = parseFields(version.fields).filter((f) => !PRESENTATIONAL_TYPES.includes(f.type));
    if (answerable.length === 0) {
      return NextResponse.json(
        {
          error: "Add at least one question",
          detail: "This version only has headings and separators, so a completed document would carry no answers.",
        },
        { status: 400 }
      );
    }

    const actor = actorLabel(auth.access);
    const [published] = await prisma.$transaction([
      prisma.medicalFormVersion.update({
        where: { id: version.id },
        data: { published: true },
      }),
      prisma.medicalForm.update({
        where: { id: form.id },
        data: { status: "Active", publishedAt: new Date() },
      }),
    ]);

    await logAudit({
      action: "publish",
      entityType: "MedicalFormVersion",
      entityId: published.id,
      entityLabel: `${form.name} v${published.version}`,
      details: { questions: answerable.length, signatureMode: published.signatureMode },
      performedBy: actor,
    });

    return NextResponse.json(published);
  } catch (error) {
    return apiError("Failed to publish form", error);
  }
}
