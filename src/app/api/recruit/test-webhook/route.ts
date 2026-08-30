import { NextRequest, NextResponse } from "next/server";
import { postToAcceptWebhook, sendDiscordDM, getNotificationSettings, describeResult } from "@/lib/discord-webhook";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  // Sends an arbitrary message to an arbitrary Discord ID through the bot.
  // Unauthenticated, this is a spam relay pointed at your bot token.
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const { discordId, characterName, message, type } = await req.json();
    const settings = await getNotificationSettings();

    if (type === "webhook") {
      if (!settings.testWebhook) {
        return NextResponse.json({ error: "Webhook testing is disabled in settings" }, { status: 400 });
      }
      const testMessage = message || `Congratulations! Your EMS application has been Accepted, <@${discordId}> For further details, please check your DMs`;
      const result = await postToAcceptWebhook(
        testMessage,
        "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_approved.png",
        "test.recruit"
      );
      // Reports what Discord actually answered. This used to return ok
      // unconditionally, so a missing webhook URL still read as "sent".
      return result.ok
        ? NextResponse.json({ ok: true, detail: describeResult(result) })
        : NextResponse.json({ error: describeResult(result) }, { status: 502 });
    }

    if (!settings.testDM) {
      return NextResponse.json({ error: "DM testing is disabled in settings" }, { status: 400 });
    }
    const testMessage = message || `Test DM from Nexus EMS Recruit System${characterName ? ` — ${characterName}` : ""}. If you received this, the DM system is working! 🚑`;
    const result = await sendDiscordDM(discordId, testMessage, "test.dm");
    return result.ok
      ? NextResponse.json({ ok: true, detail: describeResult(result) })
      : NextResponse.json({ error: describeResult(result) }, { status: 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
