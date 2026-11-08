import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { NAV_SECTIONS, activeHref, visibleSections } from "@/app/admin/nav";

const ADMIN = path.join(process.cwd(), "src", "app", "admin");

test("every sidebar link has a page in its category's route group", () => {
  for (const section of NAV_SECTIONS) {
    for (const { href } of section.items) {
      const page = path.join(ADMIN, `(${section.id})`, href.replace(/^\/admin\//, ""), "page.tsx");
      assert.ok(existsSync(page), `${href} should live at ${path.relative(process.cwd(), page)}`);
    }
  }
});

test("no admin page folder is left outside a category", () => {
  const loose = readdirSync(ADMIN, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("(") && d.name !== "login")
    .map((d) => d.name);
  assert.deepEqual(loose, []);
});

test("activeHref picks the deepest matching item, including sub-pages", () => {
  assert.equal(activeHref("/admin/roster", NAV_SECTIONS), "/admin/roster");
  assert.equal(activeHref("/admin/roster/abc123", NAV_SECTIONS), "/admin/roster");
  assert.equal(activeHref("/admin/medical/forms", NAV_SECTIONS), "/admin/medical/forms");
  assert.equal(activeHref("/admin/medical/doc1", NAV_SECTIONS), "/admin/medical");
  assert.equal(activeHref("/admin/roster-banner", NAV_SECTIONS), "/admin/roster-banner");
  assert.equal(activeHref("/admin/nope", NAV_SECTIONS), null);
});

test("visibleSections shows only permitted items and drops empty categories", () => {
  const sections = visibleSections(false, ["roster.view"]);
  assert.deepEqual(
    sections.map((s) => [s.id, s.items.map((i) => i.href)]),
    [
      ["overview", ["/admin/dashboard", "/admin/duty-board"]],
      ["personnel", ["/admin/roster"]],
    ]
  );
  assert.equal(visibleSections(true, []).length, NAV_SECTIONS.length);
});
