import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimiter } from "@/lib/rate-limit";

test("rateLimiter allows `limit` hits per key per window, then refuses until the window ends", () => {
  const allow = rateLimiter(2, 1000);
  assert.equal(allow("a", 0), true);
  assert.equal(allow("a", 10), true);
  assert.equal(allow("a", 20), false);
  assert.equal(allow("b", 20), true, "other keys are counted separately");
  assert.equal(allow("a", 1000), true, "a new window starts fresh");
});
