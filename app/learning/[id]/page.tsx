import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "love-ui/icons";
import { notFound } from "next/navigation";
import {
  AddMaterialsForm,
  UpdateLearningForm,
} from "@/components/learning/learning-forms";
import { LearningProgress } from "@/components/learning/learning-progress";
import { getAppPageContext } from "@/lib/app-page-context";
import { getLearningStatus } from "@/lib/learning";

export const metadata: Metadata = {
  title: "Learning item | EduSynapse",
};

export default async function LearningItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; materials?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await getAppPageContext();

  const [itemResult, materialsResult] = await Promise.all([
    supabase
      .from("learning_items")
      .select("id, title, notes, progress, current_lesson")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("learning_materials")
      .select("id, file_name, storage_path, file_size, mime_type")
      .eq("learning_item_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  if (itemResult.error || materialsResult.error) {
    throw new Error("Unable to load learning item");
  }
  if (!itemResult.data) notFound();

  const item = itemResult.data;
  const materials = await Promise.all(
    (materialsResult.data ?? []).map(async (material) => {
      const { data } = await supabase.storage
        .from("learning-materials")
        .createSignedUrl(material.storage_path, 300);
      return { ...material, url: data?.signedUrl ?? null };
    }),
  );
  const status = getLearningStatus(item.progress);

  return (
      <main className="mx-auto w-full max-w-5xl py-4 md:py-8">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to dashboard
        </Link>

        <header className="mt-8 border-b border-border pb-10">
          <p className="text-sm font-medium text-muted-foreground">
            {status === "completed"
              ? "Completed"
              : status === "not-started"
                ? "Not started"
                : "In progress"}
          </p>
          <div className="mt-3 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                {item.title}
              </h1>
              <p className="mt-4 text-base text-muted-foreground">
                {item.current_lesson
                  ? `Current lesson: ${item.current_lesson}`
                  : "Add a current lesson to mark where you’re working."}
              </p>
            </div>
            <span className="shrink-0 text-3xl font-semibold tabular-nums tracking-tight">
              {item.progress}%
            </span>
          </div>
          <LearningProgress title={item.title} progress={item.progress} className="mt-7" />
        </header>

        {query.updated === "1" ? (
          <p className="mt-6 rounded-lg border border-border bg-muted/45 px-4 py-3 text-sm" role="status">
            Your progress was saved.
          </p>
        ) : null}
        {query.materials === "added" ? (
          <p className="mt-6 rounded-lg border border-border bg-muted/45 px-4 py-3 text-sm" role="status">
            Your PDFs were attached.
          </p>
        ) : null}

        <div className="mt-12 grid items-start gap-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.7fr)] lg:gap-16">
          <section aria-labelledby="progress-details-title">
            <h2 id="progress-details-title" className="mb-7 text-xl font-semibold tracking-tight">
              Learning details
            </h2>
            <UpdateLearningForm
              item={{
                id: item.id,
                title: item.title,
                notes: item.notes,
                currentLesson: item.current_lesson,
                progress: item.progress,
              }}
            />
          </section>

          <aside aria-labelledby="materials-title" className="border-t border-border pt-8 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 id="materials-title" className="text-xl font-semibold tracking-tight">
                Materials
              </h2>
              <span className="text-sm tabular-nums text-muted-foreground">
                {materials.length}/12
              </span>
            </div>

            {materials.length > 0 ? (
              <ul className="mb-8 divide-y divide-border border-y border-border">
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
                        <span className="break-words">
                          {material.file_name} is temporarily unavailable.
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-8 text-sm leading-6 text-muted-foreground">
                No PDFs attached yet. Add source material here so it stays with
                this topic.
              </p>
            )}

            <AddMaterialsForm itemId={item.id} materialCount={materials.length} />
          </aside>
        </div>
      </main>
  );
}
