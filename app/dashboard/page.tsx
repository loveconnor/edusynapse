import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
} from "love-ui/icons";
import { LearningProgress } from "@/components/learning/learning-progress";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getAppPageContext } from "@/lib/app-page-context";
import { getFirstName } from "@/lib/ai-coach";
import {
  getLearningStatus,
  selectContinueItem,
  selectCurrentTopic,
  type LearningItemSummary,
} from "@/lib/learning";

export const metadata: Metadata = {
  title: "My Learning | EduSynapse",
  description: "Continue learning from where you left off.",
};

const DAY_IN_MS = 86_400_000;
const VISIBLE_PATH_COUNT = 4;
const INTERACTIVE_CARD_CLASS =
  "rounded-2xl border bg-background shadow-xs transition-[border-color,box-shadow] duration-150 ease-out hover:border-foreground/15 hover:shadow-sm motion-reduce:transition-none";

type TodayActivity = {
  id: string;
  title: string;
  position: number;
  estimated_minutes: number;
  completed: boolean;
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function relativeDayLabel(value: string, now: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "earlier";

  const dayDifference = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_IN_MS,
  );

  if (dayDifference <= 0) return "today";
  if (dayDifference === 1) return "yesterday";
  if (dayDifference < 7) return `${dayDifference} days ago`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function lastStudiedLabel(value: string | null, now: Date) {
  return value ? `Last studied ${relativeDayLabel(value, now)}` : "Not started";
}

function learningStatusLabel(item: LearningItemSummary) {
  const status = getLearningStatus(item.progress);
  if (status === "completed") return "Completed";
  if (status === "in-progress") return "In progress";
  return "Ready to start";
}

function learningActionLabel(item: LearningItemSummary) {
  const status = getLearningStatus(item.progress);
  if (status === "completed") return "Review";
  if (status === "in-progress") return "Continue";
  return "Start";
}

function activityMinutesRemaining(activities: TodayActivity[]) {
  if (activities.length === 0) return null;
  return activities
    .filter((activity) => !activity.completed)
    .reduce((total, activity) => total + activity.estimated_minutes, 0);
}

function ContinueLearningCard({
  activities,
  item,
  now,
  topicId,
}: {
  activities: TodayActivity[];
  item: LearningItemSummary;
  now: Date;
  topicId: string | null;
}) {
  const isStarted = item.progress > 0;
  const nextStep = item.current_lesson ?? item.title;
  const remainingMinutes = activityMinutesRemaining(activities);
  const href = topicId
    ? `/learning/${item.id}/topics/${topicId}`
    : `/learning/${item.id}`;

  return (
    <article className={`${INTERACTIVE_CARD_CLASS} min-h-60`}>
      <Link
        href={href}
        aria-labelledby="continue-learning-title"
        className="flex h-full min-h-60 flex-col rounded-[inherit] p-6 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-8"
      >
        <p className="text-sm font-semibold text-muted-foreground">
          {isStarted ? "Continue learning" : "Start learning"} · {item.title}
        </p>
        <h2
          id="continue-learning-title"
          className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-balance sm:text-4xl"
        >
          {nextStep}
        </h2>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-5 pt-10">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {remainingMinutes !== null ? (
              <span>{remainingMinutes} min remaining</span>
            ) : null}
            {remainingMinutes !== null ? (
              <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            ) : null}
            <span>{lastStudiedLabel(item.last_studied_at, now)}</span>
          </p>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-background">
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </div>
      </Link>
    </article>
  );
}

function NextGoalCard() {
  return (
    <article className={`${INTERACTIVE_CARD_CLASS} min-h-60`}>
      <Link
        href="/learning/new"
        aria-labelledby="continue-learning-title"
        className="flex h-full min-h-60 flex-col rounded-[inherit] p-6 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-8"
      >
        <p className="text-sm font-semibold text-muted-foreground">
          All paths complete
        </p>
        <h2
          id="continue-learning-title"
          className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-balance sm:text-4xl"
        >
          Choose your next learning goal
        </h2>
        <div className="mt-auto flex items-end justify-between gap-5 pt-10">
          <p className="text-sm text-muted-foreground">
            Build another path when you’re ready.
          </p>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-background">
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </div>
      </Link>
    </article>
  );
}

