import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { resolveAccess, hasPermission, type Access } from "./access";

export type AuthResult = { access: Access } | { error: NextResponse };

export function isDenied(result: AuthResult): result is { error: NextResponse } {
  return "error" in result;
}

/**
 * The authorization check for route handlers. Enforced here rather than in the
 * UI or in proxy.ts because this is the closest point to the data — the admin
 * pages are static shells that fetch everything through these endpoints, so a
 * check that only guards the UI guards nothing.
 *
 * Re-resolves access from the database rather than trusting the JWT claims, so
 * a revoked role or a roster removal takes effect on the next request.
 */
export async function requireAuth(permission?: string | readonly string[]): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.discordId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const access = await resolveAccess(session.user.discordId);

  if (!access.allowed) {
    return {
      error: NextResponse.json(
        { error: "Forbidden", detail: "This account is not on the roster." },
        { status: 403 }
      ),
    };
  }

  const required = permission === undefined ? [] : typeof permission === "string" ? [permission] : permission;

  // A list is any-of, not all-of: it is how a route accepts either its own
  // dedicated permission or the older, broader one it used to be guarded by.
  if (required.length > 0 && !required.some((p) => hasPermission(access, p))) {
    return {
      error: NextResponse.json(
        {
          error: "Forbidden",
          detail:
            required.length === 1
              ? `Requires the "${required[0]}" permission.`
              : `Requires one of these permissions: ${required.map((p) => `"${p}"`).join(", ")}.`,
        },
        { status: 403 }
      ),
    };
  }

  return { access };
}

export { hasPermission };

/** Human-readable actor for audit entries — the roster name/callsign, falling back to the raw Discord ID for a super admin with no roster entry. */
export function actorLabel(access: Access): string {
  return access.memberName ?? access.discordId;
}
