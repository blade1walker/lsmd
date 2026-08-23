import { NextRequest, NextResponse } from "next/server";
import { postToAcceptWebhook, sendDiscordDM, getNotificationSettings } from "@/lib/discord-webhook";

export async function POST(req: NextRequest) {
  try {
    const { discordId, characterName, message, type } = await req.json();
    const settings = await getNotificationSettings();

    if (type === "webhook") {
      if (!settings.testWebhook) {
        return NextResponse.json({ error: "Webhook testing is disabled in settings" }, { status: 400 });
      }
      const testMessage = message || `Congratulations! Your EMS application has been Accepted, <@${discordId}> For further details, please check your DMs`;
      await postToAcceptWebhook(
        testMessage,
        "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_approved.png"
      );
      return NextResponse.json({ ok: true });
    } else {
      if (!settings.testDM) {
        return NextResponse.json({ error: "DM testing is disabled in settings" }, { status: 400 });
      }
      const testMessage = message || `Test DM from Nexus EMS Recruit System${characterName ? ` — ${characterName}` : ""}. If you received this, the DM system is working! 🚑`;
      await sendDiscordDM(discordId, testMessage);
      return NextResponse.json({ ok: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message?.slice(0, 200) || "Failed" }, { status: 500 });
  }
}
