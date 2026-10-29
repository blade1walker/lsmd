/**
 * Checks the website's settings without printing any of their values.
 *
 *   node deploy/oracle/check-env.mjs              the current environment
 *   node deploy/oracle/check-env.mjs /opt/lsmd/.env   a settings file (setup.sh runs this)
 *
 * Stops (exit 1) when a required setting is missing or still a placeholder,
 * including the literal "[SENSITIVE]" some hosts export in place of a secret.
 */
import { existsSync } from "node:fs";

const file = process.argv[2];
if (file) {
  if (!existsSync(file)) {
    console.error(`[check-env] ${file} does not exist.`);
    process.exit(1);
  }
  process.loadEnvFile(file);
}

const REQUIRED = [
  { names: ["NEXTAUTH_SECRET"], what: "session signing secret (openssl rand -base64 32)" },
  { names: ["NEXTAUTH_URL"], what: "the site's public address, e.g. https://lsmd.tech", test: (v) => /^https?:\/\/[^/]+/.test(v) },
  { names: ["DISCORD_CLIENT_ID"], what: "Discord app -> OAuth2 -> Client ID" },
  { names: ["DISCORD_CLIENT_SECRET"], what: "Discord app -> OAuth2 -> Client Secret" },
];

/** Optional: each one only switches a feature off when unset. */
const OPTIONAL = {
  DATABASE_URL:
    "copying an old Postgres (Neon) database into SQLite on first start — the database itself is DATA_DIR/lsmd.db",
  DISCORD_BOT_TOKEN: "DMs, Discord usernames and role sync",
  NEXUS_BOT_API_KEY: "the Nexus EMS Discord bot's API access",
  FIVEM_API_KEY: "the FiveM sync resource",
  CRON_SECRET: "the nightly LOA expiry job",
  DISCORD_GUILD_ID: "FTP role sync (with DISCORD_FTP_ROLE_ID)",
  DISCORD_FTP_ROLE_ID: "FTP role sync (with DISCORD_GUILD_ID)",
  DISCORD_STATE_INVITE: "the invite link in outgoing messages",
  DISCORD_ENROLL_WEBHOOK_URL: "enrollment channel posts",
  DISCORD_LOA_WEBHOOK_URL: "LOA channel posts",
  DISCORD_ACCEPT_WEBHOOK_URL: "acceptance channel posts",
  DISCORD_PROMOTION_WEBHOOK_URL: "promotion channel posts",
  DISCORD_CALLSIGN_WEBHOOK_URL: "callsign channel posts",
  DISCORD_FTP_WEBHOOK_URL: "FTP channel posts",
  DISCORD_DEPARTMENT_WEBHOOK_URL: "department application posts",
};

const value = (name) => process.env[name]?.trim() || "";
const placeholder = (v) =>
  /^\[?sensitive\]?$/i.test(v) || /^<.*>$/.test(v) || v.includes("user:password@host") || /^(changeme|todo|x+)$/i.test(v);

const problems = [];
const placeholders = Object.keys(process.env).filter((n) => /^[A-Z][A-Z0-9_]*$/.test(n) && placeholder(value(n)));

for (const { names, what, test } of REQUIRED) {
  const set = names.filter((n) => value(n) && !placeholder(value(n)));
  const label = names.length > 1 ? `${names[0]} (or ${names.slice(1).join(" / ")})` : names[0];
  if (!set.length) problems.push(`${label} is missing — ${what}`);
  else if (test && !set.some((n) => test(value(n)))) problems.push(`${label} does not look right — expected ${what}`);
}

for (const name of placeholders) {
  problems.push(`${name} is a placeholder ("${value(name).slice(0, 20)}"), not a real value`);
}

const off = Object.entries(OPTIONAL).filter(([n]) => !value(n) || placeholder(value(n)));

if (problems.length) {
  console.error("[check-env] The site cannot start with these settings:");
  for (const p of [...new Set(problems)]) console.error(`  ✘ ${p}`);
  console.error("[check-env] .env.example in the repo explains where each one comes from.");
  process.exit(1);
}

console.log("[check-env] Required settings are present.");
if (off.length) {
  console.log("[check-env] Not set, so these features are off:");
  for (const [name, what] of off) console.log(`  · ${name} — ${what}`);
}
