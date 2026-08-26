import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("incidents.view");
  if (isDenied(auth)) return auth.error;

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
    return apiError("Failed to fetch incident", error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("incidents.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const incident = await prisma.incidentReport.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(incident);
  } catch (error) {
    return apiError("Failed to update incident", error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("incidents.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    await prisma.incidentMember.deleteMany({ where: { incidentId: id } });
    await prisma.incidentReport.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete incident", error);
  }
}
