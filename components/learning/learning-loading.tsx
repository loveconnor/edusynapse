export function LearningLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="sr-only" role="status">
        Loading your learning…
      </p>
      <div aria-hidden="true" className="animate-pulse space-y-12 motion-reduce:animate-none">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-12 w-full max-w-xl rounded bg-muted" />
        </div>
        <div className="h-56 rounded-2xl bg-muted" />
        <div className="space-y-4">
          <div className="h-7 w-40 rounded bg-muted" />
          <div className="h-24 border-y border-border bg-muted/40" />
          <div className="h-24 border-b border-border bg-muted/40" />
        </div>
      </div>
    </main>
  );
}
