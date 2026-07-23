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
`json-formattor.html`, `blog.html`, `blogs/*.html`, `todo.html`, `404.html`) shares one header,
footer, and dark-mode-init script by referencing:

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
- `hub.js` — the homepage tool grid. Tools are a hardcoded array (`name`, `description`, `tags`,
  `href`, `icon`) rendered client-side with instant search/filter over name+description+tags.
  **Adding a tool means updating three places**: this array, the `rollupOptions.input` entry in
  `vite.config.js`, and the actual page.
- `keygen.js`, `time-calculator.js`, `todo.js` — per-tool logic, loaded only on their own page.
- `supabase-client.js` — the single shared Supabase client (see Auth & data section below);
  every page that talks to Supabase imports this rather than constructing its own client.

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
- SQL schema lives in `supabase/` (not run automatically — see `supabase/SETUP.md`):
  `todo_schema.sql`, `profiles_schema.sql`, and `todo_subtasks_schema.sql` are applied;
  `task_manager_schema.sql` is a **design-only** schema for a not-yet-built Kanban-style task
  tracker (single-user, unlinked from the public nav) — don't assume any page consumes it yet. If
  that Kanban UI does get built, keep its Supabase calls behind a dedicated data-access module
  (e.g. `task-manager-data.js`) rather than inlining `supabase.from(...)` in event handlers the way
  `todo.js` does — that was an explicit decision so the board's rendering/interaction logic can be
  tested against a stubbed data layer instead of a live database.
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

`profiles` (one row per user: `username`, `first_name`, `last_name`) is what lets the navbar show
"Hi, {first name}" (plus a Log out button, `#nav-logout`) once logged in — this is why
`src/js/user-nav.js` and `partials/onboarding-modal.html` are wired into **every** page, not just
`todo.html`: the header partial is shared everywhere, so showing a per-user name (and giving them
a way to log out from anywhere) means every page now loads the Supabase SDK and checks auth state,
even pages with nothing to do with auth. That's a deliberate size trade-off, not an oversight.
Logging out lives only in the navbar now — don't re-add a page-local logout button.

- New sign-ups collect `username`/`first_name`/`last_name` directly on the sign-up form
  (`todo.html`'s `#signup-fields`, currently the only sign-up entry point) and pass them as
  `signUp()` `options.data` metadata — never as a separate insert. A trigger on `auth.users`
  (`handle_new_user()` in `profiles_schema.sql`) creates the `profiles` row automatically from that
  metadata, which also means username uniqueness is enforced atomically: if the trigger hits the
  unique constraint, the whole `auth.users` insert rolls back and sign-up fails cleanly.
- **A missing `profiles` row is the signal**, not a separate "onboarded" flag: accounts created
  before this feature has no row at all, which is exactly what `user-nav.js` checks to decide
  whether to show the "complete your profile" toast. Existing users fill in the same three fields
  via a modal, which inserts their row client-side (the `insert own profile` RLS policy exists
  specifically for this path — new sign-ups never hit it, since the trigger already created theirs).
- `is_username_available(text)` is a `SECURITY DEFINER` RPC grantable to `anon` — needed because
  the `profiles` RLS policies otherwise block anyone (including a not-yet-signed-up visitor) from
  reading any row at all, but the sign-up form still needs to give early feedback on whether a name
  is taken.

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
