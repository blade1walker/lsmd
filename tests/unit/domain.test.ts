import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCallInput } from "@/lib/calls";
import { parseUnitStatus } from "@/lib/duty-board";
import { parseActivityPeriod } from "@/lib/activity";
import { dayCount, daysBetween } from "@/lib/loa";
import { groupByRank, matchesFilters, parseRosterFilters, EMPTY_FILTERS, type RosterMember } from "@/lib/roster-shared";

const validCall = {
  occurredAt: new Date().toISOString(),
  location: "Pillbox Hill",
  nature: "Fall",
  outcome: "Transported",
  hospital: "Pillbox Hill Medical Center",
  responders: ["m1", { memberId: "m2", role: "Lead" }, "m1"],
};

test("calls need a known nature, outcome and hospital, and get exactly one lead", () => {
  const parsed = parseCallInput(validCall);
  assert.ok("data" in parsed);
  if ("data" in parsed) {
    assert.equal(parsed.data.responders.length, 2);
    assert.deepEqual(parsed.data.responders.map((r) => r.role), ["Responder", "Lead"]);
    assert.equal(parsed.data.priority, "P2");
  }
  assert.ok("error" in parseCallInput({ ...validCall, nature: "Made up" }));
  assert.ok("error" in parseCallInput({ ...validCall, hospital: "" }));
  assert.ok("error" in parseCallInput({ ...validCall, responders: [] }));
  assert.ok("error" in parseCallInput({ ...validCall, occurredAt: new Date(Date.now() + 2 * 3600_000).toISOString() }));
});

test("unit statuses accept labels and radio shorthand", () => {
  assert.equal(parseUnitStatus("En Route"), "En Route");
  assert.equal(parseUnitStatus("enroute"), "En Route");
  assert.equal(parseUnitStatus("10-8"), "Available");
  assert.equal(parseUnitStatus("flying"), null);
});

test("activity periods fall back to a week", () => {
  assert.equal(parseActivityPeriod("30"), 30);
  assert.equal(parseActivityPeriod("999"), 7);
});

test("leave day counts", () => {
  assert.equal(daysBetween("2026-01-01T00:00:00Z", "2026-01-04T12:00:00Z"), 3);
  assert.equal(dayCount(0), "today");
  assert.equal(dayCount(1), "1 day");
});

test("roster filters drop anything they do not recognise", () => {
  const f = parseRosterFilters({ q: "  jane ", status: "Bogus", shift: "evening", fto: "FTO" });
  assert.equal(f.q, "jane");
  assert.equal(f.status, "");
  assert.equal(f.shift, "evening");
  assert.equal(f.fto, "FTO");
});

test("roster search and grouping", () => {
  const member = (name: string, rank: string, extra: Partial<RosterMember> = {}) =>
    ({ id: name, name, rank, callSign: null, activity: "Active", departments: [], shift: null, ...extra }) as unknown as RosterMember;
  const people = [member("A", "EMT"), member("B", "Paramedic"), member("C", "EMT", { callSign: "915" })];
  assert.equal(people.filter((m) => matchesFilters(m, { ...EMPTY_FILTERS, q: "915" })).length, 1);
  assert.deepEqual(groupByRank(people).map((g) => g.rank), ["Paramedic", "EMT"]);
});
