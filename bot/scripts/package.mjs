// `npm run package` — builds nexus-ems-bot.zip, ready to upload to a host.
//
// Leaves out node_modules (the host installs its own; a copy built on Windows
// breaks on a Linux host) and .env (it holds the bot token). Pass --with-env to
// include .env for a panel where you upload files instead of setting variables.
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "nexus-ems-bot.zip");
const withEnv = process.argv.includes("--with-env");

execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", root], { stdio: "inherit" });

const files = ["index.js", "package.json", "package-lock.json", "tsconfig.json", "src", "dist", "scripts", "README.md", ".env.example", "Dockerfile", ".dockerignore", ".gitignore"];
if (withEnv) {
  if (!existsSync(join(root, ".env"))) {
    console.error("--with-env was given, but there is no .env file.");
    process.exit(1);
  }
  files.push(".env");
}

if (existsSync(out)) rmSync(out);
const present = files.filter((f) => existsSync(join(root, f)));
const name = "nexus-ems-bot.zip";
try {
  if (process.platform === "win32") {
    // Windows' own bsdtar writes zips (-a picks the format from the name). Called
    // by full path: Git Bash puts GNU tar first on PATH, which cannot.
    const tar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
    execFileSync(tar, ["-a", "-c", "-f", name, ...present], { cwd: root, stdio: "inherit" });
  } else {
    execFileSync("zip", ["-r", "-q", name, ...present], { cwd: root, stdio: "inherit" });
  }
} catch {
  console.error("Could not create the zip — zip these files by hand instead:\n  " + files.join("\n  "));
  process.exit(1);
}

console.log(`\nCreated ${out}${withEnv ? " (includes .env — keep it private)" : ""}`);
console.log("Upload it, then on the host run:  npm install  and  npm start");
