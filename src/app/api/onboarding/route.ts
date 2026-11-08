import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { DISCORD_ID_HELP, parseDiscordId } from "@/lib/discord/id";
import { clientIp, rateLimiter } from "@/lib/rate-limit";

export async function GET() {
  const auth = await requireAuth("onboarding.view");
  if (isDenied(auth)) return auth.error;

  try {
    const requests = await prisma.onboardingRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  } catch (error) {
      return apiError("Failed to fetch onboarding requests", error);
  }
}

// Public form: anyone can post, so it is limited per IP and per Discord ID.
const perIp = rateLimiter(5, 60 * 60_000);
const perDiscordId = rateLimiter(3, 24 * 60 * 60_000);

/** A trimmed string of at most `max` characters; null when empty; undefined when not a string or too long. */
function text(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > max) return undefined;
  return trimmed || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Send the form as JSON" }, { status: 400 });

    const discordId = parseDiscordId(body.discordId);
    if (!discordId) return NextResponse.json({ error: `That is not a valid Discord ID. ${DISCORD_ID_HELP}` }, { status: 400 });

    const name = text(body.name, 80);
    const stateId = text(body.stateId, 20);
    const steamId = text(body.steamId, 64);
    const reason = text(body.reason, 1000);
    if (!name || stateId === undefined || steamId === undefined || reason === undefined) {
      return NextResponse.json(
        { error: "Check the form: a name of up to 80 characters is required, State ID up to 20, Steam ID up to 64, reason up to 1000." },
        { status: 400 }
      );
    }

    if (!perIp(clientIp(req)) || !perDiscordId(discordId)) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const request = await prisma.onboardingRequest.create({
      data: { name, discordId, stateId, steamId, reason },
    });
    return NextResponse.json(request, { status: 201 });
  } catch (error) {
      return apiError("Failed to submit onboarding request", error);
  }
}
