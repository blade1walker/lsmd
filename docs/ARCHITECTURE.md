# Architecture

How the Los Santos EMS site is put together after the October 2026
refactor, and what changed from before it. Day-to-day database work
(migrations, backups, restoring, the move from Neon) is in
[DATABASE.md](DATABASE.md); hosting is in [`deploy/`](../deploy/README.md).

## What runs where

Everything runs on one Oracle Cloud VM (`lsmd.tech`). The site is built by
GitHub Actions; nothing heavy runs on the VM.

```
 browsers ──https──▶ Caddy ──▶ lsmd.service: Next.js (next start, one Node process)
                                   │  pages, API routes, Boss Menu, daily backups
                                   ▼
                     /opt/lsmd/data: lsmd.db (SQLite, WAL) · backups/ · uploads/

 Discord bot ──▶ lsmd-bot.service ──http──▶ the site's API (127.0.0.1:3000)
 FiveM server: nexus-ems-sync ──https──▶ the site's API (/api/fivem/*)
 the site ──https──▶ Discord (sign-in, DMs, roles, webhooks)

 push to main ─▶ GitHub Actions "Build for Oracle" (tests + build) ─▶ release
               ─▶ lsmd-update.timer (every 2 min): download, back up, migrate,
                  switch, health-check, roll back if unhealthy; rebuild the bot
                  if bot/ changed
 pull request ─▶ GitHub Actions "Check" (tests + build)
```

One language throughout: TypeScript for the site, the bot and the tools;
plain JavaScript for the FiveM resource, which runs on the game server's own
Node runtime. FiveM requires its manifest, `fxmanifest.lua`, to be Lua.

## Code layout

| Concern | Where |
| --- | --- |
| **Routing** | `src/app`, the Next.js App Router. `(site)/` holds the public pages that show Boss Menu content, `admin/` the staff panel, and `api/` the route handlers (147). Handlers stay thin: check access, parse input, call `src/lib`, answer. |
| **Business logic** | `src/lib/<feature>.ts` holds pure, client-safe rules (`calls.ts`, `loa.ts`, `interviews.ts`, `site-content.ts`, …) and `src/lib/<feature>-server.ts` the database side of the same feature. Pure rules are unit-tested. |
| **Data** | `prisma/schema.prisma` and `prisma/migrations`. The client is `src/lib/prisma.ts`, the connection settings and single-writer rules are in `src/lib/sqlite.ts`, the migration runner is `src/lib/migrations.ts`, backups `src/lib/backup.ts`, and file locations `src/lib/paths.ts`. |
| **Configuration** | Environment: `.env.example` documents every setting, and `deploy/check-env.mjs` checks them. Product constants (ranks, permissions, lists) are in `src/lib/constants.ts`; editable website content is in the Boss Menu registry, `src/lib/site-content.ts`. |
| **Middleware** | `src/lib/api-auth.ts` (`requireAuth`: session or bot or FiveM key, then permission) at the top of every handler; `src/lib/auth.ts` (sign-in, session refresh); `src/lib/access.ts` (who someone is and what they may do). |
| **Errors and logging** | `src/lib/api-error.ts` turns any failure into one JSON shape with the Prisma code and a hint. `src/lib/log.ts` writes one structured line per server event (`level=error msg="…" code=P2002 …`). |
| **Utilities** | `fetch-json.ts`, `json-fields.ts`, `data-cache.ts` (an in-process read cache, cleared by every write), `media-storage.ts` / `media-server.ts` (the image library). |
| **UI** | `src/components`: shared components and the small set of `ui/` primitives still in use. |
| **Tools** | `scripts/`: the deploy step (`deploy-schema.mjs` → `db-deploy.ts`), the database tools (`db-*.ts`), and the data updates each release runs (permission grants, rank renames). |
| **Tests** | `tests/unit` (rules, encodings, validation) and `tests/integration` (the database layer on a real SQLite file). Run with `npm test`, on every pull request and before every deploy. |

## Before and after

| | Before | After |
| --- | --- | --- |
| Languages | TypeScript, plus Python launchers for the bot and Lua for the FiveM resource | TypeScript / JavaScript only (`fxmanifest.lua` aside) |
| Database | Neon Postgres, about 300 ms away per round trip | SQLite file on the VM, WAL mode, a few milliseconds per page |
| Schema changes | `prisma db push` on deploy, failures ignored, no history | Versioned migrations, each all-or-nothing; a failure stops the deploy with the old release still live |
| Backups | None on the VM | Verified copies before every deploy and daily; restore tool; download from Admin → Export |
| Single writer | — | One transaction at a time, and no query runs inside another request's transaction (the stock adapter allowed it) |
| Uploaded images | Vercel Blob (needed the old Vercel project) | On the VM, one media library for the Boss Menu, SOP and letterhead |
| Public site text | Hard-coded | Boss Menu: drafts, preview, publish, notices, media; audited and permission-checked |
| Discord bot | Python hosting panel; zip files and a release branch | `lsmd-bot` service on the VM, rebuilt automatically from `main` |
| FiveM resource | Lua 1.0 | JavaScript 1.1, the same behaviour (checked side by side) |
| Logging | Free-form `console.error` | Structured lines with fields, through one logger |
| Tests / CI | None; builds only on `main` | 53 tests; checks on every pull request; tests gate every deploy |
| Dead code | 10 unused components; one-off scripts, one of which deleted every member | Removed |

### Dependencies

**Removed (19):**
- `@auth/prisma-adapter`
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `@hookform/resolvers`, `react-hook-form`, `zod`
- seven `@radix-ui/*` packages
- `class-variance-authority`, `next-themes`
- `sheetjs`, an unrelated package and not SheetJS
- `@vercel/blob`, `@prisma/adapter-pg`

Together they pulled in more than 80 packages.

**Added (2 + types):** `better-sqlite3` and `@prisma/adapter-better-sqlite3`, the SQLite driver and Prisma's adapter for it.

`pg` stays only for the one-time import from Neon and the way back
(`db:export-postgres`). It can go once Neon is retired.

## Known limits

- **Lint.** 56 ESLint errors remain, all from before the refactor, mostly React
  hooks rules in staff-panel pages. None are in new code; fixing them means
  reworking those pages one at a time.
- **Unverified on the VM.** The VM's CPU type and the real Neon import couldn't
  be checked from the development environment. The deploy step handles an ARM
  VM and stops safely if the import fails; the deploy log shows the result.
- **Browser logging.** Errors in the browser still go to the browser console,
  as before. The structured logger covers the server.
