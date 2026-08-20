import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const members = await prisma.member.findMany({
      where: { ftoRole: { not: null } },
    });
    return NextResponse.json(members);
  } catch (error: any) {
    console.error("Error fetching FTO members:", error);
    return NextResponse.json({ error: "Failed to fetch FTO members", detail: error.message?.slice(0, 200) }, { status: 500 });
  }
}
