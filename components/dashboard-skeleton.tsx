import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <main aria-labelledby="dashboard-title" className="space-y-6">
      <h1 id="dashboard-title" className="sr-only">
        Dashboard
      </h1>

      <div aria-hidden="true" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-56 max-w-full" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="space-y-4 rounded-xl border bg-background p-5"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
          <div className="space-y-5 rounded-xl border bg-background p-5">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-72 w-full" />
          </div>

          <div className="space-y-5 rounded-xl border bg-background p-5">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
