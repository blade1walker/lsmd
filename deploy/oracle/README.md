# Hosting on Oracle Cloud (Always Free)

The site runs on one free Oracle Cloud VM (`lsmd-web`, Mumbai) at
<https://lsmd.tech>. The database is on Neon; images uploaded on the site are
kept on the VM itself, in `/opt/lsmd/data`.

What runs on the VM:

| Piece | Does |
| --- | --- |
| **Caddy** | Serves `https://lsmd.tech` (and redirects `www`), gets and renews the certificate on its own |
| **lsmd.service** | The website (`next start`), only reachable through Caddy |
| **lsmd-update.timer** | Every 2 minutes: pulls `main`, and when GitHub Actions has published a new build, downloads it, applies the database schema and switches over. The old version keeps serving until then, and a release that fails to start is rolled back |
| **lsmd-loa-expiry.timer** | 08:00 UTC daily: the LOA expiry job |
| **lsmd-bot.service** | The Discord bot (`bot/`), rebuilt by the update job whenever `bot/` changes on `main`. Switched on once its token is in `/opt/lsmd/bot.env` — see [`bot/README.md`](../../bot/README.md#hosting) |

## Auto-deploy

Pushing to `main` is the whole deploy:

1. `.github/workflows/oracle-build.yml` runs the unit tests and `next build`
   (with the type check), then uploads the result to the `oracle-build`
   release. A push that fails either never reaches the site.
2. Within 2 minutes `lsmd-update.timer` runs `deploy.sh`, which resets
   `/opt/lsmd/repo` to `origin/main`, rebuilds the bot if `bot/` changed, and
   deploys the new build if its commit differs from the live one.

Pushes that only touch `deploy/`, `bot/`, `fivem/` or Markdown skip the website
build; the VM still picks up the new scripts and bot on its next pass.

## Rebuilding the VM from scratch

1. **Create it.** In OCI **Cloud Shell**, run `create-vm.sh` with your SSH public
   key. It creates the network with ports 22/80/443 open, retries while Ampere
   is "Out of capacity", and prints the public IP:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/blade1walker/lsmd/main/deploy/oracle/create-vm.sh | bash -s -- "ssh-ed25519 AAAA... you"
   ```
2. **DNS.** Point the `A` records for `@` and `www` at the IP (Cloudflare, DNS only / grey cloud, so Caddy can get its certificate).
3. **Install.** SSH in (`ssh ubuntu@<ip>`) and run:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/blade1walker/lsmd/main/deploy/oracle/setup.sh | bash -s -- lsmd.tech
   ```
   The first run stops for the settings: restore `/opt/lsmd/.env` and
   `/opt/lsmd/bot.env` from your backup (or fill them in from `.env.example`),
   then run the same command again. It builds, starts everything and turns on
   auto-deploy.

`setup.sh` is safe to run again at any time — for example after a unit file in
this folder changes, since `deploy.sh` does not reinstall systemd units.

## Day to day

| Task | Command |
| --- | --- |
| Site logs | `journalctl -u lsmd -f` |
| Deploy logs | `journalctl -u lsmd-update -f` |
| Deploy now | `sudo -u lsmd FORCE=1 bash /opt/lsmd/repo/deploy/oracle/deploy.sh` |
| Change a setting | `sudo -u lsmd nano /opt/lsmd/.env`, then `sudo systemctl restart lsmd` |
| Roll back | `sudo systemctl stop lsmd-update.timer` (or it redeploys the newest build within 2 minutes), then `ls -dt /opt/lsmd/releases/*` → `sudo ln -sfn /opt/lsmd/releases/<older> /opt/lsmd/current && sudo systemctl restart lsmd`. Start the timer again once a fix is pushed |
| Pause auto-deploy | `sudo systemctl stop lsmd-update.timer` · resume with `start` |
| Run the LOA job now | `sudo systemctl start lsmd-loa-expiry` |
| Bot logs / restart | `journalctl -u lsmd-bot -f` · `sudo systemctl restart lsmd-bot` (after editing `/opt/lsmd/bot.env`) |
| Restart | `sudo systemctl restart lsmd` |

The Oracle Always Free VM has no automatic backups. Two things on it can't be
rebuilt from this repo — keep a copy of both somewhere safe:

- `/opt/lsmd/.env` and `/opt/lsmd/bot.env`, the settings;
- `/opt/lsmd/data/uploads`, the images uploaded in the Boss Menu
  (`sudo tar -czf lsmd-uploads.tgz -C /opt/lsmd data`).

The rest of the data lives in Neon.
