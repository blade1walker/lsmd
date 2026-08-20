import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const member = await prisma.member.findFirst({
      where: { discordId: session.user.discordId },
      include: {
        trainingRecord: {
          include: {
            remarks: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching cadet info:", error);
    return NextResponse.json({ error: "Failed to fetch info" }, { status: 500 });
  }
}
