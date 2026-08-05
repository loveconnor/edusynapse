import assert from "node:assert/strict";
import test from "node:test";

import { isValidLoginEmail, normalizeLoginEmail } from "./login-email.ts";

test("normalizes email addresses consistently", () => {
  assert.equal(
    normalizeLoginEmail(" Learner@Example.com "),
    "learner@example.com",
  );
});

test("accepts a plausible email address", () => {
  assert.equal(isValidLoginEmail("learner@example.com"), true);
});

test("rejects incomplete and oversized email addresses", () => {
  assert.equal(isValidLoginEmail("learner@"), false);
  assert.equal(isValidLoginEmail(`${"a".repeat(250)}@example.com`), false);
});
