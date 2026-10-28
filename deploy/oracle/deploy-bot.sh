#!/usr/bin/env bash
# Builds the Discord bot from bot/ on main and swaps it in when that folder
# has changed since the last build. Run by deploy.sh on every pass (as the
# lsmd user), so a push that only touches bot/ still reaches the VM. Does
# nothing until the bot has been set up here (/opt/lsmd/bot.env).
#
# The new build is made beside the running one and only replaces it once it
# has built; a failed build leaves the running bot alone.
set -euo pipefail

APP="${LSMD_APP:-/opt/lsmd}"
REPO="$APP/repo"
BOT="$APP/bot"

[ -f "$APP/bot.env" ] || exit 0

TREE=$(git -C "$REPO" rev-parse origin/main:bot)
if [ "$(cat "$BOT/.tree" 2>/dev/null)" = "$TREE" ] && [ -z "${FORCE:-}" ]; then
  exit 0
fi

echo "Building the bot ($TREE)"
NEW="$BOT.new"
rm -rf "$NEW" && mkdir -p "$NEW"
git -C "$REPO" archive origin/main bot | tar -x --strip-components=1 -C "$NEW"
(
  cd "$NEW"
  npm ci --no-audit --no-fund --loglevel=error
  npm run build --silent
  npm prune --omit=dev --no-audit --no-fund --loglevel=error
)
echo "$TREE" > "$NEW/.tree"

rm -rf "$BOT.old"
if [ -d "$BOT" ]; then mv "$BOT" "$BOT.old"; fi
mv "$NEW" "$BOT"

# Stop the running bot; systemd starts the new build (Restart=always).
PID=$(systemctl show -p MainPID --value lsmd-bot 2>/dev/null || echo 0)
if [ "${PID:-0}" != 0 ]; then
  kill -TERM "$PID"
  echo "Bot updated and restarting."
else
  echo "Bot built. Start it with: sudo systemctl enable --now lsmd-bot"
fi
