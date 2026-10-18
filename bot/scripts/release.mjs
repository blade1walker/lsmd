// `npm run release` — publishes the ready-to-run bot to the `bot-release`
// branch on GitHub, for hosts that install from a git repository.
//
// The branch holds what nexus-ems-bot.zip holds (see stage.mjs), at its root:
// a panel clones it once, and its start command (`git pull`, then
// `python app.py`) picks up each new release on the next restart. Nothing is
// installed or built on the host.
//
// Each release is a new commit on top of the last one — never a rewrite — so
// the host's `git pull` always fast-forwards. The repository is public: .env
// is never included, and the branch ignores it so the host's copy is kept.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root, stage } from "./stage.mjs";

const BRANCH = "bot-release";
// The host runs the built copy; the source and build tooling stay on main.
const LEAVE_OUT = new Set(["src", "tsconfig.json", "scripts", "Dockerfile", ".dockerignore", ".gitignore"]);
const IGNORE = [
  "# Files the host makes for itself — kept across `git pull`.",
  ".env",
  ".node/",
  ".node.download",
  ".local/",
  ".cache/",
  "__pycache__/",
  "*.log",
  "",
].join("\n");

const git = (args, cwd = root) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const source = git(["rev-parse", "--short", "HEAD"]);
if (git(["status", "--porcelain", "--", "."])) {
  console.warn("[release] bot/ has uncommitted changes — they are included, but main on GitHub will not have them.");
}

const exists = (() => {
  try {
    git(["fetch", "origin", BRANCH]);
    return true;
  } catch {
    return false;
  }
})();

const { dir, contents } = stage();
const tree = mkdtempSync(join(tmpdir(), "nexus-ems-release-"));
let added = false;
try {
  if (exists) {
    git(["worktree", "add", "--force", "-B", BRANCH, tree, `origin/${BRANCH}`]);
  } else {
    git(["worktree", "add", "--force", "--detach", tree]);
    git(["checkout", "--orphan", BRANCH], tree);
  }
  added = true;

  for (const name of readdirSync(tree)) if (name !== ".git") rmSync(join(tree, name), { recursive: true, force: true });
  for (const name of contents) if (!LEAVE_OUT.has(name)) cpSync(join(dir, name), join(tree, name), { recursive: true });
  writeFileSync(join(tree, ".gitignore"), IGNORE);
  // The website's Vercel project builds every branch pushed to this repo, and
  // this one has no website in it — every release failed with "No Next.js
  // version detected". Vercel reads this from the branch it would build.
  writeFileSync(join(tree, "vercel.json"), JSON.stringify({ git: { deploymentEnabled: false } }, null, 2) + "\n");

  git(["add", "-A"], tree);
  if (!git(["status", "--porcelain"], tree)) {
    console.log(`\n[release] ${BRANCH} already matches this build — nothing to publish.`);
  } else {
    git(["commit", "-q", "-m", `release: Nexus EMS Bot from ${source}`], tree);
    git(["push", "origin", `${BRANCH}:${BRANCH}`], tree);
    console.log(`\n[release] Published to ${BRANCH} (${git(["rev-parse", "--short", "HEAD"], tree)}).`);
    console.log("[release] Restart the bot on the host to pick it up.");
  }
} catch (err) {
  console.error("[release] Could not publish:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  if (added) {
    try {
      git(["worktree", "remove", "--force", tree]);
    } catch {
      rmSync(tree, { recursive: true, force: true });
      git(["worktree", "prune"]);
    }
  } else {
    rmSync(tree, { recursive: true, force: true });
  }
  rmSync(dir, { recursive: true, force: true });
}
