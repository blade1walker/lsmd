import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.dateOfJoining) body.dateOfJoining = new Date(body.dateOfJoining);
  if (body.lastPromotion) body.lastPromotion = new Date(body.lastPromotion);

  const member = await prisma.member.update({
    where: { id },
    data: body,
  });

  if (body.rank) {
    const sectionHints: Record<string, string[]> = {
      "High Command": ["Director of EMS", "Chief of EMS", "Deputy Chief of EMS", "Assistant Chief"],
      Command: ["Division Chief", "EMS Captain", "Lieutenant"],
      NCO: ["Senior Paramedic"],
      Patrol: ["Paramedic", "EMT", "EMR"],
      Probationary: ["Medical Intern"],
    };

    for (const [sectionName, ranks] of Object.entries(sectionHints)) {
      if (ranks.includes(body.rank)) {
        const section = await prisma.section.findFirst({ where: { name: sectionName } });
        if (section) {
          await prisma.member.update({ where: { id }, data: { sectionId: section.id } });
        }
        break;
      }
    }
  }

  return NextResponse.json(member);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.deletionLog.create({
    data: {
      entityType: "Member",
      entityId: id,
      entityLabel: member.name,
      data: JSON.parse(JSON.stringify(member)),
      deletedBy: "system",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.member.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
