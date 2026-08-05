import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Dashboard | EduSynapse",
};

export default async function DashboardPage() {
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
    <main className="grid min-h-svh place-items-center px-4">
      <div className="flex max-w-full flex-col items-center gap-4 text-center">
        <div className="flex max-w-full flex-col items-center gap-1">
          {profile?.name ? (
            <p className="max-w-full break-all text-base text-muted-foreground">
              {profile.name}
            </p>
          ) : null}
          <p className="max-w-full break-all text-base text-muted-foreground">
            {user.email}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
