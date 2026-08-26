import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { sendDiscordDM, getNotificationSettings } from "@/lib/discord-webhook";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, reviewedBy, reviewNote } = body;

    const request = await prisma.fTPRequest.update({
      where: { id },
      data: { status, reviewedBy, reviewNote },
    });

    const settings = await getNotificationSettings();

    if (status === "Approved") {
      const member = await prisma.member.findFirst({
        where: { discordId: request.discordId },
      });

      if (member) {
        await prisma.member.update({
          where: { id: member.id },
          data: { category: "FTP" },
        });
      }

      if (settings.ftpDM) {
        const inviteLink = settings.botSettings?.stateInvite || process.env.DISCORD_STATE_INVITE || "https://discord.gg/YOUR_INVITE";
        await sendDiscordDM(
          request.discordId,
          `Congratulations, ${request.characterName}! 🎉\n\nYour Field Training Program (FTP) application has been **Accepted**!\n\nYou will be assigned an FTP role and a trainer will reach out to you shortly.\n\nJoin our state Discord server:\n${inviteLink}`
        );
      }
    } else if (status === "Declined") {
      if (settings.ftpDM) {
        await sendDiscordDM(
          request.discordId,
          `Dear ${request.characterName},\n\nWe regret to inform you that your FTP application has been **Declined**.\n\nIf you have questions, please contact HR.`
        );
      }
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
  try {
    const { id } = await params;
    await prisma.fTPRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
      return apiError("Failed to delete FTP request", error);
  }
}
