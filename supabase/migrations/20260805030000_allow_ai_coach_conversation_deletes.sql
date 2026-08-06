grant delete on table public.ai_coach_conversations to authenticated;

create policy "Users can delete their own AI Coach conversations"
on public.ai_coach_conversations
for delete
to authenticated
using ((select auth.uid()) = user_id);
