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
/**
 * The database host refusing every query because the plan's monthly limit
 * (compute time, data transfer, operations) is used up — Neon and Prisma
 * Postgres both answer with SQLSTATE 53000 and this wording.
 */
const QUOTA_HINT =
  "The database host's plan limit is used up, so it refuses every request. Upgrade the database plan or wait for its monthly reset — nothing on the site or the bot can load or save until then.";

export function apiError(message: string, error: unknown, status = 500) {
  const { code, detail } = describe(error);
  const hint = detail && /exceeded the .*quota|Code: `53000`/i.test(detail) ? QUOTA_HINT : code ? HINTS[code] : undefined;
  console.error(`${message}${code ? ` [${code}]` : ""}:`, error);

  return NextResponse.json(
    {
      error: message,
      ...(code ? { code } : {}),
      ...(detail ? { detail } : {}),
      ...(hint ? { hint } : {}),
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
