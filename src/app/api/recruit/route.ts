import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const auth = await requireAuth("onboarding.view");
  if (isDenied(auth)) return auth.error;

  try {
    const requests = await prisma.recruitRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  } catch (error) {
      return apiError("Failed to fetch recruits", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (Array.isArray(body)) {
      let created = 0;
      let updated = 0;

      for (const r of body) {
        if (!r.discordId) continue;

        const existing = await prisma.recruitRequest.findFirst({
          where: { discordId: r.discordId },
        });

        if (existing) {
          await prisma.recruitRequest.update({
            where: { id: existing.id },
            data: {
              discordUsername: r.discordUsername || existing.discordUsername,
              steamId: r.steamId,
              characterName: r.characterName || existing.characterName,
              user: r.user || existing.user,
              rank: r.rank || existing.rank,
            },
          });
          updated++;
        } else {
          await prisma.recruitRequest.create({
            data: {
              discordId: r.discordId,
              discordUsername: r.discordUsername || null,
              steamId: r.steamId,
              characterName: r.characterName || null,
              user: r.user || null,
              rank: r.rank || null,
            },
          });
          created++;
        }
      }

      return NextResponse.json({ count: created, updated }, { status: 201 });
    }

    const existing = await prisma.recruitRequest.findFirst({
      where: { discordId: body.discordId },
    });

    if (existing) {
      const request = await prisma.recruitRequest.update({
        where: { id: existing.id },
        data: {
          discordUsername: body.discordUsername || existing.discordUsername,
          steamId: body.steamId,
          characterName: body.characterName || existing.characterName,
          user: body.user || existing.user,
          rank: body.rank || existing.rank,
        },
      });
      return NextResponse.json(request, { status: 200 });
    }

    const request = await prisma.recruitRequest.create({
      data: {
        discordId: body.discordId,
        discordUsername: body.discordUsername || null,
        steamId: body.steamId,
        characterName: body.characterName || null,
        user: body.user || null,
        rank: body.rank || null,
      },
    });
    return NextResponse.json(request, { status: 201 });
  } catch (error) {
      return apiError("Failed to create recruit", error);
  }
}
