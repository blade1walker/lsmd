# Nexus EMS Bot

Runs the Los Santos EMS website from Discord, and posts and schedules official announcements.

The bot does its work through the website's own API. Approving an application in Discord therefore does exactly what the panel's button does: the member gets the same DM, the channel gets the same webhook post, and the website's audit log records the change as "*Name* (via Discord)".

It runs on the same Oracle VM as the website, as the `lsmd-bot` service, and updates itself within two minutes of a push to `main` that changes this folder (see [Hosting](#hosting)). The folder is self-contained: the website does not need it in order to build.

## Quick start (on your own computer)

You need [Node.js](https://nodejs.org) 18.17 or newer (22 LTS recommended).

```bash
npm install     # installs dependencies
npm start       # builds on first run, then starts the bot
```

The only required setting is `DISCORD_TOKEN` in `.env` (copy `.env.example`). Everything else is optional:
- **Without `DISCORD_GUILD_ID`**, the bot registers its commands in every server it's in.
- **Without `WEBSITE_URL`**, the bot still starts, and commands that need the website say what to set. No key is needed: the bot authenticates to the website with its own token.

On startup the bot prints a short checklist: whether the token is valid, Server Members Intent, command registration, and the website connection. It prints every problem it finds, with how to fix it.

| Script | Does |
| --- | --- |
| `npm install` | Installs dependencies, including the TypeScript compiler |
| `npm start` | Starts the bot. Rebuilds first if the source changed |
| `npm run build` | Compiles `src/` into `dist/` |
| `npm run register` | Re-registers the slash commands without starting the bot |
| `npm run typecheck` | Checks the code without building |

---

## Commands

| Command | What it does | Who can use it |
| --- | --- | --- |
| `/announce now · schedule · list · view · edit · cancel · history` | Official announcement embeds, posted now or at a set time, optionally repeating daily or weekly | Admins + anyone granted |
| `/recruit pending · view · approve · decline` | Recruitment applications | Admins + anyone granted |
| `/onboarding pending · view · approve · decline` | Onboarding requests; approving assigns a starting rank | Admins + anyone granted |
| `/loa pending · view · approve · decline` | Leave of Absence requests | Admins + anyone granted |
| `/dept-app pending · view · approve · decline` | Department join applications | Admins + anyone granted |
| `/member info · rank · callsign · status · find` | Roster lookup, promotions and demotions, call signs, Active/Reserve/LOA | Admins + anyone granted |
| `/config view · toggle · message · webhook · invite · test` | The website's notification settings: which events DM or post, the message text, channel webhooks, and a test send | Admins + anyone granted |
| `/joinlink view · create · use · roles · reset-roles · enabled` | An invite link that gives everyone who joins through it the **EMS Recruit** and **EMS** roles | Admins + anyone granted |
| `/permissions view · grant · revoke · check · clear` | Who can use which command. Give a role or person one command, or all of them | Admins + anyone granted |
| `/banner show · set · hide` | The spotlight banner on the website's home page and roster | Admins + anyone granted |
| `/dm` | Message a member as the bot; the message is kept in the website's conversation log | Admins + anyone granted |
| `/duty on · off · status` | Clock yourself on or off duty | Everyone |
| `/city` | Whether the FiveM server is up, how full it is, and which EMS are in the city (set up under Admin → City Link) | Everyone |
| `/ems overview · help · ping` | Pending reviews, roster strength, upcoming announcements, and status | Everyone |

`view` on a review queue shows **Approve** and **Decline** buttons. Onboarding shows a rank picker instead, because approving it assigns a rank.

### Who can use what: `/permissions`

| Who | Can use |
| --- | --- |
| Server administrators and the owner | Every command. No grant needed, so nobody can be locked out |
| Everyone | `/ems`, `/duty` and `/city` |
| Anyone else | Only the commands granted to one of their roles, or to them personally |

Give access in Discord. The role and person pickers are Discord's own:

| Command | Does |
| --- | --- |
| `/permissions grant to:@HR command:/loa` | HR can review LOA requests |
| `/permissions grant to:@High Command command:All commands` | High Command can use everything except `/permissions` |
| `/permissions grant to:@Someone command:/permissions` | That person can give out access too. Administrators only |
| `/permissions revoke to:@HR command:/loa` | Takes it back |
| `/permissions clear to:@HR` | Removes everything from that role |
| `/permissions view` | Everyone who has access, and to what |
| `/permissions check user:@Someone` | Exactly which commands that person can use |

The same list can be managed on the website under **Admin → Bot Permissions**, which needs the website permission `bot.permissions.view` or `bot.permissions.manage`. Grants are stored on the website, so they survive restarts, and changes made on the website reach the bot within a minute.

"All commands" deliberately leaves out `/permissions`, because handing out access is a separate decision. Someone without access who tries a command gets a private "you don't have access" reply. Access is checked again on every button and form, so taking it away takes effect immediately.

Discord's own Server Settings → Integrations → Nexus EMS Bot still works on top of this, for example to hide commands from a channel. You don't need it.

### Join link: roles for new members

Anyone who joins the server through the bot's join link automatically gets the **EMS Recruit** and **EMS** roles.

1. Run `/joinlink create channel:#welcome` to make a permanent link, or `/joinlink use link:<an invite you already share>` to use an existing one.
2. By default the bot gives the roles named exactly `EMS Recruit` and `EMS`. To pick different roles, use `/joinlink roles`.
3. Run `/joinlink view` to check it. It lists anything that would stop the roles being given, and how to fix each one.

Requirements, all of which `/joinlink view` checks:
- **Server Members Intent** must be on (Developer Portal → Bot → Privileged Gateway Intents). Without it Discord never tells the bot that someone joined. If it's off, the bot still starts and every other command works.
- The bot needs **Manage Server**, because only members with it can see invite use counts, and **Manage Roles**.
- The bot's own role must sit **above** EMS Recruit and EMS in Server Settings → Roles.

Members still on the server's rules screen get the roles as soon as they accept the rules. The setting is stored on the website, so it survives restarts.

Discord doesn't tell bots which invite a member used, so the bot compares invite use counts. If two people join within the same moment through different links, the roles go to whichever join the bot processes first. In practice this is rare.

### Scheduling times

`/announce schedule when:` accepts `in 2h`, `30m`, `18:30`, `6:30pm`, `tomorrow 9am`, `2026-10-05 18:30` or `05/10/2026 18:30`. Wall-clock times are read in `TIMEZONE` (default `Asia/Kolkata`). Discord then shows each viewer the time in their own timezone.

Schedules are stored in the website's database, not on the bot's host. A restart or a move to another host loses nothing. The bot posts anything that fell due while it was offline as soon as it starts, and a repeating announcement then resumes its cadence.

---

## Setup

### 1. The website

Nothing to set up. The bot proves who it is with its own Discord token. The website asks Discord which application the token belongs to, and trusts it when it's the same application the website's "Login with Discord" uses (`DISCORD_CLIENT_ID`). Both already use the same application.

Optionally, you can set `NEXUS_BOT_API_KEY` to the same random value (at least 32 characters) on both the website and the bot, as a second way in.

> The website must be deployed with the bot's API (any deploy from 2026-10-01 on). If the bot says the website did not accept it, the startup log gives the exact reason.

### 2. The Discord application

Use the same application as the website's DM bot (Developer Portal → Applications). Rename it **Nexus EMS Bot** under General Information and Bot if you have not already.

- **Bot → Privileged Gateway Intents:** turn on **Server Members Intent**. Only the join link needs it. Leave Presence and Message Content off.
- **Bot → Reset Token:** copy the token into `DISCORD_TOKEN`. Resetting it breaks the website's DMs until you also paste the new token into the website: Admin → Notification settings → Bot, or `DISCORD_BOT_TOKEN`.

Invite the bot with both scopes. `applications.commands` is what creates the slash commands:

```
https://discord.com/oauth2/authorize?client_id=1540114135444889701&scope=bot+applications.commands&permissions=268651553
```

This grants View Channels, Send Messages, Embed Links, Read Message History, Mention @everyone/@here/All Roles (for announcements that ping), and, for the join link, Create Invite, Manage Server and Manage Roles. After inviting, drag the bot's role above EMS Recruit and EMS in Server Settings → Roles.

### 3. Configure

```bash
cp .env.example .env     # then fill it in
```

| Variable | Required | Meaning |
| --- | --- | --- |
| `DISCORD_TOKEN` | **yes** | Bot token |
| `DISCORD_GUILD_ID` | no | Register commands in just this server. When empty, commands register in every server the bot is in |
| `WEBSITE_URL` | for website commands | e.g. `https://lsmd.tech`; on the website's own VM, `http://127.0.0.1:3000` |
| `NEXUS_BOT_API_KEY` | no | Optional second way to authenticate; must match the website's value |
| `TIMEZONE` | no | IANA timezone for typed times (default `Asia/Kolkata`) |
| `BOT_BRAND_NAME` | no | Name in embed footers (default `Los Santos EMS`) |
| `BOT_LOGO_URL` | no | Logo shown on announcements |
| `LOG_CHANNEL_ID` | no | Staff channel that receives a line for every action taken through the bot |

### 4. Run

```bash
npm install
npm start
```

---

## Hosting

### On the website's Oracle VM (how it runs today)

The bot is the `lsmd-bot` systemd service beside the website. Its settings are `/opt/lsmd/bot.env`. The website's update job (`deploy/oracle/deploy.sh`, every 2 minutes) rebuilds the bot whenever this folder changes on `main`: it builds the new copy beside the running one and swaps it in only once it has built. A failed build leaves the running bot alone.

First time, or moving the bot here from another host:

1. Get the VM up to date. `deploy/oracle/setup.sh` installs the service and creates `/opt/lsmd/bot.env`. On a VM set up before the bot moved, run it again; it is safe to repeat:
   ```bash
   bash /opt/lsmd/repo/deploy/oracle/setup.sh lsmd.tech
   ```
2. Fill in the settings. `WEBSITE_URL` is already `http://127.0.0.1:3000`, the website on the same machine:
   ```bash
   sudo -u lsmd nano /opt/lsmd/bot.env      # DISCORD_TOKEN, DISCORD_GUILD_ID, …
   ```
3. **Stop the bot wherever it ran before.** Two copies answering the same commands conflict.
4. Start it:
   ```bash
   sudo systemctl enable --now lsmd-bot
   journalctl -u lsmd-bot -f                # the startup checklist
   ```

| Task | Command |
| --- | --- |
| Logs | `journalctl -u lsmd-bot -f` |
| Restart (after changing `bot.env`) | `sudo systemctl restart lsmd-bot` |
| Rebuild now | `sudo -u lsmd FORCE=1 bash /opt/lsmd/repo/deploy/oracle/deploy-bot.sh` |
| Stop | `sudo systemctl disable --now lsmd-bot` |

### Elsewhere

Any machine that keeps a Node 18.17+ process running works. The bot only makes outgoing connections, so it needs no port and no domain.

- **Docker:** `docker build -t nexus-ems-bot . && docker run -d --restart unless-stopped --env-file .env nexus-ems-bot`. Alongside the website's Docker setup, `deploy/docker/compose.yml` has a `bot` service; see the comment there.
- **Any server with Node.js:** `npm ci && npm run build`, then keep `node index.js` running with systemd or pm2.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "The website did not accept the bot: …" | The message says why. The usual cause is a bot token from a different Discord application than the website's `DISCORD_CLIENT_ID`, or a website that hasn't been redeployed since the bot was added |
| "The website could not be reached" | Check `WEBSITE_URL` |
| Commands do not appear | The bot was invited without `applications.commands` (the startup log says so), or `DISCORD_GUILD_ID` is wrong. Re-invite with the link above, then restart the bot or run `npm run register` |
| "Dependencies are not installed" | Run `npm install` in the bot's folder |
| "The bot is not connected to the website yet" | Set `WEBSITE_URL` in the bot's `.env` to the website's address, then restart |
| "You don't have access to this command" | An administrator runs `/permissions grant` for that person's role, or adds it under Admin → Bot Permissions |
| Someone was granted a command but cannot see it | Restart the bot on the current version (it re-registers the commands as visible to everyone). If it is still hidden, open Server Settings → Integrations → Nexus EMS Bot and remove any override that turns the command off for `@everyone` or their role. Overrides set there are Discord's and the bot cannot change them |
| "The bot is missing … in #channel" | Give the bot that permission in the channel's settings |
| New members do not get the roles | Run `/joinlink view` and fix what it lists |
| Log says "Server Members Intent is off" | Turn it on in the Developer Portal → Bot, then restart the bot |
| Login fails with 401 | The token is wrong or was reset. Reset it in the Developer Portal and update `DISCORD_TOKEN` |
