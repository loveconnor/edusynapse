create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text check (name is null or char_length(name) between 1 and 100),
  learning_focus text check (
    learning_focus is null or char_length(learning_focus) between 1 and 200
  ),
  learning_context text check (
    learning_context is null or learning_context in (
      'Through school',
      'For work',
      'Personal learning',
      'Preparing for a certification'
    )
  ),
  material_notes text check (
    material_notes is null or char_length(material_notes) <= 10000
  ),
  materials jsonb not null default '[]'::jsonb check (
    jsonb_typeof(materials) = 'array' and jsonb_array_length(materials) <= 12
  ),
  goals text[] not null default '{}'::text[] check (cardinality(goals) <= 5),
  daily_study_time text check (
    daily_study_time is null or daily_study_time in (
      '15 min',
      '30 min',
      '45 min',
      '1 hour',
      '2+ hours'
    )
  ),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

grant select, insert, update on table public.profiles to authenticated;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_profile_updated_at() from public;

create trigger set_profile_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values ('learning-materials', 'learning-materials', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create policy "Users can upload their own learning materials"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'learning-materials'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can read their own learning materials"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'learning-materials'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own learning materials"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'learning-materials'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
