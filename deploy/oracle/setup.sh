#!/usr/bin/env bash
# One-time setup of the LSMD website on a fresh Oracle Cloud (Always Free)
# Ubuntu VM. Run as the default `ubuntu` user:
#
#   curl -fsSL https://raw.githubusercontent.com/blade1walker/lsmd/main/deploy/oracle/setup.sh | bash -s -- your.domain.com
#
# It installs Node.js 22 and Caddy (HTTPS), opens ports 80/443 in the VM's
# firewall, adds swap on small machines, creates an `lsmd` service user, clones
# the repo to /opt/lsmd, and installs these systemd units:
#   lsmd.service           the website (next start on 127.0.0.1:3000)
#   lsmd-update.timer      every 2 minutes: deploy main if it has new commits
#   lsmd-loa-expiry.timer  daily 08:00 UTC: the LOA expiry job
#   lsmd-bot.service       the Discord bot — installed here, switched on once
#                          its token is in /opt/lsmd/bot.env (see the end)
#
# Safe to run again — every step checks before it changes anything.
set -euo pipefail

DOMAIN="${1:-}"
REPO="${2:-https://github.com/blade1walker/lsmd.git}"
APP=/opt/lsmd

if [ -z "$DOMAIN" ]; then
  echo "usage: setup.sh <domain> [repo-url]"
  echo "  No domain yet? Use <your-public-ip-with-dashes>.sslip.io, e.g. 140-238-1-2.sslip.io"
  exit 1
fi

say() { printf '\n\033[1;31m==>\033[0m %s\n' "$*"; }

say "Installing packages"
sudo apt-get update -qq
sudo apt-get install -y -qq git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https >/dev/null

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
fi
node -v

if ! command -v caddy >/dev/null; then
  say "Installing Caddy (automatic HTTPS)"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy >/dev/null
fi

# Oracle's Ubuntu images ship an iptables policy that rejects everything but
# SSH, on top of the VCN security list. Both have to allow 80/443.
say "Opening ports 80 and 443 in the VM firewall"
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 1 -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT
  fi
done
if command -v netfilter-persistent >/dev/null; then sudo netfilter-persistent save >/dev/null; fi

# `next build` needs ~2 GB. The 1 GB AMD micro shape cannot build without swap.
if [ "$(free -m | awk '/Mem:/ {print $2}')" -lt 6000 ] && ! swapon --show | grep -q /swapfile; then
  say "Adding a 4 GB swap file"
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

say "Creating the lsmd user and $APP"
id lsmd >/dev/null 2>&1 || sudo useradd --system --create-home --home-dir /home/lsmd --shell /bin/bash lsmd
sudo mkdir -p "$APP/releases"
sudo chown -R lsmd:lsmd "$APP"
if [ ! -d "$APP/repo/.git" ]; then
  sudo -u lsmd git clone -q "$REPO" "$APP/repo"
fi
sudo -u lsmd git -C "$APP/repo" fetch -q origin main
sudo -u lsmd git -C "$APP/repo" reset -q --hard origin/main

if [ ! -f "$APP/.env" ]; then
  sudo -u lsmd cp "$APP/repo/.env.example" "$APP/.env"
  sudo -u lsmd sed -i "s#^NEXTAUTH_URL=.*#NEXTAUTH_URL=\"https://$DOMAIN\"#" "$APP/.env"
  sudo chmod 600 "$APP/.env"
  NEW_ENV=1
fi
if [ ! -f "$APP/bot.env" ]; then
  # The bot reaches the website on this machine directly.
  sudo -u lsmd cp "$APP/repo/bot/.env.example" "$APP/bot.env"
  sudo -u lsmd sed -i 's#^WEBSITE_URL=.*#WEBSITE_URL="http://127.0.0.1:3000"#' "$APP/bot.env"
  sudo chmod 600 "$APP/bot.env"
fi

say "Installing services"
sudo cp "$APP/repo/deploy/oracle/lsmd.service" "$APP/repo/deploy/oracle/lsmd-update.service" \
        "$APP/repo/deploy/oracle/lsmd-update.timer" "$APP/repo/deploy/oracle/lsmd-loa-expiry.service" \
        "$APP/repo/deploy/oracle/lsmd-loa-expiry.timer" "$APP/repo/deploy/oracle/lsmd-bot.service" /etc/systemd/system/
# The update job restarts the site as lsmd, so lsmd may restart it — and nothing else.
echo "lsmd ALL=(root) NOPASSWD: /usr/bin/systemctl restart lsmd, /usr/bin/systemctl restart lsmd.service" | sudo tee /etc/sudoers.d/lsmd >/dev/null
sudo chmod 440 /etc/sudoers.d/lsmd
sudo systemctl daemon-reload

sed "s/{{DOMAIN}}/$DOMAIN/g" "$APP/repo/deploy/oracle/Caddyfile" | sudo tee /etc/caddy/Caddyfile >/dev/null
# A root domain (lsmd.tech, not ems.lsmd.tech) also gets www.<domain> redirected to it.
if [ "$(tr -cd . <<<"$DOMAIN" | wc -c)" = 1 ]; then
  printf '\nwww.%s {\n\tredir https://%s{uri} permanent\n}\n' "$DOMAIN" "$DOMAIN" | sudo tee -a /etc/caddy/Caddyfile >/dev/null
fi
sudo systemctl reload caddy || sudo systemctl restart caddy

# The database is DATABASE_URL, or the NEON_* variables — see src/lib/db/database-url.ts.
if [ "${NEW_ENV:-}" = 1 ] || ! sudo grep -qE '^(DATABASE_URL|NEON_URL|NEON_DATABASE_URL|NEON_POSTGRES_PRISMA_URL|NEON_POSTGRES_URL)="?postgres' "$APP/.env"; then
  say "Almost done — fill in the settings, then finish"
  cat <<EOF
  1. Fill in the settings (.env.example in the repo explains each one):
       sudo -u lsmd nano $APP/.env
     NEXTAUTH_URL is already set to https://$DOMAIN.
  2. Add  https://$DOMAIN/api/auth/callback/discord  under Discord Developer Portal -> OAuth2 -> Redirects.
  3. Run this script again to build and start the site:
       bash $APP/repo/deploy/oracle/setup.sh $DOMAIN
EOF
  exit 0
fi

say "Building and starting the site (first build takes a few minutes)"
sudo -u lsmd FORCE=1 bash "$APP/repo/deploy/oracle/deploy.sh"
sudo systemctl enable --now lsmd.service lsmd-update.timer lsmd-loa-expiry.timer >/dev/null

say "Done: https://$DOMAIN"
echo "  Logs:    journalctl -u lsmd -f"
echo "  Deploys: journalctl -u lsmd-update -f   (main is deployed within 2 minutes of a push)"
if sudo grep -qE '^DISCORD_TOKEN="?[A-Za-z0-9]' "$APP/bot.env"; then
  sudo systemctl enable --now lsmd-bot.service >/dev/null
  echo "  Bot:     journalctl -u lsmd-bot -f"
else
  echo "  Bot:     put its token in $APP/bot.env (sudo -u lsmd nano $APP/bot.env),"
  echo "           then: sudo systemctl enable --now lsmd-bot"
fi
