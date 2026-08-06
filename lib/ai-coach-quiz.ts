export type MultipleChoiceQuizOption = {
  value: string;
  label: string;
};

export type MultipleChoiceQuizQuestion = {
  id: string;
  title: string;
  description?: string;
  options: MultipleChoiceQuizOption[];
  multiple: boolean;
};

export type MultipleChoiceQuiz = {
  title: string;
  description?: string;
  questions: MultipleChoiceQuizQuestion[];
};

export type MultipleChoiceQuizAnswers = Record<
  string,
  { selected: string[]; custom?: string }
>;

const MAX_QUIZ_QUESTIONS = 10;
const MAX_QUIZ_OPTIONS = 8;
export const AI_COACH_QUIZ_SUBMISSION_PREFIX =
  "[[AI_COACH_QUIZ_SUBMISSION]]";

export function formatQuietQuizSubmission(message: string) {
  return `${AI_COACH_QUIZ_SUBMISSION_PREFIX}\n${message.trim()}`;
}

export function isQuietQuizSubmission(message: string) {
  return message.trimStart().startsWith(AI_COACH_QUIZ_SUBMISSION_PREFIX);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function readOptionalString(
  value: unknown,
  maxLength: number,
): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) return null;
  return normalized;
}

export function isMultipleChoiceQuizFence(language?: string | null) {
  if (!language) return true;
  const normalized = language.toLowerCase();
  return normalized === "quiz" || normalized === "json";
}

export function isStreamingMultipleChoiceQuiz(
  source: string,
  language?: string | null,
) {
  const normalizedLanguage = language?.trim().toLowerCase();
  if (normalizedLanguage === "quiz") return true;
  if (normalizedLanguage && normalizedLanguage !== "json") return false;

  return (
    /["']questions["']\s*:/.test(source) ||
    /["']title["']\s*:\s*["'][^"']*\bquiz\b/i.test(source)
  );
}

export function hasMultipleChoiceQuiz(markdown: string) {
  const fencedBlockPattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fencedBlockPattern.exec(markdown)) !== null) {
    const language = match[1]?.trim().split(/\s+/)[0] ?? null;
    const source = match[2] ?? "";
    if (
      isMultipleChoiceQuizFence(language) &&
      parseMultipleChoiceQuiz(source)
    ) {
      return true;
    }
  }

  return false;
}

function isManualQuizSubmissionInstruction(markdown: string) {
  const text = markdown.replace(/`+/g, "").replace(/\s+/g, " ").trim();
  if (!text) return false;

  const asksForSubmission =
    /\b(?:answer|respond|reply|send|submit)\b/i.test(text);
  const exposesJsonContract =
    /\bjson\b/i.test(text) &&
    /\b(?:question\s*ids?|option\s*(?:values?|letters?)|json\s*(?:object|format))\b/i.test(
      text,
    );

  return asksForSubmission && exposesJsonContract;
}

export function stripManualQuizSubmissionInstructions(markdown: string) {
  if (!hasMultipleChoiceQuiz(markdown)) return markdown;

  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment
        .split(/\n{2,}/)
        .filter((paragraph) => !isManualQuizSubmissionInstruction(paragraph))
        .join("\n\n");
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseMultipleChoiceQuiz(
  source: string,
): MultipleChoiceQuiz | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  const title = readString(parsed.title, 120);
  const description = readOptionalString(parsed.description, 400);
  if (!title || description === null || !Array.isArray(parsed.questions)) {
    return null;
  }
  if (
    parsed.questions.length === 0 ||
    parsed.questions.length > MAX_QUIZ_QUESTIONS
  ) {
    return null;
  }

  const questionIds = new Set<string>();
  const questions: MultipleChoiceQuizQuestion[] = [];

  for (const candidate of parsed.questions) {
    if (!isRecord(candidate)) return null;

    const id = readString(candidate.id, 80);
    const questionTitle = readString(candidate.title, 500);
    const questionDescription = readOptionalString(
      candidate.description,
      600,
    );
    if (
      !id ||
      !questionTitle ||
      questionDescription === null ||
      questionIds.has(id) ||
      !Array.isArray(candidate.options) ||
      candidate.options.length < 2 ||
      candidate.options.length > MAX_QUIZ_OPTIONS ||
      (candidate.multiple !== undefined &&
        typeof candidate.multiple !== "boolean")
    ) {
      return null;
    }

    const optionValues = new Set<string>();
    const options: MultipleChoiceQuizOption[] = [];
    for (const optionCandidate of candidate.options) {
      if (!isRecord(optionCandidate)) return null;
      const value = readString(optionCandidate.value, 80);
      const label = readString(optionCandidate.label, 300);
      if (!value || !label || optionValues.has(value)) return null;
      optionValues.add(value);
      options.push({ value, label });
    }

    questionIds.add(id);
    questions.push({
      id,
      title: questionTitle,
      description: questionDescription,
      options,
      multiple: candidate.multiple === true,
    });
  }

  return { title, description, questions };
}

export function formatMultipleChoiceQuizAnswers(
  quiz: MultipleChoiceQuiz,
  answers: MultipleChoiceQuizAnswers,
) {
  const lines = quiz.questions.map((question, index) => {
    const selectedValues = answers[question.id]?.selected ?? [];
    const selectedLabels = selectedValues.map(
      (value) =>
        question.options.find((option) => option.value === value)?.label ??
        value,
    );

    return `${index + 1}. ${question.title}\nAnswer: ${selectedLabels.join(", ")}`;
  });

  return `Here are my answers to “${quiz.title}”:\n\n${lines.join("\n\n")}\n\nGrade my answers and explain any mistakes.`;
}
