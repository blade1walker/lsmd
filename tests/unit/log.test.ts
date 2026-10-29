import { test } from "node:test";
import assert from "node:assert/strict";
import { log } from "@/lib/log";

function capture(run: () => void): string[] {
  const lines: string[] = [];
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (line: unknown) => void lines.push(String(line));
  try {
    run();
  } finally {
    Object.assign(console, saved);
  }
  return lines;
}

test("log lines are level, message and key=value fields, quoted only when needed", () => {
  const [line] = capture(() => log.info("Daily backup taken", { file: "lsmd.db", kb: 12, empty: undefined }));
  assert.equal(line, 'level=info msg="Daily backup taken" file=lsmd.db kb=12');
});

test("a database error carries its code and message, without a stack", () => {
  const error = Object.assign(new Error("Unique constraint failed\n  on memberId"), { code: "P2002" });
  const lines = capture(() => log.error("Failed to update", error, { status: 500 }));
  assert.deepEqual(lines, ['level=error msg="Failed to update" status=500 error="Unique constraint failed on memberId" code=P2002']);
});

test("an unexpected error also gets its stack on the following lines", () => {
  const lines = capture(() => log.error("Crashed", new TypeError("x is undefined")));
  assert.equal(lines[0], 'level=error msg=Crashed error="x is undefined"');
  assert.match(lines[1], /^TypeError: x is undefined\n\s+at /);
});
