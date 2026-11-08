import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin } from "@/lib/auth/api";

test("isSameOrigin lets this site and origin-less requests through, refuses other sites", () => {
  assert.equal(isSameOrigin(null, "lsmd.tech"), true);
  assert.equal(isSameOrigin("https://lsmd.tech", "lsmd.tech"), true);
  assert.equal(isSameOrigin("http://localhost:3000", "localhost:3000"), true);
  assert.equal(isSameOrigin("https://evil.example", "lsmd.tech"), false);
  assert.equal(isSameOrigin("https://lsmd.tech.evil.example", "lsmd.tech"), false);
  assert.equal(isSameOrigin("null", "lsmd.tech"), false);
});
