#!/usr/bin/env bash
# Starts the website: check the settings, get the database ready (backup,
# migrations, and the first time, the copy from the old Postgres database), serve.
# Used by the Dockerfile; also works by hand on any machine after `npm ci` and
# `npm run build`:  bash deploy/start.sh
set -euo pipefail
cd "$(dirname "$0")/.."

node deploy/check-env.mjs
# Refuses to start on a database it could not get ready, rather than run on a broken one.
node scripts/deploy-schema.mjs
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
