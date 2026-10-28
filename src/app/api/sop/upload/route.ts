import { NextResponse } from "next/server";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { maxRequestBytes, storeUpload, type UploadRules } from "@/lib/media-server";

const RULES: UploadRules = { types: ["png", "jpg", "gif", "webp"] };

/**
 * Uploads an image for embedding in an SOP document (via Markdown
 * `![](url)`) and returns its URL. Gated by sop.edit — same permission as
 * editing the document the image is going into. Stored in the site's media
 * library, which will not delete an image a document still shows.
 */
export async function POST(req: Request) {
  const auth = await requireAuth("sop.edit");
  if (isDenied(auth)) return auth.error;

  try {
    if (Number(req.headers.get("content-length") ?? 0) > maxRequestBytes(RULES)) {
      return NextResponse.json({ error: "File too large", detail: "Limit is 5 MB." }, { status: 413 });
    }
    const form = await req.formData().catch(() => null);
    const stored = await storeUpload(form?.get("file"), actorLabel(auth.access), RULES);
    if ("error" in stored) return NextResponse.json({ error: stored.error }, { status: 400 });
    return NextResponse.json({ url: stored.url });
  } catch (error) {
    return apiError("Failed to upload image", error);
  }
}
