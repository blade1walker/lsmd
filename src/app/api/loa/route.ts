import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch LOAs", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
