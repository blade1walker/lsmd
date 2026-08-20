import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SECTION_HINTS: Record<string, string[]> = {
  "High Command": ["Director of Medicine", "Chief of EMS", "Deputy Chief of EMS", "Assistant Chief"],
  Command: ["Division Chief", "EMS Captain", "Lieutenant"],
  Lead: ["Senior Paramedic"],
  "Medical Patrol": ["Paramedic", "EMT", "EMR"],
  Probationary: ["Medical Intern"],
};

const RANK_CALLSIGN: Record<string, { fixed?: number; start?: number; end?: number }> = {
  "Director of Medicine": { fixed: 999 },
  "Director of EMS": { fixed: 900 },
  "Chief of EMS": { fixed: 911 },
  "Deputy Chief of EMS": { fixed: 912 },
  "Assistant Chief": { fixed: 913 },
  "Division Chief": { fixed: 914 },
  "EMS Captain": { fixed: 915 },
  "Lieutenant": { start: 920, end: 929 },
  "Senior Paramedic": { start: 930, end: 949 },
  "Paramedic": { start: 950, end: 969 },
  "EMT": { start: 970, end: 979 },
  "EMR": { start: 980, end: 989 },
  "Medical Intern": { start: 990, end: 998 },
};

async function getNextCallSign(rank: string): Promise<string | null> {
  const range = RANK_CALLSIGN[rank];
  if (!range) return null;

  if (range.fixed) {
    const existing = await prisma.member.findFirst({ where: { callSign: String(range.fixed) } });
    if (!existing) return String(range.fixed);
    return null;
  }

  if (range.start && range.end) {
    const used = await prisma.member.findMany({
      where: { callSign: { not: null } },
      select: { callSign: true },
    });
    const usedSet = new Set(used.map((m) => m.callSign));
    for (let i = range.start; i <= range.end; i++) {
      const cs = String(i);
      if (!usedSet.has(cs)) return cs;
    }
  }

  return null;
}

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
