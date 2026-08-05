create table public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text check (notes is null or char_length(notes) <= 10000),
  origin text not null default 'manual' check (
    origin in ('manual', 'onboarding', 'canvas')
  ),
  origin_key text,
  progress smallint not null default 0 check (progress between 0 and 100),
  current_lesson text check (
    current_lesson is null or char_length(current_lesson) between 1 and 200
  ),
  last_studied_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  unique (user_id, origin_key)
);

create index learning_items_user_activity_idx
on public.learning_items (user_id, last_studied_at desc nulls last, updated_at desc);

alter table public.learning_items enable row level security;

grant select, insert, update, delete on table public.learning_items to authenticated;

create policy "Users can read their own learning items"
on public.learning_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own learning items"
on public.learning_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own learning items"
on public.learning_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own learning items"
on public.learning_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

create function public.set_learning_item_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_learning_item_updated_at() from public;

create trigger set_learning_item_updated_at
before update on public.learning_items
for each row execute function public.set_learning_item_updated_at();

create table public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  learning_item_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique check (char_length(storage_path) between 1 and 1024),
  file_size bigint not null check (file_size between 1 and 52428800),
  mime_type text not null default 'application/octet-stream' check (
    char_length(mime_type) between 1 and 255
  ),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (learning_item_id, user_id)
    references public.learning_items (id, user_id)
    on delete cascade
);

create index learning_materials_item_idx
on public.learning_materials (learning_item_id, created_at);

alter table public.learning_materials enable row level security;

grant select, insert, delete on table public.learning_materials to authenticated;

create policy "Users can read their own learning materials"
on public.learning_materials
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can attach their own learning materials"
on public.learning_materials
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can remove their own learning materials"
on public.learning_materials
for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into public.learning_items (
  user_id,
  title,
  notes,
  origin,
  origin_key
)
select
  id,
  btrim(learning_focus),
  material_notes,
  'onboarding',
  'profile'
from public.profiles
where learning_focus is not null
  and char_length(btrim(learning_focus)) between 1 and 200
on conflict (user_id, origin_key) do update
set title = excluded.title,
    notes = excluded.notes;

insert into public.learning_materials (
  learning_item_id,
  user_id,
  file_name,
  storage_path,
  file_size,
  mime_type
)
select
  learning_item.id,
  profile.id,
  left(material.value ->> 'name', 255),
  left(material.value ->> 'path', 1024),
  least(greatest((material.value ->> 'size')::bigint, 1), 52428800),
  left(
    coalesce(nullif(material.value ->> 'type', ''), 'application/octet-stream'),
    255
  )
from public.profiles as profile
join public.learning_items as learning_item
  on learning_item.user_id = profile.id
 and learning_item.origin_key = 'profile'
cross join lateral jsonb_array_elements(profile.materials) as material(value)
where jsonb_typeof(material.value) = 'object'
  and nullif(material.value ->> 'name', '') is not null
  and nullif(material.value ->> 'path', '') is not null
  and (material.value ->> 'size') ~ '^[0-9]+$'
on conflict (storage_path) do nothing;
