alter table public.learning_items
  drop constraint if exists learning_items_starting_level_check;

alter table public.learning_items
  add constraint learning_items_starting_level_check check (
    starting_level in ('beginner', 'intermediate', 'advanced', 'unsure')
  );
