import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { parseEmsProgress, type TrainingSummaryRow } from "@/lib/training";

/**
 * Every roster member with their EMS training progress.
 *
 * Members with no training record yet are included. Previously only existing
 * records were listed, and a record was only created when someone opened that
 * member's profile — so a new trainee was simply absent from the Training
 * page until then.
 */
export async function GET() {
  const auth = await requireAuth("training.view");
  if (isDenied(auth)) return auth.error;

  try {
    const members = await prisma.member.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        callSign: true,
        rank: true,
        ftoRole: true,
        activity: true,
        trainingRecord: { select: { emsProgress: true, probationaryReportNumber: true } },
      },
    });

    const rows: TrainingSummaryRow[] = members.map((m) => ({
      memberId: m.id,
      member: { name: m.name, callSign: m.callSign, rank: m.rank, ftoRole: m.ftoRole, activity: m.activity },
      reportNumber: m.trainingRecord?.probationaryReportNumber ?? "",
      progress: parseEmsProgress(m.trainingRecord?.emsProgress),
    }));

    return NextResponse.json(rows);
  } catch (error) {
    return apiError("Failed to fetch training", error);
  }
}
