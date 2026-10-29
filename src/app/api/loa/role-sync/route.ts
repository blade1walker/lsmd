import { NextResponse } from "next/server";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { LOA_PERMISSIONS } from "@/lib/constants";
import { syncAllLoaRoles } from "@/lib/loa/role";

// One Discord call per member who needs a change, paced by Discord's rate
// limits — a large roster's first sync can take a while.
export const maxDuration = 60;

/**
 * Brings the EMS LOA role in line with the roster: gives it to everyone on
 * leave (including everyone who already was before the role existed) and
 * takes it from anyone who is back.
 */
export async function POST() {
  const auth = await requireAuth(LOA_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    return NextResponse.json(await syncAllLoaRoles(actorLabel(auth.access)));
  } catch (error) {
    return apiError("Failed to sync the EMS LOA role", error);
  }
}
