import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { MAX_UPLOAD_BYTES, mediaUrl, saveImage } from "@/lib/media-storage";

/** Uploads an image to the media library (multipart form, field "file"). */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.edit);
  if (isDenied(auth)) return auth.error;

  try {
    // Refused before reading the body when the browser says it is too big.
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES + 64 * 1024) {
      return NextResponse.json({ error: `Images can be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB` }, { status: 413 });
    }
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload" }, { status: 400 });

    const saved = await saveImage(new Uint8Array(await file.arrayBuffer()));
    if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: 400 });

    const actor = actorLabel(auth.access);
    const alt = typeof form?.get("alt") === "string" ? String(form?.get("alt")).trim().slice(0, 200) || null : null;
    const asset = await prisma.mediaAsset.upsert({
      where: { fileName: saved.fileName },
      create: {
        fileName: saved.fileName,
        originalName: file.name.slice(0, 200) || saved.fileName,
        mimeType: saved.mimeType,
        size: saved.size,
        alt,
        uploadedBy: actor,
      },
      update: {},
    });
    await logAudit({
      action: "create",
      entityType: "MediaAsset",
      entityId: asset.id,
      entityLabel: asset.originalName,
      details: { size: asset.size },
      performedBy: actor,
    });
    return NextResponse.json({ id: asset.id, url: mediaUrl(asset.fileName), originalName: asset.originalName }, { status: 201 });
  } catch (error) {
    return apiError("Failed to upload the image", error);
  }
}
