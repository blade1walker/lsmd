import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client, EmbedBuilder } from "discord.js";
import { config } from "./config.js";
import { COLORS } from "./ui.js";
import { formatIST } from "./time.js";

export interface VersionInfo {
  version: string;
  commit: string;
  shortSha: string;
  message?: string;
  author?: string;
  timestamp?: string;
  branch?: string;
}

export interface UpdateCheckResult {
  available: boolean;
  currentSha: string;
  remoteSha?: string;
  shortSha?: string;
  message?: string;
  author?: string;
  date?: string;
  downloadUrl?: string;
  strategy?: "git" | "bundle";
  error?: string;
}

let runningVersion: VersionInfo | null = null;
let isUpdating = false;
let lastCheckAt: Date | null = null;
let lastCheckResult: UpdateCheckResult | null = null;

const BOT_ROOT = process.cwd();
const VERSION_FILE = join(BOT_ROOT, "bot-version.json");
const MARKER_FILE = join(BOT_ROOT, ".bot-updated");

/** Determines current commit SHA from bot-version.json or git. */
export function getCurrentVersion(): VersionInfo {
  if (runningVersion) return runningVersion;

  // 1. Try bot-version.json
  if (existsSync(VERSION_FILE)) {
    try {
      const data = JSON.parse(readFileSync(VERSION_FILE, "utf-8")) as Partial<VersionInfo>;
      if (data.commit) {
        runningVersion = {
          version: data.version || "1.2.0",
          commit: data.commit,
          shortSha: data.shortSha || data.commit.slice(0, 7),
          message: data.message || "Manual build",
          author: data.author || "Unknown",
          timestamp: data.timestamp || new Date().toISOString(),
          branch: data.branch || config.githubBranch,
        };
        return runningVersion;
      }
    } catch {}
  }

  // 2. Try git rev-parse HEAD
  try {
    const sha = execSync("git rev-parse HEAD", { cwd: BOT_ROOT, stdio: ["ignore", "pipe", "ignore"], encoding: "utf-8" }).trim();
    if (sha && sha.length >= 7) {
      let message = "Git commit";
      let author = "Git";
      try {
        message = execSync("git log -1 --pretty=%B", { cwd: BOT_ROOT, stdio: ["ignore", "pipe", "ignore"], encoding: "utf-8" }).trim().split("\n")[0] || message;
        author = execSync("git log -1 --pretty=%an", { cwd: BOT_ROOT, stdio: ["ignore", "pipe", "ignore"], encoding: "utf-8" }).trim() || author;
      } catch {}

      runningVersion = {
        version: "1.2.0",
        commit: sha,
        shortSha: sha.slice(0, 7),
        message,
        author,
        timestamp: new Date().toISOString(),
        branch: config.githubBranch,
      };
      return runningVersion;
    }
  } catch {}

  // 3. Fallback
  runningVersion = {
    version: "1.2.0",
    commit: "unknown",
    shortSha: "unknown",
    message: "Standalone deployment",
    author: "Unknown",
    timestamp: new Date().toISOString(),
    branch: config.githubBranch,
  };
  return runningVersion;
}

