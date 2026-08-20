import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const entries = await prisma.clockEntry.findMany({
      include: {
        member: {
          select: { name: true, callSign: true },
        },
      },
      orderBy: { clockInAt: "desc" },
      take: 200,
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error fetching clock log:", error);
    return NextResponse.json({ error: "Failed to fetch log" }, { status: 500 });
  }
}
