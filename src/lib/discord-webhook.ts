import { prisma } from "./prisma";

export async function getNotificationSettings() {
  try {
    let settings = await prisma.notificationSettings.findUnique({
      where: { id: "singleton" },
    });
    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { id: "singleton" },
      });
    }
    return settings as {
      recruitWebhook: boolean;
      recruitDM: boolean;
      recruitWebhookApprove: string;
      recruitWebhookDecline: string;
      recruitDMApprove: string;
      recruitDMDecline: string;
      onboardingWebhook: boolean;
      onboardingDM: boolean;
      onboardingDMApprove: string;
      onboardingDMDecline: string;
      ftpWebhook: boolean;
      ftpDM: boolean;
      ftpDMApprove: string;
      ftpDMDecline: string;
      loaWebhook: boolean;
      loaDM: boolean;
      loaWebhookApprove: string;
      loaWebhookDecline: string;
      loaDMApprove: string;
      loaDMDecline: string;
      testWebhook: boolean;
      testDM: boolean;
      webhookUrls: any;
      botSettings: any;
    };
  } catch {
    return {
      recruitWebhook: true,
      recruitDM: true,
      recruitWebhookApprove: "Congratulations! Your EMS application has been Accepted, <@{discordId}> For further details, please check your DMs",
      recruitWebhookDecline: "Unfortunately, your EMS application has been Declined, <@{discordId}> For further details, please check your DMs",
      recruitDMApprove: "Congratulations, {name}! 🎉\n\nYour recruitment application has been **Accepted**!\n\nJoin our state Discord server to get started:\n{inviteLink}\n\nWelcome aboard! 🚑🚀",
      recruitDMDecline: "Dear {name},\n\nWe regret to inform you that your recruitment application has been **Declined**.\n\nIf you have questions, please contact HR.",
      onboardingWebhook: false,
      onboardingDM: true,
      onboardingDMApprove: "Congratulations, {name}! 🎉\n\nYou have been accepted into the Emergency Medical Services!\n\n**Your Details:**\n• Rank: {rank}\n• Call Sign: {callSign}\n• State ID: {stateId}\n\nJoin our state Discord server to get started:\n{inviteLink}\n\nWelcome aboard! 🚑🚀",
      onboardingDMDecline: "Dear {name},\n\nWe regret to inform you that your application has been **Declined**.\n\nIf you have questions, please contact HR.",
      ftpWebhook: false,
      ftpDM: true,
      ftpDMApprove: "Congratulations, {name}! 🎉\n\nYour Field Training Program (FTP) application has been **Accepted**!\n\nYou will be assigned an FTP role and a trainer will reach out to you shortly.\n\nJoin our state Discord server:\n{inviteLink}",
      ftpDMDecline: "Dear {name},\n\nWe regret to inform you that your FTP application has been **Declined**.\n\nIf you have questions, please contact HR.",
      loaWebhook: true,
      loaDM: false,
      loaWebhookApprove: "LOA Approved for {name}",
      loaWebhookDecline: "LOA Declined for {name}",
      loaDMApprove: "Your Leave of Absence has been **Approved**.\n\nStart: {startDate}\nEnd: {endDate}\nReason: {reason}",
      loaDMDecline: "Your Leave of Absence request has been **Declined**.\n\nIf you have questions, please contact HR.",
      testWebhook: true,
      testDM: true,
      webhookUrls: null,
      botSettings: null,
    };
  }
}

export async function postToWebhook(
  webhookUrl: string,
  embed: {
    title: string;
    description: string;
    color: number;
    fields: { name: string; value: string; inline?: boolean }[];
  }
) {
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Nexus EMS HR",
        avatar_url: "",
        embeds: [
          {
            title: embed.title,
            description: embed.description,
            color: embed.color,
            fields: embed.fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (err) {
    console.error("Failed to post to webhook:", err);
  }
}

export async function postToLOAWebhook(embed: {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
}) {
  const webhookUrl = process.env.DISCORD_LOA_WEBHOOK_URL;
  if (webhookUrl) await postToWebhook(webhookUrl, embed);
}

export async function postToEnrollWebhook(embed: {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
}) {
  const webhookUrl = process.env.DISCORD_ENROLL_WEBHOOK_URL;
  if (webhookUrl) await postToWebhook(webhookUrl, embed);
}

export async function postToAcceptWebhook(content: string, imageUrl?: string) {
  const webhookUrl = process.env.DISCORD_ACCEPT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const body: any = {
      username: "Nexus EMS HR",
      avatar_url: "",
      content,
    };

    if (imageUrl) {
      body.embeds = [
        {
          image: { url: imageUrl },
        },
      ];
    }

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Failed to post to accept webhook:", err);
  }
}

export async function sendDiscordDM(discordId: string, message: string): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return false;

  try {
    const dmResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });

    if (!dmResponse.ok) return false;

    const dmChannel = await dmResponse.json();

    const msgResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });

    return msgResponse.ok;
  } catch (err) {
    console.error("Failed to send DM:", err);
    return false;
  }
}
