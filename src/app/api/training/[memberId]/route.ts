import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { asJson } from "@/lib/medical-server";
import { findCheckpoint, findCounter, parseEmsProgress } from "@/lib/training";

const WITH_REMARKS = { remarks: { orderBy: { createdAt: "desc" as const } } };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const auth = await requireAuth("training.view");
  if (isDenied(auth)) return auth.error;

  try {
    const { memberId } = await params;

    // Checked first: creating a record for an id that is not a member fails on
    // the foreign key and surfaced as an unexplained 500.
    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const record = await prisma.trainingRecord.upsert({
      where: { memberId },
      create: { memberId },
      update: {},
      include: WITH_REMARKS,
    });

    return NextResponse.json({ ...record, emsProgress: parseEmsProgress(record.emsProgress) });
  } catch (error) {
    return apiError("Failed to fetch training record", error);
  }
}

/**
 * Records one change to a member's EMS training: a skill signed off or
 * withdrawn, a counter set, or the evaluation report number.
 *
 * One explicit change per request. The previous version mapped whatever keys
 * arrived straight onto the row — any column, including ones no screen
 * exposes, could be written by name — and "signed by" was whatever text the
 * browser sent. The signer is now always the authenticated account.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const auth = await requireAuth("training.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { memberId } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, name: true } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const checkpoint = body.checkpoint !== undefined ? findCheckpoint(body.checkpoint) : undefined;
    if (body.checkpoint !== undefined && !checkpoint) {
      return NextResponse.json({ error: "Unknown training checkpoint" }, { status: 400 });
    }

    const counter = body.counter !== undefined ? findCounter(body.counter) : undefined;
    if (body.counter !== undefined && !counter) {
      return NextResponse.json({ error: "Unknown training counter" }, { status: 400 });
    }
    const counterValue = counter ? Math.min(99, Math.floor(Number(body.value))) : 0;
    if (counter && !(counterValue >= 0)) {
      return NextResponse.json({ error: "A counter must be zero or more" }, { status: 400 });
    }

    const reportNumber = typeof body.reportNumber === "string" ? body.reportNumber.trim().slice(0, 60) : undefined;

    if (!checkpoint && !counter && reportNumber === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const actor = actorLabel(auth.access);
    const signOff = body.done === true;

    const record = await prisma.$transaction(async (tx) => {
      await tx.trainingRecord.upsert({ where: { memberId }, create: { memberId }, update: {} });

      // Progress is a single Json value, so this is read-modify-write. Locking
      // the row first means two trainers signing off different skills at the
      // same moment each build on the other's write, rather than the second
      // write quietly erasing the first tick.
      await tx.$queryRaw`SELECT "id" FROM "TrainingRecord" WHERE "memberId" = ${memberId} FOR UPDATE`;

      const current = await tx.trainingRecord.findUniqueOrThrow({
        where: { memberId },
        select: { emsProgress: true },
      });
      const progress = parseEmsProgress(current.emsProgress);

      if (checkpoint) {
        if (!signOff) {
          delete progress.checkpoints[checkpoint.key];
        } else if (!progress.checkpoints[checkpoint.key]) {
          // An existing sign-off keeps its original trainer and date.
          progress.checkpoints[checkpoint.key] = { by: actor, at: new Date().toISOString() };
        }
      }
      if (counter) progress.counters[counter.key] = counterValue;

      return tx.trainingRecord.update({
        where: { memberId },
        data: {
          emsProgress: asJson(progress),
          ...(reportNumber !== undefined ? { probationaryReportNumber: reportNumber } : {}),
        },
        include: WITH_REMARKS,
      });
    });

    await logAudit({
      action: "update",
      entityType: "TrainingRecord",
      entityId: memberId,
      entityLabel: member.name,
      details: checkpoint
        ? { checkpoint: checkpoint.label, signedOff: signOff }
        : counter
          ? { counter: counter.label, value: counterValue }
          : { reportNumber: reportNumber ?? null },
      performedBy: actor,
    });

    return NextResponse.json({ ...record, emsProgress: parseEmsProgress(record.emsProgress) });
  } catch (error) {
    return apiError("Failed to update training record", error);
  }
}
