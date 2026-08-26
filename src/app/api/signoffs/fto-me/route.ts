import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const auth = await requireAuth("training.view");
  if (isDenied(auth)) return auth.error;

  try {
    const members = await prisma.member.findMany({
      where: { ftoRole: { not: null } },
    });
    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching FTO members:", error);
    return apiError("Failed to fetch FTO members", error);
  }
}
