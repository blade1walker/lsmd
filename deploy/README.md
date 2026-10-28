# Moving the website off Vercel

Everything needed to run the site somewhere other than Vercel. The database
(Neon) is a separate service that works from any host, so **no data moves** —
only the website itself does. Uploaded images are stored by the site itself,
in `DATA_DIR` (see `.env.example`).

| File | What it is |
| --- | --- |
| [`../Dockerfile`](../Dockerfile) | The site as one container. Any host that builds a Dockerfile can run it |
| [`start.sh`](start.sh) | What the container runs: check settings → apply the database schema → serve on `$PORT` |
| [`check-env.mjs`](check-env.mjs) | Checks a settings file or environment without printing values |
| [`docker/`](docker/) | `compose.yml` + `Caddyfile`: site + automatic HTTPS + nightly LOA job on any server with Docker |
| [`oracle/`](oracle/) | The same on an Oracle Cloud free VM without Docker, with auto-deploy on every push to `main` |
| [`../.env.example`](../.env.example) | Every setting, with what it does |

## 1. Collect the settings

**Vercel will not give them back.** Its variables are marked *Sensitive*, and
`vercel env pull` writes the text `[SENSITIVE]` instead of each value. Copy
them from where they come from instead, into a `.env` file (start from
`.env.example`):

| Setting | Where it comes from | Needed? |
| --- | --- | --- |
| `DATABASE_URL` | console.neon.tech → project → **Connect** (pooled string). On Vercel this is `NEON_DATABASE_URL`; either name works | Yes |
| `DIRECT_URL` | Same, with *Connection pooling* off. Used for schema changes | Recommended |
| `NEXTAUTH_URL` | The new address, e.g. `https://lsmd.tech` | Yes |
| `NEXTAUTH_SECRET` | Make a new one: `openssl rand -base64 32`. Everyone signs in again once | Yes |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord Developer Portal → *Nexus EMS bot* → **OAuth2** | Yes |
| `DISCORD_BOT_TOKEN` | Same app → **Bot** → Token | For DMs / role sync |
| `DISCORD_*_WEBHOOK_URL` | Discord channel → Edit → **Integrations → Webhooks** → Copy URL | Per channel |
| `NEXUS_BOT_API_KEY`, `FIVEM_API_KEY`, `CRON_SECRET` | Whatever the bot / FiveM `server.cfg` already use, or new random values set on both sides | Per feature |

Discord shows the client secret and bot token only once. If you have to
**Reset** them, put the new values in Vercel too, or the old site breaks
before the move is finished.

Then check the file (Node 22):

```bash
node deploy/check-env.mjs .env
```

## 2. Pick a host

### A server with Docker (VPS, Oracle, home server)

```bash
git clone https://github.com/blade1walker/lsmd.git && cd lsmd
cp /path/to/your/.env deploy/docker/.env
echo 'DOMAIN=lsmd.tech' >> deploy/docker/.env
docker compose -f deploy/docker/compose.yml up -d --build
```

Open ports 80 and 443. HTTPS, restarts and the 08:00 UTC LOA job are handled.
To update: `git pull && docker compose -f deploy/docker/compose.yml up -d --build`.

### Oracle Cloud free VM, no Docker

See [`oracle/README.md`](oracle/README.md). It also deploys `main` on its own
within 2 minutes of every push, like Vercel did.

### Railway, Render, Fly.io, Koyeb, DigitalOcean App Platform

1. New service → from the GitHub repo. It finds the `Dockerfile`, so no build
   or start command is needed.
2. Paste the settings from step 1 into its environment variables. The port is
   read from `$PORT`, which these hosts set.
3. Add your domain in the host's dashboard and create the DNS record it asks
   for.
4. LOA job: add a daily cron for `0 8 * * *` (Render *Cron Job*, Railway *Cron
   Schedule*, or a free service like cron-job.org) that calls
   `GET https://<domain>/api/cron/loa-expiry` with the header
   `Authorization: Bearer <CRON_SECRET>`.

Use at least 1 GB of memory; `next build` runs out below that.

## 3. Discord sign-in

Discord Developer Portal → *Nexus EMS bot* → **OAuth2 → Redirects** → add
`https://<domain>/api/auth/callback/discord`. Keep the Vercel one until the
move is done.

## 4. Domain

Point the domain at the new host. On Cloudflare, use **DNS only** (grey
cloud) for a server running Caddy, so Caddy can get its certificate.

## 5. Test, then switch

1. Open the new address: sign in with Discord, open the roster, open an admin page.
2. Point the other pieces at the new address: the Discord bot's `WEBSITE_URL`
   (in `bot/.env`) and `set nexus_ems_url "https://<domain>"` in the FiveM
   server's `server.cfg`.
3. Vercel → project → Settings → **Git** → Disconnect, so pushes stop
   deploying there. Keep the Vercel project for a week as a fallback. Going
   back only means pointing the domain and the bot at it again.

## A clean copy to upload

For a host that takes a zip upload instead of a GitHub repo:

```bash
git archive --format=zip -o lsmd-site.zip main
```

It contains only tracked files: no `.env`, no `node_modules`.
