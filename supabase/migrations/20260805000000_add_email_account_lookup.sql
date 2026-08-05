create or replace function public.email_account_exists(candidate_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate_email is not null
    and char_length(trim(candidate_email)) <= 254
    and exists (
      select 1
      from auth.users
      where lower(email) = lower(trim(candidate_email))
        and deleted_at is null
    );
$$;

revoke all on function public.email_account_exists(text) from public;
grant execute on function public.email_account_exists(text) to anon, authenticated;

comment on function public.email_account_exists(text) is
  'Intentionally exposes account existence for the login-screen greeting.';
