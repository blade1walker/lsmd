import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const member = await prisma.member.create({ data: body });

    if (body.rank) {
      const sectionHints: Record<string, string[]> = {
        "High Command": ["Director of Medicine", "Chief of EMS", "Deputy Chief of EMS", "Assistant Chief"],
        Command: ["Division Chief", "EMS Captain", "Lieutenant"],
        Lead: ["Senior Paramedic"],
        "Medical Patrol": ["Paramedic", "EMT", "EMR"],
        Probationary: ["Medical Intern"],
      };
      for (const [sectionName, ranks] of Object.entries(sectionHints)) {
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
