const mobileToggle = document.getElementById("mobile-menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
const openIcon = document.getElementById("menu-icon-open");
const closeIcon = document.getElementById("menu-icon-close");

mobileToggle?.addEventListener("click", () => {
  const isOpen = !mobileMenu.classList.toggle("hidden");
  mobileToggle.setAttribute("aria-expanded", String(isOpen));
  openIcon.classList.toggle("hidden", isOpen);
  closeIcon.classList.toggle("hidden", !isOpen);
});

const path = location.pathname;
document.querySelectorAll("[data-nav]").forEach((link) => {
  const isHome = link.dataset.nav === "home" && (path === "/" || path.endsWith("/index.html"));
  const isPortfolio = link.dataset.nav === "portfolio" && path.endsWith("/portfolio.html");
  const isBlog = link.dataset.nav === "blog" && path.includes("/blog");
  if (isHome || isPortfolio || isBlog) link.setAttribute("data-active", "true");
});
