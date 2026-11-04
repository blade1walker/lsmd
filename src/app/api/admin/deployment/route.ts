import { NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export interface DeploymentInfo {
  status: "active" | "unknown";
  environment: string;
  deployedAt: string;
  source: "vercel" | "git" | "fallback";
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
  vercel?: {
    deploymentId?: string;
    url?: string;
    target?: string;
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

  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const vercelCommitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const vercelCommitMsg = process.env.VERCEL_GIT_COMMIT_MESSAGE;
  const vercelBranch = process.env.VERCEL_GIT_COMMIT_REF;
  const vercelAuthor = process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME;
  const vercelRepo = process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : "blade1walker/lsmd";

  const gitLocal = getLocalGitCommit();

  const sha = vercelCommitSha || gitLocal?.sha || "25b2ca35a2b94776aab451767171f85d8844bc12";
  const shortSha = sha.slice(0, 7);
  const message = vercelCommitMsg || gitLocal?.message || "fix: refuse usernames as Discord IDs; never post a raw <@username>";
  const author = vercelAuthor || gitLocal?.author || "blade1walker";
  const branch = vercelBranch || gitLocal?.branch || "main";
  const date = gitLocal?.date || new Date().toISOString();
  const repo = vercelRepo || "blade1walker/lsmd";
  const commitUrl = `https://github.com/${repo}/commit/${sha}`;

  const info: DeploymentInfo = {
    status: "active",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "production",
    deployedAt: process.env.VERCEL ? new Date().toISOString() : date,
    source: isVercel && vercelCommitSha ? "vercel" : gitLocal ? "git" : "fallback",
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
    vercel: isVercel
      ? {
          deploymentId: process.env.VERCEL_DEPLOYMENT_ID || undefined,
          url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
          target: process.env.VERCEL_ENV || "production",
        }
      : undefined,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.floor(process.uptime()),
    },
  };

  return NextResponse.json(info);
}
