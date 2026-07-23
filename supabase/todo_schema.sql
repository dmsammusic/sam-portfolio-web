-- Todo List schema — run in the Supabase SQL Editor.
-- One table, rows are never deleted by the system: Day / Last 7 Days / Week / Month
-- views (built in the app) are just different date-range filters over this same data.

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every list view queries "my todos in this date range" — this index serves that directly.
create index if not exists todos_user_date_idx on todos (user_id, date);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists todos_set_updated_at on todos;
create trigger todos_set_updated_at
  before update on todos
  for each row
  execute function set_updated_at();

alter table todos enable row level security;

-- Each user can only ever see/change their own todos — this is what makes open
-- public sign-up safe: nobody's rows are visible to anyone else, enforced by
-- Postgres itself, not by application code.
drop policy if exists "select own todos" on todos;
create policy "select own todos" on todos
  for select using (auth.uid() = user_id);

drop policy if exists "insert own todos" on todos;
create policy "insert own todos" on todos
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own todos" on todos;
create policy "update own todos" on todos
  for update using (auth.uid() = user_id);

drop policy if exists "delete own todos" on todos;
create policy "delete own todos" on todos
  for delete using (auth.uid() = user_id);

-- RLS above only filters *which rows* are visible — Postgres still requires this base
-- table-level grant before that filtering ever applies. Without it every query 42501s
-- with "permission denied for table todos" regardless of the policies.
grant select, insert, update, delete on todos to authenticated;
