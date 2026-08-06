"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { masteryLabel } from "@/lib/learning-path";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAnswer(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

type KnowledgeQuestion = {
  question?: unknown;
  answer?: unknown;
};

async function updatePathProgress({
  itemId,
  topicId,
  userId,
}: {
  itemId: string;
  topicId: string;
  userId: string;
}) {
  const supabase = await createClient();
  const [activitiesResult, topicsResult, modulesResult] = await Promise.all([
    supabase
      .from("learning_activities")
      .select("required, completed, type, content")
      .eq("topic_id", topicId)
      .eq("learning_item_id", itemId)
      .eq("user_id", userId),
    supabase
      .from("learning_topics")
      .select("id, module_id, title, status, mastery_score, position")
      .eq("learning_item_id", itemId)
      .eq("user_id", userId),
    supabase
      .from("learning_modules")
      .select("id, position")
      .eq("learning_item_id", itemId)
      .eq("user_id", userId),
  ]);

  if (activitiesResult.error || topicsResult.error || modulesResult.error) {
    throw new Error("Unable to update learning progress");
  }

  const requiredActivities = (activitiesResult.data ?? []).filter(
    (activity) => activity.required,
  );
  const completedRequired = requiredActivities.filter(
    (activity) => activity.completed,
  ).length;
  const requiredProgress = requiredActivities.length
    ? completedRequired / requiredActivities.length
    : 0;
  const currentTopic = (topicsResult.data ?? []).find((topic) => topic.id === topicId);
  if (!currentTopic) throw new Error("Unable to find the current topic");

  const score = currentTopic.mastery_score;
  const isComplete =
    requiredProgress === 1 &&
    (score >= 70 ||
      !(activitiesResult.data ?? []).some(
        (activity) => activity.required && activity.type === "knowledge_check",
      ));
  const needsReview = requiredProgress === 1 && !isComplete;
  const topicStatus = isComplete
    ? "completed"
    : needsReview
      ? "needs_review"
      : "in_progress";
  const derivedScore = score > 0 ? score : Math.round(requiredProgress * 40);

  await supabase
    .from("learning_topics")
    .update({
      status: topicStatus,
      mastery_score: derivedScore,
      mastery_label: masteryLabel(derivedScore, needsReview),
      updated_at: new Date().toISOString(),
    })
    .eq("id", topicId)
    .eq("learning_item_id", itemId)
    .eq("user_id", userId);

  const modulePositions = new Map(
    (modulesResult.data ?? []).map((module) => [module.id, module.position]),
  );
  const topics = (topicsResult.data ?? [])
    .map((topic) =>
      topic.id === topicId
        ? {
            ...topic,
            status: topicStatus,
            mastery_score: derivedScore,
          }
        : topic,
    )
    .sort((left, right) => {
      const moduleDifference =
        (modulePositions.get(left.module_id) ?? 0) -
        (modulePositions.get(right.module_id) ?? 0);
      return moduleDifference || left.position - right.position;
    });

  const currentIndex = topics.findIndex((topic) => topic.id === topicId);
  const nextTopic = isComplete ? topics[currentIndex + 1] : currentTopic;
  if (isComplete && nextTopic && nextTopic.status === "locked") {
    await supabase
      .from("learning_topics")
      .update({ status: "available" })
      .eq("id", nextTopic.id)
      .eq("learning_item_id", itemId)
      .eq("user_id", userId);
    nextTopic.status = "available";
  }

  const completedTopics = topics.filter((topic) => topic.status === "completed").length;
  const pathProgress = topics.length
    ? Math.round((completedTopics / topics.length) * 100)
    : 0;
  const pathMastery = topics.length
    ? Math.round(
        topics.reduce((total, topic) => total + topic.mastery_score, 0) /
          topics.length,
      )
    : 0;
  const pathComplete = topics.length > 0 && completedTopics === topics.length;
  const recommendationTopic = nextTopic ?? currentTopic;

  await supabase
    .from("learning_items")
    .update({
      progress: pathProgress,
      status: pathComplete ? "completed" : "in_progress",
      mastery_score: pathMastery,
      mastery_label: masteryLabel(pathMastery),
      current_lesson: recommendationTopic.title,
      recommendation_title: needsReview
        ? `Review ${currentTopic.title}`
        : pathComplete
          ? "Review what you learned"
          : `${isComplete ? "Continue with" : "Finish"} ${recommendationTopic.title}`,
      recommendation_reason: needsReview
        ? "Your knowledge check shows that this topic needs another pass before the next topic unlocks."
        : pathComplete
          ? "A short retrieval session can help the path stay available in memory."
          : isComplete
            ? "You completed the prerequisites for this topic."
            : "Complete the required activities and knowledge check to continue.",
      recommendation_action: needsReview ? "review" : pathComplete ? "review" : "learn",
      recommendation_minutes: 15,
      last_studied_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("user_id", userId);
}

export async function completeLearningActivity(formData: FormData) {
  const itemId = textValue(formData, "itemId");
  const topicId = textValue(formData, "topicId");
  const activityId = textValue(formData, "activityId");
  if (![itemId, topicId, activityId].every((value) => UUID_PATTERN.test(value))) {
    throw new Error("This learning activity could not be identified.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await supabase
    .from("learning_activities")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("id", activityId)
    .eq("topic_id", topicId)
    .eq("learning_item_id", itemId)
    .eq("user_id", user.id)
    .neq("type", "knowledge_check")
    .select("id")
    .maybeSingle();

  if (result.error || !result.data) {
    throw new Error("This activity could not be completed.");
  }

  await updatePathProgress({ itemId, topicId, userId: user.id });
  revalidatePath("/dashboard");
  revalidatePath(`/learning/${itemId}`);
  revalidatePath(`/learning/${itemId}/topics/${topicId}`);
  redirect(`/learning/${itemId}/topics/${topicId}?activity=completed`);
}

export async function submitKnowledgeCheck(formData: FormData) {
  const itemId = textValue(formData, "itemId");
  const topicId = textValue(formData, "topicId");
  const activityId = textValue(formData, "activityId");
  if (![itemId, topicId, activityId].every((value) => UUID_PATTERN.test(value))) {
    throw new Error("This knowledge check could not be identified.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await supabase
    .from("learning_activities")
    .select("id, content")
    .eq("id", activityId)
    .eq("topic_id", topicId)
    .eq("learning_item_id", itemId)
    .eq("user_id", user.id)
    .eq("type", "knowledge_check")
    .maybeSingle();

  if (result.error || !result.data) throw new Error("This knowledge check could not be loaded.");
  const content = result.data.content as { questions?: KnowledgeQuestion[] };
  const questions = Array.isArray(content.questions) ? content.questions : [];
  if (questions.length === 0) throw new Error("This knowledge check has no questions.");

  let correct = 0;
  questions.forEach((question, index) => {
    const expected = typeof question.answer === "string" ? question.answer : "";
    if (
      expected &&
      normalizeAnswer(textValue(formData, `answer-${index}`)) ===
        normalizeAnswer(expected)
    ) {
      correct += 1;
    }
  });
  const score = Math.round((correct / questions.length) * 100);

  const [activityUpdate, topicUpdate] = await Promise.all([
    supabase
      .from("learning_activities")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", activityId)
      .eq("user_id", user.id),
    supabase
      .from("learning_topics")
      .update({ mastery_score: score, mastery_label: masteryLabel(score) })
      .eq("id", topicId)
      .eq("learning_item_id", itemId)
      .eq("user_id", user.id),
  ]);
  if (activityUpdate.error || topicUpdate.error) {
    throw new Error("Your knowledge check could not be saved.");
  }

  await updatePathProgress({ itemId, topicId, userId: user.id });
  revalidatePath("/dashboard");
  revalidatePath(`/learning/${itemId}`);
  revalidatePath(`/learning/${itemId}/topics/${topicId}`);
  redirect(
    `/learning/${itemId}/topics/${topicId}?score=${correct}&total=${questions.length}`,
  );
}
