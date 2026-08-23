import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const requests = await prisma.recruitRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch recruits", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (Array.isArray(body)) {
      const created = await prisma.recruitRequest.createMany({
        data: body.map((r: any) => ({
          discordId: r.discordId,
          discordUsername: r.discordUsername || null,
          steamId: r.steamId,
          characterName: r.characterName || null,
          user: r.user || null,
        })),
        skipDuplicates: true,
      });
      return NextResponse.json({ count: created.count }, { status: 201 });
    }

    const request = await prisma.recruitRequest.create({
      data: {
        discordId: body.discordId,
        discordUsername: body.discordUsername || null,
        steamId: body.steamId,
        characterName: body.characterName || null,
        user: body.user || null,
      },
    });
    return NextResponse.json(request, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create recruit", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
