import { cn } from "@/lib/utils";

export function LearningProgress({
  title,
  progress,
  inverse = false,
  className,
}: {
  title: string;
  progress: number;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full", inverse ? "bg-white/20" : "bg-muted", className)}
      role="progressbar"
      aria-label={`Progress for ${title}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <div
        className={cn("h-full rounded-full", inverse ? "bg-white" : "bg-foreground")}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
