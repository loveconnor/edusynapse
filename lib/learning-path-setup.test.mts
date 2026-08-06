import assert from "node:assert/strict";
import test from "node:test";
import { parseLearningPathSetupGuidance } from "./learning-path-setup.ts";

test("parses personalized goal guidance", () => {
  const guidance = parseLearningPathSetupGuidance(
    JSON.stringify({
      question: "Which React outcome matters most for the app you want to build?",
      options: [
        { label: "Build an interactive prototype", value: "Build an interactive React prototype" },
        { label: "Understand component design", value: "Design reusable React components" },
        { label: "Connect real API data", value: "Build a React app that uses an API" },
      ],
    }),
    "goal",
  );

  assert.equal(guidance.options.length, 3);
  assert.match(guidance.question, /React/);
});

test("requires stable values for experience guidance", () => {
  assert.throws(() =>
    parseLearningPathSetupGuidance(
      JSON.stringify({
        question: "Where should we begin?",
        options: [
          { label: "New", value: "new" },
          { label: "Some experience", value: "some" },
          { label: "Advanced", value: "advanced" },
        ],
      }),
      "experience",
    ),
  );
});
