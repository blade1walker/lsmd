import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { DISCORD_ID_HELP, parseDiscordId } from "@/lib/discord/id";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const discordId = parseDiscordId(body.discordId);
    if (!discordId) return NextResponse.json({ error: `That is not a valid Discord ID. ${DISCORD_ID_HELP}` }, { status: 400 });

    const request = await prisma.onboardingRequest.create({
      data: {
        name: body.name,
        discordId,
        stateId: body.stateId || null,
        steamId: body.steamId || null,
        reason: body.reason || null,
      },
    });
    return NextResponse.json(request, { status: 201 });
  } catch (error) {
      return apiError("Failed to submit onboarding request", error);
  }
}
