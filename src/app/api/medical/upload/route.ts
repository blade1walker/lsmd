import { NextResponse } from "next/server";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { maxRequestBytes, storeUpload, type UploadRules } from "@/lib/media/server";

/**
 * A letterhead mark is a small image. SVG and GIF are deliberately absent:
 * jsPDF cannot draw them, so such a logo would upload cleanly, preview
 * correctly in the browser, and then be silently missing from every exported
 * document — the worst possible failure for a letterhead.
 */
const RULES: UploadRules = { types: ["png", "jpg", "webp"], maxBytes: 2 * 1024 * 1024 };

/**
 * Uploads the department logo shown on the medical letterhead and returns its
 * URL. Gated by medical.types.manage — the same permission as editing the
 * letterhead the image goes onto. Stored in the site's media library.
 */
export async function POST(req: Request) {
  const auth = await requireAuth("medical.types.manage");
  if (isDenied(auth)) return auth.error;

  try {
    if (Number(req.headers.get("content-length") ?? 0) > maxRequestBytes(RULES)) {
      return NextResponse.json({ error: "File too large", detail: "Limit is 2 MB." }, { status: 413 });
    }
    const form = await req.formData().catch(() => null);
    const stored = await storeUpload(form?.get("file"), actorLabel(auth.access), RULES);
    if ("error" in stored) return NextResponse.json({ error: stored.error }, { status: 400 });
    return NextResponse.json({ url: stored.url });
  } catch (error) {
    return apiError("Failed to upload image", error);
  }
}
