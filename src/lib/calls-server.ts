import { prisma } from "./prisma";
import { hasPermission, type Access } from "./access";
import type { Prisma } from "@/generated/prisma/client";
import type { CallInput, EmsCallRecord } from "./calls";

/** Server half of the Call Log: the query shape, serialization and access rules. */

export const CALL_INCLUDE = {
  responders: {
    // "Lead" sorts before "Responder", so the medic in charge is listed first.
    orderBy: { role: "asc" as const },
    include: { member: { select: { id: true, name: true, callSign: true, rank: true } } },
  },
} satisfies Prisma.EmsCallInclude;

type CallWithResponders = Prisma.EmsCallGetPayload<{ include: typeof CALL_INCLUDE }>;

export function toCallRecord(call: CallWithResponders): EmsCallRecord {
  return {
    id: call.id,
    callNumber: call.callNumber,
    occurredAt: call.occurredAt.toISOString(),
    location: call.location,
    nature: call.nature,
    priority: call.priority,
    outcome: call.outcome,
    hospital: call.hospital,
    patientName: call.patientName,
    patientStateId: call.patientStateId,
    notes: call.notes,
    medicalDocumentNumber: call.medicalDocumentNumber,
    createdByDiscordId: call.createdByDiscordId,
    createdByName: call.createdByName,
    createdAt: call.createdAt.toISOString(),
    updatedAt: call.updatedAt.toISOString(),
    responders: call.responders.map((r) => ({
      memberId: r.memberId,
      role: r.role,
      name: r.member.name,
      callSign: r.member.callSign,
      rank: r.member.rank,
    })),
  };
}

/**
 * Calls carry patient names and State IDs, so the whole log is not open to
 * everyone who can log a call. calls.view reads every call; without it a
 * medic sees the calls they logged or responded to — the same rule medical
 * documents follow.
 */
export function ownCallsFilter(access: Access): Prisma.EmsCallWhereInput | null {
  if (hasPermission(access, "calls.view")) return null;
  return {
    OR: [
      { createdByDiscordId: access.discordId },
      ...(access.memberId ? [{ responders: { some: { memberId: access.memberId } } }] : []),
    ],
  };
}

export function mayReadCall(access: Access, call: CallWithResponders): boolean {
  return (
    hasPermission(access, "calls.view") ||
    call.createdByDiscordId === access.discordId ||
    (!!access.memberId && call.responders.some((r) => r.memberId === access.memberId))
  );
}

/** The person who logged a call may correct it; calls.manage may correct anyone's. */
export function mayEditCall(access: Access, call: { createdByDiscordId: string }): boolean {
  return hasPermission(access, "calls.manage") || call.createdByDiscordId === access.discordId;
}

/**
 * Confirms what a call points at still exists — responders removed from the
 * roster, or a mistyped document number — so the error is a readable 400
 * rather than a foreign-key failure.
 */
export async function checkCallReferences(data: CallInput): Promise<string | null> {
  const ids = data.responders.map((r) => r.memberId);
  const found = await prisma.member.count({ where: { id: { in: ids } } });
  if (found !== ids.length) return "One of the responding medics is no longer on the roster";

  if (data.medicalDocumentNumber) {
    const document = await prisma.medicalDocument.findUnique({
      where: { documentNumber: data.medicalDocumentNumber },
      select: { id: true },
    });
    if (!document) return `No medical document is numbered ${data.medicalDocumentNumber}`;
  }
  return null;
}
