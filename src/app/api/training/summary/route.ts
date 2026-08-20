import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const records = await prisma.trainingRecord.findMany({
      include: {
        member: {
          select: { name: true, callSign: true, rank: true, ftoRole: true },
        },
      },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("Error fetching training summary:", error);
    return NextResponse.json({ error: "Failed to fetch training" }, { status: 500 });
  }
}
