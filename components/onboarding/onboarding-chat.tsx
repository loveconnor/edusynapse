"use client";

import { Paperclip, RotateCcw, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { QuestionCard } from "@/components/agents/question-card";
import {
  MessageBubble,
  MessageBubbleContent,
} from "@/components/agents/message-bubble";
import { MessageScroller } from "@/components/agents/message-scroller";
import { PromptInput } from "@/components/agents/prompt-input";
import { StreamingResponse } from "@/components/agents/streaming-response";
import { ReasoningText } from "@/components/agents/loading-states/reasoning-text";
import { Button } from "@/components/motion/button";
import { SlideActionButton } from "@/components/motion/slide-action-button";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

type OnboardingStep =
  | "name"
  | "focus"
  | "context"
  | "materials"
  | "goals"
  | "time"
  | "personalization";

type ChatMessage = {
  id: number;
  from: "assistant" | "user";
  content: string;
};

type LocalAttachment = {
  id: string;
  name: string;
  size: number;
  file: File;
};

type OnboardingAnswers = {
  name: string;
  focus: string;
  context: string;
  materialNotes: string;
  goals: string[];
  time: string;
};

type StoredMaterial = {
  name: string;
  path: string;
  size: number;
  type: string;
};

const STEP_ORDER: OnboardingStep[] = [
  "name",
  "focus",
  "context",
  "materials",
  "goals",
  "time",
  "personalization",
];

const FOCUS_SUGGESTIONS = [
  "React",
  "Calculus II",
  "Spanish",
  "AWS certification",
];

const CONTEXT_OPTIONS = [
  "Through school",
  "For work",
  "Personal learning",
  "Preparing for a certification",
];

const GOAL_OPTIONS = [
  "Pass an upcoming exam",
  "Understand topics more deeply",
  "Learn a new skill",
  "Stay consistent",
  "Complete assignments faster",
];

const TIME_OPTIONS = ["15 min", "30 min", "45 min", "1 hour", "2+ hours"];
const MAX_ATTACHMENTS = 12;
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

const EMPTY_ANSWERS: OnboardingAnswers = {
  name: "",
  focus: "",
  context: "",
  materialNotes: "",
  goals: [],
  time: "",
};

function getQuestion(step: OnboardingStep, answers: OnboardingAnswers) {
  const focus = answers.focus || "this";

  if (step === "name") {
    return "Welcome to EduSynapse. I’ll guide you through seven short steps so EduSynapse can personalize your learning experience. Your answers are saved when you finish setup.\n\nWhat should EduSynapse call you?";
  }
  if (step === "focus") {
    return `Thanks, ${answers.name}. What are you learning right now?`;
  }
  if (step === "context") {
    return `How are you learning ${focus}? This helps set the right kind of milestones and practice.`;
  }
  if (step === "materials") {
    return "Do you have any learning materials you’d like to add? Attach files, enter details yourself, or skip this for now.";
  }
  if (step === "goals") {
    return `What do you want to achieve with ${focus}? Choose any that apply.`;
  }
  if (step === "time") {
    return "How much time can you usually study each day?";
  }
  return "Everyone learns differently. EduSynapse will use what you’ve shared to personalize explanations, practice, and study plans around your goals, available time, and learning materials.";
}

function useLocalTextStream(text: string, streamKey: string) {
  const reduceMotion = useReducedMotion() ?? false;
  const [streamState, setStreamState] = useState<{
    key: string;
    visibleText: string;
    phase: "preparing" | "streaming" | "complete";
  }>(() => ({
    key: streamKey,
    visibleText: reduceMotion ? text : "",
    phase: reduceMotion ? "complete" : "preparing",
  }));

  useEffect(() => {
    let interval: number | undefined;
    if (reduceMotion) return;

    const timer = window.setTimeout(() => {
      const tokens = text.match(/\S+\s*/g) ?? [text];
      let tokenIndex = 0;
      setStreamState({ key: streamKey, visibleText: "", phase: "streaming" });
      interval = window.setInterval(() => {
        tokenIndex += 1;
        const streamComplete = tokenIndex >= tokens.length;
        setStreamState({
          key: streamKey,
          visibleText: tokens.slice(0, tokenIndex).join(""),
          phase: streamComplete ? "complete" : "streaming",
        });
        if (tokenIndex >= tokens.length) {
          if (interval) window.clearInterval(interval);
        }
      }, 45);
    }, 380);

    return () => {
      if (timer) window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
    };
  }, [reduceMotion, streamKey, text]);

  const currentState =
    reduceMotion
      ? { visibleText: text, phase: "complete" as const }
      : streamState.key === streamKey
        ? streamState
        : { visibleText: "", phase: "preparing" as const };

  return {
    visibleText: currentState.visibleText,
    preparing: currentState.phase === "preparing",
    streaming: currentState.phase !== "complete",
    complete: currentState.phase === "complete",
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div data-slot="message" data-from="assistant">
      <MessageBubble variant="ghost" align="start">
        <MessageBubbleContent className="max-w-2xl whitespace-pre-wrap text-base leading-7">
          {content}
        </MessageBubbleContent>
      </MessageBubble>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div data-slot="message" data-from="user">
      <MessageBubble variant="soft" align="end" animateIn>
        <MessageBubbleContent className="whitespace-pre-wrap text-[15px]">
          {content}
        </MessageBubbleContent>
      </MessageBubble>
    </div>
  );
}

export function OnboardingChat() {
  const router = useRouter();
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const messageIdRef = useRef(0);
  const [runId, setRunId] = useState(0);
  const [step, setStep] = useState<OnboardingStep>("name");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const question = useMemo(() => getQuestion(step, answers), [answers, step]);
  const stream = useLocalTextStream(question, `${runId}:${step}`);
  const stepIndex = STEP_ORDER.indexOf(step);
  const stepNumber = stepIndex + 1;
  const progress = (stepNumber / STEP_ORDER.length) * 100;

  function nextMessageId() {
    messageIdRef.current += 1;
    return messageIdRef.current;
  }

  function answerCurrentStep(
    userContent: string,
    nextStep: OnboardingStep,
    answerUpdate: Partial<OnboardingAnswers>,
  ) {
    setMessages((current) => [
      ...current,
      { id: nextMessageId(), from: "assistant", content: question },
      { id: nextMessageId(), from: "user", content: userContent },
    ]);
    setAnswers((current) => ({ ...current, ...answerUpdate }));
    setDraft("");
    setStep(nextStep);
  }

  function submitFocus(value: string) {
    const focus = value.trim();
    if (!focus) return;
    answerCurrentStep(focus, "context", { focus });
  }

  function submitName(value: string) {
    const name = value.trim();
    if (!name) return;
    answerCurrentStep(name, "focus", { name });
  }

  function submitMaterials(notes?: string) {
    const details = notes?.trim() ?? "";
    const fileSummary =
      attachments.length === 0
        ? ""
        : `${attachments.length} ${attachments.length === 1 ? "file" : "files"}: ${attachments.map((file) => file.name).join(", ")}`;
    const materialSummary = [fileSummary, details].filter(Boolean).join("; ");
    if (!materialSummary) return;
    answerCurrentStep(materialSummary, "goals", { materialNotes: details });
  }

  function skipMaterials() {
    setAttachments([]);
    setAttachmentError(null);
    answerCurrentStep("I’ll add materials later.", "goals", {
      materialNotes: "",
    });
  }

  async function addAttachments(files: File[]) {
    const availableSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const candidates = files.slice(0, availableSlots);
    const acceptedFiles: File[] = [];
    let validationError: string | null =
      candidates.length < files.length
        ? `You can attach up to ${MAX_ATTACHMENTS} PDFs.`
        : null;

    for (const file of candidates) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        validationError = "Each PDF must be 50 MB or smaller.";
        continue;
      }

      const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (new TextDecoder().decode(signature) !== "%PDF-") {
        validationError = "Attach PDF files only.";
        continue;
      }

      acceptedFiles.push(file);
    }

    setAttachmentError(validationError);
    setAttachments((current) => [
      ...current,
      ...acceptedFiles.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}-${Date.now()}`,
        name: file.name,
        size: file.size,
        file,
      })),
    ]);
  }

  async function finishOnboarding() {
    setIsSaving(true);
    setSaveError(null);
    const supabase = createSupabaseClient();
    const uploadedPaths: string[] = [];

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const proposedLearningItemId = crypto.randomUUID();
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        name: answers.name,
        learning_focus: answers.focus,
        learning_context: answers.context,
        material_notes: answers.materialNotes || null,
        goals: answers.goals,
        daily_study_time: answers.time,
      });

      if (profileError) throw profileError;

      const { data: learningItem, error: learningItemError } = await supabase
        .from("learning_items")
        .upsert(
          {
            id: proposedLearningItemId,
            user_id: user.id,
            title: answers.focus,
            notes: answers.materialNotes || null,
            origin: "onboarding",
            origin_key: "profile",
          },
          { onConflict: "user_id,origin_key" },
        )
        .select("id")
        .single();

      if (learningItemError) throw learningItemError;

      const storedMaterials: StoredMaterial[] = [];

      for (const attachment of attachments) {
        const path = `${user.id}/${learningItem.id}/${crypto.randomUUID()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("learning-materials")
          .upload(path, attachment.file, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        uploadedPaths.push(path);
        storedMaterials.push({
          name: attachment.name,
          path,
          size: attachment.size,
          type: "application/pdf",
        });
      }

      if (storedMaterials.length > 0) {
        const { error: materialsError } = await supabase
          .from("learning_materials")
          .insert(
            storedMaterials.map((material) => ({
              learning_item_id: learningItem.id,
              user_id: user.id,
              file_name: material.name,
              storage_path: material.path,
              file_size: material.size,
              mime_type: material.type,
            })),
          );

        if (materialsError) throw materialsError;
      }

      const { error: completionError } = await supabase
        .from("profiles")
        .update({
          materials: storedMaterials,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (completionError) throw completionError;

      router.replace("/dashboard");
      router.refresh();
    } catch {
      if (uploadedPaths.length > 0) {
        await supabase
          .from("learning_materials")
          .delete()
          .in("storage_path", uploadedPaths);
        await supabase.storage.from("learning-materials").remove(uploadedPaths);
      }
      setSaveError("We couldn’t save your setup. Your answers are still here—try again.");
      setIsSaving(false);
    }
  }

  function restart() {
    setRunId((current) => current + 1);
    setStep("name");
    setMessages([]);
    setAnswers(EMPTY_ANSWERS);
    setDraft("");
    setAttachments([]);
    setAttachmentError(null);
    setIsSaving(false);
    setSaveError(null);
  }

  const readyForInput = stream.complete;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="flex h-svh w-full flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-border/70 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-4">
                <p className="truncate text-sm font-semibold">EduSynapse setup</p>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  Step {stepNumber} of {STEP_ORDER.length}
                </p>
              </div>
              <div
                className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Onboarding progress"
                aria-valuemin={1}
                aria-valuemax={STEP_ORDER.length}
                aria-valuenow={stepNumber}
              >
                <div
                  className="h-full rounded-full bg-foreground transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={restart}
              aria-label="Restart onboarding"
              title="Restart onboarding"
              className="shrink-0 rounded-full"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </header>

        <MessageScroller
          className="min-h-0 flex-1"
          viewportClassName="h-full"
          contentClassName="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-7 px-4 py-8 sm:px-6 sm:py-10"
          label="Onboarding conversation"
          busy={stream.streaming}
          followOutput
        >
          {messages.map((message) =>
            message.from === "assistant" ? (
              <AssistantMessage key={message.id} content={message.content} />
            ) : (
              <UserMessage key={message.id} content={message.content} />
            ),
          )}

          <div data-slot="message" data-from="assistant" id={`onboarding-question-${step}`}>
            {stream.preparing ? (
              <ReasoningText
                phrases={["Preparing the next question"]}
                variant="swap"
              />
            ) : (
              <MessageBubble variant="ghost" align="start" animateIn>
                <MessageBubbleContent className="max-w-2xl">
                  <StreamingResponse
                    status={stream.streaming ? "streaming" : "complete"}
                    announce={false}
                    showActions={false}
                    contentClassName="whitespace-pre-wrap text-base leading-7"
                  >
                    {stream.visibleText}
                    {stream.streaming ? (
                      <span
                        aria-hidden="true"
                        className="ms-1 inline-block h-4 w-0.5 translate-y-0.5 bg-foreground animate-pulse motion-reduce:animate-none"
                      />
                    ) : null}
                  </StreamingResponse>
                </MessageBubbleContent>
              </MessageBubble>
            )}
          </div>
        </MessageScroller>

        <div className="shrink-0 px-4 pb-4 sm:px-6 sm:pb-6">
          <div
            className="mx-auto w-full max-w-3xl"
            aria-labelledby={`onboarding-question-${step}`}
          >
            {!readyForInput ? null : step === "name" ? (
              <PromptInput
                value={draft}
                onValueChange={setDraft}
                onSubmit={submitName}
                minRows={1}
                maxRows={2}
                maxLength={100}
                autoComplete="name"
                placeholder="Enter your name…"
                aria-label="Your name"
              />
            ) : step === "focus" ? (
              <div>
                <div className="mb-3 flex flex-wrap gap-2" aria-label="Suggested learning topics">
                  {FOCUS_SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => submitFocus(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
                <PromptInput
                  value={draft}
                  onValueChange={setDraft}
                  onSubmit={submitFocus}
                  minRows={1}
                  maxRows={4}
                  placeholder="Type a subject, course, or skill…"
                  aria-label="What are you learning right now?"
                />
              </div>
            ) : step === "context" ? (
              <QuestionCard
                questions={[
                  {
                    id: "learning-context",
                    title: "Choose one",
                    options: CONTEXT_OPTIONS.map((option) => ({
                      value: option,
                      label: option,
                    })),
                  },
                ]}
                submitLabel="Continue"
                onSubmit={(cardAnswers) => {
                  const context =
                    cardAnswers["learning-context"]?.selected[0];

                  if (!context) return;

                  answerCurrentStep(context, "materials", { context });
                }}
              />
            ) : step === "materials" ? (
              <div>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  tabIndex={-1}
                  className="sr-only"
                  aria-label="Attach learning materials"
                  onChange={(event) => {
                    void addAttachments(
                      Array.from(event.currentTarget.files ?? []),
                    );
                    event.currentTarget.value = "";
                  }}
                />

                {attachments.length > 0 ? (
                  <ul className="mb-3 space-y-2" aria-label="Attached files">
                    {attachments.map((file) => (
                      <li
                        key={file.id}
                        className="flex min-h-11 items-center gap-3 rounded-xl bg-muted px-3 text-sm"
                      >
                        <Paperclip aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => {
                            setAttachments((current) => current.filter((item) => item.id !== file.id));
                            setAttachmentError(null);
                          }}
                          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {attachmentError ? (
                  <p className="mb-3 text-sm font-medium text-destructive" role="alert">
                    {attachmentError}
                  </p>
                ) : null}

                <PromptInput
                  value={draft}
                  onValueChange={setDraft}
                  onSubmit={(value) => submitMaterials(value)}
                  canSubmitWithoutText={attachments.length > 0}
                  submitAriaLabel={
                    attachments.length > 0
                      ? "Continue with attached files and notes"
                      : "Continue with notes"
                  }
                  minRows={1}
                  maxRows={5}
                  placeholder={
                    attachments.length > 0
                      ? "Add notes about these files (optional)…"
                      : "Enter notes, an outline, or other details…"
                  }
                  aria-label="Enter learning material details"
                  actions={[
                    {
                      value: "attach-files",
                      label: "Attach PDFs",
                      description: "Add up to 12 PDFs, up to 50 MB each",
                      icon: <Paperclip aria-hidden="true" />,
                    },
                  ]}
                  onAction={() => attachmentInputRef.current?.click()}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={skipMaterials} className="rounded-full text-muted-foreground">
                    Skip for now
                  </Button>
                  <p className="ms-auto text-xs text-muted-foreground">
                    {attachments.length > 0
                      ? "Files and notes will be saved together when you finish."
                      : "Your notes will be saved when you finish setup."}
                  </p>
                </div>
              </div>
            ) : step === "goals" ? (
              <QuestionCard
                questions={[
                  {
                    id: "learning-goals",
                    title: "Choose your goals",
                    multiple: true,
                    options: GOAL_OPTIONS.map((option) => ({
                      value: option,
                      label: option,
                    })),
                  },
                ]}
                submitLabel="Continue"
                onSubmit={(cardAnswers) => {
                  const goals =
                    cardAnswers["learning-goals"]?.selected ?? [];

                  if (goals.length === 0) return;

                  answerCurrentStep(goals.join(", "), "time", { goals });
                }}
              />
            ) : step === "time" ? (
              <QuestionCard
                questions={[
                  {
                    id: "daily-study-time",
                    title: "Choose your daily study time",
                    options: TIME_OPTIONS.map((option) => ({
                      value: option,
                      label: option,
                    })),
                  },
                ]}
                submitLabel="Continue"
                onSubmit={(cardAnswers) => {
                  const time =
                    cardAnswers["daily-study-time"]?.selected[0];

                  if (!time) return;

                  answerCurrentStep(time, "personalization", { time });
                }}
              />
            ) : (
              <div className="flex flex-col items-start gap-3">
                {isSaving ? (
                  <p className="py-5 text-sm text-muted-foreground" role="status">
                    Saving your setup…
                  </p>
                ) : (
                  <>
                    <SlideActionButton
                      completeLabel="Saving setup"
                      onComplete={() => void finishOnboarding()}
                    >
                      Slide to finish setup
                    </SlideActionButton>
                    <p className="text-xs text-muted-foreground">
                      Drag the arrow to save and continue, or focus it and press Enter.
                    </p>
                  </>
                )}
                {saveError ? (
                  <p className="text-sm font-medium text-destructive" role="alert">
                    {saveError}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
