import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import {
  EVALUATION_CATEGORIES,
  SCORE_BUCKETS,
  categoryFloor,
  daysBetween,
  individualScore,
  isScoringRole,
  type CategoryKey,
  type InterviewAnalytics,
} from "@/lib/interviews";
import { getPromotionSettings } from "@/lib/interviews-server";
import type { Prisma } from "@/generated/prisma/client";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function rate(passed: number, failed: number): number | null {
  return passed + failed === 0 ? null : Math.round((passed / (passed + failed)) * 100);
}

/**
 * How the examinations are going over a date range: outcomes, where
 * candidates fall short, and how each interviewer scores against the panels
 * they sit on.
 *
 * Reads finalized sessions only — a score still being typed is not a result —
 * and uses the score frozen at finalize, so these numbers never drift from
 * what the session pages show.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth("interviews.analytics");
  if (isDenied(auth)) return auth.error;

  try {
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const bounded = Boolean(from || to);
    const range: Prisma.DateTimeFilter = {
      ...(from ? { gte: new Date(from) } : {}),
      // Inclusive of the whole "to" day.
      ...(to ? { lte: new Date(new Date(to).setUTCHours(23, 59, 59, 999)) } : {}),
    };

    const now = new Date();
    const [settings, finalized, cancelled, open] = await Promise.all([
      getPromotionSettings(),
      prisma.promotionInterview.findMany({
        where: { status: "Finalized", ...(bounded ? { finalizedAt: range } : {}) },
        orderBy: { finalizedAt: "asc" },
        include: { panel: true },
      }),
      prisma.promotionInterview.count({
        where: { status: "Cancelled", ...(bounded ? { updatedAt: range } : {}) },
      }),
      // Open sessions are a now-figure, not a range one: how much is waiting today.
      prisma.promotionInterview.findMany({ where: { status: "Ongoing" }, select: { createdAt: true } }),
    ]);

    const passed = finalized.filter((i) => i.result === "Passed").length;
    const failed = finalized.filter((i) => i.result === "Failed").length;
    const scores = finalized.flatMap((i) => (i.finalScore === null ? [] : [i.finalScore]));

    // By target rank, busiest first.
    const rankMap = new Map<string, typeof finalized>();
    for (const i of finalized) rankMap.set(i.targetRank, [...(rankMap.get(i.targetRank) ?? []), i]);
    const byTargetRank = [...rankMap.entries()]
      .map(([rank, list]) => {
        const p = list.filter((i) => i.result === "Passed").length;
        const f = list.filter((i) => i.result === "Failed").length;
        return {
          rank,
          total: list.length,
          passed: p,
          failed: f,
          passRate: rate(p, f),
          averageScore: mean(list.flatMap((i) => (i.finalScore === null ? [] : [i.finalScore]))),
        };
      })
      .sort((a, b) => b.total - a.total);

    // Category averages from the per-session averages frozen at finalize.
    const categories = EVALUATION_CATEGORIES.map((category) => {
      const values: number[] = [];
      let belowFloor = 0;
      for (const i of finalized) {
        const stored = i.categoryScores as Partial<Record<CategoryKey, number | null>> | null;
        const value = stored?.[category.key];
        if (typeof value !== "number") continue;
        values.push(value);
        if (value < categoryFloor(settings, category.key)) belowFloor++;
      }
      return { key: category.key, label: category.label, average: mean(values), belowFloor };
    });

    // Month by month, keyed on when the result was recorded.
    const monthMap = new Map<string, { passed: number; failed: number; review: number; scores: number[] }>();
    for (const i of finalized) {
      const when = i.finalizedAt ?? i.createdAt;
      const month = `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, "0")}`;
      const bucket = monthMap.get(month) ?? { passed: 0, failed: 0, review: 0, scores: [] };
      if (i.result === "Passed") bucket.passed++;
      else if (i.result === "Failed") bucket.failed++;
      else if (i.result === "Review Required") bucket.review++;
      if (i.finalScore !== null) bucket.scores.push(i.finalScore);
      monthMap.set(month, bucket);
    }
    const monthly = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, b]) => ({
        month,
        passed: b.passed,
        failed: b.failed,
        review: b.review,
        averageScore: mean(b.scores),
      }));

    const distribution = SCORE_BUCKETS.map((bucket) => ({
      bucket: bucket.label,
      count: scores.filter((s) => s >= bucket.min && s <= bucket.max).length,
    }));

    // Interviewer calibration: submitted evaluations in scoring seats, set
    // against the panel score of the session they were given in.
    const people = new Map<
      string,
      { name: string; given: number[]; deltas: number[]; agree: number; compared: number; last: Date | null }
    >();
    for (const i of finalized) {
      for (const seat of i.panel) {
        if (!isScoringRole(seat.role) || !seat.submittedAt) continue;
        const score = individualScore(seat);
        if (score === null) continue;

        const person = people.get(seat.discordId) ?? {
          name: seat.name,
          given: [],
          deltas: [],
          agree: 0,
          compared: 0,
          last: null,
        };
        person.given.push(score);
        if (i.finalScore !== null) person.deltas.push(score - i.finalScore);

        // Only a firm recommendation against a firm outcome can agree or not.
        const firm = seat.recommendation === "Recommend Promotion" || seat.recommendation === "Do Not Recommend";
        if (firm && (i.result === "Passed" || i.result === "Failed")) {
          person.compared++;
          if ((seat.recommendation === "Recommend Promotion") === (i.result === "Passed")) person.agree++;
        }

        if (!person.last || seat.submittedAt > person.last) person.last = seat.submittedAt;
        people.set(seat.discordId, person);
      }
    }
    const interviewers = [...people.entries()]
      .map(([discordId, p]) => ({
        discordId,
        name: p.name,
        evaluations: p.given.length,
        averageGiven: mean(p.given),
        deviation: p.deltas.length
          ? Math.round((p.deltas.reduce((a, b) => a + b, 0) / p.deltas.length) * 10) / 10
          : null,
        agreement: p.compared ? Math.round((p.agree / p.compared) * 100) : null,
        agreementSample: p.compared,
        lastActive: p.last?.toISOString() ?? null,
      }))
      .sort((a, b) => b.evaluations - a.evaluations);

    // Opened to decided — including a management review, which is when a held
    // result was actually decided.
    const decisionDays = finalized.flatMap((i) => {
      const decided = i.reviewedAt ?? i.finalizedAt;
      return decided ? [daysBetween(i.createdAt, decided)] : [];
    });

    const body: InterviewAnalytics = {
      totals: {
        finalized: finalized.length,
        passed,
        failed,
        reviewRequired: finalized.filter((i) => i.result === "Review Required").length,
        cancelled,
        passRate: rate(passed, failed),
        averageScore: mean(scores),
        medianDaysToDecision: median(decisionDays),
        openSessions: open.length,
        oldestOpenDays: open.length ? Math.max(...open.map((o) => daysBetween(o.createdAt, now))) : null,
      },
      byTargetRank,
      categories,
      monthly,
      distribution,
      interviewers,
    };

    return NextResponse.json(body);
  } catch (error) {
    return apiError("Failed to load interview analytics", error);
  }
}
