-- Run this once now — todo_schema.sql and profiles_schema.sql already ran and created the
-- tables/RLS policies, but never granted base table privileges to the `authenticated` role.
-- RLS only filters *rows*; Postgres still requires a table-level GRANT before that filtering
-- ever applies, which is what "permission denied for table todos/profiles" means.
-- (This fix is folded into todo_schema.sql / profiles_schema.sql / task_manager_schema.sql
-- below too, so re-running any of them from scratch on a fresh project won't hit this.)

grant select, insert, update, delete on public.todos to authenticated;
grant select, insert, update on public.profiles to authenticated;
