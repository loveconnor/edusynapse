"use client";

import { Check } from "love-ui/icons";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const GENERATION_STEPS = [
  "Reading your goal and starting point",
  "Finding the prerequisite structure",
  "Creating topics and activities",
  "Preparing your first session",
];
const GENERATION_STEP_INTERVAL_MS = 15_000;
const CLIENT_GENERATION_TIMEOUT_MS = 95_000;

export function PathGenerator({
  pathId,
  shouldStart,
}: {
  pathId: string;
  shouldStart: boolean;
}) {
  const router = useRouter();
  const startedRef = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const generate = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setStep(0);
    setElapsedSeconds(0);

    const interval = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, GENERATION_STEPS.length - 1));
    }, GENERATION_STEP_INTERVAL_MS);
    const elapsedInterval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 5);
    }, 5_000);

    try {
      const response = await fetch(`/api/learning-paths/${pathId}/generate`, {
        method: "POST",
        signal: AbortSignal.timeout(CLIENT_GENERATION_TIMEOUT_MS),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "We couldn’t build this path.");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === "TimeoutError"
          ? "Building this path took too long. Your goal and materials are saved—try again."
          : caught instanceof Error
          ? caught.message
          : "We couldn’t build this path. Your goal and materials are still saved.",
      );
    } finally {
      window.clearInterval(interval);
      window.clearInterval(elapsedInterval);
      setIsGenerating(false);
    }
  }, [isGenerating, pathId, router]);

  useEffect(() => {
    if (!shouldStart || startedRef.current) return;
    startedRef.current = true;
    void generate();
  }, [generate, shouldStart]);

  return (
    <section
      aria-labelledby="path-generation-title"
      className="mx-auto w-full max-w-2xl py-16 text-center sm:py-24"
    >
      <div
        aria-hidden="true"
        className="mx-auto grid size-16 place-items-center rounded-full border bg-card"
      >
        <span className="size-7 animate-spin rounded-full border-2 border-muted border-t-foreground motion-reduce:animate-none" />
      </div>
      <h1
        id="path-generation-title"
        className="mt-7 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl"
      >
        {isGenerating ? "Building your learning path" : "Your path needs another try"}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted-foreground">
        {isGenerating
          ? "Your goal and materials are saved. You can leave this page and return later."
          : "Nothing was lost. Retry when the learning-path service is available."}
      </p>

      {isGenerating ? (
        <div className="mx-auto mt-10 max-w-md text-left">
          <ol className="space-y-3" aria-live="polite">
            {GENERATION_STEPS.map((label, index) => (
              <li
                key={label}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-3 text-sm leading-6"
              >
                <span
                  aria-hidden="true"
                  className={
                    index < step
                      ? "mt-1 grid size-4 place-items-center rounded-full bg-foreground text-background"
                      : index === step
                        ? "mt-1 size-4 rounded-full border-4 border-foreground"
                        : "mt-1 size-4 rounded-full border border-border"
                  }
                >
                  {index < step ? <Check aria-hidden="true" className="size-3" /> : null}
                </span>
                <span className={index <= step ? "font-medium" : "text-muted-foreground"}>
                  {label}
                </span>
              </li>
            ))}
          </ol>
          {elapsedSeconds >= 45 ? (
            <p className="mt-5 text-sm leading-6 text-muted-foreground" role="status">
              This is taking longer than usual. I’ll stop and offer a retry if it reaches the time limit.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-8">
          {error ? (
            <p className="mb-5 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="button" size="lg" onClick={() => void generate()}>
            Retry generation
          </Button>
        </div>
      )}
    </section>
  );
}
