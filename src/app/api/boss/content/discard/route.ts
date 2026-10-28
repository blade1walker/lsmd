import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { discardDrafts } from "@/lib/site-content-server";

/** Throws drafts away — all of them, or the keys named — back to what is live. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.edit);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json().catch(() => ({}))) as { keys?: unknown };
    const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string") : undefined;
    const discarded = await discardDrafts(keys);
    if (discarded.length) {
      await logAudit({
        action: "update",
        entityType: "SiteContent",
        entityId: "drafts",
        entityLabel: "Website content (draft discarded)",
        details: { keys: discarded.join(", ") },
        performedBy: actorLabel(auth.access),
      });
    }
    return NextResponse.json({ discarded });
  } catch (error) {
    return apiError("Failed to discard the changes", error);
  }
}
