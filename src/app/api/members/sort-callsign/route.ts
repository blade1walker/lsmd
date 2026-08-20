import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankWeight } from "@/lib/constants";

export async function POST() {
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
}
