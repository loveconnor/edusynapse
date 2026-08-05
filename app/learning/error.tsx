"use client";

import { LearningError } from "@/components/learning/learning-error";

export default function LearningRouteError({ reset }: { reset: () => void }) {
  return <LearningError reset={reset} title="We couldn’t load this learning item" />;
}
