import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  FileText,
  Sparkles,
} from "love-ui/icons";
import { notFound } from "next/navigation";
import {
  AddMaterialsForm,
  UpdatePathSettingsForm,
} from "@/components/learning/learning-forms";
import { LearningProgress } from "@/components/learning/learning-progress";
import { PathGenerator } from "@/components/learning/path-generator";
import { RegeneratePathButton } from "@/components/learning/regenerate-path-button";
import { Button } from "@/components/ui/button";
import { getAppPageContext } from "@/lib/app-page-context";
import {
  displayMasteryLabel,
  formatLearningMinutes,
} from "@/lib/learning-path";

export const metadata: Metadata = {
  title: "Learning path | EduSynapse",
};

type PathTopic = {
  id: string;
  module_id: string;
  title: string;
  objective: string;
  learning_question: string;
  position: number;
  estimated_minutes: number;
  status: "locked" | "available" | "in_progress" | "completed" | "needs_review";
  mastery_label: string;
};

type PathModule = {
  id: string;
  title: string;
  description: string;
  objective: string;
  position: number;
  estimated_minutes: number;
};

function pathStatusLabel(status: string) {
  const labels: Record<string, string> = {
    generating: "Generating",
    ready: "Ready to start",
    in_progress: "In progress",
    paused: "Paused",
    needs_attention: "Needs attention",
    completed: "Completed",
    archived: "Archived",
  };
  return labels[status] ?? "Learning path";
}

function formatLastStudied(value: string | null) {
  if (!value) return "Not started";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Previously studied";
  return `Last studied ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date)}`;
}

