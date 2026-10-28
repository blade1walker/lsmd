import { NextResponse } from "next/server";
import { requireAuth, isDenied, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { LOA_PERMISSIONS } from "@/lib/constants";
import { getLoaBoard } from "@/lib/loa-board";

/** The LOA section: who is on leave and since when, what is coming, and the Discord role. */
export async function GET() {
  const auth = await requireAuth(LOA_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const canManage = LOA_PERMISSIONS.manage.some((p) => hasPermission(auth.access, p));
    return NextResponse.json(await getLoaBoard(canManage));
  } catch (error) {
    return apiError("Failed to load the LOA section", error);
  }
}
