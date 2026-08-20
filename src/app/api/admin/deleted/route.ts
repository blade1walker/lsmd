import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const logs = await prisma.deletionLog.findMany({
      orderBy: { deletedAt: "desc" },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching deletion logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");

    if (!logId) {
      return NextResponse.json({ error: "logId required" }, { status: 400 });
    }

    const log = await prisma.deletionLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    const data = log.data as any;

    if (log.entityType === "Member") {
      await prisma.member.create({
        data: {
          id: log.entityId,
          name: data.name,
          rank: data.rank,
          callSign: data.callSign,
          sectionId: data.sectionId,
          activity: data.activity,
        },
      });
    }

    await prisma.deletionLog.delete({ where: { id: logId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring entity:", error);
    return NextResponse.json({ error: "Failed to restore" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");

    if (!logId) {
      return NextResponse.json({ error: "logId required" }, { status: 400 });
    }

    await prisma.deletionLog.delete({ where: { id: logId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dismissing log:", error);
    return NextResponse.json({ error: "Failed to dismiss" }, { status: 500 });
  }
}
