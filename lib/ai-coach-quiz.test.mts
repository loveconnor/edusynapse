import assert from "node:assert/strict";
import test from "node:test";
import {
  formatQuietQuizSubmission,
  formatMultipleChoiceQuizAnswers,
  hasMultipleChoiceQuiz,
  isMultipleChoiceQuizFence,
  isQuietQuizSubmission,
  isStreamingMultipleChoiceQuiz,
  parseMultipleChoiceQuiz,
  stripManualQuizSubmissionInstructions,
} from "./ai-coach-quiz.ts";

const validQuiz = JSON.stringify({
  title: "React fundamentals",
  description: "Choose the best answer.",
  questions: [
    {
      id: "components",
      title: "What does a React component return?",
      options: [
        { value: "a", label: "A UI description" },
        { value: "b", label: "A database row" },
      ],
    },
  ],
});

test("parses a valid multiple-choice quiz", () => {
  const quiz = parseMultipleChoiceQuiz(validQuiz);

  assert.equal(quiz?.title, "React fundamentals");
  assert.equal(quiz?.questions[0]?.multiple, false);
  assert.equal(quiz?.questions[0]?.options.length, 2);
});

test("accepts the JSON fence and empty optional descriptions emitted by the model", () => {
  const quiz = parseMultipleChoiceQuiz(
    JSON.stringify({
      title: "React Basics Quiz",
      description: "Answer each question.",
      questions: [
        {
          id: "q1",
          title: "What does JSX stand for?",
          description: "",
          multiple: false,
          options: [
            { value: "a", label: "JavaScript XML" },
            { value: "b", label: "JavaScript eXpress" },
          ],
        },
      ],
    }),
  );

  assert.equal(isMultipleChoiceQuizFence("json"), true);
  assert.equal(quiz?.questions[0]?.description, undefined);
});

test("rejects malformed or ambiguous quiz data", () => {
  assert.equal(parseMultipleChoiceQuiz("not json"), null);
  assert.equal(
    parseMultipleChoiceQuiz(
      JSON.stringify({
        title: "Invalid quiz",
        questions: [
          {
            id: "q1",
            title: "Choose one",
            options: [{ value: "a", label: "Only option" }],
          },
        ],
      }),
    ),
    null,
  );
});

test("formats selected option labels for the coach to grade", () => {
  const quiz = parseMultipleChoiceQuiz(validQuiz);
  assert.ok(quiz);

  const message = formatMultipleChoiceQuizAnswers(quiz, {
    components: { selected: ["a"] },
  });

  assert.match(message, /Answer: A UI description/);
  assert.match(message, /Grade my answers and explain any mistakes/);
  assert.doesNotMatch(message, /Answer: a$/m);
});

test("detects an interactive quiz inside a Markdown response", () => {
  const markdown = `Try this quiz:\n\n\`\`\`json\n${validQuiz}\n\`\`\``;

  assert.equal(hasMultipleChoiceQuiz(markdown), true);
  assert.equal(hasMultipleChoiceQuiz("```json\n{\"title\":\"Notes\"}\n```"), false);
});

test("detects quiz JSON while it is still streaming", () => {
  assert.equal(isStreamingMultipleChoiceQuiz("{", "quiz"), true);
  assert.equal(
    isStreamingMultipleChoiceQuiz(
      '{"title":"React fundamentals","questions":[',
      "json",
    ),
    true,
  );
  assert.equal(
    isStreamingMultipleChoiceQuiz('{"title":"React Quiz', "json"),
    true,
  );
  assert.equal(
    isStreamingMultipleChoiceQuiz('{"title":"API response"}', "json"),
    false,
  );
  assert.equal(
    isStreamingMultipleChoiceQuiz('{"questions":[]}', "javascript"),
    false,
  );
});

test("removes manual JSON submission instructions around an interactive quiz", () => {
  const markdown = [
    "Here’s a short React quiz for you.",
    'Answer by sending a JSON object that maps each question ID to the option value you choose, such as `{"q1":"b"}`.',
    `\`\`\`quiz\n${validQuiz}\n\`\`\``,
    "Submit your answers using the JSON format described above.",
  ].join("\n\n");

  const visibleMarkdown = stripManualQuizSubmissionInstructions(markdown);

  assert.match(visibleMarkdown, /Here’s a short React quiz for you/);
  assert.match(visibleMarkdown, /```quiz/);
  assert.doesNotMatch(visibleMarkdown, /JSON object/);
  assert.doesNotMatch(visibleMarkdown, /JSON format/);
});

test("preserves JSON guidance when the response is not an interactive quiz", () => {
  const markdown = "Submit the payload using the JSON format described above.";

  assert.equal(stripManualQuizSubmissionInstructions(markdown), markdown);
});

test("marks quiz submissions that should stay out of the visible chat", () => {
  const submission = formatQuietQuizSubmission("Answer: JavaScript XML");

  assert.equal(isQuietQuizSubmission(submission), true);
  assert.match(submission, /Answer: JavaScript XML/);
});
