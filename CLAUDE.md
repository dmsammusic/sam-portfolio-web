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
`json-formattor.html`, `blog.html`, `blogs/*.html`, `404.html`) shares one header, footer, and
dark-mode-init script by referencing:

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
classes like `.nav-link`, `.icon-btn`, `.key-box`, `.segment-btn`) lives in `src/css/main.css`.
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
- `keygen.js`, `time-calculator.js` — per-tool logic, loaded only on their own page.

`json-formattor.html` is the exception: its logic (Monaco setup, format/minify/clear/copy) lives
inline in a classic (non-module) `<script>` block in the HTML itself, not in `src/js/`, because it
shares global scope with Monaco's AMD loader (`require`/`define`, loaded from a CDN `<script src>`
— Monaco is not bundled through Vite/npm).

### Icons

No icon font, no npm icon package. Icons are hand-written inline SVG: as literal `<svg>` markup in
`partials/header.html`, and as path-string values in the `ICONS` map in `src/js/hub.js`. `src/icons/`
exists but is currently unused/empty.

### Deployment

`.github/workflows/deploy.yml` runs `npm ci && npm run build` and publishes `dist/` to GitHub Pages
via `actions/deploy-pages` on every push to `main`. This requires the repo's **Settings → Pages →
Source** to be set to **"GitHub Actions"** (not "Deploy from a branch") — a one-time manual repo
setting that a code change can't fix.
