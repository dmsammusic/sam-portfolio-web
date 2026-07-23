// Loaded on every page, same as nav.js/theme.js — one shared module handles GA4
// init, automatic page views (gtag's own default behavior on 'config'), and a
// single delegated click listener instead of wiring tracking into every button
// individually. See docs/analytics-setup.md for getting a Measurement ID.

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

if (!GA_ID) {
  console.warn(
    "Google Analytics is not configured (VITE_GA_MEASUREMENT_ID missing) — tracking disabled. " +
      "See docs/analytics-setup.md.",
  );
} else {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID); // also fires the page_view for this load
}

export function trackEvent(name, params = {}) {
  if (typeof window.gtag === "function") window.gtag("event", name, params);
}

// Elements that need a more stable label than their visible text (icon-only
// buttons like the theme toggle) can set data-analytics-label explicitly;
// everything else falls back to its visible text or aria-label.
document.addEventListener("click", (e) => {
  const el = e.target.closest("button, a");
  if (!el) return;

  const label = el.dataset.analyticsLabel || el.textContent.trim() || el.getAttribute("aria-label") || el.tagName;

  trackEvent("click", {
    label,
    tag: el.tagName.toLowerCase(),
    href: el.tagName === "A" ? el.href : undefined,
  });
});
