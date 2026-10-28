/**
 * The Boss Menu's content model: every piece of the public website that can
 * be edited without a code change, with its default (what the site showed
 * before it was editable), its type and its limits.
 *
 * Client-safe. Values live in the SiteContent table as JSON text with a
 * draft and a published copy; ./site-content-server reads and writes them.
 */

export type ContentType = "text" | "textarea" | "url" | "email" | "toggle" | "image";
export type ContentValue = string | boolean;

export interface ContentGroup {
  id: string;
  label: string;
  description: string;
}

export interface ContentField {
  key: string;
  group: string;
  label: string;
  type: ContentType;
  default: ContentValue;
  /** Longest text accepted. */
  max?: number;
  help?: string;
}

export const CONTENT_GROUPS: ContentGroup[] = [
  { id: "brand", label: "Brand & contact", description: "The name in the top bar, the logo, and how people reach the community." },
  { id: "hero", label: "Home — top banner", description: "The first thing visitors see." },
  { id: "applications", label: "Home — Applications", description: "The forms section and its cards." },
  { id: "joining", label: "Home — How joining works", description: "The four steps for new applicants." },
  { id: "resources", label: "Home — Resources", description: "The SOP, radio codes and uniform cards." },
  { id: "cta", label: "Home — closing call to action", description: "The box at the bottom of the home page." },
  { id: "footer", label: "Footer", description: "Shown at the bottom of every public page." },
];

const t = (key: string, group: string, label: string, value: string, max = 120, help?: string): ContentField => ({
  key,
  group,
  label,
  type: "text",
  default: value,
  max,
  help,
});
const area = (key: string, group: string, label: string, value: string, max = 600): ContentField => ({
  key,
  group,
  label,
  type: "textarea",
  default: value,
  max,
});
const show = (key: string, group: string, label: string, help?: string): ContentField => ({
  key,
  group,
  label,
  type: "toggle",
  default: true,
  help,
});

