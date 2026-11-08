import { NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export interface DeploymentInfo {
  status: "active" | "unknown";
  environment: string;
  deployedAt: string;
  source: "git" | "fallback";
  commit: {
    sha: string;
    shortSha: string;
    message: string;
    author?: string;
    date?: string;
    branch?: string;
    repo?: string;
    url?: string;
  };
  system: {
    nodeVersion: string;
    platform: string;
    uptimeSeconds: number;
  };
}

function getLocalGitCommit() {
  try {
    const sha = execSync("git rev-parse HEAD", { encoding: "utf8", timeout: 1500 }).trim();
    const shortSha = sha.slice(0, 7);
    const message = execSync("git log -1 --pretty=%s", { encoding: "utf8", timeout: 1500 }).trim();
    const author = execSync("git log -1 --pretty=%an", { encoding: "utf8", timeout: 1500 }).trim();
    const date = execSync("git log -1 --pretty=%cd --date=iso", { encoding: "utf8", timeout: 1500 }).trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", timeout: 1500 }).trim();
    return { sha, shortSha, message, author, date, branch };
  } catch {
    for (const dir of ["/opt/lsmd/repo", "D:/lsmd"]) {
      try {
        const sha = execSync(`git -C ${dir} rev-parse HEAD`, { encoding: "utf8", timeout: 1500 }).trim();
        const shortSha = sha.slice(0, 7);
        const message = execSync(`git -C ${dir} log -1 --pretty=%s`, { encoding: "utf8", timeout: 1500 }).trim();
        const author = execSync(`git -C ${dir} log -1 --pretty=%an`, { encoding: "utf8", timeout: 1500 }).trim();
        const date = execSync(`git -C ${dir} log -1 --pretty=%cd --date=iso`, { encoding: "utf8", timeout: 1500 }).trim();
        const branch = execSync(`git -C ${dir} rev-parse --abbrev-ref HEAD`, { encoding: "utf8", timeout: 1500 }).trim();
        return { sha, shortSha, message, author, date, branch };
      } catch {
        // try next
      }
    }
    return null;
  }
}

export async function GET() {
  const auth = await requireAuth("audit.view");
  if (isDenied(auth)) return auth.error;

  const gitLocal = getLocalGitCommit();

  const sha = gitLocal?.sha || "25b2ca35a2b94776aab451767171f85d8844bc12";
  const shortSha = sha.slice(0, 7);
  const message = gitLocal?.message || "fix: refuse usernames as Discord IDs; never post a raw <@username>";
  const author = gitLocal?.author || "blade1walker";
  const branch = gitLocal?.branch || "main";
  const date = gitLocal?.date || new Date().toISOString();
  const repo = "blade1walker/lsmd";
  const commitUrl = `https://github.com/${repo}/commit/${sha}`;

  const info: DeploymentInfo = {
    status: "active",
    environment: process.env.NODE_ENV || "production",
    deployedAt: date,
    source: gitLocal ? "git" : "fallback",
    commit: {
      sha,
      shortSha,
      message,
      author,
      date,
      branch,
      repo,
      url: commitUrl,
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.floor(process.uptime()),
    },
  };

  return NextResponse.json(info);
}
