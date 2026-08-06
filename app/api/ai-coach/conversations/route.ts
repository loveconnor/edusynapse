import { NextResponse } from "next/server";
import {
  DEFAULT_COACH_CONVERSATION_TITLE,
  isValidCoachConversationId,
} from "@/lib/ai-coach";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getAuthenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) return errorResponse("Sign in to view your chats.", 401);

  const { data, error } = await supabase
    .from("ai_coach_conversations")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return errorResponse("Your chats could not be loaded.", 500);
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) return errorResponse("Sign in to create a chat.", 401);

  let currentConversationId: string | null = null;
  try {
    const body = (await request.json()) as { currentConversationId?: unknown };
    if (typeof body.currentConversationId === "string") {
      currentConversationId = body.currentConversationId;
    }
  } catch {
    return errorResponse("Send a valid new-chat request.", 400);
  }

  if (
    currentConversationId &&
    !isValidCoachConversationId(currentConversationId)
  ) {
    return errorResponse("The current chat identifier is invalid.", 400);
  }

  if (currentConversationId) {
    const [conversationResult, messagesResult] = await Promise.all([
      supabase
        .from("ai_coach_conversations")
        .select("id")
        .eq("id", currentConversationId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("ai_coach_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", currentConversationId)
        .eq("user_id", user.id),
    ]);

    if (conversationResult.error || messagesResult.error) {
      return errorResponse("A new chat could not be created.", 500);
    }
    if (!conversationResult.data) {
      return errorResponse("The current chat could not be found.", 404);
    }
    if (messagesResult.count === 0) {
      return NextResponse.json({ conversation: conversationResult.data });
    }
  }

  const { data, error } = await supabase
    .from("ai_coach_conversations")
    .insert({
      user_id: user.id,
      title: DEFAULT_COACH_CONVERSATION_TITLE,
    })
    .select("id")
    .single();

  if (error || !data) {
    return errorResponse("A new chat could not be created. Try again.", 500);
  }

  return NextResponse.json({ conversation: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) return errorResponse("Sign in to delete a chat.", 401);

  let conversationId: string | null = null;
  try {
    const body = (await request.json()) as { conversationId?: unknown };
    if (typeof body.conversationId === "string") {
      conversationId = body.conversationId;
    }
  } catch {
    return errorResponse("Send a valid delete-chat request.", 400);
  }

  if (!conversationId || !isValidCoachConversationId(conversationId)) {
    return errorResponse("The chat identifier is invalid.", 400);
  }

  const { data: deletedConversation, error: deleteError } = await supabase
    .from("ai_coach_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (deleteError) return errorResponse("The chat could not be deleted.", 500);
  if (!deletedConversation) return errorResponse("The chat was not found.", 404);

  return NextResponse.json({ deletedConversationId: conversationId });
}
