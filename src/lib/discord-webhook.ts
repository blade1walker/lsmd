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
    return settings as NotificationSettings;
  } catch {
    return FALLBACK_SETTINGS;
  }
}

export interface NotificationSettings {
  recruitWebhook: boolean;
  recruitDM: boolean;
  recruitWebhookApprove: string;
  recruitWebhookDecline: string;
  recruitDMApprove: string;
  recruitDMDecline: string;
  onboardingWebhook: boolean;
  onboardingDM: boolean;
  onboardingWebhookMessage: string;
  onboardingDMApprove: string;
  onboardingDMDecline: string;
  ftpWebhook: boolean;
  ftpDM: boolean;
  ftpDMApprove: string;
  ftpDMDecline: string;
  ftpWebhookApprove: string;
  loaWebhook: boolean;
  loaDM: boolean;
  loaWebhookApprove: string;
  loaWebhookDecline: string;
  loaDMApprove: string;
  loaDMDecline: string;
  loaReminderDM: boolean;
  loaReminderMessage: string;
  loaExpiredDM: boolean;
  loaExpiredMessage: string;
  promotionWebhook: boolean;
  promotionWebhookMessage: string;
  demotionWebhook: boolean;
  demotionWebhookMessage: string;
  callsignWebhook: boolean;
  callsignWebhookMessage: string;
  testWebhook: boolean;
  testDM: boolean;
  webhookUrls: Record<string, string | undefined> | null;
  botSettings: { token?: string; inviteLink?: string; stateInvite?: string } | null;
}

/** Used only when the settings row cannot be read — keep in sync with the schema defaults. */
const FALLBACK_SETTINGS: NotificationSettings = {
  recruitWebhook: true,
  recruitDM: true,
  recruitWebhookApprove: "Congratulations! Your EMS application has been Accepted, <@{discordId}> For further details, please check your DMs",
  recruitWebhookDecline: "Unfortunately, your EMS application has been Declined, <@{discordId}> For further details, please check your DMs",
  recruitDMApprove: "Congratulations, {name}! 🎉\n\nYour recruitment application has been **Accepted**!\n\n**Assigned Rank:** {rank}\n\nJoin our state Discord server to get started:\n{inviteLink}\n\nWelcome aboard! 🚑🚀",
  recruitDMDecline: "Dear {name},\n\nWe regret to inform you that your recruitment application has been **Declined**.\n\nIf you have questions, please contact HR.",
  onboardingWebhook: false,
  onboardingDM: true,
  onboardingWebhookMessage: "<@{discordId}> **{name}** has been enrolled in the EMS roster.",
  onboardingDMApprove: "Congratulations, {name}! 🎉\n\nYou have been accepted into the Emergency Medical Services!\n\n**Your Details:**\n• Rank: {rank}\n• Call Sign: {callSign}\n• State ID: {stateId}\n\nJoin our state Discord server to get started:\n{inviteLink}\n\nWelcome aboard! 🚑🚀",
  onboardingDMDecline: "Dear {name},\n\nWe regret to inform you that your application has been **Declined**.\n\nIf you have questions, please contact HR.",
  ftpWebhook: false,
  ftpDM: true,
  ftpDMApprove: "Congratulations, {name}! 🎉\n\nYour Field Training Program (FTP) application has been **Accepted**! You have been assigned the FTP role and a trainer will reach out to you shortly.\n\nJoin our state Discord server:\n{inviteLink}",
  ftpDMDecline: "Dear {name},\n\nWe regret to inform you that your FTP application has been **Declined**.\n\nIf you have questions, please contact HR.",
  ftpWebhookApprove: "🎓 {name} ({callSign}) has enrolled in the Field Training Program!",
  loaWebhook: true,
  loaDM: false,
  loaWebhookApprove: "<@{discordId}> **{name}** has been granted a Leave of Absence.",
  loaWebhookDecline: "<@{discordId}> **{name}**'s Leave of Absence request has been declined.",
  loaDMApprove: "Your Leave of Absence has been **Approved**.\n\nStart: {startDate}\nEnd: {endDate}\nReason: {reason}",
  loaDMDecline: "Your Leave of Absence request has been **Declined**.\n\nIf you have questions, please contact HR.",
  loaReminderDM: true,
  loaReminderMessage: "Hi {name}, your Leave of Absence ends on {endDate} — {daysLeft} day(s) from now. Let HR know if you need an extension.",
  loaExpiredDM: true,
  loaExpiredMessage: "Welcome back, {name}! Your Leave of Absence ended on {endDate} and your roster status is Active again.",
  promotionWebhook: true,
  promotionWebhookMessage: "🎉 Congratulations <@{discordId}>! {name} ({callSign}) has been promoted from **{fromRank}** to **{toRank}**!",
  demotionWebhook: false,
  demotionWebhookMessage: "📋 {name} ({callSign}) has been moved from **{fromRank}** to **{toRank}**.",
  callsignWebhook: true,
  callsignWebhookMessage: "📻 <@{discordId}>'s call sign has been updated: **{oldCallSign}** → **{newCallSign}**",
  testWebhook: true,
  testDM: true,
  webhookUrls: null,
  botSettings: null,
};

