import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_COACH_MODEL,
  buildCoachConversationTitle,
  buildCoachSystemPrompt,
  buildTodayFocus,
  getFirstName,
  isValidCoachConversationId,
  type CoachLearningItem,
} from "./ai-coach.ts";

const baseItem: CoachLearningItem = {
  id: "react",
  title: "React",
  notes: "Review components and props.",
  progress: 40,
  current_lesson: "Components",
  last_studied_at: "2026-08-04T12:00:00.000Z",
  created_at: "2026-08-01T12:00:00.000Z",
  updated_at: "2026-08-04T12:00:00.000Z",
};

test("uses the requested Ollama model", () => {
  assert.equal(AI_COACH_MODEL, "gpt-oss:120b-cloud");
});

test("builds a truthful focus from current learning progress", () => {
  const focus = buildTodayFocus([baseItem], "30 min");

  assert.equal(focus.title, "React");
  assert.equal(focus.durationLabel, "30 min");
  assert.equal(focus.progress, 40);
  assert.match(focus.reason, /40% through React/);
  assert.equal(focus.href, "/learning/react");
});

test("does not invent a study duration when no preference exists", () => {
  const focus = buildTodayFocus([baseItem], null);

  assert.equal(focus.durationLabel, "Choose a time");
});

test("states unavailable personalization signals in the system context", () => {
  const prompt = buildCoachSystemPrompt({
    profile: {
      name: "Connor Love",
      learning_context: "For work",
      goals: ["Understand topics more deeply"],
      daily_study_time: "30 min",
    },
    items: [baseItem],
    materials: [{ learning_item_id: "react", file_name: "notes.pdf" }],
    currentDate: "August 5, 2026",
  });

  assert.match(prompt, /Quiz history and scores are not stored yet/);
  assert.match(prompt, /only filenames and saved notes are available/);
  assert.match(prompt, /notes\.pdf/);
  assert.match(prompt, /fenced code block labeled quiz/);
  assert.match(prompt, /Do not put the answer key/);
  assert.match(prompt, /private implementation details/);
  assert.match(prompt, /Never tell the learner.*using JSON/);
  assert.match(prompt, /Do not add manual submission instructions/);
  assert.match(prompt, /\[\[AI_COACH_QUIZ_SUBMISSION\]\]/);
  assert.match(prompt, /learner’s score/);
  assert.doesNotMatch(prompt, /68%/);
});

test("builds an evidence-informed teaching policy without inventing mastery", () => {
  const prompt = buildCoachSystemPrompt({
    profile: {
      name: "Connor Love",
      learning_context: "For work",
      goals: ["Understand topics more deeply"],
      daily_study_time: "30 min",
    },
    items: [baseItem],
    materials: [],
    currentDate: "August 5, 2026",
  });

  assert.match(prompt, /durable, independent understanding/);
  assert.match(prompt, /Answer a simple factual or logistical question directly/);
  assert.match(prompt, /worked example/);
  assert.match(prompt, /fade hints/);
  assert.match(prompt, /support ladder/);
  assert.match(prompt, /explain the idea in their own words/);
  assert.match(prompt, /active retrieval and practice spread across time/);
  assert.match(prompt, /assisted performance from learning/);
  assert.match(prompt, /not to a claimed visual, auditory/);
  assert.match(prompt, /Do not claim that one quiz proves mastery/);
});

test("uses the first word of a saved display name for the greeting", () => {
  assert.equal(getFirstName("  Connor Love  "), "Connor");
});

test("creates truthful, bounded conversation titles", () => {
  assert.equal(
    buildCoachConversationTitle("  Explain   React hooks again  "),
    "Explain React hooks again",
  );
  assert.equal(buildCoachConversationTitle("", ["hooks.pdf"]), "Study hooks.pdf");
  assert.equal(buildCoachConversationTitle("x".repeat(100)).length, 80);
});

test("accepts only UUID conversation identifiers", () => {
  assert.equal(
    isValidCoachConversationId("4fdf6b10-e4eb-4a71-913e-10e68c09c504"),
    true,
  );
  assert.equal(isValidCoachConversationId("not-a-conversation"), false);
});
