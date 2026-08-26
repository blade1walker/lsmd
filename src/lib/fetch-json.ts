export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const { error, detail, hint } = body as {
      error?: unknown;
      detail?: unknown;
      hint?: unknown;
    };
    if (typeof error === "string") {
      // `hint` is the actionable half (e.g. "run npm run db:push"), so keep it
      // even when it makes the message long — it is what the reader acts on.
      return [error, detail, hint].filter((p) => typeof p === "string").join(" — ");
    }
  }
  return `Request failed with status ${status}`;
}

/**
 * fetch + JSON parse that throws on a non-2xx response instead of handing back
 * the API's `{ error, detail }` body. Without this the caller stores an error
 * object in state that is typed as an array/record, and the next `.map()` or
 * property read throws during render and blanks the page.
 */
export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Empty or non-JSON body; handled by the status check below.
  }

  if (!res.ok) {
    throw new ApiError(messageFrom(body, res.status), res.status);
  }

  return body as T;
}

/** As `fetchJson`, but also rejects a 200 response whose body is not an array. */
export async function fetchList<T>(input: string, init?: RequestInit): Promise<T[]> {
  const body = await fetchJson<unknown>(input, init);
  if (!Array.isArray(body)) {
    throw new ApiError("Expected a list from the server", 500);
  }
  return body as T[];
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
