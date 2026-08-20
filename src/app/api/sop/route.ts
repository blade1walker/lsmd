import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sop = await prisma.sopContent.findFirst();
    return NextResponse.json(sop ?? { content: "" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Database connection failed", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
