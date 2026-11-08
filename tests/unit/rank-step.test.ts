import { test } from "node:test";
import assert from "node:assert/strict";
import { rankStep } from "@/lib/constants";

// Highest first, like RANK_LIST.
const LADDER = ["Chief", "Captain", "Paramedic", "EMT"];

test("rankStep promotes towards the top of the ladder and demotes towards the bottom", () => {
  assert.equal(rankStep("Paramedic", "up", LADDER), "Captain");
  assert.equal(rankStep("Paramedic", "down", LADDER), "EMT");
});

test("rankStep stops at either end and refuses an unknown rank", () => {
  assert.equal(rankStep("Chief", "up", LADDER), null);
  assert.equal(rankStep("EMT", "down", LADDER), null);
  assert.equal(rankStep("Janitor", "up", LADDER), null, "an unknown rank must not jump to the top");
});