function PathNavigation({ pathId }: { pathId: string }) {
  const links = [
    { href: `#overview`, label: "Overview" },
    { href: `#path`, label: "Path" },
    { href: `#practice`, label: "Practice" },
    { href: `#materials`, label: "Materials" },
    { href: `/ai-coach?path=${pathId}`, label: "Tutor" },
  ];

  return (
    <nav aria-label="Learning path sections" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {links.map((link, index) => (
          <li key={link.label}>
            <Link
              href={link.href}
              aria-current={index === 0 ? "page" : undefined}
              className={
                index === 0
                  ? "inline-flex min-h-11 items-center border-b-2 border-foreground px-3 text-sm font-semibold"
                  : "inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              }
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TopicStatus({ topic }: { topic: PathTopic }) {
  if (topic.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Check aria-hidden="true" className="size-3.5" />
        {displayMasteryLabel(topic.mastery_label)}
      </span>
    );
  }
  if (topic.status === "needs_review") {
    return <span className="text-xs font-medium">Needs review</span>;
  }
  if (topic.status === "locked") {
    return <span className="text-xs text-muted-foreground">Locked</span>;
  }
  return <span className="text-xs font-medium">Ready</span>;
}

export default async function LearningPathPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ materials?: string; updated?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await getAppPageContext();

  const [itemResult, materialsResult, modulesResult, topicsResult] = await Promise.all([
    supabase
      .from("learning_items")
      .select(
        "id, title, description, goal, status, starting_level, target_outcome, estimated_minutes, target_date, progress, mastery_label, current_lesson, recommendation_title, recommendation_reason, recommendation_action, recommendation_minutes, generation_error, last_studied_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("learning_materials")
      .select("id, file_name, storage_path, file_size, mime_type")
      .eq("learning_item_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("learning_modules")
      .select("id, title, description, objective, position, estimated_minutes")
      .eq("learning_item_id", id)
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    supabase
      .from("learning_topics")
      .select(
        "id, module_id, title, objective, learning_question, position, estimated_minutes, status, mastery_label",
      )
      .eq("learning_item_id", id)
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
  ]);

  if (
    itemResult.error ||
    materialsResult.error ||
    modulesResult.error ||
    topicsResult.error
  ) {
    throw new Error("Unable to load learning path");
  }
  if (!itemResult.data) notFound();

  const item = itemResult.data;
  const modules = (modulesResult.data ?? []) as PathModule[];
  const topics = (topicsResult.data ?? []) as PathTopic[];
  if (modules.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl py-4 md:py-8">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to My Learning
        </Link>
        <PathGenerator
          pathId={item.id}
          shouldStart={item.status !== "needs_attention"}
        />
      </main>
    );
  }

  const materials = await Promise.all(
    (materialsResult.data ?? []).map(async (material) => {
      const { data } = await supabase.storage
        .from("learning-materials")
        .createSignedUrl(material.storage_path, 300);
      return { ...material, url: data?.signedUrl ?? null };
    }),
  );
  const currentTopic =
    topics.find((topic) => topic.status === "in_progress") ??
    topics.find((topic) => topic.status === "needs_review") ??
    topics.find((topic) => topic.status === "available") ??
    topics[0];
  const completedTopics = topics.filter((topic) => topic.status === "completed").length;
  const progress = topics.length ? Math.round((completedTopics / topics.length) * 100) : 0;
  const currentModule = modules.find((module) => module.id === currentTopic?.module_id);

  return (
    <main id="overview" className="mx-auto w-full max-w-[76rem] py-4 md:py-8">
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to My Learning
      </Link>

      <header className="mt-7 pb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{pathStatusLabel(item.status)}</span>
          <span aria-hidden="true" className="size-1 rounded-full bg-border" />
          <span>{formatLastStudied(item.last_studied_at)}</span>
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
              {item.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              {item.description || item.goal}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4 lg:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Progress</dt>
              <dd className="mt-1 font-semibold tabular-nums">{completedTopics} of {topics.length} topics</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mastery</dt>
              <dd className="mt-1 font-semibold">{displayMasteryLabel(item.mastery_label)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Estimated time</dt>
              <dd className="mt-1 font-semibold tabular-nums">{formatLearningMinutes(item.estimated_minutes)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Starting level</dt>
              <dd className="mt-1 font-semibold capitalize">
                {item.starting_level === "unsure" ? "Not sure" : item.starting_level}
              </dd>
            </div>
          </dl>
        </div>
        <LearningProgress title={item.title} progress={progress} className="mt-7" />
      </header>

      <PathNavigation pathId={item.id} />

      {query.materials === "added" ? (
        <p className="mt-6 border border-border bg-muted/45 px-4 py-3 text-sm" role="status">
          Your PDFs were attached. Regenerate the path to incorporate the new material.
        </p>
      ) : null}
      {query.updated === "1" ? (
        <p className="mt-6 border border-border bg-muted/45 px-4 py-3 text-sm" role="status">
          Path settings saved. Existing topics are unchanged.
        </p>
      ) : null}

      <section className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.8fr)]">
        <article className="rounded-2xl border bg-foreground p-6 text-background sm:p-8">
          <p className="text-xs font-semibold tracking-[0.12em] text-background/70 uppercase">
            Continue
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance">
            {currentTopic.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-background/75">
            {currentTopic.objective}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-background/75">
            <span>{formatLearningMinutes(currentTopic.estimated_minutes)}</span>
            {currentModule ? (
              <>
                <span aria-hidden="true" className="size-1 rounded-full bg-background/35" />
                <span>{currentModule.title}</span>
              </>
            ) : null}
          </div>
          <Button asChild variant="secondary" size="lg" className="mt-7">
            <Link href={`/learning/${item.id}/topics/${currentTopic.id}`}>
              {currentTopic.status === "in_progress" ? "Continue topic" : "Start topic"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </article>

        <aside className="rounded-2xl border bg-card p-6" aria-labelledby="recommendation-title">
          <Sparkles aria-hidden="true" className="size-5" />
          <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Current recommendation
          </p>
          <h2 id="recommendation-title" className="mt-2 text-xl font-semibold tracking-tight">
            {item.recommendation_title ?? `Continue ${currentTopic.title}`}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {item.recommendation_reason ?? currentTopic.objective}
          </p>
          <p className="mt-5 text-xs font-medium text-muted-foreground">
            {item.recommendation_minutes ?? currentTopic.estimated_minutes} min
          </p>
        </aside>
      </section>

      <section id="path" aria-labelledby="path-title" className="scroll-mt-24 pt-16">
        <div className="max-w-2xl">
          <h2 id="path-title" className="text-2xl font-semibold tracking-tight">Your path</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Topics unlock in prerequisite order. Completed topics remain available for review.
          </p>
        </div>

        <div className="mt-7 border-y border-border">
          {modules.map((module, moduleIndex) => {
            const moduleTopics = topics.filter((topic) => topic.module_id === module.id);
            const moduleCompleted = moduleTopics.filter((topic) => topic.status === "completed").length;
            const isCurrent = module.id === currentTopic.module_id;
            return (
              <details
                key={module.id}
                open={isCurrent}
                className="group border-b border-border last:border-b-0"
              >
                <summary className="flex min-h-20 cursor-pointer list-none items-center gap-5 px-1 py-5 outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border text-sm font-semibold tabular-nums">
                    {moduleIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold">{module.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {moduleCompleted} of {moduleTopics.length} complete · {formatLearningMinutes(module.estimated_minutes)}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-xl text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <div className="pb-6 pl-1 sm:pl-[5.75rem] sm:pr-4">
                  <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {module.objective}
                  </p>
                  <ol className="divide-y divide-border border-y border-border">
                    {moduleTopics.map((topic) => (
                      <li key={topic.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
                        <div className="min-w-0">
                          {topic.status === "locked" ? (
                            <span className="font-medium text-muted-foreground">{topic.title}</span>
                          ) : (
                            <Link
                              href={`/learning/${item.id}/topics/${topic.id}`}
                              className="rounded-sm font-medium outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {topic.title}
                            </Link>
                          )}
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {topic.learning_question}
                          </p>
                        </div>
                        <div className="text-right">
                          <TopicStatus topic={topic} />
                          <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                            {topic.estimated_minutes} min
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section id="practice" aria-labelledby="practice-title" className="scroll-mt-24 pt-16">
        <div className="grid gap-8 border-y border-border py-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="max-w-2xl">
            <h2 id="practice-title" className="text-2xl font-semibold tracking-tight">Practice across this path</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Start with the current topic. Mixed review will become more useful after you complete more topics.
            </p>
          </div>
          <Button asChild variant="outline" size="lg">
            <Link href={`/learning/${item.id}/topics/${currentTopic.id}`}>
              Practice {currentTopic.title}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      <section id="materials" aria-labelledby="materials-title" className="scroll-mt-24 pt-16 pb-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)] lg:gap-16">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="materials-title" className="text-2xl font-semibold tracking-tight">Source materials</h2>
              <span className="text-sm tabular-nums text-muted-foreground">{materials.length}/12</span>
            </div>
            {materials.length > 0 ? (
              <ul className="mt-6 divide-y divide-border border-y border-border">
                {materials.map((material) => (
                  <li key={material.id} className="py-4">
                    {material.url ? (
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-h-11 items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                          {material.file_name}
                        </span>
                        <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <div className="flex gap-3 text-sm text-muted-foreground">
                        <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        <span>{material.file_name} is temporarily unavailable.</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
                This path uses general knowledge. Add PDFs if you want future regeneration and tutor responses grounded in your own material.
              </p>
            )}
          </div>
          <aside className="border-t border-border pt-8 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
            <AddMaterialsForm itemId={item.id} materialCount={materials.length} />
            <div className="mt-8 border-t border-border pt-7">
              <p className="mb-4 text-sm leading-6 text-muted-foreground">
                Regeneration uses the current goal and source PDFs, then replaces this path and its activity progress.
              </p>
              <RegeneratePathButton pathId={item.id} />
            </div>
          </aside>
        </div>
      </section>

      <section id="settings" aria-labelledby="settings-title" className="scroll-mt-24 border-t border-border py-12">
        <details className="max-w-2xl">
          <summary id="settings-title" className="min-h-11 cursor-pointer text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Path settings
          </summary>
          <UpdatePathSettingsForm
            path={{
              id: item.id,
              title: item.title,
              goal: item.goal,
              startingLevel: item.starting_level,
              targetOutcome: item.target_outcome,
              targetDate: item.target_date,
            }}
          />
        </details>
      </section>
    </main>
  );
}
