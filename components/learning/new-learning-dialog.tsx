"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewLearningForm } from "@/components/learning/learning-forms";

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
          document.getElementById(
            initialFocus === "files" ? "new-learning-files" : "new-learning-title",
          )
        }
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-h-[calc(100dvh-3rem)]"
      >
        <DialogHeader>
          <DialogTitle>Add learning</DialogTitle>
          <DialogDescription>
            Create a topic from your notes, PDFs, or both. You can update its
            progress after it’s created.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-6">
          <NewLearningForm
            defaultTitle={defaultTitle}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
