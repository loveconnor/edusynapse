import type { Metadata } from "next";
import { NewLearningRouteDialog } from "@/components/learning/new-learning-route-dialog";

export const metadata: Metadata = {
  title: "Add learning | EduSynapse",
  description: "Create a learning topic from your notes and PDFs.",
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
