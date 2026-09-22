import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { CANDIDATE_SELECT, buildSnapshot } from "@/lib/interviews-server";

/**
 * Everyone the Create Interview form can pick from: the roster as candidates,
 * each with the live figures the eligibility rules read, and the members who
 * can be seated on a panel.
 *
 * One route rather than two because the form needs both at once, and the
 * expensive half — the roster read — is shared between them.
 */
export async function GET() {
  const auth = await requireAuth("interviews.create");
  if (isDenied(auth)) return auth.error;

  try {
    const now = new Date();

    const [members, cooldowns, open] = await Promise.all([
      prisma.member.findMany({ orderBy: { name: "asc" }, select: CANDIDATE_SELECT }),
      // Newest cooldown per member; the map below keeps the first one seen,
      // which this ordering makes the one that expires last.
      prisma.promotionInterview.findMany({
        where: { cooldownUntil: { gt: now }, memberId: { not: null } },
        orderBy: { cooldownUntil: "desc" },
        select: { memberId: true, cooldownUntil: true },
      }),
      prisma.promotionInterview.findMany({
        where: { status: "Ongoing", memberId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { memberId: true, sessionId: true },
      }),
    ]);

    const cooldownByMember = new Map<string, Date>();
    for (const row of cooldowns) {
      if (row.memberId && row.cooldownUntil && !cooldownByMember.has(row.memberId)) {
        cooldownByMember.set(row.memberId, row.cooldownUntil);
      }
    }
    const openByMember = new Map<string, string>();
    for (const row of open) {
      if (row.memberId && !openByMember.has(row.memberId)) openByMember.set(row.memberId, row.sessionId);
    }

    const candidates = members.map((m) =>
      buildSnapshot(m, now, cooldownByMember.get(m.id) ?? null, openByMember.get(m.id) ?? null)
    );

    // A panel seat is keyed on a Discord account, so a member without one
    // cannot be seated — they would have no way to sign in and score.
    const panelists = members
      .filter((m) => m.discordId)
      .map((m) => ({ discordId: m.discordId!, name: m.name, rank: m.rank, callSign: m.callSign }));

    return NextResponse.json({ candidates, panelists });
  } catch (error) {
    return apiError("Failed to load the roster", error);
  }
}
