import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { publishDrafts } from "@/lib/site-content-server";

/** Puts drafts live — all of them, or the keys named. Live on the next page load. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.publish);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json().catch(() => ({}))) as { keys?: unknown };
    const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string") : undefined;
    const actor = actorLabel(auth.access);
    const published = await publishDrafts(actor, keys);
    if (published.length) {
      await logAudit({
        action: "publish",
        entityType: "SiteContent",
        entityId: "published",
        entityLabel: "Website content",
        details: { keys: published.join(", ") },
        performedBy: actor,
      });
    }
    return NextResponse.json({ published });
  } catch (error) {
    return apiError("Failed to publish", error);
  }
}
