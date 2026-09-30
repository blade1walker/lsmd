import { config } from "./config.js";

/** Who a request acts for. The website credits this person in its audit log. */
export interface Actor {
  id: string;
  name: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;

/**
 * Calls the website's API as the bot, on behalf of `actor`. Throws ApiError
 * with the site's own error text, so a command can show the user exactly why
 * something was refused.
 */
export async function api<T = unknown>(
  actor: Actor,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.websiteUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-nexus-bot-key": config.apiKey,
        "x-nexus-actor-id": actor.id,
        "x-nexus-actor-name": encodeURIComponent(actor.name.slice(0, 80)),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "could not be reached";
    throw new ApiError(`The website ${reason}. Check WEBSITE_URL and that the site is up.`, 0);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const payload = (data ?? {}) as { error?: string; detail?: string; hint?: string };
    let message = payload.error || `The website answered ${res.status}.`;
    if (payload.detail) message += ` — ${payload.detail}`;
    if (payload.hint) message += ` (${payload.hint})`;
    if (res.status === 401) {
      message =
        "The website did not accept the bot's key. Set NEXUS_BOT_API_KEY to the same value on the website and the bot, then redeploy the website.";
    }
    throw new ApiError(message, res.status);
  }

  return data as T;
}
