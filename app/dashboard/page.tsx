import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  FileUp,
  Plus,
  Sparkles,
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
import {
  getLearningStatus,
  selectContinueItem,
  type LearningItemSummary,
} from "@/lib/learning";

export const metadata: Metadata = {
  title: "My Learning | EduSynapse",
  description: "Continue learning from where you left off.",
};

const DAY_IN_MS = 86_400_000;
const STUDY_MINUTES: Record<string, number> = {
  "15 min": 15,
  "30 min": 30,
  "45 min": 30,
  "1 hour": 30,
  "2+ hours": 30,
};

type RecentActivity = {
  id: string;
  occurredAt: string;
  title: string;
  detail?: string;
};

export type LearningMaterialSummary = {
  id: string;
  learning_item_id: string;
  file_name: string;
  created_at: string;
};

type PlanStep = {
  title: string;
  minutes: number | null;
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function relativeDayLabel(value: string, now: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const dayDifference = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_IN_MS,
  );

  if (dayDifference <= 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  if (dayDifference < 7) return `${dayDifference} days ago`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function activityTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function lastStudiedLabel(value: string | null, now: Date) {
  return value
    ? `Last studied ${relativeDayLabel(value, now).toLowerCase()}`
    : "New path";
}

function recommendedMinutes(dailyStudyTime: string | null) {
  return dailyStudyTime ? (STUDY_MINUTES[dailyStudyTime] ?? null) : null;
}

function buildTodayPlan(
  item: LearningItemSummary,
  sessionMinutes: number | null,
): PlanStep[] {
  const firstMinutes = sessionMinutes ? Math.max(4, Math.round(sessionMinutes * 0.25)) : null;
  const secondMinutes = sessionMinutes ? Math.max(6, Math.round(sessionMinutes * 0.5)) : null;
  const thirdMinutes = sessionMinutes
    ? sessionMinutes - (firstMinutes ?? 0) - (secondMinutes ?? 0)
    : null;

  if (item.current_lesson) {
    return [
      { title: "Recall your last session", minutes: firstMinutes },
      { title: `Continue ${item.current_lesson}`, minutes: secondMinutes },
      { title: "Capture one takeaway", minutes: thirdMinutes },
    ];
  }

  return [
    { title: `Preview the core ideas in ${item.title}`, minutes: firstMinutes },
    { title: "Choose one concept to practice", minutes: secondMinutes },
    { title: "Capture one question", minutes: thirdMinutes },
  ];
}

function learningStatusLabel(item: LearningItemSummary) {
  const status = getLearningStatus(item.progress);
  if (status === "completed") return "Completed";
  if (status === "in-progress") return "In progress";
  return "New path";
}

function learningActionLabel(item: LearningItemSummary) {
  const status = getLearningStatus(item.progress);
  if (status === "completed") return "Review";
  if (status === "in-progress") return "Continue";
  return "Start path";
}

function createRecentActivity(
  items: LearningItemSummary[],
  materials: Array<{
    id: string;
    learning_item_id: string;
    file_name: string;
    created_at: string;
  }>,
) {
  const itemTitles = new Map(items.map((item) => [item.id, item.title]));
  const itemActivity: RecentActivity[] = items.map((item) => ({
    id: `learning-${item.id}`,
    occurredAt: item.last_studied_at ?? item.updated_at,
    title: item.last_studied_at
      ? `Studied ${item.title}`
      : item.updated_at !== item.created_at
        ? `Updated ${item.title}`
        : `Added ${item.title}`,
  }));
  const materialActivity: RecentActivity[] = materials.map((material) => ({
    id: `material-${material.id}`,
    occurredAt: material.created_at,
    title: `Uploaded ${material.file_name}`,
    detail: itemTitles.get(material.learning_item_id)
      ? itemTitles.get(material.learning_item_id)
      : undefined,
  }));

  return [...itemActivity, ...materialActivity]
    .sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    )
    .slice(0, 6);
}

function ProgressSummary({ item }: { item: LearningItemSummary }) {
  const isNew = item.progress === 0;

  return (
    <div className="w-36 rounded-xl border bg-background p-4">
      <span className="block text-2xl font-semibold tabular-nums tracking-tight">
        {isNew ? "New" : `${item.progress}%`}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">
        {isNew ? "Ready to begin" : "Current path"}
      </span>
      <LearningProgress className="mt-4" progress={item.progress} title={item.title} />
    </div>
  );
}

function ContinueLearningCard({
  item,
  now,
  sessionMinutes,
}: {
  item: LearningItemSummary;
  now: Date;
  sessionMinutes: number | null;
}) {
  const isStarted = item.progress > 0;
  const nextStep = item.current_lesson ?? `Core ideas in ${item.title}`;

  return (
    <article className="h-full min-h-72 overflow-hidden rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="grid h-full gap-8 md:grid-cols-[minmax(0,1fr)_9rem] md:items-center">
        <div className="flex h-full min-w-0 flex-col">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="size-1.5 rounded-full bg-foreground" aria-hidden="true" />
            Continue learning
          </p>
          <h2
            id="continue-learning-title"
            className="mt-4 font-heading text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl"
          >
            {item.title}
          </h2>
          <div className="mt-6">
            <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {item.current_lesson ? "Next up" : "Start here"}
            </p>
            <p className="mt-2 text-lg font-medium leading-7 text-balance">
              {nextStep}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {item.current_lesson
                ? "Return to your active lesson and keep the context from your last session."
                : "Begin with a short overview, then choose one concept to practice."}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>{sessionMinutes ? `${sessionMinutes} min session` : "Flexible session"}</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>{lastStudiedLabel(item.last_studied_at, now)}</span>
          </div>
          <Button
            asChild
            className="mt-7 w-fit"
            size="xl"
          >
            <Link href={`/learning/${item.id}`}>
              {isStarted ? "Continue session" : "Start first session"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="hidden justify-center md:flex">
          <ProgressSummary item={item} />
        </div>
      </div>
    </article>
  );
}

function TodayPlan({
  item,
  sessionMinutes,
}: {
  item: LearningItemSummary;
  sessionMinutes: number | null;
}) {
  const plan = buildTodayPlan(item, sessionMinutes);

  return (
    <aside
      aria-labelledby="today-plan-title"
      className="h-full min-h-72 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
          <Sparkles aria-hidden="true" className="size-5" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {sessionMinutes ? `${sessionMinutes} min total` : "Flexible session"}
        </span>
      </div>
      <h2 id="today-plan-title" className="mt-5 text-xl font-semibold tracking-tight">
        Today’s plan
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        A focused route into your next session.
      </p>

      <ol className="mt-6 space-y-4">
        {plan.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-3">
            <span className="flex size-7 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums">
              {index + 1}
            </span>
            <span className="pt-1 text-sm font-medium leading-5">{step.title}</span>
            {step.minutes ? (
              <span className="pt-1 text-xs tabular-nums text-muted-foreground">
                {step.minutes} min
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="mt-6 border-t pt-4 text-xs leading-5 text-muted-foreground">
        Based on your current path
        {sessionMinutes ? " and saved study time" : ""}.
      </p>
    </aside>
  );
}

function LearningCard({ item, now }: { item: LearningItemSummary; now: Date }) {
  return (
    <article className="group flex min-h-56 flex-col rounded-2xl border bg-card p-5 shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {learningStatusLabel(item)}
        </span>
        {item.progress === 100 ? (
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
            <Check aria-hidden="true" className="size-4" />
            <span className="sr-only">Completed</span>
          </span>
        ) : null}
      </div>
      <h3 className="mt-4 text-xl font-semibold leading-7 tracking-tight text-balance">
        {item.title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {item.current_lesson
          ? `Next: ${item.current_lesson}`
          : `Start with the core ideas in ${item.title}`}
      </p>
      <LearningProgress className="mt-5" progress={item.progress} title={item.title} />
      <div className="mt-auto flex items-end justify-between gap-4 pt-5">
        <span className="text-xs text-muted-foreground">
          {lastStudiedLabel(item.last_studied_at, now)}
        </span>
        <Link
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={`/learning/${item.id}`}
        >
          {learningActionLabel(item)}
          <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
    </article>
  );
}

function QuickAction({
  description,
  href,
  icon,
  title,
}: {
  description: string;
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link
      className="group flex min-h-24 flex-col rounded-xl border bg-card p-4 outline-none transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">
          {icon}
        </span>
        <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </div>
      <span className="mt-3 text-sm font-semibold">{title}</span>
      <span className="mt-1 text-xs leading-5 text-muted-foreground">{description}</span>
    </Link>
  );
}

function NewLearnerState() {
  return (
    <Empty className="min-h-[28rem] overflow-hidden border bg-card px-6 py-14 shadow-sm sm:px-12">
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
  dailyStudyTime,
  items,
  materials,
  now = new Date(),
}: {
  dailyStudyTime: string | null;
  items: LearningItemSummary[];
  materials: LearningMaterialSummary[];
  now?: Date;
}) {
  const continueItem = selectContinueItem(items);
  const materialTarget = continueItem ?? items[0];
  const sessionMinutes = recommendedMinutes(dailyStudyTime);
  const orderedItems = [...items].sort(
    (left, right) =>
      Date.parse(right.last_studied_at ?? right.updated_at) -
      Date.parse(left.last_studied_at ?? left.updated_at),
  );
  const secondaryItems = continueItem
    ? orderedItems.filter((item) => item.id !== continueItem.id)
    : orderedItems;
  const recentActivity = createRecentActivity(items, materials);
  const groupedActivity = Map.groupBy(recentActivity, (activity) =>
    relativeDayLabel(activity.occurredAt, now),
  );

  return (
    <main
      aria-labelledby="my-learning-title"
      className="mx-auto w-full max-w-[76rem] py-4 md:py-8"
    >
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1
            id="my-learning-title"
            className="font-heading text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl"
          >
            My Learning
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-6 text-muted-foreground">
            Your learning paths and today’s priority.
          </p>
        </div>
        <Button asChild size="lg" variant="outline">
          <Link href="/learning/new">
            <Plus aria-hidden="true" />
            Build a path
          </Link>
        </Button>
      </header>

      <div className="mt-8">
        {items.length === 0 ? (
          <NewLearnerState />
        ) : (
          <div className="space-y-12">
            {continueItem ? (
              <section
                aria-label="Today’s learning"
                className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
              >
                <ContinueLearningCard
                  item={continueItem}
                  now={now}
                  sessionMinutes={sessionMinutes}
                />
                <TodayPlan item={continueItem} sessionMinutes={sessionMinutes} />
              </section>
            ) : (
              <section
                aria-labelledby="continue-learning-title"
                className="rounded-2xl border bg-card p-7 shadow-sm sm:p-8"
              >
                <p className="text-sm font-semibold text-muted-foreground">What’s next</p>
                <h2 id="continue-learning-title" className="mt-3 text-2xl font-semibold tracking-tight">
                  Choose your next learning goal
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Your current paths are complete. Start a new goal or revisit a completed path.
                </p>
                <Button
                  asChild
                  className="mt-6"
                  size="lg"
                >
                  <Link href="/learning/new">
                    Build your next path
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </section>
            )}

            {secondaryItems.length > 0 ? (
              <section aria-labelledby="your-learning-title">
                <div>
                  <h2 id="your-learning-title" className="text-xl font-semibold tracking-tight">
                    Your learning
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    Keep your other paths within reach.
                  </p>
                </div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {secondaryItems.map((item) => (
                    <LearningCard item={item} key={item.id} now={now} />
                  ))}
                </div>
              </section>
            ) : null}

            <div className="grid gap-10 border-t pt-10 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-12">
              <section aria-labelledby="recent-activity-title">
                <h2 id="recent-activity-title" className="text-xl font-semibold tracking-tight">
                  Recent activity
                </h2>
                {recentActivity.length > 0 ? (
                  <div className="mt-5 space-y-6">
                    {Array.from(groupedActivity.entries()).map(([label, activity]) => (
                      <div key={label}>
                        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {label}
                        </h3>
                        <ul className="relative mt-3 space-y-1 before:absolute before:bottom-4 before:left-[0.6875rem] before:top-4 before:w-px before:bg-border">
                          {activity.map((entry) => {
                            const time = activityTimeLabel(entry.occurredAt);

                            return (
                              <li key={entry.id} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-3 py-2.5">
                                <span className="relative z-10 mt-0.5 flex size-5 items-center justify-center rounded-full border bg-background text-foreground">
                                  <Check aria-hidden="true" className="size-3" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium leading-5 break-words">{entry.title}</p>
                                  {entry.detail ? (
                                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</p>
                                  ) : null}
                                </div>
                                {time ? (
                                  <time
                                    className="pt-0.5 text-xs tabular-nums text-muted-foreground"
                                    dateTime={entry.occurredAt}
                                  >
                                    {time}
                                  </time>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    Your learning activity will appear here after your first session.
                  </p>
                )}
              </section>

              <section aria-labelledby="quick-actions-title">
                <h2 id="quick-actions-title" className="text-xl font-semibold tracking-tight">
                  Quick actions
                </h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                  <QuickAction
                    description="Create a new path"
                    href="/learning/new"
                    icon={<Plus aria-hidden="true" className="size-4" />}
                    title="Build a path"
                  />
                  <QuickAction
                    description={`Add to ${materialTarget.title}`}
                    href={`/learning/${materialTarget.id}#materials-title`}
                    icon={<FileUp aria-hidden="true" className="size-4" />}
                    title="Upload material"
                  />
                  <QuickAction
                    description="Ask for an explanation"
                    href="/ai-coach"
                    icon={<Sparkles aria-hidden="true" className="size-4" />}
                    title="Ask AI Coach"
                  />
                  <QuickAction
                    description={`Update ${materialTarget.title}`}
                    href={`/learning/${materialTarget.id}#progress-details-title`}
                    icon={<BookOpen aria-hidden="true" className="size-4" />}
                    title="Update progress"
                  />
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default async function DashboardPage() {
  const { profile, shellProps } = await getAppPageContext();

  return (
    <MyLearningDashboard
      dailyStudyTime={profile.dailyStudyTime}
      items={shellProps.commandPaletteData.learningItems}
      materials={shellProps.commandPaletteData.materials}
    />
  );
}
