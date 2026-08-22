import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { discordId, message } = await req.json();

    if (!discordId || !message) {
      return NextResponse.json(
        { error: "discordId and message are required" },
        { status: 400 }
      );
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "DISCORD_BOT_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Create DM channel
    const dmResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });

    if (!dmResponse.ok) {
      const err = await dmResponse.json();
      return NextResponse.json(
        { error: "Failed to create DM channel", detail: err.message },
        { status: dmResponse.status }
      );
    }

    const dmChannel = await dmResponse.json();

    // Send message
    const msgResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });

    if (!msgResponse.ok) {
      const err = await msgResponse.json();
      return NextResponse.json(
        { error: "Failed to send message", detail: err.message },
        { status: msgResponse.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to send DM", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
