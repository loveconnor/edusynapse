import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingChat } from "@/components/onboarding/onboarding-chat";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Personalize your learning | EduSynapse",
  description: "Try the conversational EduSynapse onboarding flow.",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) redirect("/dashboard");

  return <OnboardingChat />;
}
