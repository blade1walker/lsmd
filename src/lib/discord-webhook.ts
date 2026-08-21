export async function postToLOAWebhook(embed: {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
}) {
  const webhookUrl = process.env.DISCORD_LOA_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "EMS HR Assistant",
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
    console.error("Failed to post to LOA webhook:", err);
  }
}
