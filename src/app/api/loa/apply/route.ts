import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loa = await prisma.lOA.create({
      data: {
        memberId: body.memberId,
        reason: body.reason,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: "Pending",
        notes: body.notes,
        createdBy: body.createdBy || "self",
      },
    });

    return NextResponse.json(loa, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to apply for LOA", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
