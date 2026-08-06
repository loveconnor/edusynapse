"use client";

import { useMemo, useState } from "react";
import {
  QuestionCard,
  type QuestionCardAnswers,
  type QuestionCardQuestion,
  type QuestionCardStatus,
} from "@/components/agents/question-card";
import {
  formatMultipleChoiceQuizAnswers,
  type MultipleChoiceQuiz,
} from "@/lib/ai-coach-quiz";

export function MultipleChoiceQuizCard({
  quiz,
  onSubmit,
}: {
  quiz: MultipleChoiceQuiz;
  onSubmit: (message: string) => Promise<boolean>;
}) {
  const [status, setStatus] = useState<QuestionCardStatus>("pending");
  const questions = useMemo<QuestionCardQuestion[]>(
    () =>
      quiz.questions.map((question) => ({
        ...question,
        autoAdvance: true,
      })),
    [quiz.questions],
  );

  const submitAnswers = async (answers: QuestionCardAnswers) => {
    setStatus("submitting");
    const submitted = await onSubmit(
      formatMultipleChoiceQuizAnswers(quiz, answers),
    );
    setStatus(submitted ? "answered" : "pending");
  };

  return (
    <QuestionCard
      title={quiz.title}
      description={quiz.description}
      questions={questions}
      status={status}
      onSubmit={submitAnswers}
      autoSubmit
      submitLabel="Submit answers"
      result="Answers sent to AI Coach."
      className="not-prose my-4"
    />
  );
}
