"use client";

import { Check, Paperclip, RotateCcw, X } from "love-ui/icons";
import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createLearningItem } from "@/app/learning/actions";
import {
  GuidedAssistantMessage,
  GuidedStreamingMessage,
  GuidedUserMessage,
  useGuidedTextStream,
} from "@/components/agents/guided-setup";
import { ReasoningText } from "@/components/agents/loading-states/reasoning-text";
import { MessageScroller } from "@/components/agents/message-scroller";
import { PromptInput } from "@/components/agents/prompt-input";
import { QuestionCard } from "@/components/agents/question-card";
import { SlideActionButton } from "@/components/motion/slide-action-button";
import { Button } from "@/components/ui/button";
import { initialLearningActionState } from "@/lib/learning";
import type {
  LearningPathSetupGuidance,
  LearningPathSetupStep,
} from "@/lib/learning-path-setup";
import { cn } from "@/lib/utils";

type BuilderStep =
  | "topic"
  | "goal"
  | "experience"
  | "schedule"
  | "materials"
  | "review";

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

type BuilderAnswers = {
  topic: string;
  goal: string;
  startingLevel: "" | "beginner" | "intermediate" | "advanced" | "unsure";
  schedule: "" | "few-days" | "two-weeks" | "month" | "open";
  materialNotes: string;
};

const MAX_ATTACHMENTS = 12;
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

const EMPTY_ANSWERS: BuilderAnswers = {
  topic: "",
  goal: "",
  startingLevel: "",
  schedule: "",
  materialNotes: "",
};

const TOPIC_SUGGESTIONS = [
  { label: "Learn React from the beginning", value: "React" },
  { label: "Prepare for my biology final", value: "Biology" },
  { label: "Understand the material in my notes", value: "The material in my notes" },
  { label: "Study for the AWS Cloud Practitioner exam", value: "AWS Cloud Practitioner certification" },
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "New to this" },
  { value: "intermediate", label: "Know the basics" },
  { value: "advanced", label: "Comfortable already" },
  { value: "unsure", label: "Not sure" },
] as const;

const SCHEDULE_OPTIONS = [
  { value: "few-days", label: "A few days" },
  { value: "two-weeks", label: "1–2 weeks" },
  { value: "month", label: "About a month" },
  { value: "open", label: "No deadline" },
] as const;

const PROGRESS_STEPS = ["Goal", "Experience", "Schedule", "Materials", "Review"];

