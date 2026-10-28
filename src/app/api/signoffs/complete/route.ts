import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { log } from "@/lib/log";

export async function POST(request: Request) {
  const auth = await requireAuth("training.signoff.manage");
  if (isDenied(auth)) return auth.error;

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
    log.error("Error completing signoff", error);
    return NextResponse.json({ error: "Failed to complete signoff" }, { status: 500 });
  }
}
