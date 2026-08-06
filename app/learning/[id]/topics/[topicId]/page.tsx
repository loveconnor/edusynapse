import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "love-ui/icons";
import { notFound } from "next/navigation";
import {
  completeLearningActivity,
  submitKnowledgeCheck,
} from "@/app/learning/[id]/topics/actions";
import { LearningActivityContent } from "@/components/learning/learning-activity-content";
import { LearningProgress } from "@/components/learning/learning-progress";
import { Button } from "@/components/ui/button";
import { getAppPageContext } from "@/lib/app-page-context";
import {
  displayMasteryLabel,
  formatLearningMinutes,
} from "@/lib/learning-path";

export const metadata: Metadata = {
  title: "Learning topic | EduSynapse",
};

type ActivityContent = {
  body?: unknown;
  hints?: unknown;
  questions?: unknown;
};

type KnowledgeQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

type SourceReference = {
  materialName: string;
  location: string | null;
};

type TopicActivity = {
  id: string;
  type: string;
  title: string;
  instructions: string;
  content: ActivityContent;
  source_references: unknown;
  position: number;
  estimated_minutes: number;
  required: boolean;
  completed: boolean;
};

function activityTypeLabel(type: string) {
  return type.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function bodyText(content: ActivityContent) {
  return typeof content.body === "string" ? content.body : "";
}

function hints(content: ActivityContent) {
  return Array.isArray(content.hints)
    ? content.hints.filter((hint): hint is string => typeof hint === "string")
    : [];
}

function knowledgeQuestions(content: ActivityContent): KnowledgeQuestion[] {
  if (!Array.isArray(content.questions)) return [];
  return content.questions.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const question = value as Record<string, unknown>;
    if (typeof question.question !== "string" || typeof question.answer !== "string") {
      return [];
    }
    return [
      {
        question: question.question,
        answer: question.answer,
        explanation:
          typeof question.explanation === "string" ? question.explanation : "",
        options: Array.isArray(question.options)
          ? question.options.filter(
              (option): option is string => typeof option === "string",
            )
          : [],
      },
    ];
  });
}

function sourceReferences(value: unknown): SourceReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return [];
    const record = source as Record<string, unknown>;
    if (typeof record.materialName !== "string") return [];
    return [
      {
        materialName: record.materialName,
        location: typeof record.location === "string" ? record.location : null,
      },
    ];
  });
}

