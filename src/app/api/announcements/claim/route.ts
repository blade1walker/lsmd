import { NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { ANNOUNCEMENT_PERMISSIONS } from "@/lib/constants";
import { claimDueAnnouncements, nextDueAt } from "@/lib/discord/announcements";

/**
 * The bot's delivery loop: hands over every due post, each to one caller
 * only. X-Next-Due says when to ask again (absent: nothing is pending), so the
 * bot can wait for it rather than poll.
 */
export async function POST() {
  const auth = await requireAuth(ANNOUNCEMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const due = await claimDueAnnouncements();
    const next = await nextDueAt();
    // X-Nexus-Schedule tells the bot this site sends X-Next-Due at all.
    return NextResponse.json(due, {
      headers: { "X-Nexus-Schedule": "1", ...(next ? { "X-Next-Due": next.toISOString() } : {}) },
    });
  } catch (error) {
    return apiError("Failed to claim announcements", error);
  }
}
