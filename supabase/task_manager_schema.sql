-- Task Manager schema — DESIGN ONLY, not yet used by any page on the site.
-- Run this in the Supabase SQL Editor whenever the Task Manager UI actually gets built.
--
-- This is single-user (just you), but every table is still scoped to auth.uid() via RLS
-- rather than skipping RLS entirely — cheap insurance if this project's Supabase instance
-- is ever reused, and it costs nothing today since you're the only row owner either way.
-- The Task Manager page itself should stay unlinked from the public nav; the login it uses
-- is the same Supabase Auth as the Todo List, it's just never advertised.

-- ─── Manageable lists (Kanban columns, pill tags, assignees, projects, teams) ───
-- Each of these is a small user-editable table (add/rename/delete/reorder from the UI),
-- not a fixed enum — that's what "customizable status columns" and "tags like pills" need.

create table if not exists statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default '#6b7280', -- hex, used for the Kanban column header
  sort_order int not null default 0, -- drag-to-reorder position
  created_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default '#6b7280',
  created_at timestamptz not null default now()
);

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default '#6b7280',
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default '#6b7280',
  created_at timestamptz not null default now()
);

-- "Assigned team" is a grouping label alongside a task's single assignee, not a set of
-- people — kept as its own managed list (rather than free text) for consistency with the
-- other lists above. Swap this for a plain `team text` column on `tasks` if a fixed list
-- turns out to be more friction than it's worth.
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default '#6b7280',
  created_at timestamptz not null default now()
);

-- ─── Tasks ───

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null check (char_length(trim(title)) > 0),
  description text,

  status_id uuid references statuses (id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),

  project_id uuid references projects (id) on delete set null,
  team_id uuid references teams (id) on delete set null,
  assignee_id uuid references people (id) on delete set null,

  due_date date,
  week_start_date date, -- the Monday of the sprint/week this task is planned for

  -- Independent of status: a task can be "In Progress" AND blocked at the same time.
  blocked_reason text check (blocked_reason in ('needs_clarification', 'tech_difficulty', 'other')),
  blocked_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_status_idx on tasks (user_id, status_id);
create index if not exists tasks_user_week_idx on tasks (user_id, week_start_date);

-- Same trigger function todo_schema.sql defines; recreated here too (idempotent) so this
-- file also works if it's ever run before or without todo_schema.sql.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row
  execute function set_updated_at();

-- Many-to-many: a task can carry multiple pill tags.
create table if not exists task_tags (
  task_id uuid not null references tasks (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

-- ─── Saved Kanban views ───
-- A named, reusable filter combination (status/week/date range/project/assignee/tag, any
-- mix) the board can be switched to. `filters` is intentionally schemaless (jsonb) so the
-- board's filter UI can evolve without a migration every time a new filter type is added.

create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  filters jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only one default view per user.
create unique index if not exists saved_views_one_default_per_user
  on saved_views (user_id)
  where (is_default);

-- ─── RLS ───
-- Same pattern on every table: you can only see/change rows you own.

alter table statuses enable row level security;
alter table tags enable row level security;
alter table people enable row level security;
alter table projects enable row level security;
alter table teams enable row level security;
alter table tasks enable row level security;
alter table task_tags enable row level security;
alter table saved_views enable row level security;

drop policy if exists "own rows only" on statuses;
create policy "own rows only" on statuses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows only" on tags;
create policy "own rows only" on tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows only" on people;
create policy "own rows only" on people for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows only" on projects;
create policy "own rows only" on projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows only" on teams;
create policy "own rows only" on teams for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows only" on tasks;
create policy "own rows only" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows only" on saved_views;
create policy "own rows only" on saved_views for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- task_tags has no user_id of its own — ownership is checked through the parent task.
drop policy if exists "own rows only" on task_tags;
create policy "own rows only" on task_tags for all
  using (exists (select 1 from tasks where tasks.id = task_tags.task_id and tasks.user_id = auth.uid()))
  with check (exists (select 1 from tasks where tasks.id = task_tags.task_id and tasks.user_id = auth.uid()));

-- RLS above only filters *which rows* are visible — Postgres still requires these base
-- table-level grants before that filtering ever applies (see fix_grants.sql for why this
-- matters: forgetting it is exactly what broke todos/profiles the first time around).
grant select, insert, update, delete on statuses, tags, people, projects, teams, tasks, task_tags, saved_views to authenticated;
