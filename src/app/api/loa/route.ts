import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const loas = await prisma.lOA.findMany({
      include: {
        member: {
          select: { name: true, callSign: true, rank: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(loas);
  } catch (error) {
      return apiError("Failed to fetch LOAs", error);
  }
}
