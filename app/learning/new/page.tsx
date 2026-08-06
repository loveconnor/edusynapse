import type { Metadata } from "next";
import { NewLearningRouteDialog } from "@/components/learning/new-learning-route-dialog";

export const metadata: Metadata = {
  title: "Build a learning path | EduSynapse",
  description: "Create an adaptive learning path from a goal and source materials.",
};

export default async function NewLearningPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedTitle = Array.isArray(query.title) ? query.title[0] : query.title;
  const defaultTitle = requestedTitle?.trim().slice(0, 200) ?? "";

  return <NewLearningRouteDialog defaultTitle={defaultTitle} />;
}
