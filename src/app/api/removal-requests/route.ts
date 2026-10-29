import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { log } from "@/lib/log";

export async function GET() {
  const auth = await requireAuth("hr.view");
  if (isDenied(auth)) return auth.error;

  try {
    const requests = await prisma.removalRequest.findMany({
      include: {
        member: {
          select: { name: true, callSign: true, rank: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    log.error("Error fetching removal requests", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

/** Filing a removal request needs removal.request; it used to accept anyone, under any name. */
export async function POST(request: Request) {
  const auth = await requireAuth("removal.request");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { memberId, memberName, memberRank, reason, isPTDCase } = body;
    const requestedBy = actorLabel(auth.access);

    const removalRequest = await prisma.removalRequest.create({
      data: {
        memberId,
        memberName,
        memberRank,
        requestedBy,
        reason,
        isPTDCase: isPTDCase ?? false,
      },
    });

    return NextResponse.json(removalRequest, { status: 201 });
  } catch (error) {
    log.error("Error creating removal request", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
