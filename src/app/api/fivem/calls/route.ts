import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { rejectUnlessFiveM } from "@/lib/fivem-auth";
import { loadMatcher, notOnRosterBody, parseActor, readFiveMSettings } from "@/lib/fivem-server";
import { nameKey } from "@/lib/fivem";
import { CALL_NATURES, CALL_NUMBER_PREFIX, CALL_OUTCOMES, HOSPITALS, MAX_RESPONDERS, TRANSPORT_OUTCOME, parseCallInput } from "@/lib/calls";
import { CALL_INCLUDE, checkCallReferences, toCallRecord } from "@/lib/calls-server";
import { claimDocumentNumber } from "@/lib/medical-server";
import { memberDisplayLabel } from "@/lib/utils";

/**
 * /emscall in game, or another resource calling the LogCall export: a call
 * logged from the city lands in the Call Log with the medic who logged it as
 * Lead, exactly as if they had used the form on the site.
 *
 * Typing in game is rougher than picking from a list, so the call's nature,
 * outcome and hospital are matched loosely ("cardiac" finds Cardiac Arrest);
 * a nature that matches nothing is logged as Other with what was typed kept
 * in the notes, rather than refused mid-scene.
 */

/** The one entry in `list` that `typed` names: exact, then a unique prefix, then a unique substring. */
function loose<T extends string>(list: readonly T[], typed: unknown): T | null {
  const key = typeof typed === "string" ? nameKey(typed) : "";
  if (!key) return null;
  const exact = list.find((item) => nameKey(item) === key);
  if (exact) return exact;
  for (const test of [(k: string) => k.startsWith(key), (k: string) => k.includes(key)]) {
    const found = list.filter((item) => test(nameKey(item)));
    if (found.length === 1) return found[0];
  }
  return null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

export async function POST(req: NextRequest) {
  const denied = rejectUnlessFiveM(req);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const actor = parseActor(body);
    const call = body && typeof body.call === "object" && body.call ? (body.call as Record<string, unknown>) : null;
    if (!actor || !call) return NextResponse.json({ error: "Send the medic's identifiers and the call" }, { status: 400 });

    const settings = await readFiveMSettings();
    if (settings && !settings.callSync) {
      return NextResponse.json(
        { error: "In-game call logging is off", detail: "Command has switched it off — log the call on the website's Call Log." },
        { status: 409 }
      );
    }

    const matchByName = settings?.matchByName ?? false;
    const matcher = await loadMatcher(matchByName);
    const lead = matcher(actor);
    if (!lead) return NextResponse.json(notOnRosterBody(matchByName), { status: 404 });

    // Everyone the medic named as responding, by their in-game identity.
    const responderIds = [lead.member.id];
    const unmatched: string[] = [];
    for (const entry of Array.isArray(body?.responders) ? body.responders.slice(0, MAX_RESPONDERS * 2) : []) {
      const responder = parseActor(entry);
      if (!responder) continue;
      const match = matcher(responder);
      if (!match) unmatched.push(responder.characterName ?? responder.name);
      else if (!responderIds.includes(match.member.id)) responderIds.push(match.member.id);
    }

    const typedNature = text(call.nature, 60);
    const nature = loose(CALL_NATURES, typedNature) ?? "Other";
    const outcome = call.outcome === undefined || call.outcome === "" ? "Treated on Scene" : loose(CALL_OUTCOMES, call.outcome);
    if (!outcome) {
      return NextResponse.json(
        { error: "Unknown outcome", detail: `Use one of: ${CALL_OUTCOMES.join(", ")}.` },
        { status: 400 }
      );
    }
    const hospitalTyped = text(call.hospital, 80);
    const hospital = outcome === TRANSPORT_OUTCOME && hospitalTyped ? (loose(HOSPITALS, hospitalTyped) ?? hospitalTyped) : null;

    const typedNote =
      typedNature && nature === "Other" && nameKey(typedNature) !== "other" ? `Reported in game as: ${typedNature}` : null;
    const notes = [typedNote, text(call.notes, 1900)].filter(Boolean).join("\n") || null;

    const parsed = parseCallInput({
      occurredAt: typeof call.occurredAt === "string" ? call.occurredAt : new Date().toISOString(),
      location: call.location,
      nature,
      priority: typeof call.priority === "string" ? call.priority.toUpperCase() : "P2",
      outcome,
      hospital,
      patientName: call.patientName,
      patientStateId: call.patientStateId,
      notes,
      responders: responderIds.map((memberId, i) => ({ memberId, role: i === 0 ? "Lead" : "Responder" })),
    });
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const problem = await checkCallReferences(parsed.data);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const createdByName = `${memberDisplayLabel(lead.member)} (in game)`;
    const callNumber = await claimDocumentNumber(CALL_NUMBER_PREFIX);
    const { responders, ...fields } = parsed.data;
    const created = await prisma.emsCall.create({
      data: {
        ...fields,
        callNumber,
        // Who logged it, as the Call Log's "my calls" reads it. A medic matched
        // by Steam ID or name may have no Discord ID on the roster.
        createdByDiscordId: lead.member.discordId ?? "",
        createdByName,
        responders: { create: responders.map((r) => ({ memberId: r.memberId, role: r.role })) },
      },
      include: CALL_INCLUDE,
    });

    await logAudit({
      action: "create",
      entityType: "EmsCall",
      entityId: created.id,
      entityLabel: created.callNumber,
      details: { nature: created.nature, outcome: created.outcome, responders: responders.length, source: "fivem" },
      performedBy: createdByName,
    });

    const record = toCallRecord(created);
    return NextResponse.json(
      { callNumber: record.callNumber, nature: record.nature, outcome: record.outcome, responders: record.responders.length, unmatched },
      { status: 201 }
    );
  } catch (error) {
    return apiError("Failed to log the call", error);
  }
}
