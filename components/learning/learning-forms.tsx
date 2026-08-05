"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  attachLearningMaterials,
  createLearningItem,
  updateLearningItem,
} from "@/app/learning/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialLearningActionState } from "@/lib/learning";
import { cn } from "@/lib/utils";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

function FormMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      role="alert"
    >
      {message}
    </div>
  );
}

function SubmitButton({
  children,
  pendingLabel = "Saving…",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function AttachSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      disabled={disabled || pending}
      className={cn(disabled && "cursor-not-allowed")}
    >
      {pending ? "Uploading…" : "Attach PDFs"}
    </Button>
  );
}

const textareaClassName =
  "min-h-32 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none transition-shadow placeholder:text-muted-foreground/64 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/16";

export function NewLearningForm() {
  const [state, action] = useActionState(
    createLearningItem,
    initialLearningActionState,
  );

  return (
    <form action={action} className="space-y-8">
      <FormMessage message={state.message} />

      <div className="space-y-2">
        <Label htmlFor="title">Topic or course title</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          size="lg"
          autoComplete="off"
          placeholder="For example, React Fundamentals"
          aria-invalid={Boolean(state.fieldErrors?.title)}
          aria-describedby={state.fieldErrors?.title ? "title-error" : undefined}
        />
        <FieldError id="title-error" message={state.fieldErrors?.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentLesson">Current lesson (optional)</Label>
        <Input
          id="currentLesson"
          name="currentLesson"
          maxLength={200}
          size="lg"
          autoComplete="off"
          placeholder="For example, Components"
          aria-invalid={Boolean(state.fieldErrors?.currentLesson)}
          aria-describedby={
            state.fieldErrors?.currentLesson ? "current-lesson-error" : undefined
          }
        />
        <FieldError
          id="current-lesson-error"
          message={state.fieldErrors?.currentLesson}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          name="notes"
          maxLength={10000}
          className={textareaClassName}
          placeholder="Add an outline, goals, or anything you want to remember."
          aria-invalid={Boolean(state.fieldErrors?.notes)}
          aria-describedby={state.fieldErrors?.notes ? "notes-error" : undefined}
        />
        <FieldError id="notes-error" message={state.fieldErrors?.notes} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="files">PDFs (optional)</Label>
        <Input
          id="files"
          name="files"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          size="lg"
          aria-invalid={Boolean(state.fieldErrors?.files)}
          aria-describedby={
            state.fieldErrors?.files ? "files-help files-error" : "files-help"
          }
        />
        <p id="files-help" className="text-sm leading-6 text-muted-foreground">
          Attach up to 12 PDFs. Each file can be up to 50 MB.
        </p>
        <FieldError id="files-error" message={state.fieldErrors?.files} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <SubmitButton>Create learning item</SubmitButton>
        <p className="text-sm text-muted-foreground">
          New items start at 0% until you update your progress.
        </p>
      </div>
    </form>
  );
}

export function UpdateLearningForm({
  item,
}: {
  item: {
    id: string;
    title: string;
    notes: string | null;
    currentLesson: string | null;
    progress: number;
  };
}) {
  const [state, action] = useActionState(
    updateLearningItem,
    initialLearningActionState,
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="itemId" value={item.id} />
      <FormMessage message={state.message} />

      <div className="space-y-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          name="title"
          required
          maxLength={200}
          size="lg"
          defaultValue={item.title}
          aria-invalid={Boolean(state.fieldErrors?.title)}
          aria-describedby={
            state.fieldErrors?.title ? "edit-title-error" : undefined
          }
        />
        <FieldError id="edit-title-error" message={state.fieldErrors?.title} />
      </div>

      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="space-y-2">
          <Label htmlFor="edit-current-lesson">Current lesson</Label>
          <Input
            id="edit-current-lesson"
            name="currentLesson"
            maxLength={200}
            size="lg"
            defaultValue={item.currentLesson ?? ""}
            placeholder="Add the lesson you’re working on"
            aria-invalid={Boolean(state.fieldErrors?.currentLesson)}
            aria-describedby={
              state.fieldErrors?.currentLesson
                ? "edit-current-lesson-error"
                : undefined
            }
          />
          <FieldError
            id="edit-current-lesson-error"
            message={state.fieldErrors?.currentLesson}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="progress">Progress (%)</Label>
          <Input
            id="progress"
            name="progress"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            required
            size="lg"
            defaultValue={item.progress}
            className="tabular-nums"
            aria-invalid={Boolean(state.fieldErrors?.progress)}
            aria-describedby={
              state.fieldErrors?.progress ? "progress-error" : undefined
            }
          />
          <FieldError id="progress-error" message={state.fieldErrors?.progress} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-notes">Notes</Label>
        <textarea
          id="edit-notes"
          name="notes"
          maxLength={10000}
          defaultValue={item.notes ?? ""}
          className={textareaClassName}
          placeholder="Add an outline, goals, or anything you want to remember."
          aria-invalid={Boolean(state.fieldErrors?.notes)}
          aria-describedby={
            state.fieldErrors?.notes ? "edit-notes-error" : undefined
          }
        />
        <FieldError id="edit-notes-error" message={state.fieldErrors?.notes} />
      </div>

      <SubmitButton>Save progress</SubmitButton>
    </form>
  );
}

export function AddMaterialsForm({
  itemId,
  materialCount,
}: {
  itemId: string;
  materialCount: number;
}) {
  const [state, action] = useActionState(
    attachLearningMaterials,
    initialLearningActionState,
  );
  const remaining = Math.max(0, 12 - materialCount);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="itemId" value={itemId} />
      <FormMessage message={state.message} />

      <div className="space-y-2">
        <Label htmlFor="add-files">Add PDFs</Label>
        <Input
          id="add-files"
          name="files"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          required
          disabled={remaining === 0}
          size="lg"
          aria-invalid={Boolean(state.fieldErrors?.files)}
          aria-describedby={
            state.fieldErrors?.files
              ? "add-files-help add-files-error"
              : "add-files-help"
          }
        />
        <p id="add-files-help" className="text-sm leading-6 text-muted-foreground">
          {remaining === 0
            ? "This item already has the maximum of 12 PDFs."
            : `You can attach ${remaining} more ${remaining === 1 ? "PDF" : "PDFs"}, up to 50 MB each.`}
        </p>
        <FieldError id="add-files-error" message={state.fieldErrors?.files} />
      </div>

      <AttachSubmitButton disabled={remaining === 0} />
    </form>
  );
}
