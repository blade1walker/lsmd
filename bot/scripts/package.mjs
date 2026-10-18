// `npm run package` — builds nexus-ems-bot.zip, ready to upload to a host.
//
// The zip is complete — see stage.mjs. A host needs nothing but Node.js.
//
// Leaves out .env (it holds the bot token). Pass --with-env to include it, for
// a panel where you upload files instead of setting variables.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { root, stage } from "./stage.mjs";

const name = "nexus-ems-bot.zip";
const out = join(root, name);
const withEnv = process.argv.includes("--with-env");

if (withEnv && !existsSync(join(root, ".env"))) {
  console.error("--with-env was given, but there is no .env file.");
  process.exit(1);
}

const { dir, contents } = stage(withEnv ? [".env"] : []);
try {
  if (process.platform === "win32") {
    // Windows' own bsdtar writes zips (-a picks the format from the name). Called
    // by full path: Git Bash puts GNU tar first on PATH, which cannot.
    const tar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
    execFileSync(tar, ["-a", "-c", "-f", name, ...contents], { cwd: dir, stdio: "inherit" });
  } else {
    execFileSync("zip", ["-r", "-q", name, ...contents], { cwd: dir, stdio: "inherit" });
  }
  if (existsSync(out)) rmSync(out);
  copyFileSync(join(dir, name), out);
} catch (err) {
  console.error("Could not create the zip:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (!process.exitCode) {
  console.log(`\nCreated ${out}${withEnv ? " (includes .env — keep it private)" : ""}`);
  console.log("Python server: upload, unzip, press Start (app.py runs it).");
  console.log("Node.js server: upload, unzip, then `node index.js` — no npm install needed.");
}
