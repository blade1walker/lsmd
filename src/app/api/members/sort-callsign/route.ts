import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankWeight } from "@/lib/constants";

export async function POST() {
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
  } catch (error: any) {
    console.error("Error sorting callsigns:", error);
    return NextResponse.json({ error: "Failed to sort callsigns", detail: error.message?.slice(0, 200) }, { status: 500 });
  }
}
