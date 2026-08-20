import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ftoMemberId, signOffDefinitionId, completedBy, notes } = body;

    const record = await prisma.fTOSignOffRecord.create({
      data: {
        ftoMemberId,
        signOffDefinitionId,
        completedBy,
        notes,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Error completing signoff:", error);
    return NextResponse.json({ error: "Failed to complete signoff" }, { status: 500 });
  }
}
