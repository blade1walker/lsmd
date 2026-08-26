import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { getRankWeight } from "@/lib/constants";

export async function POST() {
  const auth = await requireAuth("roster.edit");
  if (isDenied(auth)) return auth.error;

  try {
    const members = await prisma.member.findMany();

    for (const member of members) {
      const weight = getRankWeight(member.rank);
      const order = weight * 10000 + (member.order % 10000);
      await prisma.member.update({
        where: { id: member.id },
        data: { order },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error sorting callsigns:", error);
    return apiError("Failed to sort callsigns", error);
  }
}
