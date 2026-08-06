"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LearningPathBuilder } from "@/components/learning/learning-path-builder";

export type NewLearningDialogFocus = "title" | "files";

export function NewLearningDialog({
  defaultTitle,
  initialFocus = "title",
  onOpenChange,
  open,
}: {
  defaultTitle?: string;
  initialFocus?: NewLearningDialogFocus;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      disablePointerDismissal
    >
      <DialogContent
        initialFocus={() =>
          document.querySelector<HTMLTextAreaElement>(
            '[aria-label="What would you like to learn or prepare for?"]',
          )
        }
        className="flex h-[calc(100dvh-2rem)] max-w-4xl flex-col overflow-hidden sm:h-[min(46rem,calc(100dvh-3rem))]"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Create a learning path</DialogTitle>
          <DialogDescription>
            Tell me what you want to learn. I’ll use your goals, experience,
            schedule, and materials to build a personalized path.
          </DialogDescription>
        </DialogHeader>
        <LearningPathBuilder
          defaultTitle={defaultTitle}
          initialIntent={initialFocus}
        />
      </DialogContent>
    </Dialog>
  );
}