function TodayChecklist({
  activities,
  itemId,
  topicId,
}: {
  activities: TodayActivity[];
  itemId: string | null;
  topicId: string | null;
}) {
  const completedCount = activities.filter((activity) => activity.completed).length;

  return (
    <aside
      aria-labelledby="today-checklist-title"
      className="min-h-60 rounded-2xl border bg-background p-6 shadow-xs sm:p-7"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="today-checklist-title"
          className="text-lg font-semibold tracking-tight"
        >
          Today’s checklist
        </h2>
        {activities.length > 0 ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {completedCount}/{activities.length} complete
          </span>
        ) : null}
      </div>

      {activities.length > 0 && itemId && topicId ? (
        <ul className="mt-5 space-y-1">
          {activities.map((activity) => (
            <li key={activity.id}>
              <Link
                href={`/learning/${itemId}/topics/${topicId}#activity-${activity.id}`}
                className="group/activity grid min-h-11 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-1.5 outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden="true"
                  className={
                    activity.completed
                      ? "grid size-5 place-items-center rounded-full bg-foreground text-background"
                      : "size-5 rounded-full border-2 border-muted-foreground"
                  }
                >
                  {activity.completed ? <Check className="size-3" /> : null}
                </span>
                <span className="min-w-0 text-sm font-medium leading-5">
                  <span className="sr-only">
                    {activity.completed ? "Completed" : "Not completed"}: {" "}
                  </span>
                  {activity.title}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {activity.estimated_minutes} min
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
          {itemId
            ? "Activities will appear here when the current topic is ready."
            : "Nothing is scheduled. Start a new path to build your next checklist."}
        </p>
      )}
    </aside>
  );
}

function LearningCard({ item, now }: { item: LearningItemSummary; now: Date }) {
  return (
    <article className={`${INTERACTIVE_CARD_CLASS} min-h-52`}>
      <Link
        href={`/learning/${item.id}`}
        className="flex h-full min-h-52 flex-col rounded-[inherit] p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-xl font-semibold leading-7 tracking-tight text-balance">
            {item.title}
          </h3>
          {item.progress === 100 ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-background">
              <Check aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Completed</span>
            </span>
          ) : null}
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {item.current_lesson ?? learningStatusLabel(item)}
        </p>

        <div className="mt-auto pt-8">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{learningStatusLabel(item)}</span>
            <span className="tabular-nums">{item.progress}%</span>
          </div>
          <LearningProgress
            className="mt-2"
            progress={item.progress}
            title={item.title}
          />
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {lastStudiedLabel(item.last_studied_at, now)}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold">
              {learningActionLabel(item)}
              <ArrowRight
                aria-hidden="true"
                className="size-4"
              />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function PathGrid({
  items,
  now,
}: {
  items: LearningItemSummary[];
  now: Date;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <LearningCard item={item} key={item.id} now={now} />
      ))}
    </div>
  );
}

function LearningPaths({
  items,
  now,
}: {
  items: LearningItemSummary[];
  now: Date;
}) {
  const visibleItems = items.slice(0, VISIBLE_PATH_COUNT);
  const remainingItems = items.slice(VISIBLE_PATH_COUNT);

  return (
    <section aria-labelledby="learning-paths-title" className="mt-12">
      <h2
        id="learning-paths-title"
        className="text-xl font-semibold tracking-tight"
      >
        Your learning paths
      </h2>
      <div className="mt-5">
        <PathGrid items={visibleItems} now={now} />
      </div>

      {remainingItems.length > 0 ? (
        <details className="group mt-5">
          <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">View all</span>
            <span className="hidden group-open:inline">Show fewer</span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="mt-5">
            <PathGrid items={remainingItems} now={now} />
          </div>
        </details>
      ) : null}
    </section>
  );
}