/** Checks whether git repository is available for pulling. */
function hasGit(): boolean {
  try {
    const check1 = existsSync(join(BOT_ROOT, ".git"));
    const check2 = existsSync(join(BOT_ROOT, "..", ".git"));
    if (!check1 && !check2) return false;
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Checks GitHub for new bot updates. */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const current = getCurrentVersion();
  lastCheckAt = new Date();

  const headers: Record<string, string> = {
    "User-Agent": "Nexus-EMS-Bot-Updater",
    Accept: "application/vnd.github.v3+json",
  };
  if (config.githubToken) {
    headers["Authorization"] = `Bearer ${config.githubToken}`;
  }

  // Strategy 1: Check GitHub Release bot-latest metadata asset
  try {
    const releaseMetaUrl = `https://github.com/${config.githubRepo}/releases/download/bot-latest/bot-version.json`;
    const res = await fetch(releaseMetaUrl, { headers, redirect: "follow" });
    if (res.ok) {
      const data = (await res.json()) as VersionInfo;
      if (data.commit && data.commit.length >= 7) {
        const isNewer = current.commit !== "unknown" ? data.commit !== current.commit : true;
        const result: UpdateCheckResult = {
          available: isNewer,
          currentSha: current.commit,
          remoteSha: data.commit,
          shortSha: data.shortSha || data.commit.slice(0, 7),
          message: data.message || "Bot update",
          author: data.author || "GitHub Release",
          date: data.timestamp || new Date().toISOString(),
          downloadUrl: `https://github.com/${config.githubRepo}/releases/download/bot-latest/bot-bundle.tar.gz`,
          strategy: hasGit() ? "git" : "bundle",
        };
        lastCheckResult = result;
        return result;
      }
    }
  } catch {}

  // Strategy 2: Check GitHub Commits API for bot/ path
  try {
    const apiUrl = `https://api.github.com/repos/${config.githubRepo}/commits?path=bot&sha=${encodeURIComponent(config.githubBranch)}&per_page=1`;
    const res = await fetch(apiUrl, { headers });
    if (res.ok) {
      const list = (await res.json()) as Array<{
        sha: string;
        commit: {
          author?: { name?: string; date?: string };
          message?: string;
        };
      }>;
      if (Array.isArray(list) && list.length > 0 && list[0]?.sha) {
        const item = list[0];
        const remoteSha = item.sha;
        const isNewer = current.commit !== "unknown" ? remoteSha !== current.commit : true;
        const result: UpdateCheckResult = {
          available: isNewer,
          currentSha: current.commit,
          remoteSha,
          shortSha: remoteSha.slice(0, 7),
          message: item.commit.message?.split("\n")[0] || "Update bot",
          author: item.commit.author?.name || "GitHub",
          date: item.commit.author?.date || new Date().toISOString(),
          strategy: hasGit() ? "git" : "bundle",
        };
        lastCheckResult = result;
        return result;
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const result: UpdateCheckResult = {
      available: false,
      currentSha: current.commit,
      error: errorMsg,
    };
    lastCheckResult = result;
    return result;
  }

  const result: UpdateCheckResult = {
    available: false,
    currentSha: current.commit,
  };
  lastCheckResult = result;
  return result;
}

/** Executes the update, notifies staff log channel in IST, and restarts the process. */
export async function applyUpdate(client: Client, actorName?: string, force = false): Promise<{ success: boolean; error?: string }> {
  if (isUpdating) {
    return { success: false, error: "An update is already in progress." };
  }
  isUpdating = true;

  try {
    const check = await checkForUpdate();
    if (!force && !check.available && !check.remoteSha) {
      isUpdating = false;
      return { success: false, error: check.error || "No new update found." };
    }

    const current = getCurrentVersion();
    const targetSha = check.remoteSha || "latest";
    const shortSha = check.shortSha || targetSha.slice(0, 7);
    const commitMessage = check.message || "Automated bot update";
    const commitAuthor = check.author || "GitHub";

    console.log(`[updater] starting update to ${shortSha} (${commitMessage})...`);

    // Execute update strategy
    if (hasGit()) {
      console.log("[updater] using git pull strategy...");
      const gitCwd = existsSync(join(BOT_ROOT, ".git")) ? BOT_ROOT : join(BOT_ROOT, "..");
      execSync(`git fetch origin ${config.githubBranch}`, { cwd: gitCwd, stdio: "inherit" });
      execSync(`git checkout -B ${config.githubBranch} origin/${config.githubBranch}`, { cwd: gitCwd, stdio: "inherit" });

      // Install dependencies if package.json or package-lock changed
      console.log("[updater] checking dependencies & building TypeScript...");
      execSync("npm install --omit=dev --no-audit --no-fund", { cwd: BOT_ROOT, stdio: "inherit" });
      execSync("npm run build", { cwd: BOT_ROOT, stdio: "inherit" });
    } else {
      console.log("[updater] using bundle download strategy...");
      const bundleUrl = check.downloadUrl || `https://github.com/${config.githubRepo}/releases/download/bot-latest/bot-bundle.tar.gz`;
      const bundleRes = await fetch(bundleUrl);
      if (!bundleRes.ok) {
        throw new Error(`Failed to download bot bundle (${bundleRes.status} ${bundleRes.statusText})`);
      }
      const buffer = Buffer.from(await bundleRes.arrayBuffer());
      const tempArchive = join(BOT_ROOT, ".bot-update-bundle.tar.gz");
      writeFileSync(tempArchive, buffer);

      // Extract bundle over current directory
      execSync(`tar -xzf "${tempArchive}" -C "${BOT_ROOT}"`, { stdio: "inherit" });
      try {
        unlinkSync(tempArchive);
      } catch {}
    }

    // Write updated bot-version.json
    const newVersion: VersionInfo = {
      version: current.version,
      commit: targetSha,
      shortSha,
      message: commitMessage,
      author: commitAuthor,
      timestamp: new Date().toISOString(),
      branch: config.githubBranch,
    };
    writeFileSync(VERSION_FILE, JSON.stringify(newVersion, null, 2), "utf-8");

    // Write post-restart marker
    writeFileSync(
      MARKER_FILE,
      JSON.stringify(
        {
          previousSha: current.shortSha,
          newSha: shortSha,
          message: commitMessage,
          author: commitAuthor,
          updatedAt: new Date().toISOString(),
          updatedBy: actorName || "Auto-Updater",
        },
        null,
        2
      ),
      "utf-8"
    );

    // Notify Discord staff log channel
    if (config.logChannelId) {
      try {
        const channel = await client.channels.fetch(config.logChannelId);
        if (channel && channel.isSendable()) {
          const now = new Date();
          const embed = new EmbedBuilder()
            .setColor(COLORS.brand)
            .setTitle("🔄  Nexus EMS Bot · Updating")
            .setDescription(
              `The bot is applying an update to commit \`${shortSha}\` and restarting.\n` +
                `**Initiated by:** ${actorName || "Auto-Updater"}`
            )
            .addFields(
              { name: "Commit", value: `\`${shortSha}\` — ${commitMessage}`, inline: false },
              { name: "Author", value: commitAuthor, inline: true },
              { name: "Update Time (IST)", value: `\`${formatIST(now)}\``, inline: true }
            );
          await channel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error("[updater] failed to post updating embed to log channel:", err);
      }
    }

    console.log(`[updater] update to ${shortSha} completed. Restarting bot process...`);

    // Give Discord gateway a moment to flush outbound traffic
    setTimeout(async () => {
      try {
        await client.destroy();
      } catch {}
      process.exit(0);
    }, 1200);

    return { success: true };
  } catch (err) {
    isUpdating = false;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[updater] update failed:", errorMsg);

    if (config.logChannelId) {
      try {
        const channel = await client.channels.fetch(config.logChannelId);
        if (channel && channel.isSendable()) {
          const now = new Date();
          const embed = new EmbedBuilder()
            .setColor(COLORS.danger)
            .setTitle("❌  Nexus EMS Bot · Update Failed")
            .setDescription(`An error occurred while updating the bot:\n\`\`\`\n${errorMsg.slice(0, 500)}\n\`\`\``)
            .addFields({ name: "Time (IST)", value: `\`${formatIST(now)}\``, inline: true });
          await channel.send({ embeds: [embed] });
        }
      } catch {}
    }

    return { success: false, error: errorMsg };
  }
}

/** Called on ClientReady to notify Discord if a restart followed a successful update. */
export async function checkPostUpdate(client: Client) {
  if (!existsSync(MARKER_FILE)) return;

  try {
    const raw = readFileSync(MARKER_FILE, "utf-8");
    unlinkSync(MARKER_FILE);
    const data = JSON.parse(raw) as {
      previousSha: string;
      newSha: string;
      message: string;
      author: string;
      updatedAt: string;
      updatedBy: string;
    };

    if (config.logChannelId) {
      const channel = await client.channels.fetch(config.logChannelId);
      if (channel && channel.isSendable()) {
        const now = new Date();
        const embed = new EmbedBuilder()
          .setColor(COLORS.success)
          .setTitle("✅  Nexus EMS Bot · Update Complete")
          .setDescription(
            `The bot has successfully restarted and is now running commit \`${data.newSha}\`.\n` +
              `All commands, duty listeners, and scheduled announcements are live.`
          )
          .addFields(
            { name: "Previous Version", value: `\`${data.previousSha}\``, inline: true },
            { name: "Current Version", value: `\`${data.newSha}\``, inline: true },
            { name: "Triggered By", value: data.updatedBy, inline: true },
            { name: "Commit", value: data.message, inline: false },
            { name: "Ready Time (IST)", value: `\`${formatIST(now)}\``, inline: true }
          );
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error("[updater] error processing post-update marker:", err);
  }
}

/** Starts the background polling interval. */
export function startAutoUpdater(client: Client) {
  if (!config.autoUpdate) {
    console.log("[updater] auto-updater is disabled via BOT_AUTO_UPDATE=false.");
    return;
  }

  const intervalMs = config.autoUpdateIntervalMinutes * 60_000;
  console.log(`[updater] auto-updater active. Polling every ${config.autoUpdateIntervalMinutes} min for repository ${config.githubRepo}:${config.githubBranch}.`);

  // First check 45 seconds after startup
  setTimeout(async () => {
    try {
      const check = await checkForUpdate();
      if (check.available) {
        console.log(`[updater] initial check: new version available (${check.shortSha}). Updating...`);
        await applyUpdate(client, "Auto-Updater (Startup check)");
      }
    } catch (err) {
      console.warn("[updater] initial check error:", err);
    }
  }, 45_000);

  // Periodic polling
  setInterval(async () => {
    if (isUpdating) return;
    try {
      const check = await checkForUpdate();
      if (check.available) {
        console.log(`[updater] scheduled check: new version detected (${check.shortSha}). Auto-deploying...`);
        await applyUpdate(client, "Auto-Updater (Scheduled poll)");
      }
    } catch (err) {
      console.warn("[updater] scheduled poll error:", err);
    }
  }, intervalMs);
}

export function getUpdaterStatus() {
  return {
    enabled: config.autoUpdate,
    intervalMinutes: config.autoUpdateIntervalMinutes,
    lastCheckAt,
    lastCheckResult,
    currentVersion: getCurrentVersion(),
  };
}
