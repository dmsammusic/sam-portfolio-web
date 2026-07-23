# Google Analytics setup

`src/js/analytics.js` is loaded on every page and does nothing until it has a GA4
Measurement ID — until then it just logs a console warning.

## 1. Create a GA4 property

1. Go to [analytics.google.com](https://analytics.google.com) and sign in.
2. Create a property for this site (Admin → Create Property) if you don't have one yet.
3. Add a **Web** data stream for `https://dmsam.in`.
4. Copy the **Measurement ID** shown for that stream (looks like `G-XXXXXXXXXX`).

## 2. Give the site your Measurement ID

Same pattern as the Supabase credentials:

**Local development** — add to your `.env` (copy `.env.example` if you haven't):

```
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Deployed site** — add it as a GitHub repository secret:

1. **Settings → Secrets and variables → Actions**.
2. Add a repository secret named `VITE_GA_MEASUREMENT_ID` with the same value.

The deploy workflow already reads this — no other changes needed once the secret is set.

## What gets tracked

- A page view on every page load (GA4's own default behavior — no extra code needed).
- A `click` event on every button/link clicked anywhere on the site, labeled with the
  element's visible text (or `aria-label` if it has no text — icon-only buttons like the
  theme toggle already have one) unless it sets an explicit `data-analytics-label`
  attribute, which takes priority.

## Not included

No cookie-consent banner ships with this — GA sets cookies as soon as it loads, so if
this site gets traffic from a jurisdiction that requires consent before tracking loads,
that's a decision (and a small `analytics.js` change to gate on consent) worth making
separately, not something this setup does for you.
