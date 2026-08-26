import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const auth = await requireAuth("hr.view");
  if (isDenied(auth)) return auth.error;

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
