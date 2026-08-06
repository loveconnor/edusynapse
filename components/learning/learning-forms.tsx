"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  attachLearningMaterials,
  updateLearningPath,
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

export function UpdatePathSettingsForm({
  path,
}: {
  path: {
    id: string;
    title: string;
    goal: string;
    startingLevel: string;
    targetOutcome: string;
    targetDate: string | null;
  };
}) {
  const [state, action] = useActionState(
    updateLearningPath,
    initialLearningActionState,
  );

  return (
    <form action={action} className="mt-6 space-y-6">
      <input type="hidden" name="itemId" value={path.id} />
      <FormMessage message={state.message} />
      <div className="space-y-2">
        <Label htmlFor="path-settings-title">Path title</Label>
        <Input
          id="path-settings-title"
          name="title"
          required
          maxLength={200}
          size="lg"
          defaultValue={path.title}
          aria-invalid={Boolean(state.fieldErrors?.title)}
          aria-describedby={state.fieldErrors?.title ? "path-settings-title-error" : undefined}
        />
        <FieldError id="path-settings-title-error" message={state.fieldErrors?.title} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="path-settings-goal">Goal</Label>
        <textarea
          id="path-settings-goal"
          name="goal"
          required
          maxLength={1000}
          defaultValue={path.goal}
          className={textareaClassName}
          aria-invalid={Boolean(state.fieldErrors?.goal)}
          aria-describedby={state.fieldErrors?.goal ? "path-settings-goal-error" : undefined}
        />
        <FieldError id="path-settings-goal-error" message={state.fieldErrors?.goal} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="path-settings-level">Current level</Label>
          <select
            id="path-settings-level"
            name="startingLevel"
            defaultValue={path.startingLevel}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="unsure">Not sure</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="path-settings-date">Target date</Label>
          <Input
            id="path-settings-date"
            name="targetDate"
            type="date"
            size="lg"
            defaultValue={path.targetDate ?? ""}
            aria-invalid={Boolean(state.fieldErrors?.targetDate)}
            aria-describedby={state.fieldErrors?.targetDate ? "path-settings-date-error" : undefined}
          />
          <FieldError id="path-settings-date-error" message={state.fieldErrors?.targetDate} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="path-settings-outcome">Target outcome</Label>
        <textarea
          id="path-settings-outcome"
          name="targetOutcome"
          maxLength={1000}
          defaultValue={path.targetOutcome}
          className={textareaClassName}
          aria-invalid={Boolean(state.fieldErrors?.targetOutcome)}
          aria-describedby={state.fieldErrors?.targetOutcome ? "path-settings-outcome-error" : undefined}
        />
        <FieldError id="path-settings-outcome-error" message={state.fieldErrors?.targetOutcome} />
      </div>
      <div>
        <SubmitButton>Save path settings</SubmitButton>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Saving does not rewrite existing topics. Regenerate the path when the new goal should change its structure.
        </p>
      </div>
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