export const SITE_CONTENT: ContentField[] = [
  // Brand & contact
  t("brand.name", "brand", "Department name", "Los Santos EMS", 40, "In the top bar of the home page."),
  t("brand.community", "brand", "Community name", "Nexus Universe", 40),
  {
    key: "brand.logo",
    group: "brand",
    label: "Logo",
    type: "image",
    default: "",
    help: "Replaces the Star of Life in the top bar and on the home page. A square PNG or WebP works best.",
  },
  {
    key: "contact.discordInvite",
    group: "brand",
    label: "Discord invite link",
    type: "url",
    default: "",
    help: "The footer's Discord link, e.g. https://discord.gg/yourcode. Hidden while empty.",
  },
  {
    key: "contact.fivemUrl",
    group: "brand",
    label: "FiveM server link",
    type: "url",
    default: "/connect",
    help: "/connect follows the join code set on City Link.",
  },
  { key: "contact.email", group: "brand", label: "Contact email", type: "email", default: "", help: "Shown in the footer when set." },

  // Home — top banner
  t("home.hero.badge", "hero", "Badge above the title", "Nexus Universe RP", 40),
  t("home.hero.titleTop", "hero", "Title — first line", "Los Santos", 40),
  t("home.hero.titleAccent", "hero", "Title — red words", "Emergency Medical", 40),
  t("home.hero.titleEnd", "hero", "Title — last words", "Services", 40),
  area(
    "home.hero.intro",
    "hero",
    "Introduction",
    "First on scene when it matters most. Apply to join the department, manage your membership, and find everything a Los Santos medic needs, all in one place.",
    300
  ),
  t("home.hero.primaryCta", "hero", "Main button", "Apply to Join", 30),
  t("home.hero.secondaryCta", "hero", "Second button", "All Applications", 30),
  {
    key: "home.hero.image",
    group: "hero",
    label: "Background picture",
    type: "image",
    default: "",
    help: "Shown faintly behind the top banner. Wide pictures (1600×900 or larger) work best.",
  },
  show("home.hero.showStats", "hero", "Show personnel, on-duty and department counts"),
  show("home.hero.showCity", "hero", "Show the FiveM server card"),

  // Home — Applications
  show("home.applications.show", "applications", "Show this section"),
  t("home.applications.eyebrow", "applications", "Small heading", "Applications", 40),
  t("home.applications.title", "applications", "Heading", "Apply, request and enrol", 80),
  area(
    "home.applications.intro",
    "applications",
    "Introduction",
    "Every form and training test the department runs. Each one goes straight to the right team, and you hear back on Discord.",
    300
  ),
  t("home.applications.join.title", "applications", "Join EMS — title", "Join EMS", 50),
  area(
    "home.applications.join.description",
    "applications",
    "Join EMS — description",
    "Apply to become a Los Santos medic. HR reviews every application and sends the decision to you on Discord.",
    240
  ),
  t("home.applications.department.title", "applications", "Department Application — title", "Department Application", 50),
  area(
    "home.applications.department.description",
    "applications",
    "Department Application — description",
    "Already on the roster? Apply to a specialist department and follow your application through review.",
    240
  ),
  t("home.applications.loa.title", "applications", "Leave of Absence — title", "Leave of Absence", 50),
  area(
    "home.applications.loa.description",
    "applications",
    "Leave of Absence — description",
    "Going away for a while? Request a Leave of Absence with your dates and reason, so command knows before you go.",
    240
  ),
  show("home.applications.showTraining", "applications", "Show the training and quiz cards"),

  // Home — How joining works
  show("home.joining.show", "joining", "Show this section"),
  t("home.joining.eyebrow", "joining", "Small heading", "Becoming a medic", 40),
  t("home.joining.title", "joining", "Heading", "How joining works", 80),
  t("home.joining.step1.title", "joining", "Step 1 — title", "Apply", 40),
  area("home.joining.step1.text", "joining", "Step 1 — text", "Fill in the short application with your character and Discord details.", 200),
  t("home.joining.step2.title", "joining", "Step 2 — title", "Review", 40),
  area("home.joining.step2.text", "joining", "Step 2 — text", "HR reviews your application and checks your details.", 200),
  t("home.joining.step3.title", "joining", "Step 3 — title", "Decision", 40),
  area(
    "home.joining.step3.text",
    "joining",
    "Step 3 — text",
    "The bot sends you the result on Discord, with the server invite if you are accepted.",
    200
  ),
  t("home.joining.step4.title", "joining", "Step 4 — title", "Field training", 40),
  area(
    "home.joining.step4.text",
    "joining",
    "Step 4 — text",
    "You join as a trainee and a Field Training Officer works with you on shift.",
    200
  ),

  // Home — Resources
  show("home.resources.show", "resources", "Show this section"),
  t("home.resources.eyebrow", "resources", "Small heading", "Reference", 40),
  t("home.resources.title", "resources", "Heading", "Resources", 80),
  area("home.resources.intro", "resources", "Introduction", "The procedures, codes and standards every medic works to.", 300),
  t("home.resources.sop.title", "resources", "SOP — title", "Standard Operating Procedures", 50),
  area("home.resources.sop.description", "resources", "SOP — description", "How the department works, from scene conduct to chain of command.", 240),
  t("home.resources.radio.title", "resources", "Radio Codes — title", "Radio Codes", 50),
  area("home.resources.radio.description", "resources", "Radio Codes — description", "10-codes, 11-codes and response codes used on the radio.", 240),
  t("home.resources.uniform.title", "resources", "Uniform Guide — title", "Uniform Guide", 50),
  area(
    "home.resources.uniform.description",
    "resources",
    "Uniform Guide — description",
    "Standard uniform components and rank colours for every medic.",
    240
  ),

  // Home — closing call to action
  show("home.cta.show", "cta", "Show this section"),
  t("home.cta.title", "cta", "Heading", "Ready to answer the call?", 80),
  area("home.cta.text", "cta", "Text", "Applications are open. It takes a couple of minutes, and HR replies on Discord.", 300),
  t("home.cta.button", "cta", "Button", "Apply to Join", 30),

  // Footer
  area(
    "footer.about",
    "footer",
    "About text",
    "Los Santos Emergency Medical Services — applications, roster, procedures and training. Part of the Nexus Universe GTA V Roleplay community.",
    300
  ),
  t("footer.disclaimer", "footer", "Disclaimer", "This is a fictional roleplay community. Not affiliated with any real emergency service.", 200),
];

export const CONTENT_FIELD_MAP = new Map(SITE_CONTENT.map((f) => [f.key, f]));

/** Every value the site renders, by key. */
export type SiteContentValues = Record<string, ContentValue>;

export function contentDefaults(): SiteContentValues {
  return Object.fromEntries(SITE_CONTENT.map((f) => [f.key, f.default]));
}

/** A text value, falling back to the field's default for an unknown or mistyped key. */
export function textOf(content: SiteContentValues, key: string): string {
  const value = content[key];
  if (typeof value === "string") return value;
  const fallback = CONTENT_FIELD_MAP.get(key)?.default;
  return typeof fallback === "string" ? fallback : "";
}

export function flagOf(content: SiteContentValues, key: string): boolean {
  const value = content[key];
  if (typeof value === "boolean") return value;
  return CONTENT_FIELD_MAP.get(key)?.default !== false;
}

/** A stored value back into a ContentValue, or undefined when it is not valid for the field any more. */
export function decodeValue(field: ContentField, stored: string | null | undefined): ContentValue | undefined {
  if (stored === null || stored === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(stored);
    const checked = validateValue(field, value);
    return "value" in checked ? checked.value : undefined;
  } catch {
    return undefined;
  }
}

export function encodeValue(value: ContentValue): string {
  return JSON.stringify(value);
}

const MEDIA_PATH = /^\/media\/[a-f0-9]{16,64}\.(png|jpg|webp|gif)$/;

