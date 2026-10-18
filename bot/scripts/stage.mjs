// Builds a ready-to-run copy of the bot in a temporary folder — shared by
// `npm run package` (zips it) and `npm run release` (pushes it to GitHub).
//
// The copy is complete: the built bot (dist) plus its production dependencies
// (node_modules — pure JavaScript, so a copy made on Windows runs on Linux). A
// host then needs nothing but Node.js: no npm install, no compiler, and far
// less disk than installing on the host.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const FILES = [
  "index.js", "app.py", "bot.py", "main.py", "requirements.txt",
  "package.json", "package-lock.json", "tsconfig.json", "src", "dist", "scripts",
  "README.md", ".env.example", "Dockerfile", ".dockerignore", ".gitignore",
];

/** Builds the bot and stages it with its run-time dependencies. Returns the folder and what it holds. */
export function stage(extra = []) {
  execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", root], { stdio: "inherit" });

  const dir = mkdtempSync(join(tmpdir(), "nexus-ems-bot-"));
  const present = [...FILES, ...extra].filter((f) => existsSync(join(root, f)));
  for (const f of present) cpSync(join(root, f), join(dir, f), { recursive: true, preserveTimestamps: true });

  const npmCli = process.env.npm_execpath;
  if (npmCli) {
    execFileSync(process.execPath, [npmCli, "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: dir, stdio: "inherit" });
  } else {
    execFileSync("npm ci --omit=dev --ignore-scripts --no-audit --no-fund", { cwd: dir, stdio: "inherit", shell: true });
  }
  return { dir, contents: [...present, "node_modules"] };
}
