import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postToLOAWebhook } from "@/lib/discord-webhook";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, assignedRank, reviewedBy, reviewNote } = body;

    const request = await prisma.onboardingRequest.update({
      where: { id },
      data: { status, assignedRank, reviewedBy, reviewNote },
    });

    if (status === "Approved" && assignedRank) {
      let sectionId: string | null = null;
      for (const [sectionName, ranks] of Object.entries(SECTION_HINTS)) {
        if (ranks.includes(assignedRank)) {
          const section = await prisma.section.findFirst({ where: { name: sectionName } });
          if (section) sectionId = section.id;
          break;
        }
      }

      const callSign = await getNextCallSign(assignedRank);
      const memberCount = await prisma.member.count();

      const member = await prisma.member.create({
        data: {
          name: request.name,
          rank: assignedRank,
          dept: "EMS",
          activity: "Active",
          discordId: request.discordId,
          stateId: request.stateId,
          callSign,
          sectionId,
          dateOfJoining: new Date(),
          order: memberCount,
        },
      });

      await postToLOAWebhook({
        title: "New Member Enrolled",
        description: `**${request.name}** has been enrolled in the EMS roster.`,
        color: 0x22c55e,
        fields: [
          { name: "Name", value: request.name, inline: true },
          { name: "Rank", value: assignedRank, inline: true },
          { name: "Call Sign", value: callSign || "N/A", inline: true },
          { name: "State ID", value: request.stateId || "N/A", inline: true },
        ],
      });
    }

    return NextResponse.json(request);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update onboarding request", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.onboardingRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete onboarding request", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