/** A link the site may point at: a path on the site, or an http(s) address. Never javascript: and the like. */
function safeUrl(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//") && !/[\s\\]/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Checks a submitted value against its field. Text is trimmed and single-line text loses its line breaks. */
export function validateValue(field: ContentField, raw: unknown): { value: ContentValue } | { error: string } {
  if (field.type === "toggle") {
    return typeof raw === "boolean" ? { value: raw } : { error: `${field.label}: choose on or off` };
  }
  if (typeof raw !== "string") return { error: `${field.label}: enter text` };

  let value = raw.trim();
  if (field.type === "text") value = value.replace(/\s+/g, " ");
  if (field.type === "textarea") value = value.replace(/\r\n/g, "\n");
  const max = field.max ?? (field.type === "textarea" ? 600 : 300);
  if (value.length > max) return { error: `${field.label}: at most ${max} characters` };

  switch (field.type) {
    case "text":
      return value || field.default === "" ? { value } : { error: `${field.label}: cannot be empty` };
    case "textarea":
      return { value };
    case "url":
      return !value || safeUrl(value) ? { value } : { error: `${field.label}: use a full https:// link or a path on this site` };
    case "email":
      return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { value } : { error: `${field.label}: not an email address` };
    case "image":
      return !value || MEDIA_PATH.test(value) || (value.startsWith("https://") && safeUrl(value))
        ? { value }
        : { error: `${field.label}: pick an image from the media library` };
  }
}

/**
 * The values client components read: everything but the home page's text,
 * which that page renders on the server — so it is not sent to the browser a
 * second time on every public page. Its switches stay, for the header's links.
 */
export function clientValues(values: SiteContentValues): SiteContentValues {
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => !key.startsWith("home.") || typeof value === "boolean"));
}

/** The stored row for one key, as the server reads it. */
export interface ContentRow {
  key: string;
  draft: string | null;
  published: string | null;
}

/**
 * What the site shows. Published: each published value, or the default.
 * Preview: pending drafts on top of that — what publishing would make live.
 */
export function resolveContent(rows: ContentRow[], mode: "published" | "preview"): SiteContentValues {
  const values = contentDefaults();
  for (const row of rows) {
    const field = CONTENT_FIELD_MAP.get(row.key);
    if (!field) continue;
    const published = decodeValue(field, row.published);
    if (published !== undefined) values[row.key] = published;
    if (mode === "preview") {
      const draft = decodeValue(field, row.draft);
      if (draft !== undefined) values[row.key] = draft;
    }
  }
  return values;
}

/** Notice tones and their colours. */
export const NOTICE_TONES = {
  info: { label: "Information", className: "border-sky-500/30 bg-sky-500/10 text-sky-100", dot: "bg-sky-400" },
  success: { label: "Good news", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100", dot: "bg-emerald-400" },
  warning: { label: "Heads up", className: "border-amber-500/30 bg-amber-500/10 text-amber-100", dot: "bg-amber-400" },
  urgent: { label: "Urgent", className: "border-red-500/40 bg-red-500/10 text-red-100", dot: "bg-red-400" },
} as const;

export type NoticeTone = keyof typeof NOTICE_TONES;

export function isNoticeTone(value: unknown): value is NoticeTone {
  return typeof value === "string" && value in NOTICE_TONES;
}

export const NOTICE_LIMITS = { title: 80, body: 600, linkLabel: 30 } as const;

export interface NoticeInput {
  title: string;
  body: string;
  tone: NoticeTone;
  linkUrl: string | null;
  linkLabel: string | null;
}

export function parseNoticeInput(raw: unknown): { data: NoticeInput } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Nothing was submitted" };
  const b = raw as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().replace(/\s+/g, " ") : "";
  const body = typeof b.body === "string" ? b.body.trim().replace(/\r\n/g, "\n") : "";
  if (!title) return { error: "Give the notice a title" };
  if (title.length > NOTICE_LIMITS.title) return { error: `The title can be at most ${NOTICE_LIMITS.title} characters` };
  if (body.length > NOTICE_LIMITS.body) return { error: `The text can be at most ${NOTICE_LIMITS.body} characters` };
  const linkUrl = typeof b.linkUrl === "string" && b.linkUrl.trim() ? b.linkUrl.trim() : null;
  if (linkUrl && !safeUrl(linkUrl)) return { error: "The link must be a full https:// address or a path on this site" };
  const linkLabel = typeof b.linkLabel === "string" && b.linkLabel.trim() ? b.linkLabel.trim().slice(0, NOTICE_LIMITS.linkLabel) : null;
  return { data: { title, body, tone: isNoticeTone(b.tone) ? b.tone : "info", linkUrl, linkLabel: linkUrl ? linkLabel : null } };
}

/** A notice as the site and the Boss Menu read it. */
export interface SiteNoticeView {
  id: string;
  title: string;
  body: string;
  tone: NoticeTone;
  linkUrl: string | null;
  linkLabel: string | null;
  status: "Draft" | "Published";
  order: number;
  publishedAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

/** One field as the Boss Menu edits it. */
export interface ContentFieldState {
  key: string;
  /** What the public site shows now. */
  published: ContentValue;
  /** The value being edited — the draft if there is one, else the live value. */
  value: ContentValue;
  pending: boolean;
  isDefault: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** What the public pages' layout hands every page under it. */
export interface SiteContentState {
  values: SiteContentValues;
  notices: SiteNoticeView[];
  preview: boolean;
}
