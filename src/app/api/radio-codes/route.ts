import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { cached } from "@/lib/data-cache";

export async function GET() {
  try {
    // Cached; an edit to the codes drops it (src/lib/data-cache.ts).
    const codes = await cached("radio-codes", 5 * 60_000, () =>
      prisma.radioCode.findMany({ orderBy: { order: "asc" } })
    );
    return NextResponse.json(codes);
  } catch (error) {
      return apiError("Database connection failed", error);
  }
}
