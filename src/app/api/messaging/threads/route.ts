import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { lookupDiscordUser } from "@/lib/discord-dm";
import { upsertThread } from "@/lib/dm-threads";

/**
 * Every conversation the bot has had, newest activity first.
 *
 * A thread appears the moment the bot writes to someone — automated DMs are
 * recorded the same way hand-written ones are — so this is the answer to
 * "what has the bot been sending, and to whom".
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const query = (req.nextUrl.searchParams.get("q") ?? "").trim();

    const threads = await prisma.dMThread.findMany({
      where: query
        ? {
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { memberName: { contains: query, mode: "insensitive" } },
              { discordId: { contains: query } },
            ],
          }
        : undefined,
      orderBy: { lastMessageAt: "desc" },
      take: 200,
      include: {
        messages: { orderBy: { sentAt: "desc" }, take: 1 },
      },
    });

    // One count query for the lot rather than one per thread.
    const unreadRows = await prisma.directMessage.groupBy({
      by: ["threadId"],
      where: { direction: "in" },
      _max: { sentAt: true },
    });
    const newestInbound = new Map(unreadRows.map((r) => [r.threadId, r._max.sentAt]));

    return NextResponse.json(
      threads.map((thread) => {
        const latestInbound = newestInbound.get(thread.id) ?? null;
        return {
          id: thread.id,
          discordId: thread.discordId,
          username: thread.username,
          memberId: thread.memberId,
          memberName: thread.memberName,
          lastMessageAt: thread.lastMessageAt,
          lastMessage: thread.messages[0]
            ? {
                direction: thread.messages[0].direction,
                content: thread.messages[0].content.slice(0, 160),
                sentAt: thread.messages[0].sentAt,
                ok: thread.messages[0].ok,
              }
            : null,
          hasUnread:
            latestInbound !== null &&
            (thread.lastReadAt === null || latestInbound > thread.lastReadAt),
        };
      })
    );
  } catch (error) {
    return apiError("Failed to load conversations", error);
  }
}

/** Opens a conversation with someone the bot has never written to yet. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const { discordId } = (await req.json()) as { discordId?: string };
    const id = String(discordId ?? "").trim();

    if (!/^\d{5,25}$/.test(id)) {
      return NextResponse.json({ error: "Enter a numeric Discord user ID" }, { status: 400 });
    }

    // Not fatal if the lookup fails — the thread is still usable, it just
    // shows the raw ID until a send or sync fills the name in.
    const user = await lookupDiscordUser(id);
    const thread = await upsertThread(id, {
      username: user?.globalName || user?.username || null,
    });

    return NextResponse.json(thread, { status: 201 });
  } catch (error) {
    return apiError("Failed to open conversation", error);
  }
}
