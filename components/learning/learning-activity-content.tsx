"use client";

import { Markdown } from "@/components/agents/markdown";

export function LearningActivityContent({ children }: { children: string }) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <Markdown className="prose mt-6 max-w-none text-[1rem] leading-7">
        {children}
      </Markdown>
    </div>
  );
}
