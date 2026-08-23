import { NextRequest, NextResponse } from "next/server";
import { postToAcceptWebhook, sendDiscordDM } from "@/lib/discord-webhook";

export async function POST(req: NextRequest) {
  try {
    const { discordId, characterName, message, type } = await req.json();

    if (type === "webhook") {
      const testMessage = message || `Test Webhook — ${characterName || "Recruit"} — This is a test message from the Recruit System.`;
      await postToAcceptWebhook(
        `<@${discordId}> ${testMessage}`,
        "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_approved.png"
      );
      return NextResponse.json({ ok: true });
    } else {
      const testMessage = message || `Test DM from Nexus EMS Recruit System${characterName ? ` — ${characterName}` : ""}. If you received this, the DM system is working! 🚑`;
      await sendDiscordDM(discordId, testMessage);
      return NextResponse.json({ ok: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message?.slice(0, 200) || "Failed" }, { status: 500 });
  }
}
