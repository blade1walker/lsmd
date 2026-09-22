import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

/**
 * Promotion History — every rank change ever made through the roster, newest
 * first. Read-only: rows are written by the member PATCH route and there is
 * deliberately no route that edits or deletes one.
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
      },
    });
    return NextResponse.json(records);
  } catch (error) {
    return apiError("Failed to load promotion history", error);
  }
}
