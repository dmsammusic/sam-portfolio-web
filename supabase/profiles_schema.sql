-- Profiles schema — run in the Supabase SQL Editor after todo_schema.sql.
-- Adds a display name (username, first name, last name) shown in the navbar once logged in.
--
-- New sign-ups collect these fields on the sign-up form itself and pass them as
-- auth.signUp() metadata; a trigger on auth.users creates the profiles row automatically
-- (see handle_new_user() below) — no client-side insert needed for new accounts.
--
-- Existing accounts created before this feature has no profiles row at all. That's the
-- signal src/js/user-nav.js uses to show the "complete your profile" toast — no separate
-- "is onboarded" flag needed. Those users complete the modal form, which inserts their row
-- directly via the "insert own profile" policy below.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) > 3),
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text not null check (char_length(trim(last_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row
  execute function set_updated_at(); -- defined in todo_schema.sql; run that first

alter table profiles enable row level security;

drop policy if exists "select own profile" on profiles;
create policy "select own profile" on profiles
  for select using (auth.uid() = id);

drop policy if exists "insert own profile" on profiles;
create policy "insert own profile" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No delete policy — profiles are cleaned up via the auth.users FK cascade, not directly.

-- RLS above only filters *which rows* are visible — Postgres still requires this base
-- table-level grant before that filtering ever applies.
grant select, insert, update on profiles to authenticated;

-- Lets the sign-up form check availability before submitting, without exposing any other
-- profile data (RLS above blocks a plain SELECT of other users' rows entirely, including
-- for anonymous visitors — this function runs as SECURITY DEFINER specifically so a
-- not-yet-signed-up visitor can still check a name). Enforcement against races still
-- happens at the database level via the unique constraint above, not this check alone.
create or replace function is_username_available(check_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from profiles where username = check_username);
$$;

grant execute on function is_username_available(text) to anon, authenticated;

-- Fires the moment a new auth user is created (i.e. at signUp() time, even before email
-- confirmation) and reads the username/first_name/last_name passed as signUp() options.data.
-- Runs as SECURITY DEFINER so it can write past RLS. If the username is already taken, the
-- unique constraint violation raises here, which rolls back the whole auth.users insert too
-- — sign-up fails atomically and the client must show "username taken" and let them retry.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'username' is not null then
    insert into profiles (id, username, first_name, last_name)
    values (
      new.id,
      new.raw_user_meta_data ->> 'username',
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'last_name'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();
