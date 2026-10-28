# nexus-ems-sync

Links the FiveM server to the Nexus EMS website. Once it is running:

- **Duty sync.** Going on or off EMS duty in game clocks the medic on or off the website's duty clock. Leaving the city, crashing or a server restart clocks them off at the last moment the city saw them, so nobody is credited for time they were not there.
- **City time.** The website records how long each roster member spends in the city. It shows on **Admin → Activity** next to duty hours, so "in the city every day, never on duty" is easy to spot.
- **Duty Board.** `/unitstatus` sets the medic's status (Available, En Route, On Scene, Transporting, At Hospital, Busy, On Break) on **Admin → Duty Board**.
- **Call Log.** `/emscall` logs a call in the website's Call Log. The street it was typed on is the location, and on-duty EMS standing nearby are added as responders.
- **Live presence.** The home page, the roster, the Duty Board and the bot's `/city` show who is in the city. **Admin → City Link** lists every player with the roster member they matched, and flags anyone clocked on without being in the city.

Everything the resource reports can be switched off on **Admin → City Link** without touching the server.

It is plain JavaScript on FXServer's built-in Node.js runtime (`server.js`, `client.js`, `config.js`), with nothing to install or build. `fxmanifest.lua` is FiveM's manifest format and stays Lua. Settings are in `config.js`.

## Install

1. On the website, set `FIVEM_API_KEY` to 32 or more random characters and redeploy:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Copy this `nexus-ems-sync` folder into the server's `resources` folder.
3. Add to `server.cfg`, after the framework:
   ```
   set nexus_ems_url "https://your-site.example.com"
   set nexus_ems_api_key "<the same value as FIVEM_API_KEY>"
   ensure nexus-ems-sync
   ```
4. Restart the server. The console prints `Linked to https://…` when it connects, or what is wrong when it cannot. **Admin → City Link** shows the resource as *Live* within a minute.

The address and key go in `server.cfg`, not `config.js`, so the key never ends up in a zip of the resource.

Updating from 1.0 (the Lua version): replace the whole folder. Copy any changes you made to `config.lua` into `config.js` (same settings, JavaScript syntax). The `server.cfg` lines stay the same.

## Frameworks

`Framework: "auto"` in `config.js` picks the first one running:

| Framework | EMS are | On duty when |
| --- | --- | --- |
| Qbox (`qbx_core`) | jobs in `EmsJobs`, or any job of type `ems` | `job.onduty` |
| QBCore (`qb-core`) | the same | `job.onduty` |
| ESX (`es_extended`) | jobs in `EmsJobs` | `job.onDuty` on ESX Legacy 1.10+; otherwise holding the job. `offambulance` counts as off duty |
| Standalone | players with the `nexus.ems` ace (`add_ace group.ems nexus.ems allow`) | `/emsduty` toggles it |

Duty changes are sent the moment the framework announces them (`QBCore:Server:SetDuty`, `QBCore:Server:OnJobUpdate`, `esx:setJob`). The heartbeat every minute corrects anything missed.

## Commands

| Command | Does |
| --- | --- |
| `/emsduty` | On or off EMS duty. QBCore/Qbox and standalone; on ESX use the job's own duty point |
| `/unitstatus <status> [note]` | e.g. `/unitstatus enroute Vinewood Blvd`, `/unitstatus hospital`, `/unitstatus available`. With no status, lists them |
| `/emscall nature \| outcome \| hospital \| notes` | e.g. `/emscall cardiac arrest \| transported \| pillbox \| ROSC on scene`. Only the nature is required; the outcome defaults to Treated on Scene. Names are matched loosely, so `cardiac` finds Cardiac Arrest |

Command names are set in `Commands` in `config.js`; set one to `false` to leave it out.

## Exports

For dispatch and job scripts, server side. The exports work the same from Lua or JavaScript resources:

```lua
-- Log a call with `src` as the lead medic.
exports["nexus-ems-sync"]:LogCall(src, {
  nature = "Motor Vehicle Collision",
  location = "Route 68, Harmony",
  outcome = "Transported",
  hospital = "Sandy Shores Medical Center",
  priority = "P1",          -- optional: P1, P2 (default) or P3
  patientName = "John Doe", -- optional
  notes = "Two vehicles",   -- optional
}, function(success, callNumberOrError)
  print(success, callNumberOrError)
end)

-- Set a medic's Duty Board status.
exports["nexus-ems-sync"]:SetUnitStatus(src, "On Scene", "Route 68, Harmony")

-- Re-read a player's duty and report it now, e.g. after your script changes it.
exports["nexus-ems-sync"]:SyncDuty(src)
```

## What is sent

Every minute: each player's server ID, player name, ping, character name, job, grade, whether the job is EMS and whether they are on duty, and their `discord`, `steam`, `license`, `license2` and `fivem` identifiers. IP addresses are never sent.

Players are matched to the roster by Discord ID, then by Steam ID (the roster's Steam ID may be the 17-digit SteamID64 or the `steam:` hex form). Name matching is off unless **Match by name** is switched on in City Link. A medic whose Discord ID is not on the roster, or who joined with Discord closed, is told so in chat when they go on duty.

## Troubleshooting

| Console says | Fix |
| --- | --- |
| `Not configured` | Add `nexus_ems_url` and `nexus_ems_api_key` to `server.cfg` |
| `FIVEM_API_KEY is not set on the website` | Set it on the website and redeploy |
| `nexus_ems_api_key in server.cfg does not match` | Copy the key again. No quotes inside the value |
| `The website could not be reached` | Check `nexus_ems_url` is the site's public `https://` address, with no path |
| `Duty sync is off` | Switched off on Admin → City Link |

Set `Debug: true` in `config.js` to print every request.
