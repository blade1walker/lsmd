import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postToAcceptWebhook, sendDiscordDM } from "@/lib/discord-webhook";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      if (status === "Approved") {
        await postToAcceptWebhook(
          `<@${request.discordId}> Congratulations! Your recruitment has been **Accepted**!`,
          "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_approved.png"
        );

        const inviteLink = process.env.DISCORD_STATE_INVITE || "https://discord.gg/YOUR_INVITE";
        const message = customMessage || `Congratulations${request.characterName ? `, ${request.characterName}` : ""}! 🎉\n\nYour recruitment application has been **Accepted**!\n\nJoin our state Discord server to get started:\n${inviteLink}\n\nWelcome aboard! 🚑🚀`;

        await sendDiscordDM(request.discordId, message);
      } else if (status === "Declined") {
        await postToAcceptWebhook(
          `<@${request.discordId}> Unfortunately, your recruitment application has been **Declined**.`,
          "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_rejected.png"
        );

        await sendDiscordDM(
          request.discordId,
          `Dear${request.characterName ? ` ${request.characterName}` : " recruit"},\n\nWe regret to inform you that your recruitment application has been **Declined**.\n\nIf you have questions, please contact HR.`
        );
      }
    }

    return NextResponse.json(request);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update recruit", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.recruitRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete recruit", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
