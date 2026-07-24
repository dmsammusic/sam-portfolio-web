# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install deps
npm run dev       # local dev server (Vite)
npm run build     # production build -> dist/
npm run preview   # serve the built dist/ locally, for testing the real build
```

There is no test suite or linter configured in this project.

You cannot open `index.html` (or any page) directly in a browser — pages use root-absolute asset
paths (`/src/js/...`) and `<!-- @include ... -->` comments that only resolve through the Vite
build. Always go through `npm run dev` or `npm run build && npm run preview`.

## Architecture

Static multi-page site (no SPA framework) built with **Vite** + **Tailwind v4**, deployed to GitHub
Pages via GitHub Actions on every push to `main`.

### Page assembly: build-time HTML includes

Every page (`index.html`, `portfolio.html`, `keygen.html`, `time-calculator.html`,
`json-formattor.html`, `blog.html`, `blogs/*.html`, `todo.html`, `insights.html`, `settings.html`,
`task-manager.html`, `404.html`) shares one header, footer, and dark-mode-init script by
referencing:

```html
<!-- @include "partials/header.html" -->
<!-- @include "partials/footer.html" -->
<!-- @include "partials/theme-init.html" -->
```

A custom Vite plugin in `vite.config.js` (`htmlIncludes()`) resolves these recursively at build
time via a `transformIndexHtml` hook with `order: "pre"`. The output is plain static HTML — there
is no client-side templating and no other include syntax. To change the shared header/footer/nav,
edit the files under `partials/`, not each page individually.

**Every page must be registered as an entry in `vite.config.js`'s `build.rollupOptions.input`,
or Vite won't build/emit it.** This is the most common thing to forget when adding a new page
(a new tool, a new blog post) — the file can exist on disk and still silently not appear in `dist/`.

### Dark mode

Tailwind v4 defaults `dark:` to `prefers-color-scheme`. This project overrides that in
`src/css/main.css`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

so `dark:` is driven by a `.dark` class on `<html>` instead. That class is:
- set **before paint** by the inline script in `partials/theme-init.html` (included in every
  page's `<head>`, reading `localStorage` then falling back to `prefers-color-scheme`) — this
  avoids a flash of the wrong theme on load,
- toggled by the click handler in `src/js/theme.js` (also persists to `localStorage` and listens
  for OS-level theme changes when the user hasn't set an explicit preference).

`json-formattor.html`'s Monaco editor doesn't use `src/js/theme.js` directly — it syncs via a
`MutationObserver` watching `document.documentElement`'s `class` attribute, so it stays correct
regardless of script execution order.

### No `tailwind.config.js`

Tailwind v4 uses CSS-first config. All Tailwind setup (`@import "tailwindcss"`, the
`@tailwindcss/typography` plugin, the `dark:` custom variant, and the handful of shared component
classes like `.nav-link`, `.icon-btn`, `.key-box`, `.btn-primary`) lives in `src/css/main.css`.
Don't go looking for a JS config file.

### `public/` vs. everything else

`public/` holds only pure passthrough assets copied verbatim into `dist/` root: `CNAME` (required
for the GitHub Pages custom domain, dmsam.in) and `images/`. Every other top-level `.html` file and
everything under `src/`/`partials/` is processed by Vite.

### Shared JS (`src/js/`)

Loaded per-page via `<script type="module" src="/src/js/...">` tags — there's no single bundled
entry point, so which modules a page loads is determined by the `<script>` tags in that page's own
HTML. Vite's build still dedupes modules shared across multiple entries into one chunk (e.g.
`nav.js` + `theme.js` end up together since every page loads both).

- `nav.js` — mobile menu toggle, and active-nav-link detection (matches `[data-nav]` links against
  `location.pathname`; extend the `home`/`portfolio`/`blog` checks here if a new primary nav
  section is added).
- `theme.js` — dark-mode toggle click handler + OS-preference-change listener.
- `analytics.js` — Google Analytics (see Analytics section below).
- `hub.js` — the homepage tool grid. Tools are a hardcoded array (`name`, `description`, `tags`,
  `href`, `icon`) rendered client-side with instant search/filter over name+description+tags.
  **Adding a tool means updating three places**: this array, the `rollupOptions.input` entry in
  `vite.config.js`, and the actual page. Settings and Insights are deliberately **not** hub
  tiles — they're reached only from the profile dropdown / the Todo List page, not the tool grid.
  Task Manager is the one exception: `hub.js` imports the shared Supabase client and checks
  `getSession()`/`onAuthStateChange()` itself (the only async/auth-aware code in this file) to
  conditionally append a Task Manager tool object ahead of the base array, so its tile only shows
  to logged-in visitors — logged-out visitors see the same four tiles as everyone else. This is
  the single seam for that gating; don't duplicate the auth check elsewhere for this purpose.
- `keygen.js`, `time-calculator.js` — per-tool logic, loaded only on their own page.
- `todo.js`, `insights.js` — the Todo List and Insights pages; both render todo rows via the
  shared `todo-row.js` module (see Auth & data section) rather than each having their own
  rendering logic.
- `settings.js` — the Settings page (name + display-format editing).
- `date-utils.js` — date math shared by `todo.js`/`insights.js`/`todo-row.js`.
- `supabase-client.js` — the single shared Supabase client (see Auth & data section below);
  every page that talks to Supabase imports this rather than constructing its own client.
- `profile.js` — the single shared module for reading/writing `profiles` and resolving a
  username to an email for login (see User profiles section below); the navbar dropdown, the
  Settings page, and the login form all call into this rather than each doing their own
  `supabase.from("profiles")` calls.
- `todo-row.js` — renders a single todo row (checkbox, kebab menu with Edit/Delete, inline
  title+date edit form, subtasks) identically for `todo.js` and `insights.js`. Takes a
  `belongsInView(todo)` predicate from the caller so it knows whether to remove itself from the
  DOM after a mutation — `todo.js`'s predicate checks the selected day + Pending/Completed filter,
  `insights.js`'s checks the current date range. If you're adding a third place that shows todo
  rows, render through this module rather than reimplementing row behavior again.
- `task-manager.js` — the Task Manager Kanban board. All of its Supabase calls go through
  `task-manager-data.js` rather than being inlined here (see Task Manager section below) — this
  is the one page in the codebase with a dedicated data-access module, by explicit design.

`json-formattor.html` is the exception: its logic (Monaco setup, format/minify/clear/copy) lives
inline in a classic (non-module) `<script>` block in the HTML itself, not in `src/js/`, because it
shares global scope with Monaco's AMD loader (`require`/`define`, loaded from a CDN `<script src>`
— Monaco is not bundled through Vite/npm).

### Icons

No icon font, no npm icon package. Icons are hand-written inline SVG: as literal `<svg>` markup in
`partials/header.html`, and as path-string values in the `ICONS` map in `src/js/hub.js`. `src/icons/`
exists but is currently unused/empty.

### Auth & data (Supabase)

The site is still a static build with no server of its own — auth and data storage are handled by
**Supabase**, called directly from the browser via `@supabase/supabase-js`. This works because
Supabase's security model relies on **Row Level Security (RLS)** in Postgres, not on keeping the
API key secret — the Project URL and anon key are meant to be public/client-exposed. Never put the
`service_role` key anywhere in this project; it bypasses RLS and has no legitimate use in a
server-less static site.

- `src/js/supabase-client.js` creates the one shared client, reading
  `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Locally these come from a
  gitignored `.env` (see `.env.example`); in CI they're injected as build-time env in
  `.github/workflows/deploy.yml` from GitHub repo secrets of the same names.
- `todo.html` / `src/js/todo.js` is the primary Supabase-backed page. It's a single page that
  shows a login/sign-up form when logged out and the todo app when logged in (`#auth-section` /
  `#app-section`, toggled by `supabase.auth.onAuthStateChange`) — there's no separate login page or
  redirect. `insights.html` / `src/js/insights.js` is the second Supabase-backed page (see below);
  both import shared date math from `src/js/date-utils.js` rather than duplicating it.
- Todo rows are **never deleted or archived by the system** — this is the whole point of the
  feature. `todo.js` itself only ever shows one day at a time (the day selected in the date strip),
  filtered to Pending or Completed; the historical Last 7 Days / Week / Month / Custom-range views
  live entirely in `insights.js`'s `rangeFor()` instead. Don't add any kind of rollup/archival job
  to either page.
- SQL schema lives in `supabase/` (not run automatically — see `supabase/SETUP.md`): all six
  files (`todo_schema.sql`, `profiles_schema.sql`, `todo_subtasks_schema.sql`,
  `settings_schema.sql`, `dob_schema.sql`, `task_manager_schema.sql`) are applied, in that order
  (later files alter tables/functions the earlier ones create).
- **Every schema file must both create its RLS policies and `grant` base table access to
  `authenticated`** (and `is_username_available` to `anon` too). RLS alone isn't enough — Postgres
  blocks the query before RLS is even evaluated without the table-level grant, which is exactly
  what `supabase/fix_grants.sql` patches for the two tables that shipped without it originally. Any
  new table needs the same `grant select, insert, ... on <table> to authenticated;` line. Also use
  `drop policy if exists "..." on <table>;` before every `create policy` — Postgres has no
  `create policy if not exists`, so omitting the drop makes the file fail if it's ever re-run.
- Subtasks (`todo_subtasks`) are a small independent checklist under a todo — their own `done`
  state, no `user_id` of their own (ownership checked through the parent todo's `user_id`, same
  pattern as `task_tags` in `task_manager_schema.sql`), and completing all of them does **not**
  mark the parent todo done. Don't add that cascade unless explicitly asked.

### User profiles & the navbar

`profiles` (one row per user: `username`, `first_name`, `last_name`, `date_of_birth`,
`date_format`, `time_format`) is what lets the navbar show an account dropdown once logged in —
this is why `src/js/user-nav.js` and `partials/onboarding-modal.html` are wired into **every**
page, not just `todo.html`: the header partial is shared everywhere, so showing per-user identity
(and giving a way to log out from anywhere) means every page now loads the Supabase SDK and checks
auth state, even pages with nothing to do with auth. That's a deliberate size trade-off, not an
oversight.

- The navbar's `#nav-user` is a profile icon (`#nav-profile-btn`) that opens a dropdown
  (`#nav-profile-menu`) showing full name + `@username`, with **Settings** and **Log out**
  (`#nav-logout`) as the only actions — there's no plain-text "Hi, name" anymore. Logging out lives
  only here; don't re-add a page-local logout button.
- New sign-ups collect `username`/`first_name`/`last_name`/`date_of_birth` directly on the sign-up
  form (`todo.html`'s `#signup-fields`, currently the only sign-up entry point) and pass them as
  `signUp()` `options.data` metadata — never as a separate insert. A trigger on `auth.users`
  (`handle_new_user()`, defined in `profiles_schema.sql` and redefined in `dob_schema.sql` to add
  the DOB field) creates the `profiles` row automatically from that metadata, which also means
  username uniqueness is enforced atomically: if the trigger hits the unique constraint, the whole
  `auth.users` insert rolls back and sign-up fails cleanly. `date_of_birth` is nullable — existing
  accounts from before that field existed have none, and aren't required to backfill it.
- **A missing `profiles` row is the signal**, not a separate "onboarded" flag: accounts created
  before this feature has no row at all, which is exactly what `user-nav.js` checks to decide
  whether to show the "complete your profile" toast. Existing users fill in the same fields via a
  modal, which inserts their row client-side (the `insert own profile` RLS policy exists
  specifically for this path — new sign-ups never hit it, since the trigger already created theirs).
- `is_username_available(text)` and `resolve_email_for_username(text)` are both `SECURITY DEFINER`
  RPCs grantable to `anon` — needed because the `profiles` RLS policies otherwise block anyone
  (including a not-yet-signed-up or not-yet-logged-in visitor) from reading any row at all, but the
  sign-up form needs availability feedback and the login form needs username-to-email resolution
  before a session exists. `resolve_email_for_username` returns `null` for an unknown username
  rather than erroring, and the login form shows the exact same generic invalid-credentials message
  either way — never make that message depend on which case it was, or the login form becomes a way
  to enumerate registered usernames.
- Login (`todo.js`) accepts an email **or** a username in the same field — a non-email-shaped value
  goes through `resolveEmailForLogin()` (in `profile.js`) before `signInWithPassword()`, since
  Supabase Auth's password sign-in is email/phone-only.
- Forgot/reset password are two more modes (`reset-request`, `recovery`) on the same single auth
  entry point, not separate pages — `setAuthMode()` in `todo.js` toggles which fields show for all
  four modes (`login`, `signup`, `reset-request`, `recovery`). Recovery is entered automatically
  when Supabase fires a `PASSWORD_RECOVERY` auth event (after the user clicks the emailed link) —
  `isRecoveryFlow` suppresses the normal "session exists → show the app" behavior in
  `refreshAuthUI()` until a new password is actually set, otherwise a recovery session would look
  identical to a real login and drop the user straight into the app without resetting anything.
- Settings (`settings.html` / `settings.js`) is reachable only from the profile dropdown — not
  linked from primary nav or the Tools hub. It edits name and `date_format`/`time_format` through
  `profile.js`'s `updateProfile()`. `date_format` ("us" | "intl") is consumed by
  `date-utils.js`'s `formatShort`/`formatDay` (switches `en-US` vs `en-GB` locale to get Month-Day
  vs Day-Month word order — not a translation switch). `time_format` ("12h" | "24h") is stored but
  has no display consumer yet — nothing in the app currently renders a time-of-day, only dates —
  don't assume it's wired to anything until it actually is.

### Task Manager

`task-manager.html` / `src/js/task-manager.js` is a single-user Kanban board — statuses are
customizable columns, tasks are cards, backed by the six tables in `task_manager_schema.sql`
(`statuses`, `tags`, `people`, `projects`, `teams`, `tasks`, `task_tags`, `saved_views`). It's
gated by the same Supabase session as everything else, and — unlike Settings/Insights — it **does**
appear as a Tools hub tile, but only when `hub.js` detects an active session; logged-out visitors
don't see it and it's still unlinked from primary nav. "Single-user" is a convention enforced by RLS
scoping every table to `auth.uid()`, not a hardcoded owner check — any authenticated session sees
their own board, the same access model as Todo List/Insights.

- **Every Supabase call for this page goes through `src/js/task-manager-data.js`** — this is the
  one deliberate exception to the rest of this codebase's convention of inlining
  `supabase.from(...)` directly in event handlers (`todo.js`/`insights.js` do that; this page
  doesn't). If you're adding a new Task Manager capability, add a function to that module rather
  than calling Supabase from `task-manager.js` directly — that's what keeps the board's
  rendering/filtering logic testable against a stubbed data layer instead of a live database.
- Tags/people/projects/teams are near-identical small manageable lists (id, name, color) — rather
  than four copies of the same CRUD, `task-manager-data.js` backs all of them with one generic
  `listRows`/`createRow`/`updateRow`/`deleteRow` set of helpers keyed by table name.
- `blocked_reason`/`blocked_notes` are independent of `status_id` — a task can be blocked while
  sitting in any column. Don't couple clearing a blocked flag to also changing status, or vice
  versa.
- Reordering status columns is **not** drag-and-drop (explicitly out of scope) — it's "move
  left"/"move right" buttons in each column's kebab menu, rewriting every status's `sort_order` via
  `reorderStatuses()`.
- `saved_views.filters` is a schemaless `jsonb` blob rather than fixed filter columns — the filter
  UI can grow new filter types without a migration. Only one view can be `is_default` per user
  (enforced by both a partial unique index in the schema and `setDefaultSavedView()` clearing every
  other view's flag before setting the new one).
- Renames anywhere in this page (status names, tag/person/project/team names) use the same
  click-the-text-to-get-an-inline-input pattern already established elsewhere in this codebase
  (`todo.js`'s title edit, `user-nav.js`'s onboarding modal) — don't introduce `window.prompt()` for
  this; it was tried once during this page's build and corrected for exactly this reason.

### Analytics

`src/js/analytics.js` (Google Analytics, GA4) is loaded on every page, reading
`import.meta.env.VITE_GA_MEASUREMENT_ID` the same way `supabase-client.js` reads its env vars —
missing it just logs a console warning and disables tracking, it doesn't break anything. Page
views are GA4's own default behavior on `gtag('config', ...)`, not code in this repo. Click
tracking is **one delegated listener on `document`**, not per-button instrumentation — don't wire
individual `trackEvent()` calls into new buttons; the delegated listener already covers any
button/link automatically. It labels a click using, in order: an explicit `data-analytics-label`
attribute, the element's visible text, its `aria-label`, then its tag name — icon-only buttons
should have an `aria-label` (most already do, for accessibility) rather than needing a separate
analytics-specific attribute. See `docs/analytics-setup.md` for getting a Measurement ID.

### Deployment

`.github/workflows/deploy.yml` runs `npm ci && npm run build` and publishes `dist/` to GitHub Pages
via `actions/deploy-pages` on every push to `main`. This requires the repo's **Settings → Pages →
Source** to be set to **"GitHub Actions"** (not "Deploy from a branch") — a one-time manual repo
setting that a code change can't fix.

## Agent skills

### Issue tracker

Issues live as GitHub issues on this repo (`dmsammusic/sam-portfolio-web`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root (neither exists yet; created lazily by domain-modeling skills when needed). See `docs/agents/domain.md`.
