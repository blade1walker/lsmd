import { NextResponse } from "next/server";

/** Prisma error codes worth translating into something actionable. */
const HINTS: Record<string, string> = {
  P2021: "That table does not exist in the database. Run `npm run db:push` to apply the current schema.",
  P2022: "That column does not exist in the database. Run `npm run db:push` to apply the current schema.",
  P1001: "Could not reach the database. Check DATABASE_URL and that the server is accepting connections.",
  P1003: "The database named in DATABASE_URL does not exist.",
};

/**
 * Builds the JSON error body for a failed route.
 *
 * Routes that returned a bare `{ error }` made failures undiagnosable from the
 * UI: a missing table and a bad connection string both surfaced as "Failed to
 * fetch X". Including the Prisma code and message means the page can say which
 * one it is.
 */
export function apiError(message: string, error: unknown, status = 500) {
  const { code, detail } = describe(error);
  console.error(`${message}${code ? ` [${code}]` : ""}:`, error);

  return NextResponse.json(
    {
      error: message,
      ...(code ? { code } : {}),
      ...(detail ? { detail } : {}),
      ...(code && HINTS[code] ? { hint: HINTS[code] } : {}),
    },
    { status }
  );
}

function describe(error: unknown): { code?: string; detail?: string } {
  if (typeof error !== "object" || error === null) {
    return { detail: String(error).slice(0, 200) };
  }

  const { code, message } = error as { code?: unknown; message?: unknown };
  return {
    code: typeof code === "string" ? code : undefined,
    // Prisma messages are multi-line with ANSI-ish padding; collapse to one line.
    detail:
      typeof message === "string"
        ? message.replace(/\s+/g, " ").trim().slice(0, 300)
        : undefined,
  };
}
