# LSMD — Nexus EMS website

The roster, training, LOA, SOP and admin site for Nexus EMS, live at
<https://lsmd.tech>. Next.js + Prisma on a Neon PostgreSQL database.

| Folder | What it is |
| --- | --- |
| `src/` | The website |
| `prisma/` | Database schema and seed |
| `scripts/` | Database scripts (`npm run db:*`); `deploy-schema.mjs` runs on every deploy |
| `bot/` | The Nexus EMS Discord bot — see [`bot/README.md`](bot/README.md) |
| `fivem/` | The FiveM resource that syncs with the site |
| `deploy/oracle/` | The Oracle Cloud VM the site runs on — see [`deploy/oracle/README.md`](deploy/oracle/README.md) |

## Develop

```bash
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET, Discord app
npm install
npm run dev            # http://localhost:3000
npm test               # unit tests
```

## Deploy

Push to `main`. GitHub Actions ("Build for Oracle") tests and builds it, and
the VM picks the build up within 2 minutes, applies the database schema and
switches over — rolling back on its own if the new version does not start.
