import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sections = await prisma.section.findMany({
      include: {
        members: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      rank,
      callSign,
      sectionId,
      activity,
      timezone,
      dateOfJoining,
      discordId,
      ptd,
      hr,
      asd,
      bike,
      speedUnit,
      ftoRole,
      tempRank,
      category,
    } = body;

    const member = await prisma.member.create({
      data: {
        name,
        rank,
        callSign,
        sectionId,
        activity: activity ?? "Active",
        timezone,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
        discordId,
        ptd: ptd ?? false,
        hr: hr ?? false,
        asd: asd ?? false,
        bike: bike ?? false,
        speedUnit: speedUnit ?? false,
        ftoRole,
        tempRank,
        category,
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Error creating member:", error);
    return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
  }
}
