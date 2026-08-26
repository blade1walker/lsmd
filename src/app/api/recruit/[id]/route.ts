import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { postToAcceptWebhook, sendDiscordDM, getNotificationSettings } from "@/lib/discord-webhook";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("onboarding.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, reviewedBy, reviewNote, customMessage, discordId, discordUsername, steamId, characterName, user } = body;

    const request = await prisma.recruitRequest.update({
      where: { id },
      data: {
        ...(discordId && { discordId }),
        ...(discordUsername !== undefined && { discordUsername: discordUsername || null }),
        ...(steamId && { steamId }),
        ...(characterName !== undefined && { characterName: characterName || null }),
        ...(user !== undefined && { user: user || null }),
        ...(status && { status }),
        ...(reviewedBy && { reviewedBy }),
        ...(reviewNote !== undefined && { reviewNote }),
      },
    });

    if (status && status !== "Pending") {
      const settings = await getNotificationSettings();
      const inviteLink = settings.botSettings?.stateInvite || settings.webhookUrls?.recruit || process.env.DISCORD_STATE_INVITE || "https://discord.gg/YOUR_INVITE";

      if (status === "Approved") {
        if (settings.recruitWebhook) {
          const msg = settings.recruitWebhookApprove
            .replace(/{discordId}/g, request.discordId)
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{inviteLink}/g, inviteLink);
          await postToAcceptWebhook(msg, "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_approved.png");
        }

        if (settings.recruitDM) {
          const msg = (customMessage || settings.recruitDMApprove)
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{inviteLink}/g, inviteLink);
          await sendDiscordDM(request.discordId, msg);
        }
      } else if (status === "Declined") {
        if (settings.recruitWebhook) {
          const msg = settings.recruitWebhookDecline
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{discordId}/g, request.discordId);
          await postToAcceptWebhook(msg, "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_rejected.png");
        }

        if (settings.recruitDM) {
          const msg = settings.recruitDMDecline
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{inviteLink}/g, inviteLink);
          await sendDiscordDM(request.discordId, msg);
        }
      }
    }

    return NextResponse.json(request);
  } catch (error) {
      return apiError("Failed to update recruit", error);
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
    await prisma.recruitRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
      return apiError("Failed to delete recruit", error);
  }
}
