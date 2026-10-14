import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isDenied, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { ACTIVITY_PERMISSIONS } from "@/lib/constants";
import { parseActivityPeriod } from "@/lib/activity";
import { getActivity } from "@/lib/activity-server";

/** Every member's duty hours, city time and calls over 7, 14 or 30 days. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(ACTIVITY_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const period = parseActivityPeriod(req.nextUrl.searchParams.get("days"));
    const canManage = ACTIVITY_PERMISSIONS.manage.some((p) => hasPermission(auth.access, p));
    return NextResponse.json(await getActivity(period, canManage));
  } catch (error) {
    return apiError("Failed to load activity", error);
  }
}
