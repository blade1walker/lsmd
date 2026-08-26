import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAuth("training.view");
  if (isDenied(auth)) return auth.error;

  try {
    const records = await prisma.fTOSignOffRecord.findMany({
      include: {
        ftoMember: {
          select: { name: true, callSign: true },
        },
        signOffDefinition: {
          select: { name: true },
        },
      },
      orderBy: { completedAt: "desc" },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("Error fetching FTO records:", error);
    return NextResponse.json({ error: "Failed to fetch records" }, { status: 500 });
  }
}
