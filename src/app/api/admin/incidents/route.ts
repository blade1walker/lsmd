import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET(request: Request) {
  const auth = await requireAuth("incidents.view");
  if (isDenied(auth)) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");

    const where: Record<string, string> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const incidents = await prisma.incidentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(incidents);
  } catch (error) {
    return apiError("Failed to fetch incidents", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("incidents.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { type, location, description, priority, reportedById, reportedBy, assignedToId, assignedTo } = body;

    const now = new Date();
    const year = now.getFullYear();
    const count = await prisma.incidentReport.count();
    const reportNumber = `INC-${year}-${String(count + 1).padStart(3, "0")}`;

    const incident = await prisma.incidentReport.create({
      data: {
        reportNumber,
        type,
        location,
        description,
        priority: priority || "Normal",
        reportedById,
        reportedBy,
        assignedToId,
        assignedTo,
      },
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (error) {
    return apiError("Failed to create incident", error);
  }
}
