import { NextResponse } from "next/server";
import { put, BlobError } from "@vercel/blob";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

const MAX_BYTES = 4.5 * 1024 * 1024; // Vercel's serverless request body ceiling.
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/**
 * Uploads an image for embedding in an SOP document (via Markdown
 * `![](url)`) and returns its public URL. Gated by sop.edit — same
 * permission as editing the document the image is going into.
 *
 * Requires a Vercel Blob store: enable one in the Vercel dashboard
 * (Storage -> Create Database -> Blob), which provisions
 * BLOB_READ_WRITE_TOKEN automatically. Without it this 503s with an
 * explanation rather than the editor silently failing to attach the image.
 */
export async function POST(req: Request) {
  const auth = await requireAuth("sop.edit");
  if (isDenied(auth)) return auth.error;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error: "Image uploads are not configured",
        detail:
          "Enable Vercel Blob storage for this project (Storage -> Create Database -> Blob in the Vercel dashboard), which provisions BLOB_READ_WRITE_TOKEN automatically.",
      },
      { status: 503 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type", detail: "Use PNG, JPEG, GIF, or WebP." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large", detail: `Limit is ${(MAX_BYTES / 1024 / 1024).toFixed(1)}MB.` },
        { status: 400 }
      );
    }

    const blob = await put(`sop/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    if (error instanceof BlobError) {
      return NextResponse.json({ error: "Upload failed", detail: error.message }, { status: 502 });
    }
    return apiError("Failed to upload image", error);
  }
}
