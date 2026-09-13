import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CALL_SECTION_PERMISSIONS } from "@/lib/constants";
import { parseCallInput } from "@/lib/calls";
import { CALL_INCLUDE, checkCallReferences, mayEditCall, mayReadCall, toCallRecord } from "@/lib/calls-server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CALL_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const call = await prisma.emsCall.findUnique({ where: { id }, include: CALL_INCLUDE });
    // A call the viewer may not read answers exactly like one that does not
    // exist, so the id cannot be used to probe for other medics' patients.
    if (!call || !mayReadCall(auth.access, call)) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }
    return NextResponse.json(toCallRecord(call));
  } catch (error) {
    return apiError("Failed to load the call", error);
  }
}

/** Replaces a call's details. The call number and who logged it never change. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["calls.create", "calls.manage"]);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const existing = await prisma.emsCall.findUnique({ where: { id }, select: { id: true, createdByDiscordId: true } });
    if (!existing) return NextResponse.json({ error: "Call not found" }, { status: 404 });
    if (!mayEditCall(auth.access, existing)) {
      return NextResponse.json(
        { error: "Forbidden", detail: "Only the medic who logged this call, or calls.manage, can change it." },
        { status: 403 }
      );
    }

    const parsed = parseCallInput(await req.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { data } = parsed;

    const problem = await checkCallReferences(data);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const { responders, ...fields } = data;
    const call = await prisma.$transaction(async (tx) => {
      await tx.emsCallResponder.deleteMany({ where: { callId: id } });
      return tx.emsCall.update({
        where: { id },
        data: {
          ...fields,
          responders: { create: responders.map((r) => ({ memberId: r.memberId, role: r.role })) },
        },
        include: CALL_INCLUDE,
      });
    });

    await logAudit({
      action: "update",
      entityType: "EmsCall",
      entityId: call.id,
      entityLabel: call.callNumber,
      details: { nature: call.nature, outcome: call.outcome, responders: responders.length },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(toCallRecord(call));
  } catch (error) {
    return apiError("Failed to update the call", error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("calls.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const call = await prisma.emsCall.findUnique({ where: { id }, include: CALL_INCLUDE });
    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

    await prisma.emsCall.delete({ where: { id } });

    // The row is gone afterwards, so the audit entry keeps enough to say what it was.
    await logAudit({
      action: "delete",
      entityType: "EmsCall",
      entityId: id,
      entityLabel: call.callNumber,
      details: {
        occurredAt: call.occurredAt.toISOString(),
        nature: call.nature,
        outcome: call.outcome,
        loggedBy: call.createdByName,
      },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete the call", error);
  }
}
