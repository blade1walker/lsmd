import { NextResponse } from "next/server";
import { put, BlobError } from "@vercel/blob";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

/** Well under Vercel's 4.5MB request ceiling — a letterhead mark is a small image. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * SVG is deliberately absent: jsPDF cannot draw one, so an SVG logo would
 * upload cleanly, preview correctly in the browser, and then be silently
 * missing from every exported document — the worst possible failure for a
 * letterhead.
 */
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Uploads the department logo shown on the medical letterhead and returns its
 * public URL. Gated by medical.types.manage — the same permission as editing
 * the letterhead the image goes onto.
 *
 * Requires a Vercel Blob store (Storage -> Create Database -> Blob), which
 * provisions BLOB_READ_WRITE_TOKEN. Without it this 503s with an explanation
 * rather than failing silently at the picker.
 */
export async function POST(req: Request) {
  const auth = await requireAuth("medical.types.manage");
  if (isDenied(auth)) return auth.error;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error: "Image uploads are not configured",
        detail:
          "Enable Vercel Blob storage for this project (Storage -> Create Database -> Blob in the Vercel dashboard), which provisions BLOB_READ_WRITE_TOKEN automatically. You can paste an image URL instead in the meantime.",
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
        {
          error: "Unsupported file type",
          detail: "Use PNG, JPEG or WebP. SVG cannot be drawn into a PDF, so it is not accepted here.",
        },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large", detail: `Limit is ${(MAX_BYTES / 1024 / 1024).toFixed(0)}MB.` },
        { status: 400 }
      );
    }

    const blob = await put(`medical/${file.name}`, file, {
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
