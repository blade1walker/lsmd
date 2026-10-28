import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { saveDrafts } from "@/lib/site-content-server";

/** Saves edits as drafts. Nothing changes on the public site until they are published. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.edit);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json().catch(() => null)) as { values?: unknown } | null;
    if (!body?.values || typeof body.values !== "object" || Array.isArray(body.values)) {
      return NextResponse.json({ error: "Send the values to save" }, { status: 400 });
    }
    const actor = actorLabel(auth.access);
    const result = await saveDrafts(body.values as Record<string, unknown>, actor);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    await logAudit({
      action: "update",
      entityType: "SiteContent",
      entityId: "drafts",
      entityLabel: "Website content (draft)",
      details: { keys: result.saved.join(", ") },
      performedBy: actor,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError("Failed to save the changes", error);
  }
}
