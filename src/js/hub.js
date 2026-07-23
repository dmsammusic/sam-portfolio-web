const ICONS = {
  key: `<circle cx="7" cy="15" r="4"/><path d="M10 12l8-8M15 4l2 2M18 7l2 2"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>`,
  braces: `<path d="M8 3a3 3 0 0 0-3 3v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a3 3 0 0 0 3 3"/><path d="M16 3a3 3 0 0 1 3 3v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a3 3 0 0 1-3 3"/>`,
  checklist: `<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7.5 9.5l1.5 1.5 2.5-2.5M7.5 15.5l1.5 1.5 2.5-2.5"/><path d="M14 9.5h4M14 15.5h4"/>`,
};

const TOOLS = [
  {
    name: "Key Generator",
    description: "Generate secure random keys, passwords, and hex strings for development.",
    tags: ["security", "password", "random", "hex", "wpa", "wep"],
    href: "/keygen.html",
    icon: "key",
  },
  {
    name: "Work End Time",
    description: "Calculate when your 8-hour work day completes.",
    tags: ["time", "work", "calculator", "shift", "hours"],
    href: "/time-calculator.html",
    icon: "clock",
  },
  {
    name: "JSON Formatter",
    description: "Format, minify, and validate JSON data with a live editor.",
    tags: ["json", "format", "dev", "editor", "validate", "minify"],
    href: "/json-formattor.html",
    icon: "braces",
  },
  {
    name: "Todo List",
    description: "A day-based todo list with weekly and monthly summary views. Requires login.",
    tags: ["todo", "tasks", "login", "planner", "checklist"],
    href: "/todo.html",
    icon: "checklist",
  },
];

const grid = document.getElementById("tool-grid");
const emptyState = document.getElementById("tool-empty");
const searchInput = document.getElementById("tool-search");

function iconSvg(name) {
  return `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

function cardHtml(tool) {
  return `
    <a href="${tool.href}" class="group block rounded-lg border border-gray-200 dark:border-gray-800 p-5 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all">
      <div class="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center mb-4">
        ${iconSvg(tool.icon)}
      </div>
      <h3 class="font-semibold text-gray-900 dark:text-white mb-1">${tool.name}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">${tool.description}</p>
      <span class="text-sm font-medium text-gray-900 dark:text-white group-hover:underline">Open tool →</span>
    </a>
  `;
}

function render(list) {
  grid.innerHTML = list.map(cardHtml).join("");
  emptyState.classList.toggle("hidden", list.length > 0);
}

function matches(tool, query) {
  const haystack = [tool.name, tool.description, ...tool.tags].join(" ").toLowerCase();
  return haystack.includes(query);
}

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  render(query ? TOOLS.filter((tool) => matches(tool, query)) : TOOLS);
});

render(TOOLS);
