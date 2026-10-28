import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROMOTION_SETTINGS,
  daysBetween,
  evaluateThresholds,
  individualScore,
  panelDiverges,
  panelScores,
  type PanelistRecord,
} from "@/lib/interviews";

function panelist(role: string, scores: [number, number, number, number] | null, submitted = true): PanelistRecord {
  const [sop, medical, situation, overall] = scores ?? [null, null, null, null];
  const record = { sopScore: sop, medicalScore: medical, situationScore: situation, overallScore: overall };
  return {
    role,
    ...record,
    individualScore: individualScore(record),
    submittedAt: submitted ? new Date().toISOString() : null,
  } as unknown as PanelistRecord;
}

test("an evaluation counts only once all four scores are in", () => {
  assert.equal(individualScore({ sopScore: 80, medicalScore: 70, situationScore: 90, overallScore: 60 }), 75);
  assert.equal(individualScore({ sopScore: 80, medicalScore: null, situationScore: 90, overallScore: 60 }), null);
});

test("the panel score ignores observers and unsubmitted drafts", () => {
  const scores = panelScores([
    panelist("Lead Interviewer", [80, 80, 80, 80]),
    panelist("Interviewer", [60, 60, 60, 60]),
    panelist("Observer", [10, 10, 10, 10]),
    panelist("Interviewer", [100, 100, 100, 100], false),
  ]);
  assert.equal(scores.finalScore, 70);
  assert.equal(scores.submitted, 2);
  assert.equal(scores.expected, 3);
  assert.equal(scores.spread, 20);
  assert.equal(panelDiverges(scores, DEFAULT_PROMOTION_SETTINGS), true);
});

test("thresholds fail a candidate below the pass mark or a category floor", () => {
  const pass = evaluateThresholds(panelScores([panelist("Lead Interviewer", [75, 75, 75, 75])]), DEFAULT_PROMOTION_SETTINGS);
  assert.equal(pass.suggested, "Passed");

  const lowCategory = evaluateThresholds(panelScores([panelist("Lead Interviewer", [100, 50, 100, 100])]), DEFAULT_PROMOTION_SETTINGS);
  assert.equal(lowCategory.suggested, "Failed");
  assert.equal(lowCategory.failures.length, 1);

  assert.equal(evaluateThresholds(panelScores([]), DEFAULT_PROMOTION_SETTINGS).suggested, "Pending");
});

test("days between dates are counted by calendar day in UTC", () => {
  assert.equal(daysBetween(new Date("2026-01-01T23:00:00Z"), new Date("2026-01-02T01:00:00Z")), 1);
  assert.equal(daysBetween(new Date("2026-01-05T00:00:00Z"), new Date("2026-01-01T00:00:00Z")), 0);
});
