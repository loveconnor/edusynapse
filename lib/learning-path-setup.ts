export type LearningPathSetupStep =
  | "topic"
  | "goal"
  | "experience"
  | "schedule"
  | "materials";

export type LearningPathSetupOption = {
  label: string;
  value: string;
};

export type LearningPathSetupGuidance = {
  question: string;
  options: LearningPathSetupOption[];
};

const FIXED_VALUES: Partial<Record<LearningPathSetupStep, string[]>> = {
  experience: ["beginner", "intermediate", "advanced", "unsure"],
  schedule: ["few-days", "two-weeks", "month", "open"],
};

function boundedText(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && [...text].length <= maximum ? text : null;
}

export function parseLearningPathSetupGuidance(
  raw: string,
  step: LearningPathSetupStep,
): LearningPathSetupGuidance {
  const normalized = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const value: unknown = JSON.parse(normalized);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Setup guidance must be an object");
  }

  const record = value as Record<string, unknown>;
  const question = boundedText(record.question, 240);
  if (!question) throw new Error("Setup guidance requires a question");

  const rawOptions = Array.isArray(record.options) ? record.options : [];
  const options = rawOptions.map((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) {
      throw new Error("Setup options must be objects");
    }
    const optionRecord = option as Record<string, unknown>;
    const label = boundedText(optionRecord.label, 120);
    const optionValue = boundedText(optionRecord.value, 240);
    if (!label || !optionValue) throw new Error("Setup options require labels and values");
    return { label, value: optionValue };
  });

  if (step === "materials") {
    return { question, options: [] };
  }
  if (options.length < 3 || options.length > 4) {
    throw new Error("Setup guidance requires three or four options");
  }

  const requiredValues = FIXED_VALUES[step];
  if (requiredValues) {
    const actualValues = new Set(options.map((option) => option.value));
    if (
      actualValues.size !== requiredValues.length ||
      requiredValues.some((required) => !actualValues.has(required))
    ) {
      throw new Error(`Setup guidance has invalid ${step} values`);
    }
  }

  return { question, options };
}
