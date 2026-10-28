import { test } from "node:test";
import assert from "node:assert/strict";
import { autoScore, grade, parseQuestionText, seededShuffle, type TestQuestion } from "@/lib/tests";

function q(partial: Partial<TestQuestion> & Pick<TestQuestion, "id" | "type">): TestQuestion {
  return { prompt: "Q", options: [], correct: [], accepted: [], points: 1, required: true, ...partial };
}

test("single choice scores only the right option", () => {
  const question = q({ id: "a", type: "single", options: [{ id: "x", text: "X" }, { id: "y", text: "Y" }], correct: ["y"], points: 2 });
  assert.equal(autoScore(question, "y"), 2);
  assert.equal(autoScore(question, "x"), 0);
  assert.equal(autoScore(question, undefined), 0);
});

test("checkboxes are all-or-nothing unless partial credit is on", () => {
  const base = { id: "m", type: "multiple" as const, correct: ["a", "b"], points: 4 };
  assert.equal(autoScore(q(base), ["a", "b"]), 4);
  assert.equal(autoScore(q(base), ["a"]), 0);
  const partial = q({ ...base, partialCredit: true });
  assert.equal(autoScore(partial, ["a"]), 2);
  // A wrong tick takes a share back, never below zero.
  assert.equal(autoScore(partial, ["a", "c"]), 0);
  assert.equal(autoScore(partial, ["c", "d"]), 0);
});

test("short answers ignore case, spacing and punctuation", () => {
  const question = q({ id: "s", type: "short", accepted: ["Cardiac Arrest"] });
  assert.equal(autoScore(question, "  cardiac   arrest! "), 1);
  assert.equal(autoScore(question, "stroke"), 0);
});

test("number answers allow the set tolerance", () => {
  const question = q({ id: "n", type: "number", numberAnswer: 120, tolerance: 5 });
  assert.equal(autoScore(question, "124"), 1);
  assert.equal(autoScore(question, "1,26"), 0); // 126 after removing the comma: outside tolerance
  assert.equal(autoScore(question, "abc"), 0);
});

test("grade waits for hand-marked answers and applies overrides", () => {
  const questions = [
    q({ id: "a", type: "truefalse", options: [{ id: "true", text: "True" }, { id: "false", text: "False" }], correct: ["true"], points: 1 }),
    q({ id: "b", type: "long", points: 4 }),
  ];
  const pending = grade(questions, { a: "true", b: "Some essay" });
  assert.equal(pending.score, null);
  assert.equal(pending.pendingManual, 1);

  const marked = grade(questions, { a: "true", b: "Some essay" }, { b: 3 });
  assert.equal(marked.earned, 4);
  assert.equal(marked.total, 5);
  assert.equal(marked.score, 80);

  // A grader cannot award more than the question is worth.
  assert.equal(grade(questions, { a: "true", b: "x" }, { b: 99 }).earned, 5);
  // An unanswered hand-marked question scores 0 without waiting for anyone.
  assert.equal(grade(questions, { a: "false" }).score, 0);
});

test("seededShuffle is stable for a seed and keeps every item", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const one = seededShuffle(items, "attempt-1");
  assert.deepEqual(seededShuffle(items, "attempt-1"), one);
  assert.deepEqual([...one].sort((a, b) => a - b), items);
});

test("parseQuestionText reads choices, stars and tags", () => {
  const { questions } = parseQuestionText(
    [
      "What does P1 mean?",
      "- Non-urgent",
      "- *Life-threatening",
      "Which are vital signs?",
      "- *Pulse",
      "- *Blood pressure",
      "- Hair colour",
    ].join("\n")
  );
  assert.equal(questions.length, 2);
  assert.equal(questions[0].type, "single");
  assert.equal(questions[0].correct.length, 1);
  assert.equal(questions[1].type, "multiple");
  assert.equal(questions[1].correct.length, 2);
});
