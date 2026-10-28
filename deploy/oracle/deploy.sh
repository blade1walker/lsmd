#!/usr/bin/env bash
# Builds the latest `main` into its own release folder and switches the site
# to it. Run as the lsmd user — by lsmd-update.timer every 2 minutes, or by
# hand:  sudo -u lsmd FORCE=1 bash /opt/lsmd/repo/deploy/oracle/deploy.sh
#
# The live site keeps serving the previous release while the new one builds,
# and if the new one does not answer after the restart, the previous release
# is put back. Does nothing when main has not changed (unless FORCE=1).
set -euo pipefail

APP=/opt/lsmd
REPO="$APP/repo"
LOCK="$APP/.deploy.lock"

exec 9>"$LOCK"
flock -n 9 || { echo "Another deploy is running."; exit 0; }

git -C "$REPO" fetch -q origin main
SHA=$(git -C "$REPO" rev-parse --short=10 origin/main)
CURRENT=$(readlink -f "$APP/current" 2>/dev/null || true)
DEST="$APP/releases/$SHA"

if [ "$CURRENT" = "$DEST" ] && [ -z "${FORCE:-}" ]; then
  exit 0
fi

echo "Deploying $SHA: $(git -C "$REPO" log -1 --format=%s origin/main)"
# Keep the checkout on main so the next run uses this version of the scripts.
git -C "$REPO" reset -q --hard origin/main

rm -rf "$DEST"
mkdir -p "$DEST"
git -C "$REPO" archive origin/main | tar -x -C "$DEST"
ln -sf "$APP/.env" "$DEST/.env"

cd "$DEST"
# The build (and the schema push it runs) reads settings from the environment.
set -a
# shellcheck disable=SC1091
. "$APP/.env"
set +a
export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

npm ci --no-audit --no-fund --include=dev
npm run build

PREVIOUS="$CURRENT"
ln -sfn "$DEST" "$APP/current"
sudo /usr/bin/systemctl restart lsmd

healthy=""
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:3000/; then healthy=1; break; fi
  sleep 2
done

if [ -z "$healthy" ]; then
  echo "New release $SHA did not answer — rolling back."
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$APP/current"
    sudo /usr/bin/systemctl restart lsmd
  fi
  exit 1
fi

echo "Live: $SHA"
# Keep the three newest releases for a quick manual rollback.
ls -1dt "$APP"/releases/*/ | tail -n +4 | xargs -r rm -rf
