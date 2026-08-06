export const LEARNING_PATH_ACTIVITY_TYPES = [
  "explanation",
  "example",
  "guided_practice",
  "independent_practice",
  "knowledge_check",
  "reflection",
  "review",
  "applied_task",
] as const;

export const MASTERY_LABELS = [
  "not_started",
  "introduced",
  "developing",
  "proficient",
  "mastered",
  "needs_review",
] as const;

export type LearningPathActivityType =
  (typeof LEARNING_PATH_ACTIVITY_TYPES)[number];
export type MasteryLabel = (typeof MASTERY_LABELS)[number];
export type StartingLevel = "beginner" | "intermediate" | "advanced";

export type GeneratedLearningActivity = {
  type: LearningPathActivityType;
  title: string;
  instructions: string;
  estimatedMinutes: number;
  required: boolean;
  content: Record<string, unknown>;
  sourceReferences: Array<{
    materialName: string;
    location: string | null;
  }>;
};

export type GeneratedLearningTopic = {
  title: string;
  objective: string;
  learningQuestion: string;
  difficulty: StartingLevel;
  estimatedMinutes: number;
  keyConcepts: string[];
  activities: GeneratedLearningActivity[];
};

export type GeneratedLearningModule = {
  title: string;
  description: string;
  objective: string;
  estimatedMinutes: number;
  topics: GeneratedLearningTopic[];
};

export type GeneratedLearningPath = {
  title: string;
  description: string;
  targetOutcome: string;
  estimatedMinutes: number;
  modules: GeneratedLearningModule[];
};

function recordValue(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(
  value: unknown,
  label: string,
  maximumLength: number,
  allowEmpty = false,
) {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw new Error(`${label} cannot be empty.`);
  return normalized.slice(0, maximumLength);
}

function integerValue(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer.`);
  const numericValue = value as number;
  if (numericValue < minimum || numericValue > maximum) {
    throw new Error(`${label} is outside the supported range.`);
  }
  return numericValue;
}

function arrayValue(value: unknown, label: string, minimum = 0, maximum = 100) {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list.`);
  if (value.length < minimum || value.length > maximum) {
    throw new Error(`${label} must contain ${minimum}–${maximum} items.`);
  }
  return value;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`${label} has an unsupported value.`);
  }
  return value as T[number];
}

function parseSourceReferences(value: unknown, label: string) {
  return arrayValue(value ?? [], label, 0, 20).map((source, sourceIndex) => {
    const record = recordValue(source, `${label}[${sourceIndex}]`);
    return {
      materialName: stringValue(
        record.materialName,
        `${label}[${sourceIndex}].materialName`,
        255,
      ),
      location:
        record.location === null || record.location === undefined
          ? null
          : stringValue(
              record.location,
              `${label}[${sourceIndex}].location`,
              200,
              true,
            ) || null,
    };
  });
}

function parseActivity(value: unknown, label: string): GeneratedLearningActivity {
  const activity = recordValue(value, label);
  return {
    type: enumValue(activity.type, LEARNING_PATH_ACTIVITY_TYPES, `${label}.type`),
    title: stringValue(activity.title, `${label}.title`, 200),
    instructions: stringValue(
      activity.instructions,
      `${label}.instructions`,
      4_000,
    ),
    estimatedMinutes: integerValue(
      activity.estimatedMinutes,
      `${label}.estimatedMinutes`,
      1,
      1_440,
    ),
    required: activity.required !== false,
    content: recordValue(activity.content, `${label}.content`),
    sourceReferences: parseSourceReferences(
      activity.sourceReferences,
      `${label}.sourceReferences`,
    ),
  };
}

function parseTopic(value: unknown, label: string): GeneratedLearningTopic {
  const topic = recordValue(value, label);
  const activities = arrayValue(topic.activities, `${label}.activities`, 4, 12).map(
    (activity, index) => parseActivity(activity, `${label}.activities[${index}]`),
  );
  const activityTypes = new Set(activities.map((activity) => activity.type));
  const hasPractice =
    activityTypes.has("guided_practice") ||
    activityTypes.has("independent_practice") ||
    activityTypes.has("applied_task");

  if (
    !activityTypes.has("explanation") ||
    !activityTypes.has("example") ||
    !activityTypes.has("knowledge_check") ||
    !hasPractice
  ) {
    throw new Error(
      `${label} needs an explanation, example, practice activity, and knowledge check.`,
    );
  }

  return {
    title: stringValue(topic.title, `${label}.title`, 200),
    objective: stringValue(topic.objective, `${label}.objective`, 1_000),
    learningQuestion: stringValue(
      topic.learningQuestion,
      `${label}.learningQuestion`,
      500,
    ),
    difficulty: enumValue(
      topic.difficulty,
      ["beginner", "intermediate", "advanced"] as const,
      `${label}.difficulty`,
    ),
    estimatedMinutes: integerValue(
      topic.estimatedMinutes,
      `${label}.estimatedMinutes`,
      1,
      1_440,
    ),
    keyConcepts: arrayValue(topic.keyConcepts, `${label}.keyConcepts`, 1, 20).map(
      (concept, index) =>
        stringValue(concept, `${label}.keyConcepts[${index}]`, 200),
    ),
    activities,
  };
}

function parseModule(value: unknown, label: string): GeneratedLearningModule {
  const moduleRecord = recordValue(value, label);
  return {
    title: stringValue(moduleRecord.title, `${label}.title`, 200),
    description: stringValue(
      moduleRecord.description,
      `${label}.description`,
      1_000,
      true,
    ),
    objective: stringValue(moduleRecord.objective, `${label}.objective`, 1_000),
    estimatedMinutes: integerValue(
      moduleRecord.estimatedMinutes,
      `${label}.estimatedMinutes`,
      1,
      100_000,
    ),
    topics: arrayValue(moduleRecord.topics, `${label}.topics`, 1, 20).map(
      (topic, index) => parseTopic(topic, `${label}.topics[${index}]`),
    ),
  };
}

function unwrapJson(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ?? trimmed;
}

export function parseGeneratedLearningPath(value: string): GeneratedLearningPath {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapJson(value));
  } catch {
    throw new Error("The generated path was not valid JSON.");
  }

  const path = recordValue(parsed, "path");
  const modules = arrayValue(path.modules, "path.modules", 1, 12).map(
    (module, index) => parseModule(module, `path.modules[${index}]`),
  );
  const topicCount = modules.reduce((total, module) => total + module.topics.length, 0);
  if (topicCount > 80) throw new Error("The generated path contains too many topics.");

  return {
    title: stringValue(path.title, "path.title", 200),
    description: stringValue(path.description, "path.description", 1_000),
    targetOutcome: stringValue(path.targetOutcome, "path.targetOutcome", 1_000),
    estimatedMinutes: integerValue(
      path.estimatedMinutes,
      "path.estimatedMinutes",
      1,
      100_000,
    ),
    modules,
  };
}

export function masteryLabel(score: number, needsReview = false): MasteryLabel {
  if (needsReview) return "needs_review";
  if (score <= 0) return "not_started";
  if (score < 45) return "introduced";
  if (score < 70) return "developing";
  if (score < 90) return "proficient";
  return "mastered";
}

export function displayMasteryLabel(label: MasteryLabel | string) {
  return label.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function formatLearningMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}
