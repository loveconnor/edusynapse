create table public.ai_coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) between 1 and 20000),
  created_at timestamptz not null default timezone('utc', now())
);

create index ai_coach_messages_user_created_idx
on public.ai_coach_messages (user_id, created_at desc);

alter table public.ai_coach_messages enable row level security;

grant select, insert, delete on table public.ai_coach_messages to authenticated;

create policy "Users can read their own AI Coach messages"
on public.ai_coach_messages
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can save their own AI Coach messages"
on public.ai_coach_messages
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own AI Coach messages"
on public.ai_coach_messages
for delete
to authenticated
using ((select auth.uid()) = user_id);
