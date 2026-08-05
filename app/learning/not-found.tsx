import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LearningItemNotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Learning item not found</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          It may have been removed, or you may not have access to it.
        </p>
        <Button render={<Link href="/dashboard" />} size="lg" className="mt-7">
          Return to dashboard
        </Button>
      </div>
    </main>
  );
}
