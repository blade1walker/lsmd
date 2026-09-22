import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

/**
 * Promotion History — every rank change ever made, newest first. Read-only:
 * rows are written by the member PATCH route and by a passed promotion
 * examination, and there is deliberately no route that edits or deletes one.
 *
 * A record that came out of an examination carries its session, its panel
 * score and the panel that sat on it, so the history says not just that a rank
 * changed but what earned it.
 */
export async function GET() {
  const auth = await requireAuth("promotions.view");
  if (isDenied(auth)) return auth.error;

  try {
    const records = await prisma.promotionRecord.findMany({
      orderBy: { promotedAt: "desc" },
      select: {
        id: true,
        memberId: true,
        memberName: true,
        callSign: true,
        fromRank: true,
        toRank: true,
        direction: true,
        promotedBy: true,
        promotedAt: true,
        interviewId: true,
        interviewSessionId: true,
        finalScore: true,
      },
    });

    // The panels behind the records that have one. Fetched in a single query
    // rather than a join per row — most history is hand-made promotions with
    // no interview at all.
    const interviewIds = records.map((r) => r.interviewId).filter((id): id is string => !!id);
    const interviews = interviewIds.length
      ? await prisma.promotionInterview.findMany({
          where: { id: { in: interviewIds } },
          select: {
            id: true,
            result: true,
            finalizedAt: true,
            categoryScores: true,
            panel: { select: { name: true, rank: true, role: true } },
          },
        })
      : [];
    const byId = new Map(interviews.map((i) => [i.id, i]));

    return NextResponse.json(
      records.map((r) => {
        const interview = r.interviewId ? byId.get(r.interviewId) : undefined;
        return {
          ...r,
          interview: interview
            ? {
                result: interview.result,
                finalizedAt: interview.finalizedAt,
                categoryScores: interview.categoryScores,
                panel: interview.panel,
              }
            : null,
        };
      })
    );
  } catch (error) {
    return apiError("Failed to load promotion history", error);
  }
}