function ActivitySources({ references }: { references: SourceReference[] }) {
  if (references.length === 0) return null;
  return (
    <div className="mt-7 border-t border-border pt-5">
      <p className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        Sources used
      </p>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {references.map((source) => (
          <li key={`${source.materialName}-${source.location ?? "source"}`}>
            {source.materialName}
            {source.location ? ` · ${source.location}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KnowledgeCheck({
  activity,
  itemId,
  questions,
  topicId,
}: {
  activity: TopicActivity;
  itemId: string;
  questions: KnowledgeQuestion[];
  topicId: string;
}) {
  if (questions.length === 0) {
    return (
      <p className="mt-6 text-sm text-destructive">
        This knowledge check could not be loaded. Regenerate the path to repair it.
      </p>
    );
  }

  return (
    <form action={submitKnowledgeCheck} className="mt-7 space-y-8">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="activityId" value={activity.id} />
      {questions.map((question, questionIndex) => (
        <fieldset key={`${activity.id}-${questionIndex}`}>
          <legend className="font-semibold leading-6">
            {questionIndex + 1}. {question.question}
          </legend>
          {question.options.length > 0 ? (
            <div className="mt-4 space-y-2">
              {question.options.map((option) => (
                <label
                  key={option}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border px-4 py-3 text-sm leading-6 has-checked:border-foreground has-checked:bg-muted/45"
                >
                  <input
                    type="radio"
                    name={`answer-${questionIndex}`}
                    value={option}
                    required
                    className="mt-1 size-4 shrink-0 accent-foreground"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              name={`answer-${questionIndex}`}
              required
              rows={3}
              className="mt-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24"
              aria-label={`Answer to question ${questionIndex + 1}`}
            />
          )}
        </fieldset>
      ))}
      <Button type="submit" size="lg">
        Check answers
      </Button>
    </form>
  );
}

export default async function LearningTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; topicId: string }>;
  searchParams: Promise<{
    activity?: string;
    score?: string;
    total?: string;
  }>;
}) {
  const { id, topicId } = await params;
  const query = await searchParams;
  const { supabase, user } = await getAppPageContext();

  const [pathResult, topicResult, activitiesResult, topicsResult, modulesResult] =
    await Promise.all([
      supabase
        .from("learning_items")
        .select("id, title")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("learning_topics")
        .select(
          "id, module_id, title, objective, learning_question, difficulty, estimated_minutes, key_concepts, status, mastery_label",
        )
        .eq("id", topicId)
        .eq("learning_item_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("learning_activities")
        .select(
          "id, type, title, instructions, content, source_references, position, estimated_minutes, required, completed",
        )
        .eq("topic_id", topicId)
        .eq("learning_item_id", id)
        .eq("user_id", user.id)
        .order("position", { ascending: true }),
      supabase
        .from("learning_topics")
        .select("id, module_id, title, status, position")
        .eq("learning_item_id", id)
        .eq("user_id", user.id),
      supabase
        .from("learning_modules")
        .select("id, title, position")
        .eq("learning_item_id", id)
        .eq("user_id", user.id),
    ]);

  if (
    pathResult.error ||
    topicResult.error ||
    activitiesResult.error ||
    topicsResult.error ||
    modulesResult.error
  ) {
    throw new Error("Unable to load learning topic");
  }
  if (!pathResult.data || !topicResult.data) notFound();

  const path = pathResult.data;
  const topic = topicResult.data;
  if (topic.status === "locked") notFound();
  const activities = (activitiesResult.data ?? []) as TopicActivity[];
  const completedActivities = activities.filter((activity) => activity.completed).length;
  const activityProgress = activities.length
    ? Math.round((completedActivities / activities.length) * 100)
    : 0;
  const modules = modulesResult.data ?? [];
  const modulePositions = new Map(modules.map((module) => [module.id, module.position]));
  const orderedTopics = [...(topicsResult.data ?? [])].sort((left, right) => {
    const moduleDifference =
      (modulePositions.get(left.module_id) ?? 0) -
      (modulePositions.get(right.module_id) ?? 0);
    return moduleDifference || left.position - right.position;
  });
  const currentIndex = orderedTopics.findIndex((pathTopic) => pathTopic.id === topic.id);
  const nextTopic = orderedTopics[currentIndex + 1];
  const currentModule = modules.find((module) => module.id === topic.module_id);
  const score = Number(query.score);
  const total = Number(query.total);
  const hasScore =
    Number.isInteger(score) &&
    Number.isInteger(total) &&
    total > 0 &&
    score >= 0 &&
    score <= total;

  return (
    <main className="mx-auto w-full max-w-[72rem] py-4 md:py-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/learning/${path.id}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {path.title}
        </Link>
        {currentModule ? (
          <>
            <span aria-hidden="true">/</span>
            <span>{currentModule.title}</span>
          </>
        ) : null}
      </nav>

      <header className="mt-8 max-w-4xl border-b border-border pb-9">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span className="capitalize">{topic.difficulty}</span>
          <span aria-hidden="true" className="size-1 rounded-full bg-border" />
          <span>{formatLearningMinutes(topic.estimated_minutes)}</span>
          <span aria-hidden="true" className="size-1 rounded-full bg-border" />
          <span>{displayMasteryLabel(topic.mastery_label)}</span>
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
          {topic.title}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          {topic.objective}
        </p>
        <div className="mt-7 max-w-2xl border-l-2 border-foreground pl-4">
          <p className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Learning question
          </p>
          <p className="mt-1 font-medium leading-7">{topic.learning_question}</p>
        </div>
        <LearningProgress
          title={`${topic.title} activities`}
          progress={activityProgress}
          className="mt-8"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {completedActivities} of {activities.length} activities complete
        </p>
      </header>

      {query.activity === "completed" ? (
        <p className="mt-6 border border-border bg-muted/45 px-4 py-3 text-sm" role="status">
          Activity completed. Your path and next recommendation were updated.
        </p>
      ) : null}
      {hasScore ? (
        <div
          className="mt-6 border border-border bg-muted/45 px-4 py-4 text-sm"
          role="status"
        >
          <p className="font-semibold">
            {score} of {total} correct
          </p>
          <p className="mt-1 leading-6 text-muted-foreground">
            {score / total >= 0.7
              ? "You demonstrated enough independent recall to complete this check."
              : "Review the explanations and try the check again before continuing."}
          </p>
        </div>
      ) : null}

      <div className="mt-12 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-14">
          {activities.map((activity, activityIndex) => {
            const content = activity.content ?? {};
            const references = sourceReferences(activity.source_references);
            const activityHints = hints(content);
            const questions = knowledgeQuestions(content);
            return (
              <section
                key={activity.id}
                id={`activity-${activity.id}`}
                aria-labelledby={`activity-title-${activity.id}`}
                className="min-w-0 scroll-mt-24"
              >
                <div className="flex items-start gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold tabular-nums">
                    {activity.completed ? <Check aria-hidden="true" className="size-4" /> : activityIndex + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                      {activityTypeLabel(activity.type)} · {activity.estimated_minutes} min
                    </p>
                    <h2 id={`activity-title-${activity.id}`} className="mt-1 text-2xl font-semibold tracking-tight">
                      {activity.title}
                    </h2>
                  </div>
                </div>
                <div className="mt-6 min-w-0 max-w-full sm:pl-12">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {activity.instructions}
                  </p>
                  {bodyText(content) ? (
                    <LearningActivityContent>
                      {bodyText(content)}
                    </LearningActivityContent>
                  ) : null}
                  {activityHints.length > 0 ? (
                    <details className="mt-6 border-y border-border py-4">
                      <summary className="min-h-8 cursor-pointer font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Show {activityHints.length === 1 ? "a hint" : "hints"}
                      </summary>
                      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                        {activityHints.map((hint) => <li key={hint}>{hint}</li>)}
                      </ol>
                    </details>
                  ) : null}
                  {activity.type === "knowledge_check" ? (
                    <KnowledgeCheck
                      activity={activity}
                      itemId={path.id}
                      questions={questions}
                      topicId={topic.id}
                    />
                  ) : activity.completed ? (
                    <p className="mt-7 inline-flex items-center gap-2 text-sm font-medium">
                      <Check aria-hidden="true" className="size-4" />
                      Activity completed
                    </p>
                  ) : (
                    <form action={completeLearningActivity} className="mt-7">
                      <input type="hidden" name="itemId" value={path.id} />
                      <input type="hidden" name="topicId" value={topic.id} />
                      <input type="hidden" name="activityId" value={activity.id} />
                      <Button type="submit" variant="outline" size="lg">
                        Mark activity complete
                      </Button>
                    </form>
                  )}
                  <ActivitySources references={references} />
                </div>
              </section>
            );
          })}

          {topic.status === "completed" && nextTopic && nextTopic.status !== "locked" ? (
            <section className="border-t border-border pt-8" aria-labelledby="next-topic-title">
              <p className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">Next topic</p>
              <h2 id="next-topic-title" className="mt-2 text-2xl font-semibold tracking-tight">{nextTopic.title}</h2>
              <Button asChild className="mt-5" size="lg">
                <Link href={`/learning/${path.id}/topics/${nextTopic.id}`}>
                  Continue to next topic
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </section>
          ) : null}
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block" aria-labelledby="topic-contents-title">
          <h2 id="topic-contents-title" className="text-sm font-semibold">In this topic</h2>
          <ol className="mt-4 space-y-1">
            {activities.map((activity, index) => (
              <li key={activity.id}>
                <a
                  href={`#activity-${activity.id}`}
                  className="flex min-h-10 items-center gap-3 rounded-md px-2 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="w-4 text-center text-xs tabular-nums">
                    {activity.completed ? "✓" : index + 1}
                  </span>
                  <span className="line-clamp-2">{activity.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
