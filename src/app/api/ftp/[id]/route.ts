import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { sendDiscordDM, postToFtpWebhook, getNotificationSettings } from "@/lib/discord-webhook";
import { addFtpDiscordRole } from "@/lib/discord-roles";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("onboarding.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, reviewNote } = body;
    const performedBy = actorLabel(auth.access);

    // Atomically claims the transition: only the request that actually moves
    // status away from its current value grants the Discord role and posts
    // below — a double-click or a race shouldn't grant/post twice.
    let wonTransition = true;
    if (status !== undefined) {
      const claim = await prisma.fTPRequest.updateMany({
        where: { id, status: { not: status } },
        data: { status, reviewedBy: performedBy, reviewNote },
      });
      wonTransition = claim.count === 1;
    } else {
      await prisma.fTPRequest.update({ where: { id }, data: { reviewedBy: performedBy, reviewNote } });
    }

    const request = await prisma.fTPRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const settings = await getNotificationSettings();

    if (wonTransition && status === "Approved") {
      const member = await prisma.member.findFirst({
        where: { discordId: request.discordId },
      });

      if (member) {
        await prisma.member.update({
          where: { id: member.id },
          data: { category: "FTP" },
        });

        // Grants the Discord server role — a no-op until DISCORD_GUILD_ID and
        // DISCORD_FTP_ROLE_ID are configured. Not fatal if it fails: the
        // roster is the source of truth, Discord is kept in sync with it.
        await addFtpDiscordRole(request.discordId);
      }

      const inviteLink = settings.botSettings?.stateInvite || process.env.DISCORD_STATE_INVITE || "https://discord.gg/YOUR_INVITE";

      if (settings.ftpDM) {
        const msg = settings.ftpDMApprove
          .replace(/{name}/g, request.characterName)
          .replace(/{inviteLink}/g, inviteLink);
        await sendDiscordDM(request.discordId, msg, "ftp.approved");
      }

      if (settings.ftpWebhook) {
        const msg = settings.ftpWebhookApprove
          .replace(/{name}/g, request.characterName)
          .replace(/{callSign}/g, member?.callSign ?? "N/A");
        await postToFtpWebhook(msg, "ftp.enrolled");
      }
    } else if (wonTransition && status === "Declined") {
      if (settings.ftpDM) {
        const msg = settings.ftpDMDecline.replace(/{name}/g, request.characterName);
        await sendDiscordDM(request.discordId, msg, "ftp.declined");
      }
    }

    if (wonTransition && (status === "Approved" || status === "Declined")) {
      await logAudit({
        action: status === "Approved" ? "approve" : "decline",
        entityType: "FTPRequest",
        entityId: request.id,
        entityLabel: request.characterName,
        performedBy,
      });
    }

    return NextResponse.json(request);
  } catch (error) {
      return apiError("Failed to update FTP request", error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("onboarding.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    await prisma.fTPRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
      return apiError("Failed to delete FTP request", error);
  }
}
