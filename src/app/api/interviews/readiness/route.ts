import { NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { classifyReadiness, type ReadinessEntry } from "@/lib/interviews";
import { allCandidateSnapshots, getPromotionSettings } from "@/lib/interviews/server";

/**
 * The Promotion Readiness board: every roster member measured against the rank
 * directly above theirs, using the same rules the Create Interview form uses.
 *
 * Upcoming members are limited to the configured look-ahead, so the board is a
 * working list for the next couple of weeks rather than the whole roster.
 * Blocked members are all returned — "why can't they be promoted" is worth
 * seeing whenever it is true.
 */
export async function GET() {
  const auth = await requireAuth("interviews.readiness");
  if (isDenied(auth)) return auth.error;

  try {
    const now = new Date();
    const [{ candidates, openInterviewIds }, settings] = await Promise.all([
      allCandidateSnapshots(now),
      getPromotionSettings(),
    ]);

    const entries: (ReadinessEntry & { openInterviewId: string | null })[] = [];
    for (const candidate of candidates) {
      const entry = classifyReadiness(candidate, settings, now);
      if (!entry) continue;
      if (entry.status === "Upcoming" && entry.daysToGo > settings.readinessWindowDays) continue;
      // The session behind "In Progress", so the board can link straight to it.
      entries.push({ ...entry, openInterviewId: openInterviewIds.get(candidate.memberId) ?? null });
    }

    const order = { Eligible: 0, Upcoming: 1, "In Progress": 2, Blocked: 3 } as const;
    entries.sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        a.daysToGo - b.daysToGo ||
        b.candidate.daysInRank - a.candidate.daysInRank
    );

    return NextResponse.json({ entries, windowDays: settings.readinessWindowDays });
  } catch (error) {
    return apiError("Failed to load promotion readiness", error);
  }
}
