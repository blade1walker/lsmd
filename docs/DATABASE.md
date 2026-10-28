# The database

The site keeps its data in **one SQLite file on its own server**: no
database service, no connection string, nothing to pay for. This page covers
where the data is, how schema changes work, backups, restoring, the one-time
move from Neon, and how to go back.

## Where everything is

Everything the site writes lives under `DATA_DIR` (default `./data` in the app
folder; on the Oracle VM `/opt/lsmd/data`, which every release links to; with
Docker the `app_data` volume):

| Path | What |
| --- | --- |
| `lsmd.db` (+ `-wal`, `-shm` while running) | The database |
| `backups/` | Verified backups: one before every deploy (last 10 kept), one a day (last 14), and any taken by hand |
| `uploads/` | Images uploaded in the Boss Menu, the SOP editor and the medical letterhead |
| `MOVED-TO-SQLITE.json` | Written once the server's data is in SQLite; see "If the database file goes missing" |

## How the site uses it

- **WAL mode** — readers never wait for the writer and the writer never waits
  for readers; online backups are safe.
- **`synchronous = NORMAL`** — with WAL, a power cut can lose the last moments
  of commits but never corrupts the file.
- **`busy_timeout = 5000`** — another process holding the write lock (a
  backup, a script) is waited for, up to 5 seconds.
- **`foreign_keys = ON`** — relations' delete rules are enforced by the database.
- **One writer, one transaction at a time.** The site is one process with one
  connection. Every transaction runs on its own, in order, and no other
  request's query can run inside it (src/lib/sqlite.ts). So inside
  `prisma.$transaction(async (tx) => …)`, use only `tx`, and never wait on the
  network: the whole database waits with it.
- **Text search** (`contains`) ignores letter case for A–Z; accented letters
  still match case-sensitively.

All queries go through Prisma, so every value is a bound parameter.

## Changing the schema

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate`: brings your local database up to date with the
   existing migrations.
3. `npm run db:migration -- short_name`: writes
   `prisma/migrations/<timestamp>_short_name/migration.sql` for your change.
   Read it, especially anything that drops or rebuilds a table.
4. `npm run db:migrate` applies it locally; commit the schema and the
   migration together.

Every deploy backs the database up and then applies new migrations
(scripts/db-deploy.ts). Each migration is all or nothing. If one fails, the
deploy stops and the running release keeps serving on the unchanged database.

Don't use `prisma migrate dev` or `prisma db push`. Prisma writes JSON
defaults for SQLite in a form SQLite rejects; `db:migration` corrects them.

## Backups

Automatic, both integrity-checked before they count:

- **before every deploy**, ahead of any migration;
- **once a day**, by the site itself (no separate timer needed).

By hand:

```bash
npm run db:backup            # take one now
npm run db:backup -- --list  # what is there
npm run db:check             # integrity, migrations, row counts, newest backup
```

**Admin → Export → Download database** downloads a fresh, verified copy of the
whole database as one `.db` file.

Backups on the same disk do not survive losing the server. Copy `DATA_DIR` off
it now and then, for example:

```bash
sudo tar -czf lsmd-data-$(date +%F).tgz -C /opt/lsmd data   # then copy it somewhere else
```

## Restoring

```bash
sudo systemctl stop lsmd
cd /opt/lsmd/current
sudo -u lsmd npm run db:restore -- --latest                          # newest backup
sudo -u lsmd npm run db:restore -- lsmd-20261028T120000Z-daily.db    # or a named one
sudo systemctl start lsmd
```

The backup is checked before it is used. The database it replaces is saved
first as `…-pre-restore.db`, so a restore can be undone the same way. The
restore refuses to run while the site is running.

### If the database file goes missing

A deploy that finds no database, on a server that already moved to SQLite
(`MOVED-TO-SQLITE.json` is there), stops rather than starting empty or copying
in old data. Restore the newest backup, then deploy again.

## The move from Neon (one time)

The first deploy of the SQLite release finds no SQLite database. If the old
Postgres address is still in the settings (`DATABASE_URL` or the `NEON_…`
variables), it copies it in:

1. Builds the new database in a temporary file from the migrations.
2. Copies every table, then checks it: every row counted, every table's ids
   compared with the old database's, every link resolved, every value read back
   through Prisma, and SQLite's own integrity check.
3. Only then moves it into place and carries on with the deploy.

If anything fails, the temporary file is deleted, the deploy stops, and the
old release keeps running on Neon as before. **Neon is only ever read, never
changed.** The deploy log (`journalctl -u lsmd-update`) shows the row count.

Anything saved on the old release between the copy and the switch, a window
of a minute or so, is not carried over. Deploy at a quiet moment.

Afterwards the Postgres address is no longer used. Keep it in the settings
while Neon is your way back (below), then remove it.

## Going back to Neon

- **Soon after the move, with nothing important written since:** roll the
  release back as usual (see `deploy/oracle/README.md` → Day to day). The old
  release runs on Neon exactly as it was left.
- **After new data has been written on SQLite:** copy it back first, so the
  old release finds it:

  ```bash
  sudo systemctl stop lsmd
  cd /opt/lsmd/current && sudo -u lsmd npm run db:export-postgres -- --replace
  # then roll the release back to one from before the move
  ```

  This replaces everything in the Postgres database with the SQLite data, in
  one transaction: it either ends up an exact copy or is left as it was.

## Commands

| Command | Does |
| --- | --- |
| `npm run db:migrate` | Gets the database ready: creates or imports it, backs up, applies migrations (what deploys run) |
| `npm run db:migration -- <name>` | Writes a migration for your schema changes |
| `npm run db:backup` / `-- --list` | Takes a verified backup / lists them |
| `npm run db:restore -- <file>\|--latest` | Restores a backup (site stopped) |
| `npm run db:check` | Health report |
| `npm run db:import [-- --from <url>] [--replace]` | Copies a Postgres database into SQLite by hand |
| `npm run db:export-postgres -- --replace [--to <url>]` | Copies SQLite into Postgres (the way back) |
| `npm run db:reset` | Development only: empty database with seed data (the old one is backed up) |
| `npm run db:seed`, `db:seed-roles`, … | Seed data for a new install |
