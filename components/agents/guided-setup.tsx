"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { ReasoningText } from "@/components/agents/loading-states/reasoning-text";
import {
  MessageBubble,
  MessageBubbleContent,
} from "@/components/agents/message-bubble";
import { StreamingResponse } from "@/components/agents/streaming-response";

export function useGuidedTextStream(text: string, streamKey: string) {
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
        const complete = tokenIndex >= tokens.length;
        setStreamState({
          key: streamKey,
          visibleText: tokens.slice(0, tokenIndex).join(""),
          phase: complete ? "complete" : "streaming",
        });
        if (complete && interval) window.clearInterval(interval);
      }, 45);
    }, 380);

    return () => {
      window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
    };
  }, [reduceMotion, streamKey, text]);

  const currentState = reduceMotion
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

export function GuidedAssistantMessage({ content }: { content: string }) {
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

export function GuidedUserMessage({ content }: { content: string }) {
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

export function GuidedStreamingMessage({
  preparing,
  streaming,
  visibleText,
}: {
  preparing: boolean;
  streaming: boolean;
  visibleText: string;
}) {
  if (preparing) {
    return <ReasoningText phrases={["Preparing the next question"]} variant="swap" />;
  }

  return (
    <MessageBubble variant="ghost" align="start" animateIn>
      <MessageBubbleContent className="max-w-2xl">
        <StreamingResponse
          status={streaming ? "streaming" : "complete"}
          announce={false}
          showActions={false}
          contentClassName="whitespace-pre-wrap text-base leading-7"
        >
          {visibleText}
          {streaming ? (
            <span
              aria-hidden="true"
              className="ms-1 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-foreground motion-reduce:animate-none"
            />
          ) : null}
        </StreamingResponse>
      </MessageBubbleContent>
    </MessageBubble>
  );
}
