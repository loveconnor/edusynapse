"use client";

import {
  BookOpen,
  BookPlus,
  BotMessageSquare,
  ChartNoAxesCombined,
  CirclePlay,
  Clock,
  FileText,
  Files,
  Plus,
  Search,
  Settings,
  Sparkles,
  Upload,
} from "love-ui/icons";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  CommandPalette,
  type CommandItem,
} from "@/components/ui/command-palette";
import {
  NewLearningDialog,
  type NewLearningDialogFocus,
} from "@/components/learning/new-learning-dialog";
import { useKeypress } from "@/hooks/use-keypress";
import {
  selectContinueItem,
  type LearningItemSummary,
} from "@/lib/learning";

export type CommandPaletteMaterial = {
  id: string;
  learning_item_id: string;
  file_name: string;
  created_at: string;
};

export type AppSearchData = {
  learningItems: LearningItemSummary[];
  materials: CommandPaletteMaterial[];
};

type NewLearningDialogState = {
  defaultTitle: string;
  initialFocus: NewLearningDialogFocus;
  open: boolean;
};

const soonBadge = (
  <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
    Soon
  </span>
);

function activityTime(item: LearningItemSummary) {
  return Date.parse(item.last_studied_at ?? item.updated_at);
}

function learningDescription(item: LearningItemSummary) {
  if (item.current_lesson) return `Continue ${item.current_lesson}`;
  if (item.progress > 0) return `${item.progress}% complete`;
  return "Not started";
}

function subjectFromQuery(query: string) {
  return query
    .replace(/^learn\s+/i, "")
    .replace(/^quiz me on\s+/i, "")
    .replace(/^explain\s+/i, "")
    .replace(/^create flashcards(?: from)?\s+/i, "")
    .replace(/^summarize(?: my)?\s+/i, "")
    .trim();
}

function aiActionLabels(query: string, subject: string) {
  const isCompleteAiRequest = [
    /^quiz me on\s+.+/i,
    /^summarize(?: my)?\s+.+/i,
    /^create flashcards(?: from)?\s+.+/i,
    /^build(?: me)? a study plan(?: for\s+.+)?/i,
    /^explain\s+.+/i,
    /^what should i study today\??$/i,
  ].some((pattern) => pattern.test(query));

  if (isCompleteAiRequest) return [query];
  if (!subject) return [];

  return [
    `Quiz me on ${subject}`,
    `Create flashcards from ${subject}`,
    `Explain ${subject}`,
  ];
}

