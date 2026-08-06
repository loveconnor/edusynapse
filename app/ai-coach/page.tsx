import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AiCoachChat } from "@/components/ai-coach/ai-coach-chat";
import {
  COACH_HISTORY_LIMIT,
  DEFAULT_COACH_CONVERSATION_TITLE,
  getFirstName,
  isValidCoachConversationId,
} from "@/lib/ai-coach";
import { isQuietQuizSubmission } from "@/lib/ai-coach-quiz";
import { getAppPageContext } from "@/lib/app-page-context";

export const metadata: Metadata = {
  title: "AI Coach | EduSynapse",
  description: "Personalized study guidance grounded in your learning progress.",
};

type SavedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default async function AiCoachPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string | string[]; path?: string | string[] }>;
}) {
  const query = await searchParams;
  const { supabase, user, shellProps } = await getAppPageContext();
  const requestedConversationId =
    typeof query.chat === "string" && isValidCoachConversationId(query.chat)
      ? query.chat
      : null;
  const requestedPathId =
    typeof query.path === "string" && isValidCoachConversationId(query.path)
      ? query.path
      : null;

  const [
    profileResult,
    latestConversationResult,
    requestedConversationResult,
    requestedPathResult,
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("ai_coach_conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      requestedConversationId
        ? supabase
            .from("ai_coach_conversations")
            .select("id")
            .eq("id", requestedConversationId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      requestedPathId
        ? supabase
            .from("learning_items")
            .select("id, title")
            .eq("id", requestedPathId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (
    profileResult.error ||
    latestConversationResult.error ||
    requestedConversationResult.error ||
    requestedPathResult.error
  ) {
    throw new Error("Unable to load AI Coach");
  }

  let conversationId =
    requestedConversationResult.data?.id ?? latestConversationResult.data?.id;

  if (!conversationId) {
    const conversationResult = await supabase
      .from("ai_coach_conversations")
      .insert({
        user_id: user.id,
        title: DEFAULT_COACH_CONVERSATION_TITLE,
      })
      .select("id")
      .single();

    if (conversationResult.error || !conversationResult.data) {
      throw new Error("Unable to create an AI Coach chat");
    }
    conversationId = conversationResult.data.id;
  }

  if (query.chat !== conversationId) {
    const pathQuery = requestedPathResult.data?.id
      ? `&path=${requestedPathResult.data.id}`
      : "";
    redirect(`/ai-coach?chat=${conversationId}${pathQuery}`);
  }

  const messagesResult = await supabase
    .from("ai_coach_messages")
    .select("id, role, content")
    .eq("user_id", user.id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(COACH_HISTORY_LIMIT);

  if (messagesResult.error) throw new Error("Unable to load AI Coach messages");

  const savedName = profileResult.data?.name?.trim() || shellProps.user.name;
  const initialMessages = ([...(messagesResult.data ?? [])] as SavedMessage[])
    .reverse()
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        Boolean(message.content.trim()) &&
        !isQuietQuizSubmission(message.content),
    );

  return (
    <AiCoachChat
      key={conversationId}
      conversationId={conversationId}
      firstName={getFirstName(savedName)}
      initialMessages={initialMessages}
      learningPathId={requestedPathResult.data?.id}
      pathTitle={requestedPathResult.data?.title}
    />
  );
}