/** Every channel a message can go out on. Maps to a webhook URL, or to the bot for DMs. */
export type WebhookKind = "recruit" | "onboarding" | "ftp" | "loa" | "promotion" | "callsign";

const WEBHOOK_ENV: Record<WebhookKind, string | undefined> = {
  recruit: process.env.DISCORD_ACCEPT_WEBHOOK_URL,
  onboarding: process.env.DISCORD_ENROLL_WEBHOOK_URL,
  ftp: process.env.DISCORD_FTP_WEBHOOK_URL,
  loa: process.env.DISCORD_LOA_WEBHOOK_URL,
  promotion: process.env.DISCORD_PROMOTION_WEBHOOK_URL,
  callsign: process.env.DISCORD_CALLSIGN_WEBHOOK_URL,
};

/**
 * Channels that borrow another channel's webhook when they have none of their
 * own. A call sign change belongs with promotions — both announce a change to
 * how a member is identified — so it posts there rather than nowhere until a
 * dedicated webhook is configured.
 */
const WEBHOOK_FALLBACK: Partial<Record<WebhookKind, WebhookKind>> = {
  callsign: "promotion",
};

function ownUrl(kind: WebhookKind, settings: NotificationSettings): string {
  const configured = settings.webhookUrls?.[kind] || (kind === "recruit" ? settings.webhookUrls?.accept : undefined);
  return (configured || WEBHOOK_ENV[kind] || "").trim();
}

/**
 * A URL configured in admin > notification settings wins over the environment
 * variable. The env vars stay as the fallback so an existing deployment keeps
 * working with nothing filled in — but the settings page is no longer decorative.
 */
export async function resolveWebhookUrl(kind: WebhookKind, settings?: NotificationSettings): Promise<string> {
  const s = settings ?? (await getNotificationSettings());
  const own = ownUrl(kind, s);
  if (own) return own;

  const fallback = WEBHOOK_FALLBACK[kind];
  return fallback ? ownUrl(fallback, s) : "";
}

/** The channel a kind will actually post to, for telling the admin where a test went. */
export async function resolveWebhookSource(
  kind: WebhookKind,
  settings?: NotificationSettings
): Promise<{ url: string; kind: WebhookKind | null }> {
  const s = settings ?? (await getNotificationSettings());
  const own = ownUrl(kind, s);
  if (own) return { url: own, kind };

  const fallback = WEBHOOK_FALLBACK[kind];
  const borrowed = fallback ? ownUrl(fallback, s) : "";
  return { url: borrowed, kind: borrowed ? fallback! : null };
}

export async function resolveBotToken(settings?: NotificationSettings): Promise<string> {
  const s = settings ?? (await getNotificationSettings());
  return (s.botSettings?.token || process.env.DISCORD_BOT_TOKEN || "").trim();
}

/** Why a send did not happen, when it did not happen for a reason that is not an error. */
export type SkipReason = "no-url" | "no-token" | "no-target";

export interface SendResult {
  ok: boolean;
  status?: number;
  error?: string;
  skipped?: SkipReason;
}

/** Human-readable reason, for surfacing in the admin UI instead of a silent no-op. */
export function describeResult(result: SendResult): string {
  if (result.ok) return "Sent";
  switch (result.skipped) {
    case "no-url":
      return "No webhook URL configured for this channel";
    case "no-token":
      return "No bot token configured";
    case "no-target":
      return "No Discord ID on this record";
    default:
      return result.error || `Discord returned ${result.status ?? "an error"}`;
  }
}

/**
 * Records every attempt. Sends happen inside serverless requests where a
 * console.error is effectively lost, so "did that member get their DM?" was
 * previously unanswerable. Never throws — a logging failure must not take down
 * the request that triggered the notification.
 */
async function logDelivery(entry: {
  event: string;
  channel: "webhook" | "dm";
  target?: string;
  content: string;
  result: SendResult;
}) {
  try {
    await prisma.notificationLog.create({
      data: {
        event: entry.event,
        channel: entry.channel,
        target: entry.target?.slice(0, 100) ?? null,
        ok: entry.result.ok,
        status: entry.result.status ?? null,
        error: entry.result.ok ? null : describeResult(entry.result).slice(0, 500),
        preview: entry.content.slice(0, 300),
      },
    });
  } catch (err) {
    console.error("Failed to write notification log:", err);
  }
}

const MAX_ATTEMPTS = 3;
/** Longest a rate limit is worth waiting for inline — past this the send is logged as failed. */
const MAX_RETRY_WAIT_MS = 3000;

/**
 * One HTTP send with rate-limit handling. Discord answers a burst of approvals
 * with 429 + retry_after; without this those sends were dropped silently.
 */
