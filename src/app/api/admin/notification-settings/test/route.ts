import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import {
  getNotificationSettings,
  postContent,
  sendDiscordDM,
  renderTemplate,
  describeResult,
  resolveWebhookSource,
  type WebhookKind,
  type NotificationSettings,
} from "@/lib/discord-webhook";

/** Stand-in values so a test message reads like a real one. */
const SAMPLE = {
  name: "Sample Medic",
  rank: "Paramedic",
  department: "Surgical",
  tag: "Surgical",
  fromRank: "EMT",
  toRank: "Paramedic",
  callSign: "947",
  oldCallSign: "912",
  newCallSign: "947",
  stateId: "12345",
  startDate: new Date().toLocaleDateString(),
  endDate: new Date(Date.now() + 7 * 86_400_000).toLocaleDateString(),
  daysLeft: "2",
  reason: "Vacation",
};

const WEBHOOK_KINDS: WebhookKind[] = ["recruit", "onboarding", "ftp", "department", "loa", "promotion", "callsign"];

function isMessageField(key: string, settings: NotificationSettings): key is keyof NotificationSettings {
  return key in settings && typeof settings[key as keyof NotificationSettings] === "string";
}

/**
 * Sends one channel's configured message, rendered with sample values, to a
 * Discord ID (DM) or the channel's webhook. The old test endpoint only ever
 * exercised the recruit webhook with hardcoded text and reported success even
 * when nothing was sent.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const { channel, field, discordId, kind } = (await req.json()) as {
      channel: "webhook" | "dm";
      field: string;
      discordId?: string;
      kind?: WebhookKind;
    };

    const settings = await getNotificationSettings();

    if (!isMessageField(field, settings)) {
      return NextResponse.json({ error: "Unknown message field" }, { status: 400 });
    }

    const template = settings[field] as string;
    const message = renderTemplate(template, {
      ...SAMPLE,
      discordId: discordId || "",
      inviteLink: settings.botSettings?.stateInvite || process.env.DISCORD_STATE_INVITE || "https://discord.gg/example",
    });

    if (channel === "dm") {
      if (!settings.testDM) {
        return NextResponse.json({ error: "DM testing is disabled in settings" }, { status: 400 });
      }
      if (!discordId) {
        return NextResponse.json({ error: "Enter a Discord ID to receive the test DM" }, { status: 400 });
      }
      const result = await sendDiscordDM(discordId, `**[TEST]**\n${message}`, `test.${field}`);
      return NextResponse.json({ ok: result.ok, detail: describeResult(result), preview: message }, { status: result.ok ? 200 : 502 });
    }

    if (!settings.testWebhook) {
      return NextResponse.json({ error: "Webhook testing is disabled in settings" }, { status: 400 });
    }
    if (!kind || !WEBHOOK_KINDS.includes(kind)) {
      return NextResponse.json({ error: "Unknown webhook channel" }, { status: 400 });
    }
    const source = await resolveWebhookSource(kind);
    if (!source.url) {
      return NextResponse.json(
        { error: `No webhook URL configured for "${kind}" — add one on the Webhooks tab` },
        { status: 400 }
      );
    }

    const result = await postContent(kind, `**[TEST]** ${message}`, `test.${field}`);
    const detail =
      result.ok && source.kind !== kind
        ? `Sent to the ${source.kind} channel — no dedicated ${kind} webhook is configured`
        : describeResult(result);
    return NextResponse.json({ ok: result.ok, detail, preview: message }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return apiError("Failed to send test", error);
  }
}
