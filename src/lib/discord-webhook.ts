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
    return settings;
  } catch {
    return {
      recruitWebhook: true,
      recruitDM: true,
      onboardingWebhook: false,
      onboardingDM: true,
      ftpWebhook: false,
      ftpDM: true,
      loaWebhook: true,
      loaDM: false,
      testWebhook: true,
      testDM: true,
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
