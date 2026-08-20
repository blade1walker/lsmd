import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const requests = await prisma.onboardingRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch onboarding requests", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = await prisma.onboardingRequest.create({
      data: {
        name: body.name,
        discordId: body.discordId,
        stateId: body.stateId || null,
        steamId: body.steamId || null,
        reason: body.reason || null,
      },
    });
    return NextResponse.json(request, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to submit onboarding request", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
