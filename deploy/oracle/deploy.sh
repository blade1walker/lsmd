#!/usr/bin/env bash
# Puts the latest `main` live in its own release folder and switches the site
# to it. Run as the lsmd user — by lsmd-update.timer every 2 minutes, or by
# hand:  sudo -u lsmd FORCE=1 bash /opt/lsmd/repo/deploy/oracle/deploy.sh
#
# The site is built by GitHub Actions (.github/workflows/oracle-build.yml) and
# published to the `oracle-build` release; this only downloads it, applies the
# database schema and switches over, so the 1 GB VM never builds and the live
# site never slows down. LOCAL_BUILD=1 builds on the VM instead (slow, 15+ min).
#
# The live site keeps serving the previous release until the new one is ready,
# and if the new one does not answer after the restart, the previous release
# is put back. Does nothing when there is nothing new (unless FORCE=1).
set -euo pipefail

# This file lives in the checkout that `git reset` below rewrites, and bash
# reads a script as it runs, so run from a private copy instead.
if [ -z "${LSMD_DEPLOY_COPY:-}" ]; then
  copy=$(mktemp)
  cp "$0" "$copy"
  LSMD_DEPLOY_COPY=1 exec bash "$copy" "$@"
fi
trap 'rm -f "$0"' EXIT

APP=/opt/lsmd
REPO="$APP/repo"
LOCK="$APP/.deploy.lock"
RELEASE_URL="${RELEASE_URL:-https://github.com/blade1walker/lsmd/releases/download/oracle-build}"

exec 9>"$LOCK"
flock -n 9 || { echo "Another deploy is running."; exit 0; }

# Keep the checkout on main so the next run uses the latest version of these scripts.
git -C "$REPO" fetch -q origin main
git -C "$REPO" reset -q --hard origin/main
CURRENT=$(readlink -f "$APP/current" 2>/dev/null || true)

load_env() {
  set -a
  # shellcheck disable=SC1091
  . "$APP/.env"
  set +a
  export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
  # No IPv6 route on the VM; Neon's IPv6 addresses would time out (see lsmd.service).
  export NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"
}

if [ -z "${LOCAL_BUILD:-}" ]; then
  # sha.txt is uploaded after the archive, so a new sha means its archive is complete.
  SHA=$(curl -fsSL --max-time 20 "$RELEASE_URL/sha.txt" 2>/dev/null | tr -d '[:space:]') || true
  [ -n "$SHA" ] || { echo "No published build yet (GitHub Actions still running?)."; exit 0; }
  DEST="$APP/releases/$SHA"
  if [ "$CURRENT" = "$DEST" ] && [ -z "${FORCE:-}" ]; then
    exit 0
  fi

  echo "Deploying $SHA (built by GitHub Actions)"
  TMP="$DEST.download"
  rm -rf "$TMP" && mkdir -p "$TMP"
  curl -fsSL --max-time 600 "$RELEASE_URL/lsmd.tar.gz" | tar -xz -C "$TMP"
  # A push mid-download can replace the archive; try again on the next run.
  if [ "$(cat "$TMP/BUILD_SHA" 2>/dev/null)" != "$SHA" ]; then
    echo "Archive does not match $SHA yet — retrying next run."
    rm -rf "$TMP"
    exit 0
  fi
  rm -rf "$DEST" && mv "$TMP" "$DEST"
  ln -sf "$APP/.env" "$DEST/.env"

  cd "$DEST"
  load_env
  # Schema push, permission grants and backfills; never fails the deploy.
  node scripts/deploy-schema.mjs
else
  SHA=$(git -C "$REPO" rev-parse --short=10 origin/main)
  DEST="$APP/releases/$SHA"
  if [ "$CURRENT" = "$DEST" ] && [ -z "${FORCE:-}" ]; then
    exit 0
  fi

  echo "Building $SHA on this VM: $(git -C "$REPO" log -1 --format=%s origin/main)"
  rm -rf "$DEST" && mkdir -p "$DEST"
  git -C "$REPO" archive origin/main | tar -x -C "$DEST"
  ln -sf "$APP/.env" "$DEST/.env"

  cd "$DEST"
  load_env
  # GitHub Actions type-checks every push; on this 1 GB VM the check alone takes 20+ minutes.
  export SKIP_TYPECHECK="${SKIP_TYPECHECK:-1}"
  npm ci --no-audit --no-fund --include=dev
  npm run build
fi

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
