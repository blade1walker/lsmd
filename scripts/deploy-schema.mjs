import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

/**
 * Gets the database ready for this release — see scripts/db-deploy.ts for
 * what that involves. Run on every deploy by deploy/oracle/deploy.sh (and
 * kept under this name so a server still running an older copy of deploy.sh
 * calls it too).
 *
 * The database driver is a native module. The release is built on GitHub's
 * x64 machines; on a server of another kind (an ARM Oracle VM) its compiled
 * part does not load, so it is fetched for this machine first.
 *
 * Exits non-zero if the database could not be made ready, which stops the
 * deploy before the new release goes live.
 */

if (process.env.SKIP_DB_PUSH === "1") {
  console.log("[db] SKIP_DB_PUSH=1 — leaving the database alone.");
  process.exit(0);
}

const require = createRequire(import.meta.url);
try {
  const Database = require("better-sqlite3");
  new Database(":memory:").close();
} catch {
  console.log("[db] The SQLite driver was built for another machine; fetching one for this machine…");
  execFileSync("npm", ["rebuild", "better-sqlite3", "--no-audit", "--no-fund"], { stdio: "inherit", timeout: 5 * 60_000 });
}

try {
  execFileSync("npx", ["tsx", "scripts/db-deploy.ts"], { stdio: "inherit", timeout: 20 * 60_000 });
} catch {
  process.exit(1);
}
