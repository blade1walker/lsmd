import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { log } from "@/lib/log";

export async function GET() {
  const auth = await requireAuth("hr.view");
  if (isDenied(auth)) return auth.error;

  try {
    const requests = await prisma.inactivityRequest.findMany({
      include: {
        member: {
          select: { name: true, callSign: true, rank: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    log.error("Error fetching inactivity requests", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

/** Reporting a member inactive needs hr.inactivity; it used to accept anyone, under any name. */
export async function POST(request: Request) {
  const auth = await requireAuth("hr.inactivity");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { memberId, reason } = body;
    const submittedBy = actorLabel(auth.access);

    const inactivityRequest = await prisma.inactivityRequest.create({
      data: {
        memberId,
        submittedBy,
        reason,
      },
    });

    return NextResponse.json(inactivityRequest, { status: 201 });
  } catch (error) {
    log.error("Error creating inactivity request", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
