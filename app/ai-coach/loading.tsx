import { Skeleton } from "@/components/ui/skeleton";

export default function AiCoachLoading() {
  return (
    <main aria-busy="true" aria-label="Loading AI Coach" className="mx-auto w-full max-w-5xl py-3 md:py-6">
      <div aria-hidden="true">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-4 h-12 w-64 max-w-full" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />

        <div className="mt-7 rounded-2xl border border-border bg-background p-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-8 w-72 max-w-full" />
          <Skeleton className="mt-3 h-4 w-36" />
          <Skeleton className="mt-5 h-16 w-full max-w-2xl" />
        </div>

        <div className="mt-10 flex items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-64 max-w-full" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
        </div>
        <Skeleton className="mt-6 h-80 w-full rounded-none" />
        <Skeleton className="mt-5 h-24 w-full rounded-2xl" />
      </div>
    </main>
  );
}
