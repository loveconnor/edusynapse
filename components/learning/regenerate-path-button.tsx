"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RegeneratePathButton({ pathId }: { pathId: string }) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    const confirmed = window.confirm(
      "Regenerate this learning path? This replaces its modules, topics, activities, and saved activity progress. Your goal and source materials stay saved.",
    );
    if (!confirmed) return;

    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/learning-paths/${pathId}/generate`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "The path could not be regenerated.");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The path could not be regenerated. Your goal and materials are still saved.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isGenerating}
        onClick={() => void regenerate()}
      >
        {isGenerating ? "Regenerating…" : "Regenerate path"}
      </Button>
      {error ? (
        <p className="mt-3 text-sm leading-6 text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
