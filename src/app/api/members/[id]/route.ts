import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { SECTION_HINTS } from "@/lib/constants";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("roster.edit");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();

    if (body.dateOfJoining) body.dateOfJoining = new Date(body.dateOfJoining);
    if (body.lastPromotion) body.lastPromotion = new Date(body.lastPromotion);

    const before = await prisma.member.findUnique({ where: { id }, select: { rank: true, activity: true } });
    const member = await prisma.member.update({
      where: { id },
      data: body,
    });

    if (body.rank) {
      for (const [sectionName, ranks] of Object.entries(SECTION_HINTS)) {
        if (ranks.includes(body.rank)) {
          const section = await prisma.section.findFirst({ where: { name: sectionName } });
          if (section) {
            await prisma.member.update({ where: { id }, data: { sectionId: section.id } });
          }
          break;
        }
      }
    }

    const changedFields = Object.keys(body).filter((k) => k !== "dateOfJoining" && k !== "lastPromotion");
    await logAudit({
      action: "update",
      entityType: "Member",
      entityId: member.id,
      entityLabel: member.name,
      details: {
        fields: changedFields.join(", "),
        rank: before && body.rank && before.rank !== body.rank ? `${before.rank} -> ${body.rank}` : null,
        activity: before && body.activity && before.activity !== body.activity ? `${before.activity} -> ${body.activity}` : null,
      },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(member);
  } catch (error) {
      return apiError("Failed to update member", error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("roster.delete");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const performedBy = actorLabel(auth.access);

    await prisma.deletionLog.create({
      data: {
        entityType: "Member",
        entityId: id,
        entityLabel: member.name,
        data: JSON.parse(JSON.stringify(member)),
        deletedBy: performedBy,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.member.delete({ where: { id } });

    await logAudit({
      action: "delete",
      entityType: "Member",
      entityId: id,
      entityLabel: member.name,
      performedBy,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
      return apiError("Failed to delete member", error);
  }
}
