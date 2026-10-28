import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { PREVIEW_COOKIE } from "@/lib/site-content-server";

/**
 * Turns preview on (?on=1) or off (?on=0) and opens the home page. In
 * preview the public pages show the drafts and unpublished notices — only to
 * this browser, and only while it belongs to someone who may edit content.
 */
export async function GET(req: NextRequest) {
  const on = req.nextUrl.searchParams.get("on") !== "0";
  const home = new URL("/", req.url);

  if (!on) {
    const res = NextResponse.redirect(home, 303);
    res.cookies.delete(PREVIEW_COOKIE);
    return res;
  }

  const auth = await requireAuth(CONTENT_PERMISSIONS.edit);
  if (isDenied(auth)) return auth.error;

  const res = NextResponse.redirect(home, 303);
  res.cookies.set(PREVIEW_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return res;
}