function NewLearnerState() {
  return (
    <Empty className="mt-8 min-h-[28rem] overflow-hidden border bg-background px-6 py-14 shadow-xs sm:px-12">
      <EmptyMedia variant="icon" className="text-foreground">
        <BookOpen aria-hidden="true" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>Build your first learning path</EmptyTitle>
        <EmptyDescription>
          Start with a goal or source PDFs. EduSynapse will organize the topics,
          activities, and most useful next step.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild size="xl">
          <Link href="/learning/new">
            Build a learning path
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Begin with what you already have. You can refine the path later.
        </p>
      </EmptyContent>
    </Empty>
  );
}

export function MyLearningDashboard({
  activities,
  firstName,
  items,
  now = new Date(),
  topicId,
}: {
  activities: TodayActivity[];
  firstName: string | null;
  items: LearningItemSummary[];
  now?: Date;
  topicId: string | null;
}) {
  const continueItem = selectContinueItem(items);
  const orderedItems = [...items].sort(
    (left, right) =>
      Date.parse(right.last_studied_at ?? right.updated_at) -
      Date.parse(left.last_studied_at ?? left.updated_at),
  );

  return (
    <main
      aria-labelledby="my-learning-title"
      className="mx-auto min-h-[calc(100dvh-var(--app-header-height)-2rem)] w-full max-w-[80rem] py-4 md:min-h-[calc(100dvh-var(--app-header-height)-3rem)] md:py-8"
    >
      <header className="max-w-3xl">
        <h1
          id="my-learning-title"
          className="font-heading text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-4xl"
        >
          Welcome back{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          Your learning paths and progress.
        </p>
      </header>

      {items.length === 0 ? (
        <NewLearnerState />
      ) : (
        <>
          <section
            aria-label="Current learning"
            className="mt-8 grid items-stretch gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(19rem,2fr)]"
          >
            {continueItem ? (
              <ContinueLearningCard
                activities={activities}
                item={continueItem}
                now={now}
                topicId={topicId}
              />
            ) : (
              <NextGoalCard />
            )}
            <TodayChecklist
              activities={activities}
              itemId={continueItem?.id ?? null}
              topicId={topicId}
            />
          </section>

          <LearningPaths items={orderedItems} now={now} />
        </>
      )}
    </main>
  );
}

export default async function DashboardPage() {
  const { shellProps, supabase, user } = await getAppPageContext();
  const items = shellProps.commandPaletteData.learningItems;
  const continueItem = selectContinueItem(items);
  let topicId: string | null = null;
  let activities: TodayActivity[] = [];

  if (continueItem) {
    const topicsResult = await supabase
      .from("learning_topics")
      .select("id, title, status, position")
      .eq("learning_item_id", continueItem.id)
      .eq("user_id", user.id)
      .order("position", { ascending: true });

    if (topicsResult.error) throw new Error("Unable to load today’s checklist");

    const currentTopic = selectCurrentTopic(
      topicsResult.data ?? [],
      continueItem.current_lesson,
    );
    topicId = currentTopic?.id ?? null;

    if (topicId) {
      const activitiesResult = await supabase
        .from("learning_activities")
        .select("id, title, position, estimated_minutes, completed")
        .eq("topic_id", topicId)
        .eq("learning_item_id", continueItem.id)
        .eq("user_id", user.id)
        .order("position", { ascending: true });

      if (activitiesResult.error) {
        throw new Error("Unable to load today’s checklist");
      }
      activities = activitiesResult.data ?? [];
    }
  }

  const savedName = shellProps.user.name;
  const firstName = savedName.includes("@") ? null : getFirstName(savedName);

  return (
    <MyLearningDashboard
      activities={activities}
      firstName={firstName}
      items={items}
      topicId={topicId}
    />
  );
}
