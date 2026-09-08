import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { parseFields, validateAnswers, isLocked, type Answers } from "@/lib/medical";
import { claimDocumentNumber } from "@/lib/medical-server";

/**
 * Finalizes a document: validates it against its own form version, signs it,
 * issues its official number and locks it.
 *
 * The number is claimed only after validation passes, so a rejected attempt
 * never burns a number out of the sequence and leaves a gap in the register.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("medical.finalize");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const document = await prisma.medicalDocument.findUnique({
      where: { id },
      include: { formVersion: { include: { form: true } }, documentType: true },
    });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (document.authorDiscordId !== auth.access.discordId && !hasPermission(auth.access, "medical.review")) {
      return NextResponse.json(
        { error: "Forbidden", detail: "Only the author can finalize their own document." },
        { status: 403 }
      );
    }
    if (isLocked(document.status)) {
      return NextResponse.json(
        { error: `Already ${document.status.toLowerCase()}`, detail: document.documentNumber ?? undefined },
        { status: 409 }
      );
    }

    // Answers may arrive with this request (finalize straight from the form)
    // or already be saved. Either way they are validated before anything is
    // written, against the exact version the document was started on.
    const answers: Answers =
      body.answers && typeof body.answers === "object"
        ? (body.answers as Answers)
        : ((document.answers as Answers) ?? {});

    const fields = parseFields(document.formVersion.fields);
    const errors = validateAnswers(fields, answers);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "This document is not complete", detail: errors.join(" "), errors },
        { status: 400 }
      );
    }

    const signatureMode = document.formVersion.signatureMode;
    const signedBy = String(body.signedBy ?? "").trim() || actorLabel(auth.access);
    if (signatureMode === "required" && body.signed !== true) {
      return NextResponse.json(
        {
          error: "This form requires a signature",
          detail: "Sign the document before finalizing it.",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    // A reopened document keeps the number it was issued under. Claiming a
    // fresh one would leave the original dangling in whatever already cites it,
    // and burn a number out of the sequence for a record that is not new.
    const documentNumber =
      document.documentNumber ?? (await claimDocumentNumber(document.documentType.numberPrefix, now));

    const finalized = await prisma.medicalDocument.update({
      where: { id },
      data: {
        answers: answers as never,
        // Patient details can be corrected right up to the moment of issue, so
        // they are accepted here too — otherwise a fix made on the form and
        // finalized in the same breath would be silently dropped.
        ...(typeof body.patientName === "string" && body.patientName.trim()
          ? { patientName: body.patientName.trim() }
          : {}),
        ...(body.patientStateId !== undefined
          ? { patientStateId: String(body.patientStateId ?? "").trim() || null }
          : {}),
        status: "Finalized",
        documentNumber,
        finalizedAt: now,
        finalizedBy: actorLabel(auth.access),
        ...(signatureMode === "disabled"
          ? {}
          : { signedBy: body.signed === true || signatureMode === "required" ? signedBy : null, signedAt: body.signed === true ? now : null }),
      },
      include: {
        documentType: true,
        formVersion: { include: { form: true } },
        patient: { select: { id: true, name: true, rank: true, callSign: true, stateId: true, dept: true } },
        attachments: true,
      },
    });

    await logAudit({
      action: "finalize",
      entityType: "MedicalDocument",
      entityId: finalized.id,
      entityLabel: `${documentNumber} — ${finalized.patientName}`,
      details: {
        form: finalized.formVersion.form.name,
        version: finalized.formVersion.version,
        type: finalized.documentType.name,
        signed: finalized.signedBy ?? null,
        // Distinguishes a first issue from a re-finalize after correction, so
        // the trail shows a document was amended rather than freshly created.
        refinalized: document.documentNumber !== null,
      },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(finalized);
  } catch (error) {
    return apiError("Failed to finalize document", error);
  }
}
