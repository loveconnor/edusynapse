import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/dashboard/actions";

export function LearningHeader({
  name,
  email,
}: {
  name: string | null;
  email: string;
}) {
  return (
    <header className="border-b border-border/80">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="rounded-sm text-base font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          EduSynapse
        </Link>

        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <div className="hidden min-w-0 text-right sm:block">
            {name ? (
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
            ) : null}
            <p className="max-w-64 truncate text-xs text-muted-foreground">
              {email}
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
