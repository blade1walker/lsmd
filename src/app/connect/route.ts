import { NextRequest, NextResponse } from "next/server";
import { readFiveMSettings } from "@/lib/fivem/server";
import { connectUrlFor, parseJoinCode } from "@/lib/fivem";

/**
 * /connect — a short link to join the city, for the footer, Discord and
 * anywhere else. Sends players to the cfx.re join link from the City Link
 * settings, so changing servers is one edit on the site rather than a hunt
 * for every place the old link was pasted. Falls back to the home page while
 * no join code is set.
 */
export async function GET(req: NextRequest) {
  const settings = await readFiveMSettings();
  const code = parseJoinCode(settings?.joinCode);
  const target = connectUrlFor(code && "code" in code ? code.code : null);
  return NextResponse.redirect(target ?? new URL("/", req.url), 307);
}
