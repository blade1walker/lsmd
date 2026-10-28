import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { maxRequestBytes, storeUpload } from "@/lib/media-server";

/** Uploads an image to the media library (multipart form, field "file"). */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.edit);
  if (isDenied(auth)) return auth.error;

  try {
    // Refused before reading the body when the browser says it is too big.
    if (Number(req.headers.get("content-length") ?? 0) > maxRequestBytes()) {
      return NextResponse.json({ error: "Images can be at most 5 MB" }, { status: 413 });
    }
    const form = await req.formData().catch(() => null);
    const stored = await storeUpload(form?.get("file"), actorLabel(auth.access));
    if ("error" in stored) return NextResponse.json({ error: stored.error }, { status: 400 });
    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    return apiError("Failed to upload the image", error);
  }
}
