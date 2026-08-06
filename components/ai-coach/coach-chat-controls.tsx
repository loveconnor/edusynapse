"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LoaderCircle,
  MessagesSquare,
  Plus,
  Trash2,
} from "love-ui/icons";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SwipeableList,
  type SwipeableListValue,
} from "@/components/ui/swipable-list";

type CoachConversationSummary = {
  id: string;
  title: string;
  updated_at: string;
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return new Intl.DateTimeFormat(undefined, {
    ...(isToday
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" }),
  }).format(date);
}

export function CoachChatControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentConversationId = searchParams.get("chat");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<
    CoachConversationSummary[] | null
  >(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [openChatActions, setOpenChatActions] =
    useState<SwipeableListValue | null>(null);
  const [chatToDelete, setChatToDelete] =
    useState<CoachConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setHistoryError(null);
    setConversations(null);

    try {
      const response = await fetch("/api/ai-coach/conversations", {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as {
        conversations?: CoachConversationSummary[];
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Your chats could not be loaded.");
      }
      setConversations(result?.conversations ?? []);
    } catch (error) {
      setConversations([]);
      setHistoryError(
        error instanceof Error ? error.message : "Your chats could not be loaded.",
      );
    }
  }, []);

  async function createChat() {
    if (creating) return;
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/ai-coach/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentConversationId }),
      });
      const result = (await response.json().catch(() => null)) as {
        conversation?: { id: string };
        error?: string;
      } | null;

      if (!response.ok || !result?.conversation?.id) {
        throw new Error(result?.error ?? "A new chat could not be created.");
      }

      if (result.conversation.id === currentConversationId) {
        window.dispatchEvent(new Event("ai-coach:new-chat"));
        router.refresh();
      } else {
        router.push(`/ai-coach?chat=${result.conversation.id}`);
      }
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "A new chat could not be created.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function deleteChat() {
    if (!chatToDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/ai-coach/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: chatToDelete.id }),
      });
      const result = (await response.json().catch(() => null)) as {
        deletedConversationId?: string;
        error?: string;
      } | null;

      if (!response.ok || result?.deletedConversationId !== chatToDelete.id) {
        throw new Error(result?.error ?? "The chat could not be deleted.");
      }

      const deletedCurrentChat = chatToDelete.id === currentConversationId;
      setConversations((current) =>
        current?.filter((conversation) => conversation.id !== chatToDelete.id) ??
        current,
      );
      setChatToDelete(null);
      setHistoryOpen(false);

      if (deletedCurrentChat) {
        router.push("/ai-coach");
      } else {
        router.refresh();
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "The chat could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={creating}
        aria-describedby={createError ? "new-coach-chat-error" : undefined}
        onClick={createChat}
        className={`max-sm:size-8 max-sm:p-0 ${createError ? "text-destructive" : ""}`}
      >
        {creating ? (
          <LoaderCircle
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <Plus aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {createError ? "Try new chat again" : "New chat"}
        </span>
        <span className="sr-only sm:hidden">
          {createError ? "Try new chat again" : "New chat"}
        </span>
      </Button>

      {createError ? (
        <span id="new-coach-chat-error" role="alert" className="sr-only">
          {createError}
        </span>
      ) : null}

      <DropdownMenu
        open={historyOpen}
        onOpenChange={(open) => {
          setHistoryOpen(open);
          if (open) void loadConversations();
          else setOpenChatActions(null);
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-sm:size-8 max-sm:p-0"
            >
              <MessagesSquare aria-hidden="true" />
              <span className="hidden sm:inline">Chats</span>
              <span className="sr-only sm:hidden">Open chats</span>
            </Button>
          }
        />
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="w-80 max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5">
              Chats
            </DropdownMenuLabel>

            {conversations === null ? (
              <DropdownMenuItem
                disabled
                className="min-h-20 justify-center gap-2 text-muted-foreground"
              >
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
                Loading chats…
              </DropdownMenuItem>
            ) : historyError ? (
              <>
                <DropdownMenuItem
                  disabled
                  className="min-h-12 px-2 py-2 text-sm leading-5 text-destructive"
                >
                  <span role="alert">{historyError}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  nativeButton
                  className="min-h-10 cursor-pointer px-2"
                  render={<button type="button" />}
                  onClick={() => void loadConversations()}
                >
                  Try again
                </DropdownMenuItem>
              </>
            ) : conversations.length === 0 ? (
              <DropdownMenuItem
                disabled
                className="min-h-16 px-2 text-sm text-muted-foreground"
              >
                Your conversations will appear here.
              </DropdownMenuItem>
            ) : (
              <SwipeableList
                value={openChatActions}
                onValueChange={setOpenChatActions}
                actionWidth={52}
                revealThreshold={28}
                classNames={{
                  root: "gap-1",
                  item: "rounded-lg bg-destructive/10",
                  rail: "rounded-lg",
                  surface:
                    "min-h-12 rounded-lg border-0 bg-popover p-0 shadow-none",
                }}
                items={conversations.map((conversation) => {
                  const isCurrent =
                    conversation.id === currentConversationId;

                  return {
                    id: conversation.id,
                    rightActions: [
                      {
                        id: "delete",
                        label: `Delete ${conversation.title}`,
                        icon: <Trash2 aria-hidden="true" />,
                        tone: "danger" as const,
                        onClick: () => {
                          setDeleteError(null);
                          setOpenChatActions(null);
                          setHistoryOpen(false);
                          setChatToDelete(conversation);
                        },
                      },
                    ],
                    content: (
                      <Link
                        href={`/ai-coach?chat=${conversation.id}`}
                        draggable={false}
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={() => setHistoryOpen(false)}
                        className="flex min-h-12 min-w-0 items-center rounded-lg px-2 py-2 outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate ${isCurrent ? "font-medium" : ""}`}
                          >
                            {conversation.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {formatUpdatedAt(conversation.updated_at)}
                            {isCurrent ? " · Current" : ""}
                            <span className="sr-only">
                              . Swipe left or press the Left Arrow key to show
                              chat actions.
                            </span>
                          </span>
                        </span>
                      </Link>
                    ),
                  };
                })}
              />
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={chatToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setChatToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="max-w-md" showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              Delete “{chatToDelete?.title}” and all of its messages? This can’t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 px-6 py-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setChatToDelete(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void deleteChat()}
            >
              {deleting ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {deleting ? "Deleting…" : "Delete chat"}
            </Button>
          </div>
          {deleteError ? (
            <p className="px-6 pb-5 text-sm text-destructive" role="alert">
              {deleteError} Try again.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
