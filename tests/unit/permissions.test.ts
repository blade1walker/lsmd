import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_PERMISSIONS, LOA_PERMISSIONS, FIVEM_PERMISSIONS, ACTIVITY_PERMISSIONS, isRankAtLeast } from "@/lib/constants";
import { effectiveRolePermissions, inheritedPermissions } from "@/lib/auth/role-hierarchy";
import { ROLE_PRESETS } from "@/lib/auth/role-presets";

const roles = [
  { id: "top", order: 0, permissions: ["roles.manage"] },
  { id: "hr", order: 1, permissions: ["hr.loa"] },
  { id: "member", order: 2, permissions: ["roster.view"] },
];

test("a role holds every permission of the roles ranked below it", () => {
  assert.deepEqual(effectiveRolePermissions([roles[0]], roles).sort(), ["hr.loa", "roles.manage", "roster.view"]);
  assert.deepEqual(effectiveRolePermissions([roles[2]], roles), ["roster.view"]);
  assert.deepEqual(inheritedPermissions(roles[1], roles), ["roster.view"]);
  assert.deepEqual(effectiveRolePermissions([], roles), []);
});

test("every permission is declared once", () => {
  assert.equal(new Set(ALL_PERMISSIONS).size, ALL_PERMISSIONS.length);
});

test("permission groups only name declared permissions", () => {
  const known = new Set<string>(ALL_PERMISSIONS);
  for (const group of [LOA_PERMISSIONS, FIVEM_PERMISSIONS, ACTIVITY_PERMISSIONS]) {
    for (const list of Object.values(group)) for (const p of list) assert.ok(known.has(p), p);
  }
  for (const preset of ROLE_PRESETS) for (const p of preset.permissions) assert.ok(known.has(p), `${preset.name}: ${p}`);
});

test("HR roles can open the LOA section through hr.loa", () => {
  for (const name of ["HR Admin", "Assistant HR"]) {
    const preset = ROLE_PRESETS.find((r) => r.name === name)!;
    assert.ok(LOA_PERMISSIONS.manage.some((p) => preset.permissions.includes(p)), name);
  }
});

test("an unknown rank never passes a rank requirement", () => {
  assert.equal(isRankAtLeast("Not A Rank", "EMT"), false);
  assert.equal(isRankAtLeast(null, "EMT"), false);
  assert.equal(isRankAtLeast("Paramedic", "EMT"), true);
});
