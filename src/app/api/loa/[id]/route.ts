import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { postToLOAWebhook, sendDiscordDM, getNotificationSettings } from "@/lib/discord-webhook";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const loa = await prisma.lOA.update({
      where: { id },
      data: { status },
      include: { member: true },
    });

    const settings = await getNotificationSettings();

    if (status === "Approved") {
      await prisma.member.update({
        where: { id: loa.memberId },
        data: { activity: "LOA" },
      });

      if (settings.loaWebhook) {
        await postToLOAWebhook({
          title: "LOA Approved",
          description: `<@${loa.member.discordId}> **${loa.member.name}** has been granted a Leave of Absence.`,
          color: 0x22c55e,
          fields: [
            { name: "Member", value: loa.member.name, inline: true },
            { name: "Rank", value: loa.member.rank, inline: true },
            { name: "Call Sign", value: loa.member.callSign || "N/A", inline: true },
            { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
            { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true },
            { name: "Reason", value: loa.reason || "Not specified", inline: false },
          ],
        });
      }

      if (settings.loaDM && loa.member.discordId) {
        await sendDiscordDM(
          loa.member.discordId,
          `Your Leave of Absence has been **Approved**.\n\nStart: ${loa.startDate.toLocaleDateString()}\nEnd: ${loa.endDate.toLocaleDateString()}\nReason: ${loa.reason || "Not specified"}`
        );
      }
    } else if (status === "Declined") {
      if (settings.loaWebhook) {
        await postToLOAWebhook({
          title: "LOA Declined",
          description: `<@${loa.member.discordId}> **${loa.member.name}**'s Leave of Absence request has been declined.`,
          color: 0xef4444,
          fields: [
            { name: "Member", value: loa.member.name, inline: true },
            { name: "Rank", value: loa.member.rank, inline: true },
            { name: "Call Sign", value: loa.member.callSign || "N/A", inline: true },
            { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
            { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true },
            { name: "Reason", value: loa.reason || "Not specified", inline: false },
          ],
        });
      }

      if (settings.loaDM && loa.member.discordId) {
        await sendDiscordDM(
          loa.member.discordId,
          `Your Leave of Absence request has been **Declined**.\n\nIf you have questions, please contact HR.`
        );
      }
    } else if (status === "Expired" || status === "Cancelled") {
      await prisma.member.update({
        where: { id: loa.memberId },
        data: { activity: "Active" },
      });
    }

    return NextResponse.json(loa);
  } catch (error) {
      return apiError("Failed to update LOA", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.lOA.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
      return apiError("Failed to delete LOA", error);
  }
}
