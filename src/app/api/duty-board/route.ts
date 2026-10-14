import { NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { DUTY_BOARD_PERMISSIONS } from "@/lib/constants";
import { getDutyBoard } from "@/lib/duty-board-server";

/** Everyone on duty, where they are, and whether they are in the city. */
export async function GET() {
  const auth = await requireAuth(DUTY_BOARD_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    return NextResponse.json(await getDutyBoard(auth.access), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError("Failed to load the Duty Board", error);
  }
}
