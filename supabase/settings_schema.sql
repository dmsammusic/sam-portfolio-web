-- Settings schema — run in the Supabase SQL Editor after profiles_schema.sql.
-- Adds display-format preferences to profiles, and a username-to-email lookup so
-- the login form can accept a username instead of requiring an email.

alter table profiles add column if not exists date_format text not null default 'us'
  check (date_format in ('us', 'intl')); -- 'us' = Month Day (e.g. "Jul 22"), 'intl' = Day Month (e.g. "22 Jul")

alter table profiles add column if not exists time_format text not null default '12h'
  check (time_format in ('12h', '24h'));

-- Called from the login form before the user is authenticated, so it has to be
-- reachable by the `anon` role — same reasoning as is_username_available in
-- profiles_schema.sql. Returns null (not an error) for an unknown username, and
-- the client shows the same generic "invalid credentials" message either way,
-- so this can't be used to enumerate which usernames have accounts.
create or replace function resolve_email_for_username(check_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from auth.users where id = (select id from profiles where username = check_username);
$$;

grant execute on function resolve_email_for_username(text) to anon, authenticated;
