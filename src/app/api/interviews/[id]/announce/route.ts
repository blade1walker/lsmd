import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import {
  INTERVIEW_INCLUDE,
  getPromotionSettings,
  readInterviewDetail,
  toPanelistRecord,
} from "@/lib/interviews/server";
import { announce } from "@/lib/interviews/promote";

/**
 * Resends a promotion announcement Discord refused.
 *
 * Only for a promotion that actually reached the roster and whose announcement
 * failed — never a way to announce a result that did not promote anyone. The
 * status is claimed first ("Failed" → "Sending"), so two people pressing
 * Resend at once post it once.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("interviews.review");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const interview = await prisma.promotionInterview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!interview.rosterUpdated || interview.announcementStatus !== "Failed") {
      return NextResponse.json(
        { error: "Only a failed announcement for a completed promotion can be resent" },
        { status: 409 }
      );
    }

    const claim = await prisma.promotionInterview.updateMany({
      where: { id, announcementStatus: "Failed" },
      data: { announcementStatus: "Sending" },
    });
    if (claim.count !== 1) {
      return NextResponse.json({ error: "The announcement is already being resent" }, { status: 409 });
    }

    const member = interview.memberId
      ? await prisma.member.findUnique({
          where: { id: interview.memberId },
          select: { discordId: true, callSign: true },
        })
      : null;

    await announce(
      interview,
      interview.panel.map(toPanelistRecord),
      interview.finalScore ?? 0,
      member?.discordId ?? interview.discordId,
      member?.callSign ?? interview.callSign,
      await getPromotionSettings(),
      actorLabel(auth.access)
    );

    return NextResponse.json(await readInterviewDetail(id));
  } catch (error) {
    return apiError("Failed to resend the announcement", error);
  }
}
