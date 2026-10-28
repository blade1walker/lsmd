import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CONTENT_FIELD_MAP,
  SITE_CONTENT,
  clientValues,
  contentDefaults,
  decodeValue,
  encodeValue,
  flagOf,
  parseNoticeInput,
  resolveContent,
  textOf,
  validateValue,
  type ContentField,
} from "@/lib/site-content";
import { isStoredFileName, readImage, saveImage, sniffImage } from "@/lib/media-storage";

const field = (key: string): ContentField => {
  const f = CONTENT_FIELD_MAP.get(key);
  assert.ok(f, `no field ${key}`);
  return f;
};

test("every content key is unique and every default passes its own validation", () => {
  assert.equal(new Set(SITE_CONTENT.map((f) => f.key)).size, SITE_CONTENT.length);
  for (const f of SITE_CONTENT) {
    const checked = validateValue(f, f.default);
    assert.ok("value" in checked, `${f.key}: ${"error" in checked ? checked.error : ""}`);
  }
});

test("text is trimmed, single-line text loses line breaks, and limits are enforced", () => {
  assert.deepEqual(validateValue(field("brand.name"), "  Los   Santos\nEMS "), { value: "Los Santos EMS" });
  assert.deepEqual(validateValue(field("home.hero.intro"), "Line one\r\nLine two"), { value: "Line one\nLine two" });
  assert.ok("error" in validateValue(field("brand.name"), "x".repeat(41)));
  // A required heading cannot be blanked; an optional link can.
  assert.ok("error" in validateValue(field("brand.name"), "   "));
  assert.deepEqual(validateValue(field("contact.discordInvite"), ""), { value: "" });
});

test("links must be http(s) or a path on the site — never javascript: or another host's //path", () => {
  const url = field("contact.discordInvite");
  assert.ok("value" in validateValue(url, "https://discord.gg/abc"));
  assert.ok("value" in validateValue(url, "/connect"));
  assert.ok("error" in validateValue(url, "javascript:alert(1)"));
  assert.ok("error" in validateValue(url, "//evil.example/x"));
  assert.ok("error" in validateValue(url, "data:text/html,hi"));
  assert.ok("error" in validateValue(field("contact.email"), "not-an-email"));
  assert.ok("value" in validateValue(field("contact.email"), "ems@example.com"));
});

test("images must come from the media library or an https address", () => {
  const logo = field("brand.logo");
  assert.ok("value" in validateValue(logo, "/media/0123456789abcdef01234567.png"));
  assert.ok("value" in validateValue(logo, "https://cdn.example.com/logo.png"));
  assert.ok("error" in validateValue(logo, "/media/../../etc/passwd"));
  assert.ok("error" in validateValue(logo, "http://cdn.example.com/logo.png"));
  assert.ok("error" in validateValue(logo, "/media/0123456789abcdef01234567.svg"));
});

test("switches only take true or false", () => {
  const toggle = field("home.cta.show");
  assert.deepEqual(validateValue(toggle, false), { value: false });
  assert.ok("error" in validateValue(toggle, "false"));
});

test("the live site shows published values; preview lays the drafts on top", () => {
  const rows = [
    { key: "brand.name", published: encodeValue("Published EMS"), draft: encodeValue("Draft EMS") },
    { key: "home.cta.show", published: null, draft: encodeValue(false) },
    // Unknown keys and values that no longer validate are ignored.
    { key: "removed.key", published: encodeValue("x"), draft: null },
    { key: "contact.email", published: encodeValue("bad"), draft: null },
  ];
  const live = resolveContent(rows, "published");
  assert.equal(live["brand.name"], "Published EMS");
  assert.equal(live["home.cta.show"], true);
  assert.equal(live["contact.email"], "");
  assert.equal("removed.key" in live, false);

  const preview = resolveContent(rows, "preview");
  assert.equal(preview["brand.name"], "Draft EMS");
  assert.equal(preview["home.cta.show"], false);
});

test("reading values falls back to the default for missing or mistyped keys", () => {
  const values = { ...contentDefaults(), "brand.name": 5 as unknown as string };
  assert.equal(textOf(values, "brand.name"), "Los Santos EMS");
  assert.equal(flagOf({}, "home.cta.show"), true);
  assert.equal(textOf({}, "not.a.key"), "");
  assert.equal(decodeValue(field("brand.name"), "{not json"), undefined);
});

test("the browser gets the brand, contact, footer and section switches, not the home page's text", () => {
  const sent = clientValues(contentDefaults());
  assert.equal(sent["brand.name"], "Los Santos EMS");
  assert.equal(sent["footer.disclaimer"], CONTENT_FIELD_MAP.get("footer.disclaimer")?.default);
  assert.equal(sent["home.applications.show"], true);
  assert.equal("home.hero.intro" in sent, false);
  assert.equal("home.cta.title" in sent, false);
});

test("notices need a title, keep to their limits and only link somewhere safe", () => {
  const ok = parseNoticeInput({ title: " Drive  this weekend ", body: "Come along", tone: "urgent", linkUrl: "/onboarding" });
  assert.ok("data" in ok);
  if ("data" in ok) {
    assert.equal(ok.data.title, "Drive this weekend");
    assert.equal(ok.data.tone, "urgent");
    assert.equal(ok.data.linkLabel, null);
  }
  assert.ok("error" in parseNoticeInput({ title: "" }));
  assert.ok("error" in parseNoticeInput({ title: "x".repeat(81) }));
  assert.ok("error" in parseNoticeInput({ title: "Hi", linkUrl: "javascript:alert(1)" }));
  const unknownTone = parseNoticeInput({ title: "Hi", tone: "rainbow", linkLabel: "ignored without a link" });
  assert.ok("data" in unknownTone && unknownTone.data.tone === "info" && unknownTone.data.linkLabel === null);
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test("uploads are recognised by their bytes, not their name — SVG and HTML are refused", () => {
  assert.equal(sniffImage(PNG), "png");
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(sniffImage(new TextEncoder().encode("GIF89a......")), "gif");
  assert.equal(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "webp");
  assert.equal(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
  assert.equal(sniffImage(new TextEncoder().encode("<html><script>")), null);
  assert.equal(isStoredFileName("0123456789abcdef01234567.png"), true);
  assert.equal(isStoredFileName("../0123456789abcdef01234567.png"), false);
  assert.equal(isStoredFileName("0123456789abcdef01234567.svg"), false);
});

test("an image is stored under its content hash and read back; anything else is refused", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lsmd-media-"));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  try {
    const saved = await saveImage(PNG);
    assert.ok("fileName" in saved);
    if (!("fileName" in saved)) return;
    assert.match(saved.fileName, /^[a-f0-9]{24}\.png$/);
    assert.deepEqual(await readFile(path.join(dir, "uploads", saved.fileName)), Buffer.from(PNG));
    // The same picture twice is one file.
    const again = await saveImage(PNG);
    assert.ok("fileName" in again && again.fileName === saved.fileName);

    const read = await readImage(saved.fileName);
    assert.equal(read?.mimeType, "image/png");
    assert.equal(await readImage("../../etc/passwd"), null);

    assert.ok("error" in (await saveImage(new Uint8Array(0))));
    assert.ok("error" in (await saveImage(new TextEncoder().encode("<svg/>"))));
    assert.ok("error" in (await saveImage(new Uint8Array(5 * 1024 * 1024 + 1))));
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
