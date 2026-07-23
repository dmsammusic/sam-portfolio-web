# Supabase setup

This site's Todo List (and later, the Task Manager) run on Supabase for auth + data storage,
while the site itself stays a static build on GitHub Pages. Supabase is designed for exactly this:
a client-side SDK talks directly to Supabase from the browser, and Row Level Security (RLS) —
not secrecy of your API keys — is what keeps one user's data away from another's.

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) and sign up / log in (GitHub login is fine).
2. Click **New Project**.
3. Pick an organization (create one if this is your first project), give the project a name
   (e.g. `sam-portfolio`), set a database password (save it somewhere — you won't need it for
   this setup, but you would for direct DB access later), and pick a region close to you.
4. Wait ~1-2 minutes for the project to finish provisioning.

## 2. Get your Project URL and anon key

1. In your new project, go to **Settings → API**.
2. Copy the **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`).
3. Copy the **anon public** key (a long JWT-looking string, under "Project API keys").

Both of these are safe to expose in client-side code — that's how Supabase is designed to work.
**Never** copy the `service_role` key into this project; that one bypasses RLS entirely and must
stay server-side only (this static site has no server, so it should never appear here at all).

## 3. Enable email confirmation

1. Go to **Authentication → Providers → Email**.
2. Make sure **Confirm email** is turned **on** (it's on by default for new projects) — this
   requires new sign-ups to click a link in their email before they can log in, which is the main
   spam/abuse guard for a site with open public sign-up.
3. Optional but recommended: go to **Authentication → URL Configuration** and set the **Site URL**
   to your deployed domain (`https://dmsam.in`) so confirmation links point at the live site
   instead of `localhost`.

## 4. Run the schema SQL

Run these in order in the **SQL Editor**, pasting each file's contents in and clicking **Run**:

1. `supabase/todo_schema.sql` — the Todo List table. Defines `set_updated_at()`, which the next
   file also reuses.
2. `supabase/profiles_schema.sql` — the username/first name/last name shown in the navbar once
   logged in, plus the trigger that creates a profile automatically at sign-up.
3. `supabase/todo_subtasks_schema.sql` — the per-todo checklist shown under each todo on the
   Todo List page.
4. `supabase/settings_schema.sql` — date/time format preferences on `profiles`, plus the
   username-to-email lookup that lets the login form accept a username instead of email.
5. `supabase/dob_schema.sql` — adds date of birth, collected at sign-up.
6. `supabase/task_manager_schema.sql` — statuses/tags/people/projects/teams/tasks/saved_views for
   the Task Manager Kanban board at `/task-manager.html` (unlinked from the public nav — reach it
   by URL).

Each of these files both creates its tables/policies **and** grants the `authenticated` role
access to them — RLS policies alone aren't enough; Postgres blocks the query before RLS is even
evaluated without a base table grant. If you ran an earlier copy of `todo_schema.sql` /
`profiles_schema.sql` before this note existed and are seeing `permission denied for table todos`
or `profiles`, run `supabase/fix_grants.sql` once to add the missing grants — no need to re-run
the full schema files.

## 5. Give the site your credentials

**Local development** — create a `.env` file at the project root (copy `.env.example`) with:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

This file is gitignored — it never gets committed.

**Deployed site** — the GitHub Actions build needs the same two values as repository secrets:

1. In your GitHub repo, go to **Settings → Secrets and variables → Actions**.
2. Add two **Repository secrets**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, same values
   as above.

The deploy workflow already reads these and makes them available to the Vite build — no other
changes needed once the secrets are set.
