-- Date of birth schema — run in the Supabase SQL Editor after profiles_schema.sql.
-- Nullable rather than NOT NULL: existing accounts created before this feature shipped
-- have no date of birth on file and shouldn't be broken by a constraint they can't
-- retroactively satisfy. New sign-ups are required to provide it client-side instead.

alter table profiles add column if not exists date_of_birth date;

-- Redefines handle_new_user() to also read date_of_birth from signUp() metadata.
-- CREATE OR REPLACE keeps the function's identity, so the existing on_auth_user_created
-- trigger picks up this new body automatically — no need to recreate the trigger, but it's
-- included below anyway so this file also works standalone on a fresh project.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'username' is not null then
    insert into profiles (id, username, first_name, last_name, date_of_birth)
    values (
      new.id,
      new.raw_user_meta_data ->> 'username',
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'last_name',
      (new.raw_user_meta_data ->> 'date_of_birth')::date
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
