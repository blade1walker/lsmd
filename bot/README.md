# Nexus EMS Bot

Runs the Los Santos EMS website from Discord, and posts and schedules official announcements.

The bot does its work through the website's own API. Approving an application in Discord therefore does exactly what the panel's button does: the member gets the same DM, the channel gets the same webhook post, and the website's audit log records the change as "*Name* (via Discord)".

This folder is self-contained. Deploy it on its own; the website does not need it in order to build.

---

## Commands

| Command | What it does | Default access |
| --- | --- | --- |
| `/announce now · schedule · list · view · edit · cancel · history` | Official announcement embeds, posted now or at a set time, optionally repeating daily or weekly | Admins only |
| `/recruit pending · view · approve · decline` | Recruitment applications | Admins only |
| `/onboarding pending · view · approve · decline` | Onboarding requests; approving assigns a starting rank | Admins only |
| `/loa pending · view · approve · decline` | Leave of Absence requests | Admins only |
| `/dept-app pending · view · approve · decline` | Department join applications | Admins only |
| `/member info · rank · callsign · status · find` | Roster lookup, promotions and demotions, call signs, Active/Reserve/LOA | Admins only |
| `/config view · toggle · message · webhook · invite · test` | The website's notification settings: which events DM or post, the message text, channel webhooks, and a test send | Admins only |
| `/banner show · set · hide` | The spotlight banner on the website's home page and roster | Admins only |
| `/dm` | Message a member as the bot; the message is kept in the website's conversation log | Admins only |
| `/duty on · off · status` | Clock yourself on or off duty | Everyone |
| `/ems overview · help · ping` | Pending reviews, roster strength, upcoming announcements, and status | Everyone |

`view` on a review queue shows **Approve** and **Decline** buttons. Onboarding shows a rank picker instead, because approving it assigns a rank.

### Who can use what: Server Settings → Integrations

The bot runs **no permission checks of its own**. Access is set entirely in Discord:

1. Open **Server Settings → Integrations → Nexus EMS Bot**.
2. Pick a command, for example `/loa`.
3. Under **Roles & Members**, add who may use it, for example the HR role. Under **Channels**, optionally limit where it can be used.

Each area is its own top-level command, so HR can be given `/loa` and `/recruit` without `/config`. Staff commands start out usable by server administrators only, until you grant them. `/duty` and `/ems` start out usable by everyone. You can change any of these in the same place.

### Scheduling times

`/announce schedule when:` accepts `in 2h`, `30m`, `18:30`, `6:30pm`, `tomorrow 9am`, `2026-10-05 18:30` or `05/10/2026 18:30`. Wall-clock times are read in `TIMEZONE` (default `Asia/Kolkata`). Discord then shows each viewer the time in their own timezone.

Schedules are stored in the website's database, not on the bot's host. A restart or a move to another host loses nothing. The bot posts anything that fell due while it was offline as soon as it starts, and a repeating announcement then resumes its cadence.

---

## Setup

### 1. The website

In the website's host (Vercel → Settings → Environment Variables), add:

| Variable | Value |
| --- | --- |
| `NEXUS_BOT_API_KEY` | A long random secret, at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Redeploy the website. The deploy also creates the `Announcement` table.

> This key is a master key for the website's API. Keep it only in the website's and the bot's environment variables, never in chat or in git. To revoke it, change it in both places.

### 2. The Discord application

Use the same application as the website's DM bot (Developer Portal → Applications). Rename it **Nexus EMS Bot** under General Information and Bot if you have not already.

- **Bot → Privileged Gateway Intents:** leave all three off. The bot needs none of them.
- **Bot → Reset Token:** copy the token into `DISCORD_TOKEN`. Resetting it breaks the website's DMs until you also paste the new token into the website: Admin → Notification settings → Bot, or `DISCORD_BOT_TOKEN`.

Invite the bot with both scopes. `applications.commands` is what creates the slash commands:

```
https://discord.com/oauth2/authorize?client_id=1540114135444889701&scope=bot+applications.commands&permissions=216064
```

This grants View Channels, Send Messages, Embed Links, Read Message History, and Mention @everyone/@here/All Roles. Mention permission is only needed for announcements that ping.

### 3. Stop the old Python bot

The earlier Python bot in `d:\nexus-ems-bot` uses the same application. Stop it before starting this one, because two processes answering the same commands will conflict. On first start this bot replaces the old bot's commands.

### 4. Configure

```bash
cp .env.example .env     # then fill it in
```

| Variable | Required | Meaning |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token |
| `DISCORD_GUILD_ID` | yes | Your server's ID. Commands register here and appear instantly |
| `WEBSITE_URL` | yes | e.g. `https://your-site.vercel.app`, with no trailing slash |
| `NEXUS_BOT_API_KEY` | yes | The same value as on the website |
| `TIMEZONE` | no | IANA timezone for typed times (default `Asia/Kolkata`) |
| `BOT_BRAND_NAME` | no | Name in embed footers (default `Los Santos EMS`) |
| `BOT_LOGO_URL` | no | Logo shown on announcements |
| `LOG_CHANNEL_ID` | no | Staff channel that receives a line for every action taken through the bot |

### 5. Run

```bash
npm install
npm run build
npm start
```

For development, `npm run dev` restarts on every change.

---

## Hosting

Any host that keeps a Node 20+ process running works. The bot only makes outgoing connections, so it needs no port and no domain.

- **Bot hosting panel (Pterodactyl and similar):** upload this folder, choose a Node.js 20 egg, set the startup to `npm install && npm run build && npm start`, and enter the variables in the panel.
- **Railway / Render:** create a service from this repository with the root directory set to `bot`. On Render, make it a **Background Worker**. Build command: `npm install && npm run build`. Start command: `npm start`. Add the variables.
- **Docker:** `docker build -t nexus-ems-bot . && docker run -d --restart unless-stopped --env-file .env nexus-ems-bot`
- **VPS:** `npm install && npm run build`, then keep it running with `pm2 start dist/index.js --name nexus-ems-bot`.

To push only this folder to a repository of its own, copy the `bot` folder out and `git init` it. Nothing in it depends on the rest of this repo.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "The website did not accept the bot's key" | `NEXUS_BOT_API_KEY` differs between the website and the bot, is shorter than 32 characters, or the website was not redeployed after setting it |
| "The website could not be reached" | Check `WEBSITE_URL` |
| Commands do not appear | The bot was invited without `applications.commands`, or `DISCORD_GUILD_ID` is wrong. Re-invite with the link above, then restart the bot or run `npm run register` |
| A user cannot see a command | Grant it in Server Settings → Integrations → Nexus EMS Bot |
| "The bot is missing … in #channel" | Give the bot that permission in the channel's settings |
| Login fails with 401 | The token is wrong or was reset. Reset it in the Developer Portal and update `DISCORD_TOKEN` |
