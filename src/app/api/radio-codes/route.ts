import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getRadioCodes } from "@/lib/radio-codes/server";

export async function GET() {
  try {
    const codes = await getRadioCodes();
    return NextResponse.json(codes);
  } catch (error) {
      return apiError("Database connection failed", error);
  }
}
