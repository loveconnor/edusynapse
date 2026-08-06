import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <main aria-labelledby="dashboard-loading-title" className="mx-auto w-full max-w-[76rem] py-4 md:py-8">
      <h1 id="dashboard-loading-title" className="sr-only">
        Loading My Learning
      </h1>
      <p className="sr-only" role="status">
        Loading your learning…
      </p>

      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>

        <div className="mt-12 space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-56 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
