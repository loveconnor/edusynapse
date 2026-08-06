alter table public.learning_items
  add column description text check (
    description is null or char_length(description) <= 1000
  ),
  add column goal text check (
    goal is null or char_length(goal) between 1 and 1000
  ),
  add column source_type text not null default 'manual' check (
    source_type in ('upload', 'manual', 'mixed')
  ),
  add column status text not null default 'ready' check (
    status in (
      'generating',
      'ready',
      'in_progress',
      'paused',
      'needs_attention',
      'completed',
      'archived'
    )
  ),
  add column starting_level text not null default 'beginner' check (
    starting_level in ('beginner', 'intermediate', 'advanced')
  ),
  add column target_outcome text check (
    target_outcome is null or char_length(target_outcome) <= 1000
  ),
  add column estimated_minutes integer not null default 0 check (
    estimated_minutes between 0 and 100000
  ),
  add column target_date date,
  add column mastery_score smallint not null default 0 check (
    mastery_score between 0 and 100
  ),
  add column mastery_label text not null default 'not_started' check (
    mastery_label in (
      'not_started',
      'introduced',
      'developing',
      'proficient',
      'mastered',
      'needs_review'
    )
  ),
  add column recommendation_title text check (
    recommendation_title is null or char_length(recommendation_title) <= 300
  ),
  add column recommendation_reason text check (
    recommendation_reason is null or char_length(recommendation_reason) <= 1000
  ),
  add column recommendation_action text check (
    recommendation_action is null or recommendation_action in (
      'learn', 'practice', 'review', 'assess'
    )
  ),
  add column recommendation_minutes smallint check (
    recommendation_minutes is null or recommendation_minutes between 1 and 1440
  ),
  add column generation_error text check (
    generation_error is null or char_length(generation_error) <= 1000
  );

update public.learning_items
set goal = coalesce(nullif(btrim(notes), ''), title),
    target_outcome = coalesce(nullif(btrim(notes), ''), 'Build a working understanding of ' || title),
    status = case
      when progress >= 100 then 'completed'
      when progress > 0 then 'in_progress'
      else 'ready'
    end,
    source_type = case
      when exists (
        select 1
        from public.learning_materials
        where learning_materials.learning_item_id = learning_items.id
      ) then 'mixed'
      else 'manual'
    end;

alter table public.learning_items
  alter column goal set not null,
  alter column target_outcome set not null;

create table public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  learning_item_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 1000),
  objective text not null check (char_length(btrim(objective)) between 1 and 1000),
  position smallint not null check (position between 1 and 500),
  estimated_minutes integer not null check (estimated_minutes between 1 and 100000),
  prerequisite_module_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  unique (id, learning_item_id, user_id),
  unique (learning_item_id, position),
  foreign key (learning_item_id, user_id)
    references public.learning_items (id, user_id)
    on delete cascade
);

create index learning_modules_item_position_idx
on public.learning_modules (learning_item_id, position);

alter table public.learning_modules enable row level security;
grant select, insert, update, delete on table public.learning_modules to authenticated;

create policy "Users can read their own learning modules"
on public.learning_modules for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own learning modules"
on public.learning_modules for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own learning modules"
on public.learning_modules for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own learning modules"
on public.learning_modules for delete to authenticated
using ((select auth.uid()) = user_id);

create table public.learning_topics (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null,
  learning_item_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  objective text not null check (char_length(btrim(objective)) between 1 and 1000),
  learning_question text not null check (
    char_length(btrim(learning_question)) between 1 and 500
  ),
  position smallint not null check (position between 1 and 500),
  difficulty text not null check (
    difficulty in ('beginner', 'intermediate', 'advanced')
  ),
  estimated_minutes smallint not null check (estimated_minutes between 1 and 1440),
  prerequisite_topic_ids uuid[] not null default '{}',
  key_concepts text[] not null default '{}',
  status text not null default 'locked' check (
    status in ('locked', 'available', 'in_progress', 'completed', 'needs_review')
  ),
  mastery_score smallint not null default 0 check (mastery_score between 0 and 100),
  mastery_label text not null default 'not_started' check (
    mastery_label in (
      'not_started',
      'introduced',
      'developing',
      'proficient',
      'mastered',
      'needs_review'
    )
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, module_id, learning_item_id, user_id),
  unique (module_id, position),
  foreign key (module_id, learning_item_id, user_id)
    references public.learning_modules (id, learning_item_id, user_id)
    on delete cascade
);

create index learning_topics_path_position_idx
on public.learning_topics (learning_item_id, module_id, position);

alter table public.learning_topics enable row level security;
grant select, insert, update, delete on table public.learning_topics to authenticated;

create policy "Users can read their own learning topics"
on public.learning_topics for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own learning topics"
on public.learning_topics for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own learning topics"
on public.learning_topics for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own learning topics"
on public.learning_topics for delete to authenticated
using ((select auth.uid()) = user_id);

create table public.learning_activities (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null,
  module_id uuid not null,
  learning_item_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in (
      'explanation',
      'example',
      'guided_practice',
      'independent_practice',
      'knowledge_check',
      'reflection',
      'review',
      'applied_task'
    )
  ),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  instructions text not null check (char_length(instructions) <= 4000),
  content jsonb not null default '{}'::jsonb check (
    jsonb_typeof(content) = 'object'
  ),
  source_references jsonb not null default '[]'::jsonb check (
    jsonb_typeof(source_references) = 'array'
  ),
  position smallint not null check (position between 1 and 100),
  estimated_minutes smallint not null check (estimated_minutes between 1 and 1440),
  required boolean not null default true,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, topic_id, module_id, learning_item_id, user_id),
  unique (topic_id, position),
  foreign key (topic_id, module_id, learning_item_id, user_id)
    references public.learning_topics (id, module_id, learning_item_id, user_id)
    on delete cascade
);

create index learning_activities_topic_position_idx
on public.learning_activities (topic_id, position);

alter table public.learning_activities enable row level security;
grant select, insert, update, delete on table public.learning_activities to authenticated;

create policy "Users can read their own learning activities"
on public.learning_activities for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own learning activities"
on public.learning_activities for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own learning activities"
on public.learning_activities for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own learning activities"
on public.learning_activities for delete to authenticated
using ((select auth.uid()) = user_id);
