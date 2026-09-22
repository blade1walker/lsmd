import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { INTERVIEW_SECTION_PERMISSIONS, RANK_LIST } from "@/lib/constants";
import { MAX_PANEL, PANEL_ROLE_KEYS, parseCreateInput } from "@/lib/interviews";
import {
  INTERVIEW_INCLUDE,
  candidateSnapshot,
  claimSessionId,
  evaluateEligibility,
  getPromotionSettings,
  toSummary,
} from "@/lib/interviews-server";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The Promotion & Interview dashboard: every session, filtered, plus the
 * headline counts.
 *
 * Returns an object rather than a bare list because the statistics are counted
 * over every session, not only the page of them being shown.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(INTERVIEW_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const sp = req.nextUrl.searchParams;
    const conditions: Prisma.PromotionInterviewWhereInput[] = [];

    // Without interviews.view a panelist still reaches the dashboard, but only
    // sees the sessions they are actually sitting on.
    if (!hasPermission(auth.access, "interviews.view")) {
      conditions.push({ panel: { some: { discordId: auth.access.discordId } } });
    }

    for (const field of ["status", "result", "memberId", "currentRank", "targetRank"] as const) {
      const value = sp.get(field);
      if (value) conditions.push({ [field]: value });
    }

    const interviewer = sp.get("interviewer");
    if (interviewer) conditions.push({ panel: { some: { discordId: interviewer } } });

    const from = sp.get("from");
    const to = sp.get("to");
    if (from || to) {
      conditions.push({
        createdAt: {
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
          { sessionId: { contains: q, mode: "insensitive" } },
          { memberName: { contains: q, mode: "insensitive" } },
          { callSign: { contains: q, mode: "insensitive" } },
          { currentRank: { contains: q, mode: "insensitive" } },
          { targetRank: { contains: q, mode: "insensitive" } },
          { panel: { some: { name: { contains: q, mode: "insensitive" } } } },
        ],
      });
    }

    const where: Prisma.PromotionInterviewWhereInput = conditions.length ? { AND: conditions } : {};
    // The statistics ignore the filters — they describe the department, not the
    // current view, so they stay steady as the reader narrows the list.
    const scope: Prisma.PromotionInterviewWhereInput = hasPermission(auth.access, "interviews.view")
      ? {}
      : { panel: { some: { discordId: auth.access.discordId } } };

    const [interviews, total, ongoing, passed, failed, reviewRequired, promoted] = await Promise.all([
      prisma.promotionInterview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 300,
        include: INTERVIEW_INCLUDE,
      }),
      prisma.promotionInterview.count({ where: scope }),
      prisma.promotionInterview.count({ where: { ...scope, status: "Ongoing" } }),
      prisma.promotionInterview.count({ where: { ...scope, result: "Passed" } }),
      prisma.promotionInterview.count({ where: { ...scope, result: "Failed" } }),
      prisma.promotionInterview.count({ where: { ...scope, result: "Review Required" } }),
      prisma.promotionInterview.count({ where: { ...scope, rosterUpdated: true } }),
    ]);

    return NextResponse.json({
      interviews: interviews.map(toSummary),
      stats: { total, ongoing, passed, failed, pending: ongoing, reviewRequired, promoted },
    });
  } catch (error) {
    return apiError("Failed to load promotion interviews", error);
  }
}