function progressIndex(step: BuilderStep) {
  if (step === "topic" || step === "goal") return 0;
  if (step === "experience") return 1;
  if (step === "schedule") return 2;
  if (step === "materials") return 3;
  return 4;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scheduleLabel(value: BuilderAnswers["schedule"]) {
  return SCHEDULE_OPTIONS.find((option) => option.value === value)?.label ?? "No deadline";
}

function experienceLabel(value: BuilderAnswers["startingLevel"]) {
  return EXPERIENCE_OPTIONS.find((option) => option.value === value)?.label ?? "Not sure";
}

function targetDateForSchedule(value: BuilderAnswers["schedule"]) {
  const days = value === "few-days" ? 4 : value === "two-weeks" ? 14 : value === "month" ? 30 : 0;
  if (days === 0) return "";
  const target = new Date();
  target.setDate(target.getDate() + days);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function questionFor(
  step: BuilderStep,
  materialFirstIntent: boolean,
) {
  if (step === "topic") {
    return materialFirstIntent
      ? "What would you like to learn from your materials?"
      : "What would you like to learn or prepare for?";
  }
  if (step === "goal") return "What would you like to be able to do by the end?";
  if (step === "experience") return "How familiar are you with this subject right now?";
  if (step === "schedule") return "How quickly would you like to reach this goal?";
  if (step === "materials") {
    return "Do you have PDFs or notes you want me to use? Add them here, or continue without materials.";
  }
  return "I have enough information to build your path. Review these details before I create it.";
}

function ReviewRow({
  label,
  onEdit,
  value,
}: {
  label: string;
  onEdit: () => void;
  value: string;
}) {
  return (
    <div className="grid gap-1 border-b border-border/70 py-3 last:border-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      <dt className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 text-sm leading-6 text-foreground">{value}</dd>
      <dd>
        <Button
          variant="link"
          size="xs"
          onClick={onEdit}
          className="h-8 px-0 text-muted-foreground hover:text-foreground"
        >
          Edit {label.toLowerCase()}
        </Button>
      </dd>
    </div>
  );
}

export function LearningPathBuilder({
  defaultTitle = "",
  initialIntent = "title",
}: {
  defaultTitle?: string;
  initialIntent?: "title" | "files";
}) {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const conversationViewportRef = useRef<HTMLElement>(null);
  const messageIdRef = useRef(0);
  const reviewRef = useRef<HTMLElement>(null);
  const [runId, setRunId] = useState(0);
  const [step, setStep] = useState<BuilderStep>("topic");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<BuilderAnswers>({
    ...EMPTY_ANSWERS,
    topic: defaultTitle,
  });
  const [draft, setDraft] = useState(defaultTitle);
  const [quickSetup, setQuickSetup] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const [guidance, setGuidance] = useState<
    Partial<Record<LearningPathSetupStep, LearningPathSetupGuidance>>
  >({});
  const [guidancePending, setGuidancePending] =
    useState<LearningPathSetupStep | null>(null);
  const [topicGuidanceLoading, setTopicGuidanceLoading] = useState(true);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [state, createAction, isCreating] = useActionState(
    createLearningItem,
    initialLearningActionState,
  );

  const question = useMemo(
    () =>
      step === "topic" || step === "review"
        ? questionFor(step, initialIntent === "files")
        : guidance[step]?.question ?? questionFor(step, initialIntent === "files"),
    [guidance, initialIntent, step],
  );
  const waitingForGuidance =
    guidancePending === step || (step === "topic" && topicGuidanceLoading);
  const stream = useGuidedTextStream(
    question,
    `${runId}:${step}:${returnToReview}:${waitingForGuidance ? "waiting" : question}`,
  );
  const activeProgressIndex = progressIndex(step);

  async function requestGuidance(
    nextStep: LearningPathSetupStep,
    nextAnswers: BuilderAnswers,
    signal?: AbortSignal,
  ) {
    const response = await fetch("/api/learning-paths/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ step: nextStep, answers: nextAnswers }),
    });
    if (!response.ok) return null;
    return (await response.json()) as LearningPathSetupGuidance;
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void requestGuidance("topic", { ...EMPTY_ANSWERS, topic: defaultTitle }, controller.signal)
      .then((result) => {
        if (active && result) {
          setGuidance((current) => ({ ...current, topic: result }));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setTopicGuidanceLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [defaultTitle, runId]);

  useEffect(() => {
    if (step !== "review" || !stream.complete) return;
    const viewport = conversationViewportRef.current;
    const review = reviewRef.current;
    if (!viewport || !review) return;
    viewport.scrollTop = Math.max(0, review.offsetTop - 24);
  }, [step, stream.complete]);

  function nextMessageId() {
    messageIdRef.current += 1;
    return messageIdRef.current;
  }

  function recordAnswer(
    content: string,
    update: Partial<BuilderAnswers>,
    normalNextStep: BuilderStep,
  ) {
    const nextAnswers = { ...answers, ...update };
    setMessages((current) => [
      ...current,
      { id: nextMessageId(), from: "assistant", content: question },
      { id: nextMessageId(), from: "user", content },
    ]);
    setAnswers(nextAnswers);
    setDraft("");
    const nextStep = returnToReview ? "review" : normalNextStep;
    if (returnToReview) {
      setReturnToReview(false);
    }
    setStep(nextStep);
    if (nextStep === "review") return;

    setGuidancePending(nextStep);
    void requestGuidance(nextStep, nextAnswers)
      .then((result) => {
        if (result) {
          setGuidance((current) => ({ ...current, [nextStep]: result }));
        }
      })
      .catch(() => undefined)
      .finally(() => setGuidancePending((current) => (current === nextStep ? null : current)));
  }

  function submitTopic(value: string, response = value) {
    const topic = value.trim();
    if (!topic) return;
    if (quickSetup) {
      recordAnswer(response, {
        topic,
        goal: `Understand ${topic} and apply it independently`,
        schedule: "open",
      }, "experience");
      return;
    }
    recordAnswer(response, { topic }, "goal");
  }

  function editStep(nextStep: BuilderStep) {
    setReturnToReview(true);
    setStep(nextStep);
    setDraft(
      nextStep === "topic"
        ? answers.topic
        : nextStep === "goal"
          ? answers.goal
          : nextStep === "materials"
            ? answers.materialNotes
            : "",
    );
  }

  async function addAttachments(files: File[]) {
    const availableSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const candidates = files.slice(0, availableSlots);
    const accepted: File[] = [];
    let error =
      candidates.length < files.length
        ? `You can attach up to ${MAX_ATTACHMENTS} PDFs.`
        : null;

    for (const file of candidates) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        error = "Each PDF must be 50 MB or smaller.";
        continue;
      }
      const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (new TextDecoder().decode(signature) !== "%PDF-") {
        error = "Attach PDF files only.";
        continue;
      }
      accepted.push(file);
    }

    setAttachmentError(error);
    setAttachments((current) => [
      ...current,
      ...accepted.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}-${Date.now()}`,
        name: file.name,
        size: file.size,
        file,
      })),
    ]);
  }

  function submitMaterials(notes?: string) {
    const materialNotes = notes?.trim() ?? "";
    const fileSummary =
      attachments.length === 0
        ? ""
        : `${attachments.length} ${attachments.length === 1 ? "PDF" : "PDFs"}`;
    const response = [fileSummary, materialNotes].filter(Boolean).join(" and ");
    recordAnswer(
      response || "Continue without materials",
      { materialNotes },
      "review",
    );
  }

  function createPath() {
    if (!answers.startingLevel || !answers.schedule) return;
    const formData = new FormData();
    formData.set("title", answers.topic);
    formData.set("goal", answers.goal);
    formData.set("startingLevel", answers.startingLevel);
    formData.set("targetOutcome", answers.goal);
    formData.set("targetDate", targetDateForSchedule(answers.schedule));
    const context = [
      answers.materialNotes,
      `Preferred schedule: ${scheduleLabel(answers.schedule)}.`,
      answers.startingLevel === "unsure"
        ? "The learner is not sure of their starting level; begin with lightweight diagnostic checks."
        : "",
      quickSetup ? "The learner chose quick setup; use practical defaults where details are missing." : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    formData.set("notes", context);
    for (const attachment of attachments) formData.append("files", attachment.file);
    startTransition(() => createAction(formData));
  }

  function restart() {
    setRunId((current) => current + 1);
    setStep("topic");
    setMessages([]);
    setAnswers({ ...EMPTY_ANSWERS, topic: defaultTitle });
    setDraft(defaultTitle);
    setQuickSetup(false);
    setReturnToReview(false);
    setGuidance({});
    setGuidancePending(null);
    setTopicGuidanceLoading(true);
    setAttachments([]);
    setAttachmentError(null);
  }

  const readyForInput = stream.complete && !waitingForGuidance;
  const goalOptions = [
    { label: "Understand the fundamentals", value: `Understand the fundamentals of ${answers.topic}` },
    { label: "Build something practical", value: `Build something practical with ${answers.topic}` },
    { label: "Prepare for a class or exam", value: `Prepare for a class or exam in ${answers.topic}` },
    { label: "Use it professionally", value: `Use ${answers.topic} professionally` },
  ];
  const activeGoalOptions = guidance.goal?.options ?? goalOptions;
  const activeExperienceOptions = guidance.experience?.options ?? EXPERIENCE_OPTIONS;
  const activeScheduleOptions = guidance.schedule?.options ?? SCHEDULE_OPTIONS;
  const activeTopicSuggestions = guidance.topic?.options ?? TOPIC_SUGGESTIONS;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 py-3 sm:px-6">
        <div className="relative flex items-center justify-center">
          <ol
            aria-label="Learning path setup progress"
            className="mx-auto flex w-full max-w-[44rem] min-w-0 items-center overflow-x-auto px-9 sm:px-0"
          >
            {PROGRESS_STEPS.map((label, index) => {
              const completed = index < activeProgressIndex;
              const current = index === activeProgressIndex;
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex min-w-0 items-center",
                    index < PROGRESS_STEPS.length - 1 ? "flex-1" : "shrink-0",
                  )}
                >
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 text-xs font-medium",
                      current ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-5 place-items-center rounded-full border text-[10px] tabular-nums",
                        (completed || current) && "border-foreground text-foreground",
                        completed && "bg-foreground text-background",
                      )}
                    >
                      {completed ? <Check className="size-3" /> : index + 1}
                    </span>
                    <span className={cn(!current && "hidden sm:inline")}>{label}</span>
                  </span>
                  {index < PROGRESS_STEPS.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mx-2 h-px min-w-3 flex-1 bg-border",
                        completed && "bg-foreground",
                      )}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
          <Button
            variant="ghost"
            size="icon"
            onClick={restart}
            aria-label="Restart path setup"
            title="Restart path setup"
            className="absolute right-0 shrink-0 rounded-full"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>

      <MessageScroller
        className="min-h-0 flex-1"
        viewportClassName="h-full"
        contentClassName="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-7 px-4 py-7 sm:px-6 sm:py-9"
        label="Learning path setup conversation"
        busy={stream.streaming || waitingForGuidance}
        followOutput
        viewportRef={conversationViewportRef}
      >
        {messages.map((message) =>
          message.from === "assistant" ? (
            <GuidedAssistantMessage key={message.id} content={message.content} />
          ) : (
            <GuidedUserMessage key={message.id} content={message.content} />
          ),
        )}

        <div data-slot="message" data-from="assistant" id={`path-builder-question-${step}`}>
          {waitingForGuidance ? (
            <ReasoningText
              phrases={[
                step === "topic"
                  ? "Personalizing your starting options"
                  : "Personalizing the next question",
              ]}
              variant="swap"
            />
          ) : (
            <GuidedStreamingMessage {...stream} />
          )}
        </div>

        {step === "review" && readyForInput ? (
          <section
            ref={reviewRef}
            aria-labelledby="path-review-title"
            className="rounded-2xl bg-muted p-4 sm:p-5"
          >
            <h3 id="path-review-title" className="text-base font-semibold">
              {answers.topic}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              I’ll choose prerequisites, sequence the topics, and prepare the first useful session after you confirm.
            </p>
            <dl className="mt-4 border-y border-border/70">
              <ReviewRow label="Topic" value={answers.topic} onEdit={() => editStep("topic")} />
              <ReviewRow label="Goal" value={answers.goal} onEdit={() => editStep("goal")} />
              <ReviewRow
                label="Starting point"
                value={experienceLabel(answers.startingLevel)}
                onEdit={() => editStep("experience")}
              />
              <ReviewRow
                label="Schedule"
                value={scheduleLabel(answers.schedule)}
                onEdit={() => editStep("schedule")}
              />
              <ReviewRow
                label="Materials"
                value={
                  attachments.length > 0
                    ? `${attachments.length} ${attachments.length === 1 ? "PDF" : "PDFs"}${answers.materialNotes ? " and notes" : ""}`
                    : answers.materialNotes
                      ? "Pasted notes"
                      : "No source materials"
                }
                onEdit={() => editStep("materials")}
              />
            </dl>
          </section>
        ) : null}

        <div
          data-slot="message"
          className="w-full"
          aria-labelledby={`path-builder-question-${step}`}
        >
          {state.message ? (
            <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
              {state.message}
            </div>
          ) : null}

          {!readyForInput ? null : step === "topic" ? (
            <div>
              <div className="mb-3 flex flex-wrap gap-2" aria-label="Suggested learning topics">
                {activeTopicSuggestions.map((suggestion) => (
                  <Button
                    key={`${suggestion.value}:${suggestion.label}`}
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-8 whitespace-normal py-1.5 text-left"
                    onClick={() => submitTopic(suggestion.value, suggestion.label)}
                  >
                    {suggestion.label}
                  </Button>
                ))}
              </div>
              <PromptInput
                autoFocus
                value={draft}
                onValueChange={setDraft}
                onSubmit={submitTopic}
                minRows={1}
                maxRows={4}
                maxLength={200}
                placeholder="Describe a subject, exam, or skill…"
                aria-label="What would you like to learn or prepare for?"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuickSetup((current) => !current)}
                  aria-pressed={quickSetup}
                >
                  {quickSetup ? "Use guided setup" : "Build a quick path instead"}
                </Button>
                {quickSetup ? (
                  <p className="text-xs leading-5 text-muted-foreground" role="status">
                    Quick setup asks only for your topic and starting point. You’ll review the defaults before creation.
                  </p>
                ) : null}
              </div>
            </div>
          ) : step === "goal" ? (
            <QuestionCard
              key={`${runId}:goal:${answers.goal}`}
              questions={[
                {
                  id: "path-goal",
                  title: "Choose a goal or write your own",
                  options: activeGoalOptions,
                  allowCustom: true,
                  customPlaceholder: "Write your own goal…",
                },
              ]}
              defaultAnswers={{
                "path-goal": activeGoalOptions.some((option) => option.value === answers.goal)
                  ? { selected: [answers.goal], custom: "" }
                  : { selected: [], custom: answers.goal },
              }}
              submitLabel="Continue"
              onSubmit={(cardAnswers) => {
                const answer = cardAnswers["path-goal"];
                const goal = answer?.custom?.trim() || answer?.selected[0];
                if (goal) recordAnswer(goal, { goal }, "experience");
              }}
            />
          ) : step === "experience" ? (
            <QuestionCard
              key={`${runId}:experience:${answers.startingLevel}`}
              questions={[
                {
                  id: "starting-level",
                  title: "Choose your current level",
                  options: activeExperienceOptions.map((option) => ({ ...option })),
                },
              ]}
              defaultAnswers={{
                "starting-level": {
                  selected: answers.startingLevel ? [answers.startingLevel] : [],
                  custom: "",
                },
              }}
              submitLabel="Continue"
              onSubmit={(cardAnswers) => {
                const level = cardAnswers["starting-level"]?.selected[0] as BuilderAnswers["startingLevel"] | undefined;
                if (!level) return;
                const nextStep = quickSetup && !returnToReview ? "review" : "schedule";
                const label = activeExperienceOptions.find((option) => option.value === level)?.label ?? experienceLabel(level);
                recordAnswer(label, { startingLevel: level }, nextStep);
              }}
            />
          ) : step === "schedule" ? (
            <QuestionCard
              key={`${runId}:schedule:${answers.schedule}`}
              questions={[
                {
                  id: "path-schedule",
                  title: "Choose a schedule",
                  options: activeScheduleOptions.map((option) => ({ ...option })),
                },
              ]}
              defaultAnswers={{
                "path-schedule": {
                  selected: answers.schedule ? [answers.schedule] : [],
                  custom: "",
                },
              }}
              submitLabel="Continue"
              onSubmit={(cardAnswers) => {
                const schedule = cardAnswers["path-schedule"]?.selected[0] as BuilderAnswers["schedule"] | undefined;
                if (!schedule) return;
                const label = activeScheduleOptions.find((option) => option.value === schedule)?.label ?? scheduleLabel(schedule);
                recordAnswer(label, { schedule }, "materials");
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
                  void addAttachments(Array.from(event.currentTarget.files ?? []));
                  event.currentTarget.value = "";
                }}
              />
              {attachments.length > 0 ? (
                <ul className="mb-3 space-y-2" aria-label="Attached files">
                  {attachments.map((file) => (
                    <li key={file.id} className="flex min-h-11 items-center gap-3 rounded-xl bg-muted px-3 text-sm">
                      <Paperclip aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">Ready · {formatBytes(file.size)}</span>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => {
                          setAttachments((current) => current.filter((item) => item.id !== file.id));
                          setAttachmentError(null);
                        }}
                        className="shrink-0 text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </Button>
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
                autoFocus
                value={draft}
                onValueChange={setDraft}
                onSubmit={submitMaterials}
                canSubmitWithoutText={attachments.length > 0}
                submitAriaLabel="Continue with learning materials"
                minRows={1}
                maxRows={5}
                maxLength={10000}
                placeholder={attachments.length > 0 ? "Add context about these files (optional)…" : "Paste an outline, notes, or topics to include…"}
                aria-label="Learning material notes"
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
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setAttachments([]);
                  setAttachmentError(null);
                  submitMaterials("");
                }}
              >
                Continue without materials
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              {isCreating ? (
                <p className="py-5 text-sm text-muted-foreground" role="status">
                  Creating your learning path…
                </p>
              ) : (
                <>
                  <SlideActionButton
                    completeLabel="Creating path"
                    onComplete={createPath}
                  >
                    Slide to create learning path
                  </SlideActionButton>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Drag the arrow to create your path, or focus it and press Enter. EduSynapse will then build the topic sequence and first session.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </MessageScroller>
    </div>
  );
}
