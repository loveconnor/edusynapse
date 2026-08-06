create table public.ai_coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat'
    check (char_length(btrim(title)) between 1 and 80),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index ai_coach_conversations_user_updated_idx
on public.ai_coach_conversations (user_id, updated_at desc);

alter table public.ai_coach_messages
add column conversation_id uuid;

insert into public.ai_coach_conversations (
  user_id,
  title,
  created_at,
  updated_at
)
select
  messages.user_id,
  coalesce(
    (
      select left(regexp_replace(first_message.content, '[[:space:]]+', ' ', 'g'), 80)
      from public.ai_coach_messages as first_message
      where first_message.user_id = messages.user_id
        and first_message.role = 'user'
      order by first_message.created_at asc
      limit 1
    ),
    'Previous chat'
  ),
  min(messages.created_at),
  max(messages.created_at)
from public.ai_coach_messages as messages
group by messages.user_id;

update public.ai_coach_messages as messages
set conversation_id = conversations.id
from public.ai_coach_conversations as conversations
where conversations.user_id = messages.user_id;

alter table public.ai_coach_messages
alter column conversation_id set not null;

alter table public.ai_coach_messages
add constraint ai_coach_messages_conversation_id_fkey
foreign key (conversation_id)
references public.ai_coach_conversations (id)
on delete cascade;

create index ai_coach_messages_user_conversation_created_idx
on public.ai_coach_messages (user_id, conversation_id, created_at desc);

alter table public.ai_coach_conversations enable row level security;

grant select, insert, update on table public.ai_coach_conversations to authenticated;

create policy "Users can read their own AI Coach conversations"
on public.ai_coach_conversations
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own AI Coach conversations"
on public.ai_coach_conversations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own AI Coach conversations"
on public.ai_coach_conversations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy "Users can save their own AI Coach messages"
on public.ai_coach_messages;

create policy "Users can save messages in their own AI Coach conversations"
on public.ai_coach_messages
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.ai_coach_conversations as conversations
    where conversations.id = conversation_id
      and conversations.user_id = (select auth.uid())
  )
);
