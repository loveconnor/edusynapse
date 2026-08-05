import assert from "node:assert/strict";
import test from "node:test";

import {
  getLearningStatus,
  selectContinueItem,
  selectRecommendationItem,
  type LearningItemSummary,
} from "./learning.ts";

function item(
  overrides: Partial<LearningItemSummary> & Pick<LearningItemSummary, "id">,
): LearningItemSummary {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    progress: overrides.progress ?? 0,
    current_lesson: overrides.current_lesson ?? null,
    last_studied_at: overrides.last_studied_at ?? null,
    created_at: overrides.created_at ?? "2026-08-01T12:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-08-01T12:00:00.000Z",
  };
}

test("learning status is derived from progress", () => {
  assert.equal(getLearningStatus(0), "not-started");
  assert.equal(getLearningStatus(42), "in-progress");
  assert.equal(getLearningStatus(100), "completed");
});

test("continue selects the most recently active item already in progress", () => {
  const selected = selectContinueItem([
    item({ id: "new", progress: 0, updated_at: "2026-08-04T12:00:00.000Z" }),
    item({ id: "older", progress: 20, updated_at: "2026-08-02T12:00:00.000Z" }),
    item({ id: "recent", progress: 60, updated_at: "2026-08-03T12:00:00.000Z" }),
    item({ id: "done", progress: 100, updated_at: "2026-08-04T12:00:00.000Z" }),
  ]);

  assert.equal(selected?.id, "recent");
});

test("continue selects a not-started item when nothing is in progress", () => {
  const selected = selectContinueItem([
    item({ id: "older", updated_at: "2026-08-02T12:00:00.000Z" }),
    item({ id: "recent", updated_at: "2026-08-03T12:00:00.000Z" }),
  ]);

  assert.equal(selected?.id, "recent");
});

test("recommendation selects the least-progressed unfinished item", () => {
  const selected = selectRecommendationItem([
    item({ id: "advanced", progress: 80 }),
    item({ id: "next", progress: 15 }),
    item({ id: "done", progress: 100 }),
  ]);

  assert.equal(selected?.id, "next");
});

test("completed learning produces no continue item or recommendation", () => {
  const completed = [item({ id: "done", progress: 100 })];

  assert.equal(selectContinueItem(completed), null);
  assert.equal(selectRecommendationItem(completed), null);
});
