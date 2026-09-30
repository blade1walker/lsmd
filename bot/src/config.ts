import "dotenv/config";

/**
 * Settings, read once from the environment (or a .env file beside package.json).
 *
 * Only DISCORD_TOKEN is required to start. Everything that talks to the
 * website needs WEBSITE_URL and NEXUS_BOT_API_KEY too; without them the bot
 * still starts, and those commands say what is missing instead of the whole
 * bot refusing to run.
 */

function read(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

/** Strips a pasted "Bot " prefix — it makes Discord answer 401. */
function cleanToken(raw: string) {
  return raw.replace(/^Bot\s+/i, "").trim();
}

const token = cleanToken(read("DISCORD_TOKEN"));
if (!token) {
  console.error(
    [
      "",
      "  Nexus EMS Bot cannot start: DISCORD_TOKEN is not set.",
      "",
      "  1. Copy .env.example to .env (in the same folder as package.json).",
      "  2. Paste your bot token after DISCORD_TOKEN=",
      "     (Developer Portal → your application → Bot → Reset Token).",
      "  On a hosting panel, set DISCORD_TOKEN in the panel's environment/startup variables instead.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const warnings: string[] = [];

const guildId = read("DISCORD_GUILD_ID");
if (guildId && !/^\d{15,22}$/.test(guildId)) {
  warnings.push(`DISCORD_GUILD_ID "${guildId}" is not a server ID — ignoring it and using every server the bot is in.`);
}

let websiteUrl = read("WEBSITE_URL").replace(/\/+$/, "");
if (websiteUrl && !/^https?:\/\//.test(websiteUrl)) websiteUrl = `https://${websiteUrl}`;
const apiKey = read("NEXUS_BOT_API_KEY");

let websiteProblem: string | null = null;
if (!websiteUrl || !apiKey) {
  websiteProblem = `Set ${[!websiteUrl && "WEBSITE_URL", !apiKey && "NEXUS_BOT_API_KEY"].filter(Boolean).join(" and ")} to connect the bot to the website.`;
} else if (apiKey.length < 32) {
  websiteProblem = "NEXUS_BOT_API_KEY is shorter than 32 characters — the website ignores a key that short. Generate a longer one.";
}
if (websiteProblem) warnings.push(`${websiteProblem} Until then, commands that use the website are unavailable.`);

let timezone = read("TIMEZONE") || "Asia/Kolkata";
try {
  new Intl.DateTimeFormat("en-US", { timeZone: timezone });
} catch {
  warnings.push(`TIMEZONE "${timezone}" is not a valid timezone name (e.g. Asia/Kolkata) — using Asia/Kolkata.`);
  timezone = "Asia/Kolkata";
}

const logChannelId = read("LOG_CHANNEL_ID");
if (logChannelId && !/^\d{15,22}$/.test(logChannelId)) warnings.push(`LOG_CHANNEL_ID "${logChannelId}" is not a channel ID — staff logging is off.`);

export const config = {
  token,
  /** Null means "every server the bot is in". */
  guildId: /^\d{15,22}$/.test(guildId) ? guildId : null,
  websiteUrl,
  apiKey,
  /** Why the website cannot be used, or null when it is configured. */
  websiteProblem,
  timezone,
  brandName: read("BOT_BRAND_NAME") || "Los Santos EMS",
  logoUrl: /^https:\/\//.test(read("BOT_LOGO_URL")) ? read("BOT_LOGO_URL") : undefined,
  logChannelId: /^\d{15,22}$/.test(logChannelId) ? logChannelId : undefined,
};

export const configWarnings = warnings;
