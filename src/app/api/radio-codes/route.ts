import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const codes = await prisma.radioCode.findMany({
      orderBy: { order: "asc" },
    });
    return NextResponse.json(codes);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Database connection failed", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
