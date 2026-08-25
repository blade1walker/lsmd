import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SECTION_HINTS } from "@/lib/constants";
import { getNextCallSign } from "@/lib/callsign";

export async function GET() {
  try {
    const sections = await prisma.section.findMany({
      include: { members: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(sections);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Database connection failed", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.callSign && body.rank) {
      body.callSign = await getNextCallSign(body.rank);
    }

    const member = await prisma.member.create({ data: body });

    if (body.rank) {
      for (const [sectionName, ranks] of Object.entries(SECTION_HINTS)) {
        if (ranks.includes(body.rank)) {
          const section = await prisma.section.findFirst({ where: { name: sectionName } });
          if (section) {
            await prisma.member.update({ where: { id: member.id }, data: { sectionId: section.id } });
          }
          break;
        }
      }
    }

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create member", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
