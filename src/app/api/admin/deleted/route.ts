import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const auth = await requireAuth("roster.delete");
  if (isDenied(auth)) return auth.error;

  try {
    const logs = await prisma.deletionLog.findMany({
      orderBy: { deletedAt: "desc" },
    });

    return NextResponse.json(logs);
  } catch (error) {
    return apiError("Failed to fetch logs", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("roster.delete");
  if (isDenied(auth)) return auth.error;

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
    return apiError("Failed to restore", error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth("roster.delete");
  if (isDenied(auth)) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");

    if (!logId) {
      return NextResponse.json({ error: "logId required" }, { status: 400 });
    }

    await prisma.deletionLog.delete({ where: { id: logId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to dismiss", error);
  }
}
