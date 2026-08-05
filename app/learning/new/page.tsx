import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { LearningHeader } from "@/components/learning/learning-header";
import { NewLearningForm } from "@/components/learning/learning-forms";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Add learning | EduSynapse",
  description: "Create a learning topic from your notes and PDFs.",
};

export default async function NewLearningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <LearningHeader name={profile?.name?.trim() || null} email={user.email} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to dashboard
        </Link>

        <div className="mb-10 mt-8 border-b border-border pb-8 sm:mb-12">
          <p className="mb-2 text-sm font-medium text-muted-foreground">My Learning</p>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Add learning
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Create a topic from your own notes, PDFs, or both. You’ll control the
            current lesson and progress.
          </p>
        </div>

        <NewLearningForm />
      </main>
    </div>
  );
}
