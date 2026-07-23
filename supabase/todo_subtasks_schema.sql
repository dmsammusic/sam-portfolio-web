-- Todo subtasks schema — run in the Supabase SQL Editor after todo_schema.sql.
-- A small independent checklist under a todo: each subtask has its own done state and
-- checking all of them off does NOT mark the parent todo done — they're for your own
-- tracking, not a completion cascade.

create table if not exists todo_subtasks (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references todos (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists todo_subtasks_todo_id_idx on todo_subtasks (todo_id);

alter table todo_subtasks enable row level security;

-- todo_subtasks has no user_id of its own — ownership is checked through the parent todo,
-- same pattern as task_tags in task_manager_schema.sql.
drop policy if exists "own rows only" on todo_subtasks;
create policy "own rows only" on todo_subtasks for all
  using (exists (select 1 from todos where todos.id = todo_subtasks.todo_id and todos.user_id = auth.uid()))
  with check (exists (select 1 from todos where todos.id = todo_subtasks.todo_id and todos.user_id = auth.uid()));

-- RLS above only filters *which rows* are visible — Postgres still requires this base
-- table-level grant before that filtering ever applies.
grant select, insert, update, delete on todo_subtasks to authenticated;