export function AppSearch({ learningItems, materials }: AppSearchData) {
  const [open, setOpen] = useState(false);
  const [newLearningDialog, setNewLearningDialog] =
    useState<NewLearningDialogState>({
      defaultTitle: "",
      initialFocus: "title",
      open: false,
    });
  const router = useRouter();
  const continueItem = useMemo(
    () => selectContinueItem(learningItems),
    [learningItems],
  );
  const recentItems = useMemo(
    () =>
      [...learningItems]
        .sort((left, right) => activityTime(right) - activityTime(left))
        .slice(0, 3),
    [learningItems],
  );
  const itemTitlesById = useMemo(
    () => new Map(learningItems.map((item) => [item.id, item.title])),
    [learningItems],
  );

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
  );

  const openNewLearningDialog = useCallback(
    ({
      defaultTitle = "",
      initialFocus = "title",
    }: {
      defaultTitle?: string;
      initialFocus?: NewLearningDialogFocus;
    } = {}) => {
      setOpen(false);
      setNewLearningDialog({ defaultTitle, initialFocus, open: true });
    },
    [],
  );

  const openAiCoach = useCallback(
    (draft?: string) => {
      if (draft) sessionStorage.setItem("ai-coach-draft", draft);
      navigate("/ai-coach");
    },
    [navigate],
  );

  useKeypress({
    combo: ["meta+n", "ctrl+n"],
    callback: () => openNewLearningDialog(),
  });
  useKeypress({
    combo: ["meta+/", "ctrl+/"],
    callback: () => openAiCoach(),
  });
  useKeypress({
    combo: ["meta+u", "ctrl+u"],
    callback: () => openNewLearningDialog({ initialFocus: "files" }),
  });
  useKeypress({
    combo: ["meta+l", "ctrl+l"],
    callback: () => {
      if (continueItem) navigate(`/learning/${continueItem.id}`);
    },
  });

  const getItems = useCallback(
    (query: string): CommandItem[] => {
      const normalizedQuery = query.trim();
      const learnMatch = normalizedQuery.match(/^learn\s+(.+)$/i);
      const newTopic = learnMatch?.[1]?.trim();
      const subject = subjectFromQuery(normalizedQuery);
      const matchingLearningItem = learningItems.find((item) =>
        item.title.toLowerCase().includes(subject.toLowerCase()),
      );
      const aiSubject = matchingLearningItem?.title ?? subject;

      const commands: CommandItem[] = [
        {
          id: "add-learning",
          label: "Build Learning Path",
          description: "Create a path from a goal or source materials",
          group: "Quick Actions",
          hint: "⌘N",
          keywords: ["new", "create", "course", "topic", "learn"],
          icon: Plus,
          onSelect: () => openNewLearningDialog(),
        },
        {
          id: "continue-learning",
          label: "Continue Learning",
          description: continueItem
            ? `${continueItem.title} · ${learningDescription(continueItem)}`
            : "No unfinished learning yet",
          group: "Quick Actions",
          hint: "⌘L",
          keywords: ["resume", "lesson", continueItem?.title ?? ""],
          icon: CirclePlay,
          disabled: !continueItem,
          onSelect: continueItem
            ? () => navigate(`/learning/${continueItem.id}`)
            : undefined,
        },
        {
          id: "start-study-session",
          label: "Start Study Session",
          description: "Focused study sessions are not available yet",
          group: "Quick Actions",
          keywords: ["study", "focus", "session"],
          icon: Clock,
          badge: soonBadge,
          disabled: true,
        },
        {
          id: "chat-ai-coach",
          label: "Chat with AI Coach",
          description: "Get a personalized recommendation or ask a question",
          group: "Quick Actions",
          hint: "⌘/",
          keywords: ["ai", "chat", "ask", "coach"],
          icon: BotMessageSquare,
          onSelect: () => openAiCoach(),
        },
        {
          id: "upload-material",
          label: "Upload Material",
          description: "Build a learning path from source PDFs",
          group: "Quick Actions",
          hint: "⌘U",
          keywords: ["pdf", "notes", "file", "document", "material"],
          icon: Upload,
          onSelect: () => openNewLearningDialog({ initialFocus: "files" }),
        },
        {
          id: "create-learning-path",
          label: "Create Learning Path",
          description: "Start from a goal, context, or PDFs",
          group: "Quick Actions",
          keywords: ["new", "add", "learn", "course", "subject"],
          icon: BookPlus,
          onSelect: () => openNewLearningDialog(),
        },
        {
          id: "my-learning",
          label: "My Learning",
          group: "Navigation",
          keywords: ["dashboard", "home", "courses", "topics"],
          icon: BookOpen,
          onSelect: () => navigate("/dashboard"),
        },
        {
          id: "ai-coach",
          label: "AI Coach",
          group: "Navigation",
          icon: BotMessageSquare,
          onSelect: () => openAiCoach(),
        },
        {
          id: "insights",
          label: "Insights",
          group: "Navigation",
          keywords: ["progress", "analytics", "strengths", "weaknesses"],
          icon: ChartNoAxesCombined,
          badge: soonBadge,
          disabled: true,
        },
        {
          id: "learning-materials",
          label: "Learning Materials",
          group: "Navigation",
          keywords: ["library", "pdf", "notes", "slides", "files"],
          icon: Files,
          badge: soonBadge,
          disabled: true,
        },
        {
          id: "settings",
          label: "Settings",
          group: "Navigation",
          icon: Settings,
          badge: soonBadge,
          disabled: true,
        },
      ];

      if (!normalizedQuery) {
        commands.push(
          ...recentItems.map((item) => ({
            id: `recent-${item.id}`,
            label: item.title,
            description: learningDescription(item),
            group: "Recent",
            icon: Clock,
            onSelect: () => navigate(`/learning/${item.id}`),
          })),
        );
        return commands;
      }

      commands.push(
        ...learningItems.map((item) => ({
          id: `learning-${item.id}`,
          label: item.title,
          description: learningDescription(item),
          group: "Learning",
          keywords: [item.current_lesson ?? "", `${item.progress}%`],
          icon: BookOpen,
          onSelect: () => navigate(`/learning/${item.id}`),
        })),
        ...materials.map((material) => ({
          id: `material-${material.id}`,
          label: material.file_name,
          description:
            itemTitlesById.get(material.learning_item_id) ?? "Learning material",
          group: "Materials",
          keywords: ["pdf", "document", "notes", "file"],
          icon: FileText,
          onSelect: () => navigate(`/learning/${material.learning_item_id}`),
        })),
      );

      if (newTopic) {
        const alreadyExists = learningItems.some(
          (item) => item.title.toLowerCase() === newTopic.toLowerCase(),
        );

        if (!alreadyExists) {
          commands.push({
            id: "create-from-query",
            label: `Create a learning experience for “${newTopic}”`,
            description: "Open a new learning item with this title filled in",
            group: "Quick Actions",
            icon: BookPlus,
            onSelect: () => openNewLearningDialog({ defaultTitle: newTopic }),
          });
        }
      }

      const aiActions = aiActionLabels(normalizedQuery, aiSubject);
      if (aiActions.length > 0) {
        commands.push(
          ...aiActions.map((label, index) => ({
            id: `ai-query-${index}`,
            label,
            description: "Open AI Coach with this prompt ready to send",
            group: "AI Actions",
            icon: Sparkles,
            onSelect: () => openAiCoach(label),
          })),
        );
      }

      return commands;
    },
    [
      continueItem,
      itemTitlesById,
      learningItems,
      materials,
      navigate,
      openAiCoach,
      openNewLearningDialog,
      recentItems,
    ],
  );

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
        className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-sm text-muted-foreground shadow-xs outline-none transition-shadow hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24"
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Search…</span>
        <span aria-hidden="true" className="ml-auto flex items-center gap-0.5">
          <kbd className="flex h-5 min-w-5 items-center justify-center rounded border bg-muted/60 px-1 font-sans text-[10px] leading-none font-medium text-muted-foreground shadow-xs">
            ⌘
          </kbd>
          <kbd className="flex h-5 min-w-5 items-center justify-center rounded border bg-muted/60 px-1 font-sans text-[10px] leading-none font-medium text-muted-foreground shadow-xs">
            K
          </kbd>
        </span>
      </button>

      <CommandPalette
        items={getItems}
        open={open}
        onOpenChange={setOpen}
        placeholder="What would you like to do?"
        emptyMessage="No learning, materials, or commands match your search."
      />

      <NewLearningDialog
        defaultTitle={newLearningDialog.defaultTitle}
        initialFocus={newLearningDialog.initialFocus}
        open={newLearningDialog.open}
        onOpenChange={(nextOpen) =>
          setNewLearningDialog((current) => ({
            ...current,
            open: nextOpen,
          }))
        }
      />
    </>
  );
}
