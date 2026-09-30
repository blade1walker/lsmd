import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[config] ${name} is not set. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

/** Strips a pasted "Bot " prefix or .env quotes — both make Discord answer 401. */
function cleanToken(raw: string) {
  return raw.replace(/^["']|["']$/g, "").replace(/^Bot\s+/i, "").trim();
}

const apiKey = required("NEXUS_BOT_API_KEY");
if (apiKey.length < 32) {
  console.error("[config] NEXUS_BOT_API_KEY must be at least 32 characters — the website ignores a shorter one.");
  process.exit(1);
}

export const config = {
  token: cleanToken(required("DISCORD_TOKEN")),
  guildId: required("DISCORD_GUILD_ID"),
  websiteUrl: required("WEBSITE_URL").replace(/\/+$/, ""),
  apiKey,
  timezone: optional("TIMEZONE", "Asia/Kolkata"),
  brandName: optional("BOT_BRAND_NAME", "Los Santos EMS"),
  logoUrl: optional("BOT_LOGO_URL") || undefined,
  logChannelId: optional("LOG_CHANNEL_ID") || undefined,
} as const;

try {
  new Intl.DateTimeFormat("en-US", { timeZone: config.timezone });
} catch {
  console.error(`[config] TIMEZONE "${config.timezone}" is not a valid IANA timezone (e.g. Asia/Kolkata, Europe/London).`);
  process.exit(1);
}
