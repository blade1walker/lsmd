import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { MEDICAL_SECTION_PERMISSIONS } from "@/lib/constants";
import { parseFields, AUTOFILL_TYPES, type Answers } from "@/lib/medical";
import { latestPublishedVersion } from "@/lib/medical-server";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The document dashboard.
 *
 * A doctor sees the documents they wrote; medical.review widens that to every
 * document, which is the reviewing/command view. Kept deliberately narrow —
 * these are medical records, so "everyone in the module sees everything" is a
 * decision for Command to make by granting the permission, not the default.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(MEDICAL_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const sp = req.nextUrl.searchParams;
    const seesAll = hasPermission(auth.access, "medical.review");

    const where: Prisma.MedicalDocumentWhereInput = {};
    if (!seesAll) where.authorDiscordId = auth.access.discordId;

    const status = sp.get("status");
    if (status) where.status = status;

    const typeId = sp.get("typeId");
    if (typeId) where.documentTypeId = typeId;

    const patientMemberId = sp.get("patientMemberId");
    if (patientMemberId) where.patientMemberId = patientMemberId;

    const author = sp.get("author");
    if (author && seesAll) where.authorDiscordId = author;

    const from = sp.get("from");
    const to = sp.get("to");
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        // Inclusive of the whole "to" day — a date filter that silently drops
        // everything filed today is the kind of thing nobody notices.
        ...(to ? { lte: new Date(new Date(to).setUTCHours(23, 59, 59, 999)) } : {}),
      };
    }

    const q = sp.get("q")?.trim();
    if (q) {
      where.OR = [
        { patientName: { contains: q, mode: "insensitive" } },
        { patientStateId: { contains: q, mode: "insensitive" } },
        { documentNumber: { contains: q, mode: "insensitive" } },
        { authorName: { contains: q, mode: "insensitive" } },
      ];
    }

    const documents = await prisma.medicalDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        documentNumber: true,
        status: true,
        patientName: true,
        patientStateId: true,
        patientMemberId: true,
        authorName: true,
        authorDiscordId: true,
        signedBy: true,
        signedAt: true,
        finalizedAt: true,
        createdAt: true,
        updatedAt: true,
        documentType: { select: { id: true, name: true, category: true } },
        formVersion: {
          select: { id: true, version: true, form: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    return apiError("Failed to load documents", error);
  }
}

/**
 * Starts a document as a draft against the form's newest published version.
 *
 * The version is pinned here, at creation, rather than looked up at render
 * time — so a form republished mid-shift never changes the questions under a
 * doctor who is halfway through answering them.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth("medical.create");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await req.json();
    const formId = String(body?.formId ?? "").trim();
    if (!formId) return NextResponse.json({ error: "Pick a form" }, { status: 400 });

    const form = await prisma.medicalForm.findUnique({
      where: { id: formId },
      include: { documentType: true },
    });
    if (!form) return NextResponse.json({ error: "That form no longer exists" }, { status: 400 });
    if (form.status !== "Active") {
      return NextResponse.json(
        { error: `"${form.name}" is ${form.status.toLowerCase()}`, detail: "Only Active forms can be filled in." },
        { status: 400 }
      );
    }

    const version = await latestPublishedVersion(form.id);
    if (!version) {
      return NextResponse.json(
        { error: "That form has no published version yet" },
        { status: 400 }
      );
    }

    const patientMemberId = body.patientMemberId ? String(body.patientMemberId) : null;
    const patient = patientMemberId
      ? await prisma.member.findUnique({ where: { id: patientMemberId } })
      : null;

    const patientName = String(body.patientName ?? patient?.name ?? "").trim();
    if (!patientName) {
      return NextResponse.json({ error: "A document needs a patient name" }, { status: 400 });
    }
    const patientStateId = String(body.patientStateId ?? patient?.stateId ?? "").trim() || null;

    const author = auth.access;
    const authorName = actorLabel(author);

    // Autofilled blocks are written into the answers now, not resolved at
    // render time: a finalized record has to keep saying what was true when it
    // was signed, even after the roster moves on.
    const answers: Answers = {};
    for (const field of parseFields(version.fields)) {
      if (field.defaultValue !== undefined) answers[field.name] = field.defaultValue;
      if (!AUTOFILL_TYPES.includes(field.type)) continue;
      if (field.type === "patientInfo") {
        answers[field.name] = [
          patientName,
          patientStateId ? `State ID ${patientStateId}` : null,
          patient?.rank ?? null,
          patient?.callSign ? `Call sign ${patient.callSign}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
      } else {
        answers[field.name] = [authorName, author.memberRank ?? null].filter(Boolean).join(" · ");
      }
    }

    const document = await prisma.medicalDocument.create({
      data: {
        documentTypeId: form.documentTypeId,
        formVersionId: version.id,
        status: "Draft",
        patientMemberId: patient?.id ?? null,
        patientName,
        patientStateId,
        answers: answers as Prisma.InputJsonValue,
        authorDiscordId: author.discordId,
        authorName,
        authorRank: author.memberRank,
      },
      include: {
        documentType: true,
        formVersion: { include: { form: true } },
      },
    });

    await logAudit({
      action: "create",
      entityType: "MedicalDocument",
      entityId: document.id,
      entityLabel: `${form.name} — ${patientName}`,
      details: { form: form.name, version: version.version, type: form.documentType.name },
      performedBy: authorName,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return apiError("Failed to create document", error);
  }
}
