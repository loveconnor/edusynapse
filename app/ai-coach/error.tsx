"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default function AiCoachError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto grid w-full max-w-3xl flex-1 place-items-center px-4 py-16">
      <Empty className="w-full rounded-none border-y border-solid border-border py-10">
        <EmptyHeader className="max-w-lg">
          <p className="text-sm font-medium text-muted-foreground">AI Coach</p>
          <EmptyTitle
            role="heading"
            aria-level={1}
            className="mt-3 text-3xl font-semibold tracking-tight"
          >
            Your coach could not load
          </EmptyTitle>
          <EmptyDescription className="mt-3 max-w-lg">
            Your learning data was not changed. Retry the page, or return to My
            Learning and come back later.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="max-w-none flex-row flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to My Learning</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
