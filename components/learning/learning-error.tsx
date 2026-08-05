"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LearningError({
  reset,
  title = "We couldn’t load your learning",
}: {
  reset: () => void;
  title?: string;
}) {
  return (
    <main className="grid min-h-svh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Your saved learning is unchanged. Try loading it again.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button type="button" size="lg" onClick={reset}>
            Try again
          </Button>
          <Button render={<Link href="/dashboard" />} variant="outline" size="lg">
            Return to dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
