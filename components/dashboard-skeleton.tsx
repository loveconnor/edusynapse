import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <main
      aria-labelledby="dashboard-loading-title"
      className="mx-auto min-h-[calc(100dvh-var(--app-header-height)-2rem)] w-full max-w-[80rem] py-4 md:min-h-[calc(100dvh-var(--app-header-height)-3rem)] md:py-8"
    >
      <h1 id="dashboard-loading-title" className="sr-only">
        Loading My Learning
      </h1>
      <p className="sr-only" role="status">
        Loading your learning…
      </p>

      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="space-y-3">
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(19rem,2fr)]">
          <Skeleton className="h-60 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>

        <div className="mt-12">
          <Skeleton className="h-7 w-44" />
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-52 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