/**
 * Opens a session.
 *
 * The candidate's details are copied onto the record at creation and the
 * eligibility verdict is stored with them, so the examination still reads
 * correctly after the roster moves on — and an override is visible rather than
 * implied by an absence.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth("interviews.create");
  if (isDenied(auth)) return auth.error;

  try {
    const parsed = parseCreateInput(await req.json().catch(() => null), RANK_LIST);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { data } = parsed;

    const candidate = await candidateSnapshot(data.memberId);
    if (!candidate) {
      return NextResponse.json({ error: "That employee is no longer on the roster" }, { status: 400 });
    }

    const settings = await getPromotionSettings();
    const eligibility = evaluateEligibility(candidate, data.targetRank, settings);

    // An open session or a running cooldown is never overridable: both would
    // produce two live examinations for one candidate, which is what the
    // "prevent duplicate promotion processing" rule exists to stop.
    if (candidate.openSessionId) {
      return NextResponse.json(
        { error: `${candidate.name} already has an open interview (${candidate.openSessionId})` },
        { status: 409 }
      );
    }
    if (candidate.cooldownUntil) {
      return NextResponse.json(
        {
          error: `${candidate.name} cannot be re-interviewed until ${new Date(candidate.cooldownUntil).toLocaleDateString()}`,
        },
        { status: 409 }
      );
    }

    const mayOverride = hasPermission(auth.access, "interviews.manage");
    if (!eligibility.eligible && !(data.overrideEligibility && mayOverride)) {
      return NextResponse.json(
        {
          error: "This employee does not meet the promotion requirements",
          detail: eligibility.reasons.join("; "),
        },
        { status: 400 }
      );
    }

    const actor = actorLabel(auth.access);

    // The creator always holds a seat, as Lead unless the submitted panel
    // names them otherwise — somebody has to be able to finalize the session
    // they just opened.
    const seats = new Map<string, string>();
    seats.set(auth.access.discordId, "Lead Interviewer");
    for (const entry of data.panel) {
      seats.set(entry.discordId, PANEL_ROLE_KEYS.includes(entry.role) ? entry.role : "Interviewer");
    }
    if (seats.size > MAX_PANEL) {
      return NextResponse.json({ error: `A panel can hold at most ${MAX_PANEL} people` }, { status: 400 });
    }

    // Panel names and ranks come off the roster so the panel table reads as
    // people rather than Discord snowflakes.
    const panelMembers = await prisma.member.findMany({
      where: { discordId: { in: [...seats.keys()] } },
      select: { id: true, name: true, rank: true, callSign: true, discordId: true },
    });
    const byDiscordId = new Map(panelMembers.map((m) => [m.discordId!, m]));

    // Claimed only once everything above has passed, so a rejected submission
    // never burns a session number.
    const sessionId = await claimSessionId();

    const interview = await prisma.promotionInterview.create({
      data: {
        sessionId,
        memberId: candidate.memberId,
        memberName: candidate.name,
        callSign: candidate.callSign,
        discordId: candidate.discordId,
        currentRank: candidate.rank,
        targetRank: data.targetRank,
        joinedEmsAt: candidate.joinedEmsAt ? new Date(candidate.joinedEmsAt) : null,
        rankSince: candidate.rankSince ? new Date(candidate.rankSince) : null,
        eligibility: eligibility as unknown as Prisma.InputJsonValue,
        eligibilityOverride: !eligibility.eligible,
        createdByDiscordId: auth.access.discordId,
        createdByName: actor,
        panel: {
          create: [...seats.entries()].map(([discordId, role]) => {
            const member = byDiscordId.get(discordId);
            return {
              discordId,
              name: member?.name ?? (discordId === auth.access.discordId ? actor : discordId),
              rank: member?.rank ?? null,
              memberId: member?.id ?? null,
              role,
            };
          }),
        },
      },
      include: INTERVIEW_INCLUDE,
    });

    await logAudit({
      action: "create",
      entityType: "PromotionInterview",
      entityId: interview.id,
      entityLabel: `${interview.sessionId} — ${interview.memberName}`,
      details: {
        candidate: interview.memberName,
        from: interview.currentRank,
        to: interview.targetRank,
        panel: interview.panel.length,
        eligibilityOverride: interview.eligibilityOverride,
        reasons: eligibility.reasons.join("; ") || null,
      },
      performedBy: actor,
    });

    return NextResponse.json(toSummary(interview), { status: 201 });
  } catch (error) {
    return apiError("Failed to create the interview", error);
  }
}
