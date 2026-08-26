import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const codes = await prisma.radioCode.findMany({
      orderBy: { order: "asc" },
    });
    return NextResponse.json(codes);
  } catch (error) {
      return apiError("Database connection failed", error);
  }
}