async function send(url: string, init: RequestInit): Promise<SendResult> {
  let last: SendResult = { ok: false, error: "Not attempted" };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return { ok: true, status: res.status };

      last = { ok: false, status: res.status, error: (await res.text().catch(() => "")).slice(0, 300) };

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) return last;

      const headerWait = Number(res.headers.get("retry-after")) * 1000;
      const wait = Number.isFinite(headerWait) && headerWait > 0 ? headerWait : 500 * attempt;
      if (wait > MAX_RETRY_WAIT_MS) return { ...last, error: `Rate limited, retry_after ${Math.round(wait / 1000)}s` };
      await new Promise((r) => setTimeout(r, wait));
    } catch (err) {
      last = { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : "Network error" };
      if (attempt === MAX_ATTEMPTS) return last;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  return last;
}

export interface Embed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
}

/** Posts to an explicit URL. Prefer postEmbed/postContent, which resolve the URL for a channel. */
export async function postToWebhook(webhookUrl: string, embed: Embed, event = "webhook"): Promise<SendResult> {
  if (!webhookUrl) {
    const result: SendResult = { ok: false, skipped: "no-url" };
    await logDelivery({ event, channel: "webhook", content: embed.description, result });
    return result;
  }

  const result = await send(webhookUrl, {
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

  await logDelivery({ event, channel: "webhook", target: event, content: embed.description, result });
  return result;
}

/** Embed post to one of the configured channels. */
export async function postEmbed(kind: WebhookKind, embed: Embed, event: string): Promise<SendResult> {
  return postToWebhook(await resolveWebhookUrl(kind), embed, event);
}

/** Plain-content post — a rank change or call sign reads better as a line than an embed. */
export async function postContent(
  kind: WebhookKind,
  content: string,
  event: string,
  imageUrl?: string
): Promise<SendResult> {
  const webhookUrl = await resolveWebhookUrl(kind);
  if (!webhookUrl) {
    const result: SendResult = { ok: false, skipped: "no-url" };
    await logDelivery({ event, channel: "webhook", target: kind, content, result });
    return result;
  }

  const body: Record<string, unknown> = { username: "Nexus EMS HR", avatar_url: "", content };
  if (imageUrl) body.embeds = [{ image: { url: imageUrl } }];

  const result = await send(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  await logDelivery({ event, channel: "webhook", target: kind, content, result });
  return result;
}

export async function postToLOAWebhook(embed: Embed, event = "loa"): Promise<SendResult> {
  return postEmbed("loa", embed, event);
}

export async function postToEnrollWebhook(embed: Embed, event = "onboarding.approved"): Promise<SendResult> {
  return postEmbed("onboarding", embed, event);
}

export async function postToFtpWebhook(content: string, event = "ftp.enrolled"): Promise<SendResult> {
  return postContent("ftp", content, event);
}

export async function postToPromotionWebhook(content: string, event = "member.promoted"): Promise<SendResult> {
  return postContent("promotion", content, event);
}

export async function postToCallsignWebhook(content: string, event = "member.callsign"): Promise<SendResult> {
  return postContent("callsign", content, event);
}

export async function postToAcceptWebhook(content: string, imageUrl?: string, event = "recruit"): Promise<SendResult> {
  return postContent("recruit", content, event, imageUrl);
}

export async function sendDiscordDM(discordId: string, message: string, event = "dm"): Promise<SendResult> {
  if (!discordId) {
    const result: SendResult = { ok: false, skipped: "no-target" };
    await logDelivery({ event, channel: "dm", content: message, result });
    return result;
  }

  const botToken = await resolveBotToken();
  if (!botToken) {
    const result: SendResult = { ok: false, skipped: "no-token" };
    await logDelivery({ event, channel: "dm", target: discordId, content: message, result });
    return result;
  }

  const headers = { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" };

  let result: SendResult;
  try {
    const channelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers,
      body: JSON.stringify({ recipient_id: discordId }),
    });

    if (!channelRes.ok) {
      // 403 here is the common one: the member shares no server with the bot,
      // or has DMs from server members turned off.
      result = {
        ok: false,
        status: channelRes.status,
        error:
          channelRes.status === 403
            ? "Cannot DM this user — they share no server with the bot, or have DMs disabled"
            : (await channelRes.text().catch(() => "")).slice(0, 300),
      };
    } else {
      const dmChannel = await channelRes.json();
      result = await send(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: message }),
      });
    }
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : "Network error" };
  }

  await logDelivery({ event, channel: "dm", target: discordId, content: message, result });
  return result;
}

/**
 * Substitutes {placeholders} in a configured message. Values are applied by
 * key, so a missing one blanks rather than leaving the literal placeholder in
 * the sent text — matching how <@{discordId}> has always behaved for members
 * with no linked Discord account.
 */
export function renderTemplate(template: string, values: Record<string, string | null | undefined>): string {
  return template.replace(/{(\w+)}/g, (match, key: string) =>
    key in values ? String(values[key] ?? "") : match
  );
}
