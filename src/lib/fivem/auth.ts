import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Requests from the nexus-ems-sync FiveM resource.
 *
 * The resource proves itself with FIVEM_API_KEY, a shared secret set in the
 * site's environment and in the FiveM server's server.cfg
 * (`set nexus_ems_api_key "..."`). It is deliberately a different secret from
 * the Discord bot's: the resource only ever reports what happens in the city —
 * duty, unit status, calls — and gets no access to the rest of the API, so a
 * leaked server.cfg cannot be used to edit the roster.
 */

const HEADER = "x-fivem-key";

/** Below this the key is treated as unset — a short key is a guessable one. */
const MIN_KEY_LENGTH = 32;

function clean(value: string | undefined | null) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

export type FiveMKeyState = "ok" | "unset" | "short";

export function fiveMKeyState(): FiveMKeyState {
  const key = clean(process.env.FIVEM_API_KEY);
  if (!key) return "unset";
  if (key.length < MIN_KEY_LENGTH) return "short";
  return "ok";
}

/**
 * Null when the request carries the right key; otherwise the response to send
 * back, naming what is wrong so the resource can print it in the server
 * console.
 */
export function rejectUnlessFiveM(req: Request): NextResponse | null {
  const expected = clean(process.env.FIVEM_API_KEY);
  const state = fiveMKeyState();
  if (state === "unset") {
    return NextResponse.json(
      { error: "The City Link is switched off", detail: "FIVEM_API_KEY is not set on the website." },
      { status: 503 }
    );
  }
  if (state === "short") {
    return NextResponse.json(
      { error: "The City Link is switched off", detail: "FIVEM_API_KEY on the website is shorter than 32 characters, so it is ignored." },
      { status: 503 }
    );
  }

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const given = clean(req.headers.get(HEADER) ?? bearer);
  if (!given) {
    return NextResponse.json({ error: "Unauthorized", detail: "No FiveM key was sent." }, { status: 401 });
  }

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { error: "Unauthorized", detail: "nexus_ems_api_key in server.cfg does not match FIVEM_API_KEY on the website." },
      { status: 401 }
    );
  }
  return null;
}
