import { NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { CHANGELOG } from "@/lib/changelog";

/**
 * The changelog, served through a route so changelog.view is the real
 * boundary. The page that renders it is a static client shell; had it
 * imported the data directly, the full list would ship in the browser bundle
 * to anyone who loaded the JavaScript.
 */
export async function GET() {
  const auth = await requireAuth("changelog.view");
  if (isDenied(auth)) return auth.error;

  return NextResponse.json(CHANGELOG);
}
