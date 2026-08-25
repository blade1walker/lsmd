import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { section: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    let trainingRecord = await prisma.trainingRecord.findUnique({
      where: { memberId },
      include: { remarks: { orderBy: { createdAt: "desc" } } },
    });

    if (!trainingRecord) {
      trainingRecord = await prisma.trainingRecord.create({
        data: { memberId },
        include: { remarks: true },
      });
    }

    const clockEntries = await prisma.clockEntry.findMany({
      where: { memberId },
      orderBy: { clockInAt: "desc" },
      take: 20,
    });

    const loaHistory = await prisma.lOA.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: "Member", entityId: memberId },
          { performedBy: member.name },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return NextResponse.json({
      member,
      trainingRecord,
      clockEntries,
      loaHistory,
      auditLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch member profile", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
