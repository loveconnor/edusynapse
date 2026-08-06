import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

function getUserMetadataValue(
  metadata: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

export const getAppPageContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");

  const [profileResult, learningItemsResult, materialsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, daily_study_time")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("learning_items")
      .select(
        "id, title, progress, current_lesson, last_studied_at, created_at, updated_at",
      )
      .eq("user_id", user.id),
    supabase
      .from("learning_materials")
      .select("id, learning_item_id, file_name, created_at")
      .eq("user_id", user.id),
  ]);

  if (learningItemsResult.error || materialsResult.error) {
    throw new Error("Unable to load app navigation data");
  }

  const metadata = user.user_metadata as Record<string, unknown>;
  const name =
    profileResult.data?.name?.trim() ||
    getUserMetadataValue(metadata, ["full_name", "name"]) ||
    user.email;

  return {
    supabase,
    user,
    profile: {
      dailyStudyTime: profileResult.data?.daily_study_time ?? null,
    },
    shellProps: {
      commandPaletteData: {
        learningItems: learningItemsResult.data ?? [],
        materials: materialsResult.data ?? [],
      },
      user: {
        name,
        email: user.email,
        avatarUrl: getUserMetadataValue(metadata, ["avatar_url", "picture"]),
      },
    },
  };
});
