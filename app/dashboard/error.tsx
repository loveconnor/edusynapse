"use client";

import { LearningError } from "@/components/learning/learning-error";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <LearningError reset={reset} />;
}
