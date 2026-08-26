import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAuth("clock.view");
  if (isDenied(auth)) return auth.error;

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
