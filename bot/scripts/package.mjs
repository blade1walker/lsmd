// `npm run package` — builds nexus-ems-bot.zip, ready to upload to a host.
//
// The zip is complete: the built bot (dist) plus its production dependencies
// (node_modules — pure JavaScript, so a copy made on Windows runs on Linux). A
// host then needs nothing but Node.js: no npm install, no compiler, and far
// less disk than installing on the host.
//
// Leaves out .env (it holds the bot token). Pass --with-env to include it, for
// a panel where you upload files instead of setting variables.
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = "nexus-ems-bot.zip";
const out = join(root, name);
const withEnv = process.argv.includes("--with-env");

execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", root], { stdio: "inherit" });

const files = [
  "index.js", "app.py", "bot.py", "main.py", "requirements.txt",
  "package.json", "package-lock.json", "tsconfig.json", "src", "dist", "scripts",
  "README.md", ".env.example", "Dockerfile", ".dockerignore", ".gitignore",
];
if (withEnv) {
  if (!existsSync(join(root, ".env"))) {
    console.error("--with-env was given, but there is no .env file.");
    process.exit(1);
  }
  files.push(".env");
}

// Stage a copy and install only what the bot needs at run time into it.
const stage = mkdtempSync(join(tmpdir(), "nexus-ems-bot-"));
try {
  const present = files.filter((f) => existsSync(join(root, f)));
  for (const f of present) cpSync(join(root, f), join(stage, f), { recursive: true, preserveTimestamps: true });

  const npmCli = process.env.npm_execpath;
  if (npmCli) {
    execFileSync(process.execPath, [npmCli, "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: stage, stdio: "inherit" });
  } else {
    execFileSync("npm ci --omit=dev --ignore-scripts --no-audit --no-fund", { cwd: stage, stdio: "inherit", shell: true });
  }

  const contents = [...present, "node_modules"];
  if (process.platform === "win32") {
    // Windows' own bsdtar writes zips (-a picks the format from the name). Called
    // by full path: Git Bash puts GNU tar first on PATH, which cannot.
    const tar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
    execFileSync(tar, ["-a", "-c", "-f", name, ...contents], { cwd: stage, stdio: "inherit" });
  } else {
    execFileSync("zip", ["-r", "-q", name, ...contents], { cwd: stage, stdio: "inherit" });
  }
  if (existsSync(out)) rmSync(out);
  copyFileSync(join(stage, name), out);
} catch (err) {
  console.error("Could not create the zip:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  rmSync(stage, { recursive: true, force: true });
}

if (!process.exitCode) {
  console.log(`\nCreated ${out}${withEnv ? " (includes .env — keep it private)" : ""}`);
  console.log("Python server: upload, unzip, press Start (app.py runs it).");
  console.log("Node.js server: upload, unzip, then `node index.js` — no npm install needed.");
}
