import { NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { ANNOUNCEMENT_PERMISSIONS } from "@/lib/constants";
import { claimDueAnnouncements } from "@/lib/announcements";

/** The bot's delivery loop: hands over every due post, each to one caller only. */
export async function POST() {
  const auth = await requireAuth(ANNOUNCEMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    return NextResponse.json(await claimDueAnnouncements());
  } catch (error) {
    return apiError("Failed to claim announcements", error);
  }
}
