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
  if (config.websiteProblem) throw new ApiError(`The bot is not connected to the website yet. ${config.websiteProblem}`, 0);

  let res: Response;
  try {
    res = await fetch(`${config.websiteUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        // Identifies the bot: the website checks with Discord that this token
        // belongs to its own application. The key is an optional alternative.
        "x-nexus-bot-token": config.token,
        ...(config.apiKey ? { "x-nexus-bot-key": config.apiKey } : {}),
        "x-nexus-actor-id": actor.id,
        "x-nexus-actor-name": encodeURIComponent(actor.name.slice(0, 80)),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Never follow a redirect: fetch would forward the bot's token to
      // wherever it points (Vercel's login page, another domain).
      redirect: "manual",
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "could not be reached";
    throw new ApiError(`The website ${reason}. Check WEBSITE_URL and that the site is up.`, 0);
  }

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location") ?? "";
    let target = location;
    try {
      target = new URL(location, config.websiteUrl).origin;
    } catch {
      // keep the raw value
    }
    if (/vercel\.com\/(sso|login)/.test(location)) {
      throw new ApiError(
        `WEBSITE_URL (${config.websiteUrl}) is a protected Vercel deployment address that asks for a Vercel login. Set WEBSITE_URL to the site's public address — the one visitors open.`,
        res.status
      );
    }
    throw new ApiError(`WEBSITE_URL (${config.websiteUrl}) redirects to ${target}. Set WEBSITE_URL=${target} and restart the bot.`, res.status);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const payload = (data ?? {}) as { error?: string; detail?: string; hint?: string; bot?: boolean };
    let message = payload.error || `The website answered ${res.status}.`;
    if (payload.detail) message += ` — ${payload.detail}`;
    if (payload.hint) message += ` (${payload.hint})`;
    if (res.status === 401 && payload.bot && payload.detail) {
      message = `The website did not accept the bot: ${payload.detail}`;
    } else if (res.status === 401) {
      // An older website that does not know the bot's token check yet.
      message =
        "The website did not accept the bot. Redeploy the website with the latest code (it checks the bot's token itself), or set NEXUS_BOT_API_KEY to the same value on the website and the bot.";
    } else if (res.status === 404 && data === null) {
      message = `Nothing answered at ${config.websiteUrl}${path.split("?")[0]} — check WEBSITE_URL, and that the website has been redeployed with the bot's API.`;
    } else if (data === null && /<html/i.test(text)) {
      // Vercel Deployment Protection (or a login wall) answers with an HTML page.
      message = `The website answered ${res.status} with a web page instead of the API — if Vercel Deployment Protection is on, use the production domain in WEBSITE_URL.`;
    }
    throw new ApiError(message, res.status);
  }

  return data as T;
}
