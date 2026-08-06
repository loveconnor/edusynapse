import type { ReactNode } from "react";

export type QuestionCardStatus =
  | "pending"
  | "submitting"
  | "approved"
  | "rejected"
  | "changes-requested"
  | "answered";

export interface QuestionCardOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface QuestionCardQuestion {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  options?: QuestionCardOption[];
  multiple?: boolean;
  autoAdvance?: boolean;
  allowCustom?: boolean;
  customPlaceholder?: string;
}

export interface QuestionCardAnswer {
  selected: string[];
  custom?: string;
}

export type QuestionCardAnswers = Record<string, QuestionCardAnswer>;

export interface QuestionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  questions?: QuestionCardQuestion[];
  status?: QuestionCardStatus;
  answers?: QuestionCardAnswers;
  defaultAnswers?: QuestionCardAnswers;
  onAnswersChange?: (answers: QuestionCardAnswers) => void;
  step?: number;
  defaultStep?: number;
  onStepChange?: (step: number) => void;
  onSubmit?: (answers: QuestionCardAnswers) => void;
  autoSubmit?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onRequestChanges?: () => void;
  onDismiss?: () => void;
  approveLabel?: ReactNode;
  submitLabel?: ReactNode;
  result?: ReactNode;
  className?: string;
}
