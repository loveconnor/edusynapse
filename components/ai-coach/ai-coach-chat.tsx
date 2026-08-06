"use client";

import { Paperclip, X } from "love-ui/icons";
import { useEffect, useRef, useState } from "react";
import {
  MessageBubble,
  MessageBubbleContent,
} from "@/components/agents/message-bubble";
import { Markdown } from "@/components/agents/markdown";
import { MessageScroller } from "@/components/agents/message-scroller";
import { PromptInput } from "@/components/agents/prompt-input";
import { StreamingResponse } from "@/components/agents/streaming-response";
import { ReasoningText } from "@/components/agents/loading-states/reasoning-text";
import {
  MAX_COACH_ATTACHMENTS,
  MAX_COACH_ATTACHMENT_SIZE,
  MAX_COACH_MESSAGE_LENGTH,
} from "@/lib/ai-coach";
import {
  formatQuietQuizSubmission,
  hasMultipleChoiceQuiz,
  isQuietQuizSubmission,
} from "@/lib/ai-coach-quiz";

type CoachAttachment = {
  id: string;
  file: File;
};

type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming";
  attachments?: string[];
};

type InitialCoachMessage = Omit<CoachMessage, "status">;

const SUGGESTED_PROMPTS = [
  "What should I study today?",
  "Quiz me on what I’m learning",
  "Explain my current lesson",
  "Build a study plan",
];

function makeMessageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SuggestedPrompts({
  onSelect,
  disabled,
}: {
  onSelect: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div aria-labelledby="suggested-prompts-title" className="w-full">
      <h3 id="suggested-prompts-title" className="sr-only">
        Suggested prompts
      </h3>
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(prompt)}
              className="min-h-10 shrink-0 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AiCoachChat({
  conversationId,
  firstName,
  initialMessages,
  learningPathId,
  pathTitle,
}: {
  conversationId: string;
  firstName: string;
  initialMessages: InitialCoachMessage[];
  learningPathId?: string;
  pathTitle?: string;
}) {
  const abortRef = useRef<AbortController | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<CoachMessage[]>(() =>
    initialMessages.map((message) => ({ ...message, status: "complete" })),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<CoachAttachment[]>([]);

  useEffect(() => {
    const savedDraft = sessionStorage.getItem("ai-coach-draft");
    if (!savedDraft) return;
    sessionStorage.removeItem("ai-coach-draft");
    const timer = window.setTimeout(() => setDraft(savedDraft), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const resetChat = () => {
      abortRef.current?.abort();
      setDraft("");
      setAttachments([]);
      setError(null);
      setMessages([]);
    };
    window.addEventListener("ai-coach:new-chat", resetChat);
    return () => window.removeEventListener("ai-coach:new-chat", resetChat);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  function addAttachments(files: File[]) {
    setError(null);
    const availableSlots = MAX_COACH_ATTACHMENTS - attachments.length;
    if (files.length > availableSlots) {
      setError(`Attach no more than ${MAX_COACH_ATTACHMENTS} PDFs at once.`);
      return;
    }
    if (files.some((file) => file.size > MAX_COACH_ATTACHMENT_SIZE)) {
      setError("Each PDF must be 10 MB or smaller.");
      return;
    }
    if (
      files.some(
        (file) =>
          file.type !== "application/pdf" &&
          !file.name.toLocaleLowerCase().endsWith(".pdf"),
      )
    ) {
      setError("Attach PDF files only.");
      return;
    }

    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({ id: makeMessageId(), file })),
    ]);
  }

  async function sendMessage(
    value: string,
    options: { quiet?: boolean } = {},
  ): Promise<boolean> {
    const prompt = value.trim();
    const submittedAttachments = attachments;
    if ((!prompt && submittedAttachments.length === 0) || isLoading) {
      return false;
    }

    const displayPrompt = prompt || "Help me study these PDFs.";
    const requestPrompt = options.quiet
      ? formatQuietQuizSubmission(displayPrompt)
      : prompt;

    const userMessage: CoachMessage = {
      id: makeMessageId(),
      role: "user",
      content: options.quiet ? requestPrompt : displayPrompt,
      status: "complete",
      attachments: submittedAttachments.map(({ file }) => file.name),
    };
    const assistantId = makeMessageId();
    const pendingAssistantMessage: CoachMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
    };
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setDraft("");
    setAttachments([]);
    setIsLoading(true);
    setMessages((current) => [
      ...current,
      userMessage,
      pendingAssistantMessage,
    ]);
    let responseStarted = false;

    try {
      const formData = new FormData();
      formData.set("message", requestPrompt);
      formData.set("conversationId", conversationId);
      if (learningPathId) formData.set("learningPathId", learningPathId);
      for (const attachment of submittedAttachments) {
        formData.append("files", attachment.file, attachment.file.name);
      }

      const response = await fetch("/api/ai-coach", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(result?.error ?? "Your coach could not respond. Try again.");
      }

      responseStarted = true;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let completeText = "";

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        completeText += decoder.decode(chunk, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: completeText }
              : message,
          ),
        );
      }

      completeText += decoder.decode();
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: completeText, status: "complete" }
            : message,
        ),
      );
      return true;
    } catch (caught) {
      if (controller.signal.aborted) {
        setError("Response stopped. The partial reply was not saved to your history.");
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "Your coach could not respond. Try again.",
        );
      }
      if (!responseStarted) {
        if (!options.quiet) {
          setDraft(prompt);
          setAttachments(submittedAttachments);
        }
        setMessages((current) =>
          current.filter(
            (message) =>
              message.id !== userMessage.id && message.id !== assistantId,
          ),
        );
      } else {
        setMessages((current) =>
          current
            .map((message) =>
              message.id === assistantId && message.content.length > 0
                ? { ...message, status: "complete" as const }
                : message,
            )
            .filter(
              (message) =>
                message.id !== assistantId || message.content.length > 0,
            ),
        );
      }
      return false;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  }

  return (
    <main
      aria-labelledby="ai-coach-title"
      className="mx-auto flex min-h-[calc(100dvh-var(--app-header-height)-2rem)] w-full max-w-6xl flex-col md:min-h-[calc(100dvh-var(--app-header-height)-3rem)]"
    >
      <section
        aria-label="AI Coach chat"
        className="flex min-h-0 flex-1 flex-col"
      >
        <header
          className={
            messages.length > 0
              ? "sr-only"
              : "flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-6 text-center"
          }
        >
          <h1
            id="ai-coach-title"
            className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
          >
            {pathTitle ? `${pathTitle} Tutor` : "AI Coach"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {pathTitle
              ? `Hi ${firstName}. Ask about this path, your current topic, or your source materials.`
              : `Hi ${firstName}. What are we working on?`}
          </p>
        </header>

        {messages.length > 0 ? (
          <MessageScroller
            scrollMode="page"
            label="AI Coach conversation"
            busy={isLoading}
            className="flex-1"
            viewportClassName="py-5"
            contentClassName="space-y-6 px-1 sm:px-2"
          >
            {messages.map((message) => {
              if (isQuietQuizSubmission(message.content)) return null;
              const containsQuiz =
                message.role === "assistant" &&
                hasMultipleChoiceQuiz(message.content);

              return (
                <div
                  key={message.id}
                  data-slot="message"
                  data-from={message.role}
                >
                  <MessageBubble
                    variant={message.role === "user" ? "soft" : "ghost"}
                    align={message.role === "user" ? "end" : "start"}
                    animateIn={message.status === "streaming"}
                  >
                    <MessageBubbleContent
                      className={
                        message.role === "assistant"
                          ? "max-w-5xl"
                          : "whitespace-pre-wrap"
                      }
                    >
                      {message.role === "assistant" ? (
                        message.content ? (
                          <StreamingResponse
                            status={message.status}
                            copyText={message.content}
                            showActions={!containsQuiz}
                            contentClassName="text-[15px] leading-7"
                          >
                            <Markdown
                              className="text-[15px] leading-7"
                              streaming={message.status === "streaming"}
                              onQuizSubmit={(answer) =>
                                sendMessage(answer, { quiet: true })
                              }
                            >
                              {message.content}
                            </Markdown>
                            {message.status === "streaming" ? (
                              <span
                                aria-hidden="true"
                                className="ms-1 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-foreground motion-reduce:animate-none"
                              />
                            ) : null}
                          </StreamingResponse>
                        ) : (
                          <ReasoningText
                            phrases={[
                              "Reading your learning context",
                              "Planning a useful next step",
                            ]}
                            variant="swap"
                          />
                        )
                      ) : (
                        <div>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {message.attachments?.length ? (
                            <ul
                              className="mt-2 space-y-1"
                              aria-label="Attached PDFs"
                            >
                              {message.attachments.map((name) => (
                                <li
                                  key={name}
                                  className="flex items-center gap-2 text-xs text-muted-foreground"
                                >
                                  <Paperclip
                                    aria-hidden="true"
                                    className="size-3.5"
                                  />
                                  <span className="max-w-64 truncate">
                                    {name}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      )}
                    </MessageBubbleContent>
                  </MessageBubble>
                </div>
              );
            })}
          </MessageScroller>
        ) : null}

        <div className="sticky bottom-0 z-10 shrink-0 bg-muted pb-2 pt-3 dark:bg-background">
          <SuggestedPrompts
            onSelect={(prompt) => {
              void sendMessage(prompt);
            }}
            disabled={isLoading}
          />

          <input
            ref={attachmentInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            tabIndex={-1}
            className="sr-only"
            aria-label="Attach PDFs to this message"
            onChange={(event) => {
              addAttachments(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />

          {attachments.length > 0 ? (
            <ul
              className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="PDFs ready to send"
            >
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex min-h-10 max-w-64 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <Paperclip
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 truncate font-medium">
                    {attachment.file.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(attachment.file.size)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.file.name}`}
                    onClick={() => {
                      setAttachments((current) =>
                        current.filter((item) => item.id !== attachment.id),
                      );
                      setError(null);
                    }}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <PromptInput
            className="mt-3"
            value={draft}
            onValueChange={setDraft}
            onSubmit={async (value) => {
              await sendMessage(value);
            }}
            loading={isLoading}
            onStop={() => abortRef.current?.abort()}
            canSubmitWithoutText={attachments.length > 0}
            actions={[
              {
                value: "attach-pdfs",
                label: "Attach PDFs",
                description: "Up to 3 PDFs, 10 MB each",
                icon: <Paperclip />,
                disabled: attachments.length >= MAX_COACH_ATTACHMENTS,
              },
            ]}
            onAction={(action) => {
              if (action === "attach-pdfs") attachmentInputRef.current?.click();
            }}
            minRows={2}
            maxRows={7}
            maxLength={MAX_COACH_MESSAGE_LENGTH}
            placeholder={
              attachments.length > 0
                ? "Ask about these PDFs (optional)…"
                : "Message AI Coach…"
            }
            aria-label="Message AI Coach"
            aria-describedby="ai-coach-attachment-note"
            submitAriaLabel="Send message to AI Coach"
          />

          {error ? (
            <p className="mt-3 text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <p
            id="ai-coach-attachment-note"
            className="mt-2 text-center text-xs text-muted-foreground"
          >
            Attached PDFs are used for this message, not added to Learning
            Materials. AI responses can be incorrect.
          </p>
        </div>
      </section>
    </main>
  );
}
