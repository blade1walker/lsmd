// Nexus EMS Bot — entry point & process supervisor.
//
// Builds the TypeScript source when there is no compiled copy yet (or the
// source is newer), then starts the bot. If the bot requests a restart
// (e.g. after an automatic update) by exiting cleanly with code 0, this supervisor
// rebuilds if necessary and relaunches automatically.
import { existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync, fork } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "dist", "index.js");

// Pre-load .env so supervisor and child environment variables match
try {
  const dotenv = await import("dotenv");
  const envCandidates = [
    join(process.cwd(), ".env"),
    join(here, ".env"),
    join(here, "..", ".env"),
    join(process.cwd(), "bot.env"),
    join(here, "bot.env"),
    "/home/container/.env",
    "/home/container/bot/.env",
    "/opt/lsmd/bot.env",
  ];
  for (const p of envCandidates) {
    if (existsSync(p)) {
      dotenv.config({ path: p });
    }
  }
} catch {}

function newestSource(dir) {
  let newest = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    newest = Math.max(newest, stat.isDirectory() ? newestSource(path) : stat.mtimeMs);
  }
  return newest;
}

function ensureBuild() {
  const canBuild = existsSync(join(here, "node_modules", "typescript"));
  const stale = !existsSync(entry) || (existsSync(join(here, "src")) && newestSource(join(here, "src")) > statSync(entry).mtimeMs);

  if (!existsSync(join(here, "node_modules", "discord.js"))) {
    console.error("\n  Dependencies are not installed. Run `npm install` in this folder first, then `npm start`.\n");
    process.exit(1);
  }

  if (stale && !canBuild && existsSync(entry)) {
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
}

process.chdir(here);

let activeChild = null;
let shuttingDown = false;
let consecutiveRapidRestarts = 0;
let lastLaunchTime = 0;

function launch() {
  ensureBuild();

  lastLaunchTime = Date.now();
  activeChild = fork(entry, {
    cwd: here,
    stdio: "inherit",
    env: process.env,
  });

  activeChild.on("exit", (code, signal) => {
    if (shuttingDown) return;

    const runtime = Date.now() - lastLaunchTime;
    if (runtime < 5000) {
      consecutiveRapidRestarts++;
    } else {
      consecutiveRapidRestarts = 0;
    }

    if (consecutiveRapidRestarts >= 5) {
      console.error("\n[supervisor] Bot exited repeatedly within 5s. Aborting relaunch to prevent loop.\n");
      process.exit(1);
    }

    if (code === 0) {
      console.log("\n[supervisor] Bot exited cleanly (code 0: update or restart requested). Relaunching in 2s...\n");
      setTimeout(() => {
        launch();
      }, 2000);
      return;
    }

    if (signal) {
      console.error(`\n[supervisor] Bot terminated by signal ${signal}.\n`);
      process.exit(1);
    }

    console.error(`\n[supervisor] Bot exited with error code ${code}.\n`);
    process.exit(code ?? 1);
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    shuttingDown = true;
    if (activeChild) {
      const forceTimer = setTimeout(() => {
        try {
          activeChild.kill("SIGKILL");
        } catch {}
        process.exit(0);
      }, 5000);
      activeChild.once("exit", () => {
        clearTimeout(forceTimer);
        process.exit(0);
      });
      activeChild.kill(sig);
    } else {
      process.exit(0);
    }
  });
}

launch();
