// Shared by todo-row.js's kebab menu, task-manager.js's column kebab menu, and
// user-nav.js's profile dropdown — the same "toggle open, close on outside click"
// behavior, previously copy-pasted three times.

export function createDismissibleMenu(wrapperEl, triggerBtn, menuEl) {
  function onDocClick(e) {
    if (!wrapperEl.contains(e.target)) close();
  }

  function close() {
    menuEl.classList.add("hidden");
    document.removeEventListener("click", onDocClick);
  }

  triggerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = menuEl.classList.contains("hidden");
    menuEl.classList.toggle("hidden");
    if (wasHidden) document.addEventListener("click", onDocClick);
    else document.removeEventListener("click", onDocClick);
  });

  return { close };
}
