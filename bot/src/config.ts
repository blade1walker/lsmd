import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Settings, read once from the environment (or a .env file beside package.json).
 *
 * Only DISCORD_TOKEN is required to start. Everything that talks to the
 * website needs WEBSITE_URL and NEXUS_BOT_API_KEY too; without them the bot
 * still starts, and those commands say what is missing instead of the whole
 * bot refusing to run.
 */

const here = dirname(fileURLToPath(import.meta.url));

// Load .env from multiple candidate paths (cwd, bot root, parent dir, Pterodactyl/CloudLaag /home/container, Oracle VM)
const envCandidates = [
  join(process.cwd(), ".env"),
  join(here, ".env"),
  join(here, "..", ".env"),
  join(here, "..", "..", ".env"),
  join(process.cwd(), "bot.env"),
  join(here, "bot.env"),
  join(here, "..", "bot.env"),
  "/home/container/.env",
  "/home/container/bot/.env",
  "/opt/lsmd/bot.env",
];

let loadedEnvPath: string | null = null;
for (const p of envCandidates) {
  if (existsSync(p)) {
    dotenv.config({ path: p });
    if (!loadedEnvPath) loadedEnvPath = p;
  }
}

function read(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

/** Strips a pasted "Bot " prefix — it makes Discord answer 401. */
function cleanToken(raw: string) {
  return raw.replace(/^Bot\s+/i, "").trim();
}

// Support DISCORD_TOKEN, DISCORD_BOT_TOKEN, BOT_TOKEN, or TOKEN (standard across hosting panels)
const rawToken =
  read("DISCORD_TOKEN") ||
  read("DISCORD_BOT_TOKEN") ||
  read("BOT_TOKEN") ||
  read("TOKEN") ||
  read("APPLICATION_TOKEN");

const token = cleanToken(rawToken);
if (!token) {
  console.error(
    [
      "",
      "==================================================================",
      "  Nexus EMS Bot cannot start: DISCORD_TOKEN is not set.",
      "==================================================================",
      loadedEnvPath
        ? `  Found env file at: ${loadedEnvPath}, but DISCORD_TOKEN is empty.`
        : `  No .env file found in ${process.cwd()} or candidate directories.`,
      "",
      "  HOW TO FIX ON CLOUDLAAG / PTERODACTYL PANEL:",
      "  Option 1 (Create .env file via File Manager):",
      "    1. Open CloudLaag panel -> File Manager.",
      "    2. Click 'New File' and name it '.env' (in the same folder as package.json).",
      "    3. Paste your configuration:",
      "       DISCORD_TOKEN=your_token_here",
      "       WEBSITE_URL=https://lsmd.tech",
      "       TIMEZONE=Asia/Kolkata",
      "    4. Save Content and restart the server.",
      "",
      "  Option 2 (Set Startup Variables):",
      "    1. Open CloudLaag panel -> Startup tab.",
      "    2. Find the DISCORD_TOKEN or BOT_TOKEN variable.",
      "    3. Paste your token, then restart the server.",
      "",
      "  Get your token at: https://discord.com/developers/applications",
      "==================================================================",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const warnings: string[] = [];

const rawGuildId =
  read("DISCORD_GUILD_ID") ||
  read("GUILD_ID") ||
  read("SERVER_ID");

if (rawGuildId && !/^\d{15,22}$/.test(rawGuildId)) {
  warnings.push(`DISCORD_GUILD_ID "${rawGuildId}" is not a server ID — ignoring it and using every server the bot is in.`);
}
const guildId = /^\d{15,22}$/.test(rawGuildId) ? rawGuildId : null;

// Default to https://lsmd.tech so CloudLaag deployments connect to live production out of the box
let websiteUrl = (
  read("WEBSITE_URL") ||
  read("SITE_URL") ||
  "https://lsmd.tech"
).replace(/\/+$/, "");

if (websiteUrl && !/^https?:\/\//.test(websiteUrl)) {
  websiteUrl = `https://${websiteUrl}`;
}

const apiKey = read("NEXUS_BOT_API_KEY");

let websiteProblem: string | null = null;
if (!websiteUrl) {
  websiteProblem = "Set WEBSITE_URL (e.g. https://lsmd.tech) to connect the bot to the website.";
} else if (!/^https:\/\//.test(websiteUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(websiteUrl)) {
  websiteProblem = "WEBSITE_URL must start with https:// — the bot's credentials are sent with every request.";
}

if (apiKey && apiKey.length < 32) warnings.push("NEXUS_BOT_API_KEY is shorter than 32 characters and will be ignored by the website; the bot's token is used instead.");
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

const autoUpdate = read("BOT_AUTO_UPDATE").toLowerCase() !== "false";
const rawInterval = parseInt(read("BOT_AUTO_UPDATE_MINUTES") || "5", 10);
const autoUpdateIntervalMinutes = isNaN(rawInterval) ? 5 : Math.max(1, Math.min(60, rawInterval));
const githubRepo = read("GITHUB_REPO") || "blade1walker/lsmd";
const githubBranch = read("GITHUB_BRANCH") || "main";
const githubToken = read("GITHUB_TOKEN") || undefined;

const botOwnerIds = (read("BOT_OWNER_IDS") || read("SUPER_ADMIN_IDS") || "")
  .split(/[,;\s]+/)
  .map((s) => s.trim())
  .filter((s) => /^\d{15,22}$/.test(s));

export const config = {
  token,
  /** Null means "every server the bot is in". */
  guildId,
  websiteUrl,
  apiKey,
  /** Why the website cannot be used, or null when it is configured. */
  websiteProblem,
  timezone,
  brandName: read("BOT_BRAND_NAME") || "Los Santos EMS",
  logoUrl: /^https:\/\//.test(read("BOT_LOGO_URL")) ? read("BOT_LOGO_URL") : undefined,
  logChannelId: /^\d{15,22}$/.test(logChannelId) ? logChannelId : undefined,
  autoUpdate,
  autoUpdateIntervalMinutes,
  githubRepo,
  githubBranch,
  githubToken,
  botOwnerIds,
};

export const configWarnings = warnings;
