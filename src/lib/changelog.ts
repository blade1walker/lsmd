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
