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
