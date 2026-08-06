import assert from "node:assert/strict";
import test from "node:test";

import {
  displayMasteryLabel,
  formatLearningMinutes,
  masteryLabel,
  parseGeneratedLearningPath,
} from "./learning-path.ts";

function generatedPath() {
  return {
    title: "React fundamentals",
    description: "Build a practical mental model of React.",
    targetOutcome: "Create a small React application.",
    estimatedMinutes: 120,
    modules: [
      {
        title: "Foundations",
        description: "The core rendering model.",
        objective: "Understand how React structures interfaces.",
        estimatedMinutes: 120,
        topics: [
          {
            title: "Components",
            objective: "Create and compose React components.",
            learningQuestion: "How do components structure an interface?",
            difficulty: "beginner",
            estimatedMinutes: 30,
            keyConcepts: ["component", "composition"],
            activities: [
              {
                type: "explanation",
                title: "Learn components",
                instructions: "Read the explanation.",
                estimatedMinutes: 5,
                required: true,
                content: { body: "A component is a reusable UI unit." },
                sourceReferences: [],
              },
              {
                type: "example",
                title: "See a component",
                instructions: "Review the example.",
                estimatedMinutes: 5,
                required: true,
                content: { body: "`function Welcome() {}`" },
                sourceReferences: [],
              },
              {
                type: "guided_practice",
                title: "Create a component",
                instructions: "Write a component with a hint.",
                estimatedMinutes: 10,
                required: true,
                content: { body: "Create a Welcome component.", hints: ["Start with a function."] },
                sourceReferences: [],
              },
              {
                type: "knowledge_check",
                title: "Check your understanding",
                instructions: "Answer two questions.",
                estimatedMinutes: 10,
                required: true,
                content: {
                  questions: [
                    {
                      question: "What is a component?",
                      options: ["A reusable UI unit", "A database"],
                      answer: "A reusable UI unit",
                      explanation: "Components encapsulate interface structure.",
                    },
                  ],
                },
                sourceReferences: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

test("generated learning paths are parsed into the bounded domain shape", () => {
  const parsed = parseGeneratedLearningPath(JSON.stringify(generatedPath()));

  assert.equal(parsed.modules[0].topics[0].activities.length, 4);
  assert.equal(parsed.modules[0].topics[0].difficulty, "beginner");
});

test("generated topics require explanation, example, practice, and a check", () => {
  const value = generatedPath();
  value.modules[0].topics[0].activities = value.modules[0].topics[0].activities.filter(
    (activity) => activity.type !== "knowledge_check",
  );

  assert.throws(
    () => parseGeneratedLearningPath(JSON.stringify(value)),
    /4–12 items|knowledge check/,
  );
});

test("mastery labels use understandable thresholds", () => {
  assert.equal(masteryLabel(0), "not_started");
  assert.equal(masteryLabel(55), "developing");
  assert.equal(masteryLabel(92), "mastered");
  assert.equal(masteryLabel(92, true), "needs_review");
  assert.equal(displayMasteryLabel("needs_review"), "Needs review");
});

test("learning time is formatted without false precision", () => {
  assert.equal(formatLearningMinutes(35), "35 min");
  assert.equal(formatLearningMinutes(120), "2 hr");
  assert.equal(formatLearningMinutes(135), "2 hr 15 min");
});
