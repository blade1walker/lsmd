import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

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
    console.error("Error fetching removal requests:", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memberId, memberName, memberRank, requestedBy, reason, isPTDCase } = body;

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
    console.error("Error creating removal request:", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
