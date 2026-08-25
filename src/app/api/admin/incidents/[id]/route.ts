import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const incident = await prisma.incidentReport.findUnique({
      where: { id },
      include: {
        members: {
          include: { member: { select: { id: true, name: true, callSign: true, rank: true } } },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    return NextResponse.json(incident);
  } catch (error) {
    console.error("Error fetching incident:", error);
    return NextResponse.json({ error: "Failed to fetch incident" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const incident = await prisma.incidentReport.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(incident);
  } catch (error) {
    console.error("Error updating incident:", error);
    return NextResponse.json({ error: "Failed to update incident" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.incidentMember.deleteMany({ where: { incidentId: id } });
    await prisma.incidentReport.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting incident:", error);
    return NextResponse.json({ error: "Failed to delete incident" }, { status: 500 });
  }
}
