#!/usr/bin/env bash
# Starts the website: check the settings, apply the database schema, serve.
# Used by the Dockerfile; also works by hand on any machine after `npm ci` and
# `npm run build`:  bash deploy/start.sh
set -euo pipefail
cd "$(dirname "$0")/.."

node deploy/check-env.mjs
# Never fails the start — see the comment at the top of the script.
node scripts/deploy-schema.mjs
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
