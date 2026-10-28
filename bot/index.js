// Nexus EMS Bot — entry point.
//
// Builds the TypeScript source when there is no compiled copy yet (or the
// source is newer), then starts the bot — so `npm start` works straight after
// `npm install`. On the Oracle VM the build is made in advance
// (deploy/oracle/deploy-bot.sh) and this only starts it.
import { existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "dist", "index.js");

function newestSource(dir) {
  let newest = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    newest = Math.max(newest, stat.isDirectory() ? newestSource(path) : stat.mtimeMs);
  }
  return newest;
}

const stale = !existsSync(entry) || (existsSync(join(here, "src")) && newestSource(join(here, "src")) > statSync(entry).mtimeMs);

const canBuild = existsSync(join(here, "node_modules", "typescript"));

if (!existsSync(join(here, "node_modules", "discord.js"))) {
  console.error("\n  Dependencies are not installed. Run `npm install` in this folder first, then `npm start`.\n");
  process.exit(1);
}

if (stale && !canBuild && existsSync(entry)) {
  // An install without the compiler (production dependencies only) runs the built copy.
  console.warn("[start] src/ looks newer than dist/, but TypeScript is not installed here — running the built copy.");
} else if (stale) {
  if (!canBuild) {
    console.error("\n  The bot has not been built. Run `npm install` (it includes the compiler), then `npm start`.\n");
    process.exit(1);
  }
  console.log("Building Nexus EMS Bot…");
  try {
    execFileSync(process.execPath, [join(here, "node_modules", "typescript", "bin", "tsc"), "-p", here], { stdio: "inherit" });
  } catch {
    console.error("\n  The build failed — see the errors above.\n");
    process.exit(1);
  }
}

// dotenv reads .env from the working directory; start from the bot's folder
// so it is found even when started from somewhere else.
process.chdir(here);
await import("./dist/index.js");
