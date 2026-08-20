import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SECTION_HINTS: Record<string, string[]> = {
  "High Command": ["Director of Medicine", "Chief of EMS", "Deputy Chief of EMS", "Assistant Chief"],
  Command: ["Division Chief", "EMS Captain", "Lieutenant"],
  Lead: ["Senior Paramedic"],
  "Medical Patrol": ["Paramedic", "EMT", "EMR"],
  Probationary: ["Medical Intern"],
};

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

      const memberCount = await prisma.member.count();
      await prisma.member.create({
        data: {
          name: request.name,
          rank: assignedRank,
          dept: "LSMD",
          activity: "Active",
          discordId: request.discordId,
          stateId: request.stateId,
          sectionId,
          dateOfJoining: new Date(),
          order: memberCount,
        },
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
