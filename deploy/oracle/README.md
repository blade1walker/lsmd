# Hosting the website on Oracle Cloud (Always Free)

This runs the site on one free Oracle Cloud VM instead of Vercel. The
database stays on Neon and image uploads stay on Vercel Blob — both work from
any server, so no data moves.

What runs on the VM:

| Piece | Does |
| --- | --- |
| **Caddy** | Serves `https://your-domain`, gets and renews the certificate on its own |
| **lsmd.service** | The website (`next start`), only reachable through Caddy |
| **lsmd-update.timer** | Every 2 minutes: if `main` has new commits, builds them and switches over. The old version keeps serving during the build, and a release that fails to start is rolled back |
| **lsmd-loa-expiry.timer** | 08:00 UTC daily: the LOA expiry job that `vercel.json` used to schedule |

Pushing to `main` still deploys the site — it just lands on the VM within
about 2 minutes instead of on Vercel.

## 1. Create the VM

1. Sign up at <https://www.oracle.com/cloud/free/>. A card is needed for identity checks; Always Free resources are never charged.
2. **Compute → Instances → Create instance**:
   - **Image:** Canonical Ubuntu 24.04.
   - **Shape:** *Ampere* → `VM.Standard.A1.Flex`, **2 OCPU / 12 GB** (free up to 4 OCPU / 24 GB).
     If Oracle says "Out of capacity", try another availability domain, try again later, or use
     `VM.Standard.E2.1.Micro` (1 GB — works, the setup adds swap, but builds are slow).
   - **Networking:** keep "Assign a public IPv4 address" on.
   - **SSH keys:** upload your public key, or download the generated private key and keep it safe.
3. Open the ports: the instance's **Subnet → Security List → Add Ingress Rules**: source `0.0.0.0/0`, TCP, destination ports `80` and `443`.
4. Optional but recommended: **Reserved public IP** (Networking → IP Management), so the address never changes.

## 2. Point a domain at it

Create an `A` record for your domain (e.g. `ems.example.com`) pointing to the VM's public IP.

No domain? Use the free `sslip.io` name for the IP — for `140.238.1.2` it is `140-238-1-2.sslip.io`. HTTPS works with it too.

## 3. Install

SSH in (`ssh ubuntu@<ip>`) and run, with your domain:

```bash
curl -fsSL https://raw.githubusercontent.com/blade1walker/lsmd/main/deploy/oracle/setup.sh | bash -s -- ems.example.com
```

The first run installs everything and stops to ask for the settings:

1. **Copy the settings from Vercel.** Vercel → Project → **Settings → Environment Variables**, and fill the same names into the file:
   ```bash
   sudo -u lsmd nano /opt/lsmd/.env
   ```
   `NEXTAUTH_URL` is already set to the new address. The database URL is whichever is set on Vercel —
   `DATABASE_URL`, or the `NEON_…` variables if the Neon integration added them (copy those as they are).
   Copy `BLOB_READ_WRITE_TOKEN` too, or SOP and medical image uploads stop working.
2. **Discord sign-in:** Discord Developer Portal → your app → **OAuth2 → Redirects** → add
   `https://ems.example.com/api/auth/callback/discord`. Without it every sign-in fails with "Invalid OAuth2 redirect_uri".
3. Run the same command again (or `bash /opt/lsmd/repo/deploy/oracle/setup.sh ems.example.com`). It builds and starts the site.

## 4. Switch over

1. Open `https://ems.example.com`, sign in, and check the admin panel loads.
2. Update anything that points at the old Vercel address:
   - the Discord bot's `WEBSITE_URL` (bot/.env on wherever the bot runs),
   - the FiveM resource's website URL in `server.cfg`,
   - links pinned in Discord.
3. When the new site works, stop Vercel from deploying too, so a push does not go to two places:
   Vercel → Project → **Settings → Git → Disconnect**. Keep the project for a week as a fallback, then delete it.

## Day to day

| Task | Command |
| --- | --- |
| Site logs | `journalctl -u lsmd -f` |
| Deploy logs | `journalctl -u lsmd-update -f` |
| Deploy now | `sudo -u lsmd FORCE=1 bash /opt/lsmd/repo/deploy/oracle/deploy.sh` |
| Change a setting | `sudo -u lsmd nano /opt/lsmd/.env`, then `sudo -u lsmd FORCE=1 bash /opt/lsmd/repo/deploy/oracle/deploy.sh` (settings are read at build time too) |
| Roll back | `ls -dt /opt/lsmd/releases/*` → `sudo ln -sfn /opt/lsmd/releases/<older> /opt/lsmd/current && sudo systemctl restart lsmd` |
| Run the LOA job now | `sudo systemctl start lsmd-loa-expiry` |
| Restart | `sudo systemctl restart lsmd` |

The Oracle Always Free VM has no automatic backups, but it holds nothing that
can't be rebuilt from this repo and `/opt/lsmd/.env` — keep a copy of that file
somewhere safe. The data itself lives in Neon.
