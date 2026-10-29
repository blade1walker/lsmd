import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { FIVEM_PERMISSIONS } from "@/lib/constants";
import { probeServer } from "@/lib/fivem/server";

/**
 * "Test connection" on the City Link page. Runs against the values in the
 * form, saved or not, so an address can be checked before it goes live.
 * Answers with what each check found, never with what the server returned.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(FIVEM_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const address = typeof body.serverAddress === "string" ? body.serverAddress : null;
    const code = typeof body.joinCode === "string" ? body.joinCode : null;
    return NextResponse.json({ probes: await probeServer(address, code) });
  } catch (error) {
    return apiError("Failed to test the connection", error);
  }
}
