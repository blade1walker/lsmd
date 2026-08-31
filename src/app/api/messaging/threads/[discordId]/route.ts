import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { sendDiscordDM, describeResult } from "@/lib/discord-webhook";
import { syncThread } from "@/lib/discord-dm";
import { markThreadRead, upsertThread, DM_MAX_LENGTH } from "@/lib/dm-threads";

async function loadThread(discordId: string) {
  return prisma.dMThread.findUnique({
    where: { discordId },
    include: { messages: { orderBy: { sentAt: "asc" }, take: 300 } },
  });
}

/**
 * One conversation, oldest message first.
 *
 * `?sync=1` pulls fresh history from Discord before answering — that is how a
 * reply the person sent reaches the panel. A sync failure is reported in the
 * payload rather than as an error status: the stored transcript is still worth
 * showing when Discord is unreachable or the bot token is missing.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ discordId: string }> }) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const { discordId } = await params;
    let syncError: string | null = null;

    if (req.nextUrl.searchParams.get("sync") === "1") {
      const result = await syncThread(discordId);
      if (!result.ok) syncError = result.error;
    }

    const thread = await loadThread(discordId);
    if (!thread) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    await markThreadRead(discordId);

    return NextResponse.json({
      discordId: thread.discordId,
      username: thread.username,
      memberId: thread.memberId,
      memberName: thread.memberName,
      channelId: thread.channelId,
      lastMessageAt: thread.lastMessageAt,
      messages: thread.messages,
      syncError,
    });
  } catch (error) {
    return apiError("Failed to load conversation", error);
  }
}

/** Sends a DM as the bot and appends it to the transcript. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ discordId: string }> }) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const { discordId } = await params;
    const { content } = (await req.json()) as { content?: string };
    const message = String(content ?? "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }
    if (message.length > DM_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Discord rejects anything over ${DM_MAX_LENGTH} characters` },
        { status: 400 }
      );
    }

    const sentBy = actorLabel(auth.access);
    await upsertThread(discordId);

    // sendDiscordDM records the message into the thread itself, whether or not
    // Discord accepted it — a failed send stays visible in the transcript.
    const result = await sendDiscordDM(discordId, message, "manual.dm", sentBy);

    await logAudit({
      action: "create",
      entityType: "DirectMessage",
      entityId: discordId,
      entityLabel: `DM to ${discordId}`,
      details: { ok: result.ok, preview: message.slice(0, 120) },
      performedBy: sentBy,
    });

    const thread = await loadThread(discordId);

    return NextResponse.json(
      {
        ok: result.ok,
        detail: describeResult(result),
        messages: thread?.messages ?? [],
      },
      { status: result.ok ? 200 : 502 }
    );
  } catch (error) {
    return apiError("Failed to send message", error);
  }
}
