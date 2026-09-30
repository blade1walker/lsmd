import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { BOT_PERMISSION_PERMISSIONS } from "@/lib/constants";
import { commandLabel, isGrantableCommand } from "@/lib/bot-commands";

const SNOWFLAKE = /^\d{15,22}$/;

/** Every grant, or one server's with ?guildId=. The bot reads this on a timer. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(BOT_PERMISSION_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const guildId = req.nextUrl.searchParams.get("guildId");
    const grants = await prisma.botCommandGrant.findMany({
      where: guildId && SNOWFLAKE.test(guildId) ? { guildId } : undefined,
      orderBy: [{ command: "asc" }, { targetName: "asc" }],
    });
    return NextResponse.json(grants);
  } catch (error) {
    return apiError("Failed to fetch bot permissions", error);
  }
}

/** Grants one command (or "*") to a role or user. Granting twice is a no-op. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(BOT_PERMISSION_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const guildId = String(body.guildId ?? "");
    const targetType = String(body.targetType ?? "");
    const targetId = String(body.targetId ?? "").trim();
    const targetName = String(body.targetName ?? "").trim().slice(0, 100) || targetId;
    const command = String(body.command ?? "");

    if (!SNOWFLAKE.test(guildId)) return NextResponse.json({ error: "A valid Discord server ID is required." }, { status: 400 });
    if (targetType !== "role" && targetType !== "user") {
      return NextResponse.json({ error: "Grant to a role or a user." }, { status: 400 });
    }
    if (!SNOWFLAKE.test(targetId)) return NextResponse.json({ error: "That is not a Discord role or user ID." }, { status: 400 });
    if (!isGrantableCommand(command)) return NextResponse.json({ error: "Unknown bot command." }, { status: 400 });

    const grant = await prisma.botCommandGrant.upsert({
      where: { guildId_targetType_targetId_command: { guildId, targetType, targetId, command } },
      create: {
        guildId,
        targetType,
        targetId,
        targetName,
        command,
        grantedByDiscordId: auth.access.discordId,
        grantedByName: actorLabel(auth.access),
      },
      // Keep the name current — roles get renamed.
      update: { targetName },
    });

    await logAudit({
      action: "create",
      entityType: "BotCommandGrant",
      entityId: grant.id,
      entityLabel: `${commandLabel(command)} → ${targetType} ${targetName}`,
      details: { guildId, targetType, targetId, command },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(grant, { status: 201 });
  } catch (error) {
    return apiError("Failed to grant bot permission", error);
  }
}
