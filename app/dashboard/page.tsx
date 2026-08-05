import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { LearningHeader } from "@/components/learning/learning-header";
import { LearningProgress } from "@/components/learning/learning-progress";
import { Button } from "@/components/ui/button";
import {
  getLearningStatus,
  selectContinueItem,
  selectRecommendationItem,
  type LearningItemSummary,
} from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard | EduSynapse",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");

  const [{ data: profile }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase
      .from("learning_items")
      .select(
        "id, title, progress, current_lesson, last_studied_at, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  if (error) throw new Error("Unable to load learning items");

  const items = (data ?? []) as LearningItemSummary[];
  const continueItem = selectContinueItem(items);
  const recommendation = selectRecommendationItem(items);
  const name = profile?.name?.trim() || null;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <LearningHeader name={name} email={user.email} />

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mb-12 flex flex-col gap-5 sm:mb-16 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              My Learning
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
              {name ? `Welcome back, ${name}.` : "Welcome back."}
            </h1>
          </div>
          <Button render={<Link href="/learning/new" />} size="lg">
            <Plus aria-hidden="true" />
            Add learning
          </Button>
        </div>

        {items.length === 0 ? (
          <section
            aria-labelledby="empty-learning-title"
            className="border-y border-border py-16 sm:py-24"
          >
            <div className="max-w-xl">
              <BookOpen aria-hidden="true" className="mb-6 size-8" />
              <h2
                id="empty-learning-title"
                className="text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                Add what you’re learning
              </h2>
              <p className="mt-3 text-base leading-7 text-muted-foreground">
                Start a topic from your own notes or PDFs. It will appear here so
                you can track the lesson and progress over time.
              </p>
              <Button render={<Link href="/learning/new" />} size="lg" className="mt-7">
                <Plus aria-hidden="true" />
                Create your first learning item
              </Button>
            </div>
          </section>
        ) : (
          <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)] lg:gap-16">
            <div className="min-w-0 space-y-14">
              <section aria-labelledby="continue-learning-title">
                <div className="mb-5 flex items-baseline justify-between gap-4">
                  <h2 id="continue-learning-title" className="text-xl font-semibold tracking-tight">
                    Continue learning
                  </h2>
                </div>

                {continueItem ? (
                  <div className="overflow-hidden rounded-2xl bg-foreground text-background shadow-sm">
                    <div className="p-6 sm:p-8">
                      <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0 max-w-xl">
                          <p className="text-sm font-medium text-background/70">
                            {continueItem.progress === 0
                              ? "Ready to start"
                              : `${continueItem.progress}% complete`}
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                            {continueItem.title}
                          </h3>
                          <p className="mt-3 text-sm leading-6 text-background/70">
                            {continueItem.current_lesson
                              ? `Current lesson: ${continueItem.current_lesson}`
                              : "Add your current lesson when you’re ready to begin."}
                          </p>
                        </div>
                        <Button
                          render={<Link href={`/learning/${continueItem.id}`} />}
                          variant="secondary"
                          size="lg"
                          className="w-full sm:w-auto"
                        >
                          {continueItem.progress === 0 ? "Start learning" : "Continue"}
                          <ArrowRight aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="mt-8 flex items-center gap-4">
                        <LearningProgress
                          title={continueItem.title}
                          progress={continueItem.progress}
                          inverse
                          className="flex-1"
                        />
                        <span className="text-sm tabular-nums text-background/70">
                          {continueItem.progress}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-y border-border py-10">
                    <h3 className="text-lg font-semibold">Everything is complete</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      You’ve marked every learning item as 100%. Start something new
                      whenever you’re ready.
                    </p>
                  </div>
                )}
              </section>

              <section aria-labelledby="your-learning-title">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 id="your-learning-title" className="text-xl font-semibold tracking-tight">
                    Your learning
                  </h2>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </div>

                <ul className="divide-y divide-border border-y border-border">
                  {items.map((item) => {
                    const status = getLearningStatus(item.progress);
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/learning/${item.id}`}
                          className="group grid min-h-24 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 rounded-sm py-5 outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-3 sm:-mx-3"
                        >
                          <div className="min-w-0">
                            <h3 className="truncate font-medium group-hover:underline group-hover:underline-offset-4">
                              {item.title}
                            </h3>
                            <p className="mt-1 truncate text-sm text-muted-foreground">
                              {item.current_lesson ??
                                (status === "completed"
                                  ? "Completed"
                                  : status === "not-started"
                                    ? "Not started"
                                    : "Lesson not set")}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium tabular-nums">
                              {status === "not-started" ? "Not started" : `${item.progress}%`}
                            </span>
                            <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
                          </div>
                          <LearningProgress
                            title={item.title}
                            progress={item.progress}
                            className="col-span-2"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  render={<Link href="/learning/new" />}
                  variant="link"
                  className="mt-5 px-0"
                >
                  <Plus aria-hidden="true" />
                  Add learning
                </Button>
              </section>
            </div>

            <aside aria-labelledby="recommendation-title" className="border-t border-border pt-8 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
              <p className="text-sm font-medium text-muted-foreground">Today</p>
              <h2 id="recommendation-title" className="mt-2 text-xl font-semibold tracking-tight">
                Recommendation
              </h2>
              {recommendation ? (
                <>
                  <p className="mt-5 text-lg leading-8 text-balance">
                    {recommendation.progress === 0
                      ? `Start ${recommendation.title} by setting your first lesson.`
                      : `Return to ${recommendation.title}, currently at ${recommendation.progress}% progress.`}
                  </p>
                  {recommendation.current_lesson ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Continue with {recommendation.current_lesson}.
                    </p>
                  ) : null}
                  <Button
                    render={<Link href={`/learning/${recommendation.id}`} />}
                    variant="outline"
                    size="lg"
                    className="mt-7"
                  >
                    {recommendation.progress === 0 ? "Start" : "Review progress"}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                  <p className="mt-5 text-xs leading-5 text-muted-foreground">
                    Recommendations prioritize your least-progressed unfinished item.
                  </p>
                </>
              ) : (
                <p className="mt-5 text-sm leading-6 text-muted-foreground">
                  There’s nothing unfinished to recommend. Add a new topic when
                  you’re ready.
                </p>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
