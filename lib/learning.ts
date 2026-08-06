export type LearningItemSummary = {
  id: string;
  title: string;
  progress: number;
  current_lesson: string | null;
  last_studied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LearningStatus = "not-started" | "in-progress" | "completed";

export type LearningTopicSummary = {
  id: string;
  title: string;
  status: string;
  position: number;
};

export type LearningActionState = {
  message: string | null;
  fieldErrors?: Partial<
    Record<
      | "title"
      | "goal"
      | "startingLevel"
      | "targetOutcome"
      | "targetDate"
      | "notes"
      | "currentLesson"
      | "progress"
      | "files",
      string
    >
  >;
};

export const initialLearningActionState: LearningActionState = {
  message: null,
};

export function getLearningStatus(progress: number): LearningStatus {
  if (progress >= 100) return "completed";
  if (progress > 0) return "in-progress";
  return "not-started";
}

function activityTime(item: LearningItemSummary) {
  return Date.parse(item.last_studied_at ?? item.updated_at);
}

export function selectContinueItem(items: LearningItemSummary[]) {
  const unfinished = items.filter((item) => item.progress < 100);
  const inProgress = unfinished.filter((item) => item.progress > 0);
  const candidates = inProgress.length > 0 ? inProgress : unfinished;

  return (
    [...candidates].sort((left, right) => {
      const activityDifference = activityTime(right) - activityTime(left);
      if (activityDifference !== 0) return activityDifference;
      return left.created_at.localeCompare(right.created_at);
    })[0] ?? null
  );
}

export function selectRecommendationItem(items: LearningItemSummary[]) {
  const unfinished = items.filter((item) => item.progress < 100);

  return (
    [...unfinished].sort((left, right) => {
      const progressDifference = left.progress - right.progress;
      if (progressDifference !== 0) return progressDifference;

      const activityDifference = activityTime(left) - activityTime(right);
      if (activityDifference !== 0) return activityDifference;

      return left.created_at.localeCompare(right.created_at);
    })[0] ?? null
  );
}

const TOPIC_STATUS_PRIORITY: Record<string, number> = {
  in_progress: 0,
  needs_review: 1,
  available: 2,
  completed: 3,
};

export function selectCurrentTopic(
  topics: LearningTopicSummary[],
  currentLesson: string | null,
) {
  const unlockedTopics = topics.filter((topic) => topic.status !== "locked");
  const namedTopic = currentLesson
    ? unlockedTopics.find((topic) => topic.title === currentLesson)
    : undefined;

  if (namedTopic) return namedTopic;

  return (
    [...unlockedTopics].sort((left, right) => {
      const statusDifference =
        (TOPIC_STATUS_PRIORITY[left.status] ?? Number.MAX_SAFE_INTEGER) -
        (TOPIC_STATUS_PRIORITY[right.status] ?? Number.MAX_SAFE_INTEGER);
      return statusDifference || left.position - right.position;
    })[0] ?? null
  );
}
