import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { syncThread } from "@/lib/discord-dm";

/**
 * How many conversations one refresh touches. Each is a Discord round trip, so
 * this is bounded to keep the request inside a serverless timeout; the most
 * recently active threads are the ones a reply is likely to land in.
 */
const BATCH = 20;

/**
 * Pulls new replies for the recently active conversations at once.
 *
 * Without this, a reply only surfaces when someone happens to open that one
 * thread — the unread markers in the list would never light up on their own.
 * A serverless deployment cannot hold the gateway connection that would push
 * them, so refreshing on demand is the honest version of "check for replies".
 */
export async function POST() {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const threads = await prisma.dMThread.findMany({
      orderBy: { lastMessageAt: "desc" },
      take: BATCH,
      select: { discordId: true },
    });

    let added = 0;
    let failed = 0;

    // Sequential on purpose: Discord rate-limits per route, and twenty parallel
    // reads would spend the whole budget on 429s.
    for (const thread of threads) {
      const result = await syncThread(thread.discordId);
      if (result.ok) added += result.added;
      else failed++;
    }

    return NextResponse.json({ checked: threads.length, added, failed });
  } catch (error) {
    return apiError("Failed to refresh conversations", error);
  }
}
