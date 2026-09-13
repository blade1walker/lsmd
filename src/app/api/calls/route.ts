import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CALL_SECTION_PERMISSIONS } from "@/lib/constants";
import { CALL_NUMBER_PREFIX, parseCallInput } from "@/lib/calls";
import { CALL_INCLUDE, checkCallReferences, ownCallsFilter, toCallRecord } from "@/lib/calls-server";
import { claimDocumentNumber } from "@/lib/medical-server";
import type { Prisma } from "@/generated/prisma/client";

/** The log, newest first. Without calls.view it is limited to the viewer's own calls. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(CALL_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const sp = req.nextUrl.searchParams;
    const conditions: Prisma.EmsCallWhereInput[] = [];

    const own = ownCallsFilter(auth.access);
    if (own) conditions.push(own);

    if (sp.get("mine") === "1") {
      conditions.push({
        OR: [
          { createdByDiscordId: auth.access.discordId },
          ...(auth.access.memberId ? [{ responders: { some: { memberId: auth.access.memberId } } }] : []),
        ],
      });
    }

    for (const field of ["nature", "outcome", "priority"] as const) {
      const value = sp.get(field);
      if (value) conditions.push({ [field]: value });
    }

    const responder = sp.get("responder");
    if (responder) conditions.push({ responders: { some: { memberId: responder } } });

    const from = sp.get("from");
    const to = sp.get("to");
    if (from || to) {
      conditions.push({
        occurredAt: {
          ...(from ? { gte: new Date(from) } : {}),
          // Inclusive of the whole "to" day.
          ...(to ? { lte: new Date(new Date(to).setUTCHours(23, 59, 59, 999)) } : {}),
        },
      });
    }

    const q = sp.get("q")?.trim();
    if (q) {
      conditions.push({
        OR: [
          { callNumber: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { patientName: { contains: q, mode: "insensitive" } },
          { patientStateId: { contains: q, mode: "insensitive" } },
          { medicalDocumentNumber: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const calls = await prisma.emsCall.findMany({
      where: conditions.length ? { AND: conditions } : {},
      orderBy: { occurredAt: "desc" },
      take: 300,
      include: CALL_INCLUDE,
    });

    return NextResponse.json(calls.map(toCallRecord));
  } catch (error) {
    return apiError("Failed to load the call log", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth("calls.create");
  if (isDenied(auth)) return auth.error;

  try {
    const parsed = parseCallInput(await req.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { data } = parsed;

    const problem = await checkCallReferences(data);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const actor = actorLabel(auth.access);
    // Claimed only once validation has passed, so a rejected submission never
    // burns a number out of the sequence.
    const callNumber = await claimDocumentNumber(CALL_NUMBER_PREFIX);

    const { responders, ...fields } = data;
    const call = await prisma.emsCall.create({
      data: {
        ...fields,
        callNumber,
        createdByDiscordId: auth.access.discordId,
        createdByName: actor,
        responders: { create: responders.map((r) => ({ memberId: r.memberId, role: r.role })) },
      },
      include: CALL_INCLUDE,
    });

    await logAudit({
      action: "create",
      entityType: "EmsCall",
      entityId: call.id,
      entityLabel: call.callNumber,
      details: { nature: call.nature, outcome: call.outcome, responders: responders.length },
      performedBy: actor,
    });

    return NextResponse.json(toCallRecord(call), { status: 201 });
  } catch (error) {
    return apiError("Failed to log the call", error);
  }
}
