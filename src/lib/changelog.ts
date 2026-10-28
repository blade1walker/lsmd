/**
 * Everything that has changed on the site, newest first — the source for the
 * Changelog page in the admin panel.
 *
 * Every shipped change adds its lines here in the same commit, written for the
 * people using the site rather than for developers. Entries up to 2026-09-09
 * were backfilled from the git history, one line per commit.
 *
 * Imported only by /api/changelog, never by a client component: the panel's
 * pages are static shells, so importing this directly would ship it in the
 * browser bundle and the changelog.view permission would guard nothing.
 */

export type ChangeType = "feature" | "improvement" | "fix" | "security";

export interface ChangelogChange {
  type: ChangeType;
  text: string;
}

export interface ChangelogEntry {
  /** YYYY-MM-DD, the day the change shipped. */
  date: string;
  /** Optional headline for a day with one main theme. */
  title?: string;
  changes: ChangelogChange[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-28",
    changes: [
      { type: "security", text: "Members' Discord, Steam and State IDs, timezones and HR flags are no longer readable without signing in (the full section list now needs roster access), and the public roster no longer shows why someone is on leave" },
      { type: "security", text: "Filing a removal request, reporting a member inactive and recording a promotion notice now need the matching permission (removal.request, hr.inactivity, roster.promote), and the requester is always the signed-in user. Training sign-off records now need training access. All of these were open to anyone before" },
      { type: "security", text: "LOA requests now need you to be signed in, and you can only request leave for yourself (HR can still file for someone). Before, anyone could file and announce leave for any member without signing in" },
      { type: "fix", text: "\"Could not check access\" errors and slow or failing pages: the server's database connections no longer time out" },
      { type: "feature", text: "Admin → Ranks & Insignia: move ranks up or down the ladder to change who outranks whom, and set each rank's insignia — stars, bars, chevrons, pips or none, how many (up to 5), its color, and whether they sit in a row, stacked or in a pyramid. Changes apply across the whole site at once, and Reset to defaults puts the original ladder back" },
      { type: "improvement", text: "New top rank Medical Director (five stars), above the top rank, which is renamed from Director of Medicine to Director of EMS. Members, test and department rank gates, and open requests on Director of Medicine move to Director of EMS on their own" },
    ],
  },
  {
    date: "2026-10-24",
    title: "Tests & Quizzes",
    changes: [
      { type: "feature", text: "Homepage: training tests marked \"Show on homepage\" appear as cards in the Applications row (or one Training & Quizzes card when none are). Everyone can see them; members at or above the test's minimum rank can start one, and anyone below it sees \"You require this minimum rank\" instead" },
      { type: "feature", text: "Tests can now require a minimum rank. The site refuses to start the test for anyone below it, wherever they open it from" },
      { type: "feature", text: "Exam mode for tests: the test opens full screen, copying, cutting, pasting, right-click and text selection are blocked, and leaving the page (another tab, app or window, or exiting full screen) is recorded. Each leave shows a warning, and past the allowance set on the test it is handed in automatically. Results show how many times each member left" },
      { type: "feature", text: "Import questions into a test from an Excel or CSV spreadsheet (one question per row — download the template to start), a JSON file, a text file, or by copying chosen questions from another test. Every question is previewed exactly as it will be imported, with anything that needs fixing flagged" },
      { type: "feature", text: "Export a test's questions as Excel, CSV or JSON, to edit in a spreadsheet and import back, or to move them to another test" },
      { type: "improvement", text: "Training: a link straight to Tests & Quizzes, where the theory exam is set" },
      { type: "feature", text: "Tests & Quizzes: build a test in the admin panel from multiple choice, checkbox, true/false, dropdown, short answer, long answer and number questions. Mark the correct option right on it, set points per question, and preview the test exactly as members will see it" },
      { type: "feature", text: "Paste a whole test in at once — numbered questions, \"- option\" lines with * on the correct ones, and tags like [short], [long] or [number] — and see how it will be read before adding it" },
      { type: "feature", text: "Test settings: pass mark, time limit, attempts per member, shuffled questions and options, and whether members see their score and the correct answers afterwards" },
      { type: "feature", text: "Members take published tests at /tests. Answers save as they go, the timer hands the paper in when time runs out, and choice, short and number answers are marked the moment it is submitted" },
      { type: "feature", text: "Results tab: every attempt with its score, a pass rate and average, CSV download, and a marking screen for written answers with points and comments per question. Needs tests.grade (or tests.manage, which builds tests)" },
    ],
  },
  {
    date: "2026-10-19",
    changes: [
      { type: "fix", text: "Nexus EMS Bot: the bot no longer asks the website for new announcements every 20 seconds and for permissions every minute. It now waits until the next announcement is due, and checks permissions every half hour (and right away when someone would otherwise be turned away). The constant checking kept the database running around the clock and used up its monthly limit, which made every bot command fail with \"The website answered 500\"" },
      { type: "improvement", text: "The site no longer connects to the old database at all: its records are all in the new one, so the automatic copy on each update and the \"Download old database\" button are gone" },
      { type: "feature", text: "Export: \"Full database backup\" downloads every table and row exactly as stored, as one JSON file — for the current database, and for the old one while the site still knows its address. Needs the export.data permission, and every download is recorded in the audit log" },
      { type: "fix", text: "Saved settings (notification webhooks, City Link, medical, promotion and activity settings, the roster banner) now come across from the old database too — the first copy kept the new database's blank defaults instead" },
      { type: "improvement", text: "Copying the old database now adds its records beside anything already saved in the new one, instead of waiting for the new one to be empty" },
      { type: "fix", text: "The site's error log is no longer flooded with a database security warning on every request, so real errors are easy to spot" },
      { type: "improvement", text: "The site now uses a Neon database connected through Vercel (its NEON_ settings) whenever one is connected, and keeps the previous database as the source its records are copied from" },
      { type: "fix", text: "Sign-in: when the database is not answering, signing in with Discord now returns to the login page with an explanation instead of a blank \"This page isn't working — HTTP ERROR 500\" page, and people already signed in are no longer signed out by it" },
      { type: "improvement", text: "Moving to a new database: with the old database's address kept as OLD_DATABASE_URL, the next site update copies all its records into the new one automatically — once, and only into an empty database unless told to merge. If the old database is still refusing connections, the copy is simply tried again on the next update" },
      { type: "fix", text: "Bot updates no longer show up as failed website builds (\"No Next.js version detected\") on Vercel — the bot's release branch is now skipped there" },
      { type: "improvement", text: "Nexus EMS Bot: the bot's server can now install it straight from GitHub and update itself on every restart, instead of needing a zip uploaded by hand each time" },
      { type: "improvement", text: "Moving to a new database host: `npm run db:copy` copies everything from the old database to the new one, keeping every record and the links between them" },
      { type: "improvement", text: "When the database refuses requests because its plan limit is used up, the bot and the site now say exactly that, instead of a bare \"The website answered 500\"" },
    ],
  },
  {
    date: "2026-10-15",
    changes: [
      { type: "fix", text: "Sign-in with Discord works again. Discord changed what it sends back after you press Authorize, and the site rejected every sign-in with \"Discord sign-in could not be completed\"" },
      { type: "fix", text: "Sign-in: works again when the site's address setting (NEXTAUTH_URL) has been filled in with a Discord link by mistake — the site now ignores a Discord or malformed address there and uses its own, instead of sending everyone to a broken Discord page" },
      { type: "fix", text: "Sign-in: the site's offline helper no longer gets in the way of signing in with Discord. It used to intercept and store every sign-in step and signed-in page; it now leaves sign-in and all site data alone, and clears what it had stored" },
      { type: "improvement", text: "Sign-in: when Discord sign-in is cancelled or cannot be completed, the login page now says so instead of a generic \"Sign-in failed\"" },
      { type: "improvement", text: "Login page: \"Back to Website\" now opens the home page instantly instead of reloading the whole site" },
      { type: "improvement", text: "Site updates can no longer get stuck while updating the database: that step now gives up after a few minutes and the update carries on, and it uses the database's direct connection when one is set (DIRECT_URL)" },
    ],
  },
  {
    date: "2026-10-14",
    title: "City Link, Duty Board and Activity",
    changes: [
      { type: "feature", text: "City Link: the website is now linked to the FiveM server. Set the server's address or cfx.re join code on Admin → City Link, and the home page and roster show whether the city is up, how full it is and how many EMS are in it, with a Join button. Members see who is in by name; visitors only see the count unless command chooses to show names" },
      { type: "feature", text: "nexus-ems-sync, a FiveM resource in the website's fivem/ folder: going on or off EMS duty in game clocks you on or off the website. Leaving the city, crashing or a server restart clocks you off at the last moment the city saw you. Works with Qbox, QBCore and ESX, or standalone with its own /emsduty" },
      { type: "feature", text: "In game: /unitstatus sets your status on the Duty Board (e.g. /unitstatus enroute Vinewood), and /emscall logs a call in the Call Log with the street you are on as the location and on-duty EMS standing nearby as responders. Dispatch scripts can do the same through the resource's LogCall and SetUnitStatus exports" },
      { type: "feature", text: "City Link page: every player in the city with the roster member they matched (by Discord ID or Steam ID), their character, job and duty, and a duty check that flags anyone clocked on without being in the city, on duty in game but not clocked, or on an EMS job without being on the roster. Test connection checks the address, the key and the resource, and says what is wrong" },
      { type: "feature", text: "Duty Board (Admin → Duty Board): every medic on duty with their status — Available, En Route, On Scene, Transporting, At Hospital, Busy or On Break — their unit, a note and whether they are in the city, updating every 15 seconds. Set your own status there or in game; every shift starts Available. Supervisors with duty.manage can set anyone's. Includes the week's most hours and calls" },
      { type: "feature", text: "Activity (Admin → Activity): duty hours, time in the city and calls for every member over 7, 14 or 30 days, measured against a weekly requirement (4 hours to start, changeable). Members on LOA or Reserve are listed but not measured, new members get a grace period, and anyone in the city but never on duty is flagged. Downloads as CSV" },
      { type: "feature", text: "Nexus EMS Bot: /city shows whether the server is up, how full it is and which EMS are in the city. Open to everyone, like /ems and /duty" },
      { type: "fix", text: "Admin pages with wide tables, such as the Call Log, no longer push the whole page sideways on a phone — the table scrolls inside its own box" },
      { type: "improvement", text: "The footer's FiveM Server link now works, and /connect on the website is a short link to join the city that follows whatever join code is set on City Link" },
      { type: "security", text: "New permissions: fivem.view and fivem.manage (City Link), duty.manage (setting other medics' status) and activity.view and activity.manage (Activity). Super Admin and Roster Admin get all five; HR Admin gets Activity and can view City Link; Assistant HR and Training Admin can view Activity. The Duty Board is open to every member with roster access" },
      { type: "security", text: "The FiveM resource has its own key (FIVEM_API_KEY) that can only report what happens in the city — it cannot reach the rest of the website. It never sends players' IP addresses, and the site refuses server addresses that point at cloud metadata or link-local addresses" },
    ],
  },
  {
    date: "2026-10-13",
    changes: [
      { type: "feature", text: "Promotion interviews: a session can be given a date, time and place; a result the panel holds as \"Review Required\" can be settled by management with a note (new interviews.review permission); a failed promotion announcement can be resent; and any session downloads as a PDF report (interviews.export)" },
      { type: "feature", text: "Promotion interview settings: a panel-disagreement warning when submitted scores are too far apart (Divergence threshold, 0 turns it off), and how far ahead promotion readiness looks (Readiness window). New interviews.readiness and interviews.analytics permissions are given to HR Admin, Roster Admin and Super Admin, with readiness also to Assistant HR, Training Admin and FTP; their pages follow in a later update" },
      { type: "fix", text: "Nexus EMS Bot: roles and people given access with /permissions or on Admin → Bot Permissions can now see and use those commands. Discord was still showing the staff commands to administrators only, a setting left over from earlier versions of the bot; the bot now clears it every time it starts" },
      { type: "fix", text: "Bot Permissions: Super Admin and Roster Admin can now open Admin → Bot Permissions and give access. The page had shipped with no role allowed to use it, so only super admins could see it" },
      { type: "improvement", text: "Nexus EMS Bot: when it stops at startup with \"DISCORD_TOKEN is not set\", it now says whether the .env file is missing (an update that replaced the folder deletes it, since the upload zip leaves it out) or is there with an empty token" },
      { type: "improvement", text: "Nexus EMS Bot: when it cannot load the access list from the website, /permissions view, /permissions check and the \"no access\" reply now say so and give the reason, instead of quietly letting only administrators through" },
    ],
  },
  {
    date: "2026-10-01",
    changes: [
      { type: "feature", text: "Bot Permissions: choose which Discord roles and people can use each Nexus EMS Bot command — or all of them — with /permissions in Discord (grant, revoke, clear, view, and check what someone can use) or on the new Admin → Bot Permissions page. Server administrators always have access, /ems and /duty stay open to everyone, and anyone else without access gets a private \"no access\" reply" },
      { type: "fix", text: "Saving Notification settings no longer risks wiping the bot's join-link setting — bot settings are now merged rather than replaced" },
      { type: "security", text: "Nexus EMS Bot never follows a redirect from the website address, so its credentials cannot be passed on to another site; a WEBSITE_URL that redirects (or is a protected Vercel preview address) now gets a message naming the address to use instead" },
      { type: "fix", text: "Nexus EMS Bot: its slash commands failed to register because /announce schedule listed a required option after optional ones; fixed, and the bot now checks every command before registering and names any that would be refused" },
      { type: "improvement", text: "Nexus EMS Bot connects to the website without any extra key: the website checks with Discord that the bot's token belongs to its own Discord application. NEXUS_BOT_API_KEY still works as an optional alternative, and when the website refuses the bot it now says exactly why" },
      { type: "fix", text: "Nexus EMS Bot: fixed \"No space left on device\" on small hosting servers. Node.js is now downloaded straight from nodejs.org (checked against its official checksum) keeping only what the bot runs on, and the upload zip ships the bot ready-built with its dependencies, so nothing is installed on the host — about 150 MB in total instead of over 300 MB. Space left behind by the earlier attempt is cleaned up automatically" },
      { type: "fix", text: "Nexus EMS Bot now runs on Python hosting servers: the panel's Python start-up installs Node.js through requirements.txt and app.py (or bot.py / main.py) starts the bot, so it no longer needs a Node.js server to run" },
      { type: "fix", text: "Nexus EMS Bot: fixed the bot failing to start. It no longer crashes when Discord's Server Members Intent is switched off — it starts without it and only join-link roles wait until it is turned on — and it no longer refuses to start when the website link or server ID is missing; only the bot token is required now, and the bot lists every other problem at startup with how to fix it" },
      { type: "improvement", text: "Nexus EMS Bot is ready to host: `npm install` then `npm start` is all it needs, `npm run package` makes a small upload zip without the Windows-only files that stopped it installing on Linux hosts, and a wrong token now says exactly how to replace it" },
      { type: "feature", text: "Nexus EMS Bot: a join link — everyone who joins the Discord server through the bot's invite link is given the EMS Recruit and EMS roles automatically. Set it up with /joinlink create (or /joinlink use for an invite already shared), choose other roles with /joinlink roles, and /joinlink view checks everything the bot needs and says how to fix what is missing" },
      { type: "improvement", text: "The home page no longer has the Member Services section; the roster and training remain in the top bar and footer" },
    ],
  },
  {
    date: "2026-09-30",
    changes: [
      { type: "feature", text: "Nexus EMS Bot: the site can now be run from Discord — review recruitment, onboarding, LOA and department applications, change ranks, call signs and roster status, edit notification settings and message text, set the home page banner, DM members, and clock on and off duty with slash commands. Every change is made through the site, so it sends the same DMs and posts and is credited in the audit log as \"(via Discord)\"" },
      { type: "feature", text: "Official announcements from the bot: post a branded announcement now, or schedule it for later with an optional daily or weekly repeat, then list, preview, edit or cancel it. Schedules are kept on the site, so they survive the bot restarting, and every post keeps a history with a link to the message" },
      { type: "security", text: "Who may use each bot command is set in Discord under Server Settings → Integrations → Nexus EMS Bot. Staff commands start out limited to server administrators until access is granted there, and the bot's access to the site is switched off unless NEXUS_BOT_API_KEY is set" },
      { type: "feature", text: "A new home page: the site now opens on a proper landing page with every application (Join EMS, department applications, Leave of Absence), the member services and the reference resources, each marked with who it is for, plus how joining works and live personnel and on-duty counts" },
      { type: "improvement", text: "The personnel roster has moved to its own page at /roster, linked from the home page, the top bar and the footer — signing in or out from the roster returns you to it" },
      { type: "improvement", text: "The top bar on the SOP, radio codes and training pages now highlights the page you are on, instead of always showing Roster as selected" },
      { type: "fix", text: "A bot token pasted with a \"Bot \" prefix or surrounding quotes is now cleaned up before use, instead of Discord rejecting every DM with 401 Unauthorized" },
      { type: "improvement", text: "When Discord rejects the bot token, the delivery log and messaging panel now say so plainly and explain how to replace it — including that a token saved in Notification settings overrides the one in the environment" },
    ],
  },
  {
    date: "2026-09-23",
    title: "Promotion & Interview examinations",
    changes: [
      { type: "improvement", text: "Promotion eligibility on an open interview is now re-checked live against today's roster and the current requirements, so a candidate who was a couple of days short when the session was opened is no longer still shown as failing once they have met it — the check made at creation is still there to open underneath" },
      { type: "feature", text: "Any single requirement can be waived for one candidate on one interview, with a reason, without changing the requirements for everyone else; the waiver is shown on the session and kept on the record with who made it" },
      { type: "improvement", text: "Finalizing as Passed warns when the candidate still does not meet every requirement, so an exception is made deliberately rather than by accident" },
      { type: "feature", text: "Promotions & Interviews: a full promotion examination system — create an interview session for an employee, sit a panel, score them and promote on a pass" },
      { type: "feature", text: "Creating an interview pulls the employee straight off the roster with their current rank, joining date, time in current rank and total EMS tenure worked out for you" },
      { type: "feature", text: "Promotion eligibility is checked before a session opens, and says exactly which requirement is not met rather than just \"not eligible\"" },
      { type: "feature", text: "Every session gets its own ID (EMS-PROMO-2026-0042) and can be joined by several interviewers at once, each with their own scores and notes that nobody else can overwrite" },
      { type: "feature", text: "Four scored categories — SOP Knowledge, Medical Knowledge, Situation Knowledge and Overall Performance — each 0-100 with the interviewer's own notes, plus a promotion recommendation" },
      { type: "feature", text: "Panel roles: Lead Interviewer, Interviewer, Observer and Management Reviewer. An Observer reads and writes notes but never scores or finalizes" },
      { type: "feature", text: "Individual and panel scores are worked out automatically, with the category averages shown against the minimum each one has to clear" },
      { type: "feature", text: "General Notes: several interviewers can record strengths, weaknesses and concerns side by side instead of overwriting one shared box" },
      { type: "feature", text: "Finalizing a pass promotes the employee on the roster, resets their time-in-rank counter, writes a permanent Promotion History entry and posts the promotion announcement to Discord — all in one step" },
      { type: "feature", text: "A failed interview leaves the rank untouched, keeps the whole record, and can start a cooldown before the employee may be re-interviewed" },
      { type: "feature", text: "Re-interviews are always new sessions with their own ID, panel, scores and result — an earlier attempt is never overwritten, and every attempt is listed on the session" },
      { type: "feature", text: "Promotion Settings for EMS management: passing score, per-category minimums, time in rank, EMS tenure, training and department requirements, cooldown length and the announcement channel and wording" },
      { type: "improvement", text: "Promotion History now shows the panel score and the session behind a promotion, expandable to the category averages and the panel who sat it, with filters for rank, date, interviewer, score and whether it came from an examination" },
      { type: "improvement", text: "Every score change, panel change and finalization is written to the Audit Log, including a score revised after submission" },
      { type: "security", text: "Two people pressing Finalize at the same moment can no longer promote twice: the first one through wins and the second is told the result is already recorded" },
      { type: "security", text: "New permissions: interviews.view, interviews.score, interviews.create, interviews.finalize and interviews.manage, granted to existing roles automatically — HR runs examinations end to end, Assistant HR, Training Admin and FTP sit on panels, and the thresholds stay with Super Admin and Roster Admin" },
    ],
  },
  {
    date: "2026-09-22",
    title: "Trainees and Promotion History",
    changes: [
      { type: "feature", text: "Trainees section: every Medical Intern on the roster with their joining date and how many days they have been in EMS, counted automatically" },
      { type: "feature", text: "Trainees leave the Trainees section on their own as soon as their rank is changed on the roster" },
      { type: "feature", text: "Promotion History: every rank change made on the roster is recorded with the previous and new rank, the date and who made it, and kept permanently" },
      { type: "feature", text: "Pick an employee in Promotion History to see their whole career on one timeline; filter by promotions or demotions" },
      { type: "improvement", text: "Promotions made before Promotion History existed are carried into it" },
      { type: "security", text: "New permissions: trainees.view and promotions.view, granted to the HR roles; FTP staff get trainees.view" },
      { type: "improvement", text: "Existing roles receive the new permissions automatically: Super Admin, Roster Admin and the HR roles get both, Training Admin and FTP get Trainees — anything changed on the Roles page is left as it is" },
    ],
  },
  {
    date: "2026-09-16",
    changes: [
      { type: "improvement", text: "Approving a recruit no longer asks for a rank — approve straight from the list or the review window, and set the rank on the roster instead" },
    ],
  },
  {
    date: "2026-09-14",
    title: "EMS roster redesign, duty tracking and the changelog",
    changes: [
      { type: "feature", text: "Public roster redesigned in the EMS theme: new header with every quick link, headcount tiles and a card per roster section" },
      { type: "feature", text: "Each roster section now groups its members by rank, most senior first, with a Rank Structure panel showing every rank, its insignia and how many hold it" },
      { type: "feature", text: "Filter the roster by department, status, shift and FTO role — the filters are kept in the page link, so a filtered view can be shared" },
      { type: "feature", text: "Signed-in members see time zone, join and promotion dates, Discord ID (click to copy), shift, duty status and total hours on the roster" },
      { type: "feature", text: "Clock on and off duty straight from the roster, with today's and all-time hours; an On Duty Now tile counts everyone currently working" },
      { type: "feature", text: "Click any member on the roster to open their full details" },
      { type: "feature", text: "Roster Banner admin section to set the spotlight strip across the top of the public roster" },
      { type: "feature", text: "This changelog page, listing every change made to the site" },
      { type: "improvement", text: "The admin roster groups each section by rank, the same way as the public roster" },
      { type: "security", text: "Visitors who are not signed in no longer receive members' private details with the roster page" },
      { type: "fix", text: "Editing a member on the admin roster: the fields are wider and larger so their values are readable, and the table scrolls sideways instead of squashing the columns" },
      { type: "improvement", text: "Training now follows an EMS curriculum — Foundations, Core Clinical Skills, Advanced Care & Operations, and a Probationary Evaluation — replacing the police academy topics carried over from the old roster" },
      { type: "feature", text: "Every training skill explains what it covers, and the trainer who signed it off and the date are recorded automatically" },
      { type: "feature", text: "Probationary evaluation tracks supervised patient calls and patient care reports filed against a target" },
      { type: "improvement", text: "The Training page lists every roster member, with search, progress filters and expandable checklists" },
      { type: "fix", text: "Signing off a skill on the Training page now saves" },
      { type: "fix", text: "The cadet Training Progress page now shows skills that have been signed off" },
      { type: "fix", text: "The Training Portal page loads again, showing each trainee's progress through every phase of the EMS curriculum" },
      { type: "feature", text: "EMS Call Log: log every patient contact — time, location, call type, priority, responding medics with a lead, outcome and receiving hospital — each with its own call number" },
      { type: "feature", text: "Call Log statistics: calls today, this week and this month, transport rate, the most common call types and the most active medics" },
      { type: "security", text: "Medics see the calls they logged or responded to; reading the whole Call Log, which includes patient details, needs supervisor access" },
    ],
  },
  {
    date: "2026-09-09",
    changes: [
      { type: "feature", text: "Change a field's type after it has been added" },
      { type: "fix", text: "Letterhead logos never printed; allow deleting issued documents" },
      { type: "feature", text: "Edit forms, document types and issued documents after creation" },
      { type: "feature", text: "Build a form by pasting a plain-text question list" },
      { type: "feature", text: "Letterhead logos, and a second letterhead band beneath the main one" },
      { type: "feature", text: "EMS medical documentation platform — form builder, documents, PDF export" },
    ],
  },
  {
    date: "2026-09-07",
    changes: [
      { type: "fix", text: "Require onboarding.approve to write recruits" },
      { type: "feature", text: "Search the roster by Discord, Steam and State ID" },
    ],
  },
  {
    date: "2026-09-03",
    changes: [
      { type: "feature", text: "Export section - every admin dataset as Excel or PDF" },
    ],
  },
  {
    date: "2026-09-02",
    changes: [
      { type: "feature", text: "EMS SOP document, and copy protection across the SOP reader" },
    ],
  },
  {
    date: "2026-09-01",
    changes: [
      { type: "feature", text: "Grant the baseline EMS Member role access to Shifts" },
      { type: "fix", text: "Relabel the nav login button to EMS Staff Login" },
      { type: "feature", text: "EMS shift signup and schedule under a new Shifts admin section" },
      { type: "fix", text: "Department webhook posts only the decision, and declines post too" },
      { type: "fix", text: "Honor the admin-configured bot token when granting Discord guild roles" },
      { type: "feature", text: "Grant Discord role and send join announcement on manual department add" },
      { type: "feature", text: "Two-way bot conversations, channel posts and a delivery log" },
      { type: "feature", text: "Search the recruit list and approve log" },
    ],
  },
  {
    date: "2026-08-31",
    changes: [
      { type: "feature", text: "Give the departments section its own permissions" },
      { type: "feature", text: "Turn the FTP interest form into a department join system" },
      { type: "feature", text: "Pick a rank when approving a recruit and DM it to them" },
    ],
  },
  {
    date: "2026-08-30",
    changes: [
      { type: "feature", text: "Call sign changes post on the promotion channel when they have no webhook" },
      { type: "feature", text: "Make notification settings real — auth, delivery log, tests, LOA cron" },
      { type: "feature", text: "Group members on LOA into their own roster section" },
      { type: "feature", text: "Give each notification channel its own message editor" },
    ],
  },
  {
    date: "2026-08-28",
    changes: [
      { type: "feature", text: "Replace rank-tied call signs with a shared 912-998 pool" },
      { type: "fix", text: "Auto-assigned call signs no longer stop when a rank's number band fills up" },
      { type: "fix", text: "Don't block call sign/promotion PATCH response on Discord webhook round-trip" },
      { type: "feature", text: "Add activity status filter to roster, surface real API errors in admin mutations" },
      { type: "feature", text: "Dedicated Call Signs section, notifies via webhook when a call sign changes" },
      { type: "feature", text: "Departmental rosters with a document link, plus rank/department roster filters" },
      { type: "fix", text: "Guarantee a webhook/notification fires at most once per approval or promotion" },
      { type: "feature", text: "Provision every roster member into the Admin Users list, with search and role filter" },
      { type: "feature", text: "Actually tag the promoted member in the promotion webhook" },
      { type: "feature", text: "Role hierarchy — a permission on a lower role cascades up automatically" },
      { type: "feature", text: "Image uploads and related links on SOP documents" },
      { type: "feature", text: "Assign multiple roles to one person, plus individual permission grants" },
    ],
  },
  {
    date: "2026-08-27",
    changes: [
      { type: "feature", text: "Assign the Discord FTP role on enrollment, revoke it when removed from the roster" },
      { type: "feature", text: "Post a promotion notice to Discord and reassign call sign on rank increase" },
      { type: "feature", text: "Grant FTP, Assistant HR and HR Admin permission to add and edit SOPs" },
      { type: "feature", text: "Restrict FTP applications to Paramedic and above" },
      { type: "fix", text: "SOP page survives a missing table, and repair the schema push" },
      { type: "fix", text: "Apply the Prisma schema during the build so deploys stop shipping missing tables" },
      { type: "feature", text: "Multiple SOP documents with a switcher, restricted to members" },
      { type: "feature", text: "Audit log recording who changed and approved what" },
      { type: "feature", text: "Sync admin user data from the roster on login, editable role permissions" },
      { type: "feature", text: "Inline role dropdown for existing admin users" },
      { type: "feature", text: "Replace radio codes with the current department list" },
      { type: "feature", text: "Remove Shifts, Incidents and Audit Log" },
      { type: "improvement", text: "Add db:check and .env.example" },
      { type: "feature", text: "Roster-gated login with role-based access, and close the auth holes" },
      { type: "fix", text: "Surface the real cause of API failures instead of a generic message" },
      { type: "fix", text: "Unbreak dev server and deploy, harden admin pages, add role presets" },
    ],
  },
  {
    date: "2026-08-26",
    changes: [
      { type: "fix", text: "Remove generated prisma import from audit.ts, use cast as never" },
      { type: "fix", text: "Prisma Json type in audit.ts" },
      { type: "fix", text: "Add recharts dep, fix Next.js 16 async params in shifts/incidents routes" },
      { type: "fix", text: "Add missing incidentMembers relation to Member model" },
      { type: "fix", text: "Prisma 7 Json default syntax" },
      { type: "feature", text: "Advanced system overhaul - auth, audit, charts, profiles, shifts, incidents" },
      { type: "fix", text: "Remove proxy.ts to fix Next.js 16 build error" },
      { type: "fix", text: "Move proxy.ts back to src/ where Next.js 16 expects it" },
      { type: "fix", text: "Move proxy.ts to project root for Next.js 16 compatibility" },
      { type: "fix", text: "Merge middleware into proxy.ts for Next.js 16 compatibility" },
      { type: "feature", text: "Confirmation dialogs, loading skeletons, mobile sidebar, CSV export" },
      { type: "feature", text: "EMS red theme rebrand + admin dashboard" },
      { type: "fix", text: "API auth, training field mapping, deduplicate constants, add error toasts" },
    ],
  },
  {
    date: "2026-08-25",
    changes: [
      { type: "feature", text: "Add Bot Messaging page + user lookup API + fix webhook DB templates" },
      { type: "improvement", text: "Update webhook format to match desired style with @mention" },
      { type: "feature", text: "Add {discordId} variable to webhook messages to mention users" },
      { type: "improvement", text: "Use State Discord Invite Link from settings for all messages" },
    ],
  },
  {
    date: "2026-08-24",
    changes: [
      { type: "improvement", text: "Update recruit webhook message to new EMS accepted format with invite link" },
      { type: "improvement", text: "Make Steam ID optional in recruit, only Discord ID required" },
      { type: "improvement", text: "Recruit import: upsert by Discord ID, update existing instead of skipping" },
      { type: "improvement", text: "Full message management: customize all webhook/DM messages, configure webhooks, manage bot settings" },
      { type: "feature", text: "Add Approve Log tab to recruit page" },
      { type: "improvement", text: "Update recruitment webhook messages to new format" },
      { type: "feature", text: "Add notification settings page to enable/disable webhooks and DMs per feature" },
      { type: "fix", text: "Test DM to use correct endpoint" },
      { type: "improvement", text: "Remove webhook from onboarding and FTP, keep only for recruitment" },
      { type: "feature", text: "Add manual entry, edit, and test DM/webhook for recruit system" },
      { type: "feature", text: "Add XLSX import support for recruit system" },
      { type: "feature", text: "Add Character Name, Discord Username, and User fields to recruit system" },
      { type: "improvement", text: "Update recruit CSV import to parse export file columns automatically" },
      { type: "feature", text: "Replace invite page with recruit system: CSV import, approve/reject with webhook and DM" },
      { type: "feature", text: "Add Category column to admin roster table showing FTP status" },
    ],
  },
  {
    date: "2026-08-23",
    changes: [
      { type: "improvement", text: "Remove all departments except EMS from FTP form" },
      { type: "feature", text: "Add FTP Interest button to hero header" },
      { type: "feature", text: "Add FTP application system: public form, admin review, auto-assign FTP category on approval" },
      { type: "feature", text: "Add HR Assistant role with HR permissions" },
      { type: "feature", text: "Add acceptance and rejection images to webhook messages" },
      { type: "improvement", text: "Post rejection message to webhook when application is declined" },
      { type: "feature", text: "Add acceptance workflow: webhook + DM with welcome message on approval" },
      { type: "feature", text: "Add Send DM button to onboarding invite page" },
      { type: "feature", text: "Add EMS Onboarding Invite page with editable message template" },
    ],
  },
  {
    date: "2026-08-22",
    changes: [
      { type: "feature", text: "Add Discord mention tag to all webhook notifications" },
      { type: "improvement", text: "Post LOA request to Discord when submitted" },
      { type: "improvement", text: "Separate webhook for enrollment notifications" },
      { type: "improvement", text: "Post to Discord when new member is enrolled with name and call sign" },
      { type: "feature", text: "Add Discord webhook for LOA approve/decline notifications via EMS HR Assistant bot" },
      { type: "improvement", text: "Rename hero button from Join EMS to Enroll in Roster" },
    ],
  },
  {
    date: "2026-08-21",
    changes: [
      { type: "improvement", text: "Make State ID mandatory on onboarding form" },
      { type: "improvement", text: "Rename LSMD to EMS across all pages and components" },
      { type: "improvement", text: "Remove 'Why do you want to join LSMD?' field from onboarding form" },
      { type: "improvement", text: "Simplify Join LSMD card to match minimal section style" },
      { type: "feature", text: "Add Join LSMD call-to-action card at bottom of roster" },
      { type: "improvement", text: "Auto-assign call signs based on rank when approving onboarding or adding members" },
      { type: "feature", text: "Add onboarding system: public form, admin approve with rank assignment, auto-create member" },
      { type: "improvement", text: "Rename Patrol to Medical Patrol" },
      { type: "improvement", text: "Rename NCO section to Lead, update section hints" },
      { type: "feature", text: "Add uniform pages, reassign call signs by rank" },
      { type: "improvement", text: "Style select dropdowns with black background and white text" },
      { type: "fix", text: "Show Approved LOAs in Active LOAs section" },
      { type: "improvement", text: "LOA approval workflow: pending requests, admin approve/decline, roster status update" },
      { type: "feature", text: "Add public LOA request page at /loa with member search" },
      { type: "improvement", text: "Rename top rank to Director of Medicine" },
      { type: "feature", text: "Add PUT handler to SOP API so saves actually work" },
      { type: "feature", text: "Add stateId field to Member model, add 14 EMS members" },
      { type: "feature", text: "Add Discord ID 1170690398558097511 as super admin" },
      { type: "fix", text: "/api/members to return sections, add error handling to all API routes" },
      { type: "feature", text: "Add error handling for Vercel runtime, env validation, debug endpoint" },
      { type: "improvement", text: "First release: LSMD Roster Application with Prisma 7, Next.js 16, Discord OAuth" },
    ],
  },
  {
    date: "2026-08-19",
    changes: [
      { type: "improvement", text: "Project created" },
    ],
  },
];
