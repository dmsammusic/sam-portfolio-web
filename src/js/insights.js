import { supabase } from "./supabase-client.js";
import {
  toISODate,
  parseISODate,
  addDays,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  formatShort,
  formatDay,
} from "./date-utils.js";

const signedOutMessage = document.getElementById("signed-out-message");
const app = document.getElementById("insights-app");
const rangeTabs = document.querySelectorAll(".range-tab");
const customRange = document.getElementById("custom-range");
const fromDateInput = document.getElementById("from-date");
const toDateInput = document.getElementById("to-date");
const applyCustomBtn = document.getElementById("apply-custom");
const rangeNav = document.getElementById("range-nav");
const rangeLabelEl = document.getElementById("range-label");
const statCreated = document.getElementById("stat-created");
const statCompleted = document.getElementById("stat-completed");
const statPending = document.getElementById("stat-pending");
const todoGroups = document.getElementById("todo-groups");
const todoEmpty = document.getElementById("todo-empty");

let currentRange = "last7"; // "last7" | "week" | "month" | "custom"
let refDate = new Date();
let customFrom = null;
let customTo = null;

function rangeFor() {
  switch (currentRange) {
    case "last7":
      return [addDays(refDate, -6), refDate];
    case "week": {
      const start = startOfWeek(refDate);
      return [start, addDays(start, 6)];
    }
    case "month":
      return [startOfMonth(refDate), endOfMonth(refDate)];
    case "custom":
      return [customFrom ?? addDays(refDate, -6), customTo ?? refDate];
    default:
      return [refDate, refDate];
  }
}

function shiftRef(direction) {
  if (currentRange === "month") {
    refDate = addMonths(refDate, direction);
  } else {
    refDate = addDays(refDate, direction * 7);
  }
}

function rangeLabel() {
  const [start, end] = rangeFor();
  if (currentRange === "month") return refDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return `${formatShort(start)} – ${formatShort(end)}`;
}

rangeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    rangeTabs.forEach((t) => t.setAttribute("data-active", "false"));
    tab.setAttribute("data-active", "true");
    currentRange = tab.dataset.range;
    customRange.classList.toggle("hidden", currentRange !== "custom");
    rangeNav.classList.toggle("hidden", currentRange === "custom");
    load();
  });
});

applyCustomBtn.addEventListener("click", () => {
  if (!fromDateInput.value || !toDateInput.value) return;
  customFrom = parseISODate(fromDateInput.value);
  customTo = parseISODate(toDateInput.value);
  load();
});

document.getElementById("range-prev").addEventListener("click", () => {
  shiftRef(-1);
  load();
});

document.getElementById("range-next").addEventListener("click", () => {
  shiftRef(1);
  load();
});

async function load() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const [start, end] = rangeFor();
  rangeLabelEl.textContent = rangeLabel();

  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", session.user.id)
    .gte("date", toISODate(start))
    .lte("date", toISODate(end))
    .order("date", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  render(data ?? []);
}

function render(todos) {
  const completed = todos.filter((t) => t.done).length;
  statCreated.textContent = todos.length;
  statCompleted.textContent = completed;
  statPending.textContent = todos.length - completed;

  todoGroups.innerHTML = "";
  todoEmpty.classList.toggle("hidden", todos.length > 0);

  const byDate = new Map();
  for (const todo of todos) {
    if (!byDate.has(todo.date)) byDate.set(todo.date, []);
    byDate.get(todo.date).push(todo);
  }

  for (const [date, items] of byDate) {
    const done = items.filter((t) => t.done).length;
    const group = document.createElement("div");

    const header = document.createElement("div");
    header.className = "flex items-baseline justify-between mb-2";
    header.innerHTML = `
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">${formatDay(parseISODate(date))}</h3>
      <span class="text-xs text-gray-400 dark:text-gray-500">${done}/${items.length} done</span>
    `;
    group.appendChild(header);

    const list = document.createElement("div");
    list.className = "space-y-1";
    items.forEach((todo) => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 px-2 py-1";
      row.innerHTML = `
        <span class="w-4 h-4 rounded-sm border ${todo.done ? "bg-black dark:bg-white border-black dark:border-white" : "border-gray-300 dark:border-gray-600"} shrink-0"></span>
        <span class="flex-1 text-sm ${todo.done ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}"></span>
      `;
      row.querySelector("span:last-child").textContent = todo.title;
      list.appendChild(row);
    });
    group.appendChild(list);

    todoGroups.appendChild(group);
  }
}

async function refreshAuthUI() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    signedOutMessage.classList.add("hidden");
    app.classList.remove("hidden");
    load();
  } else {
    signedOutMessage.classList.remove("hidden");
    app.classList.add("hidden");
  }
}

supabase.auth.onAuthStateChange(() => refreshAuthUI());
refreshAuthUI();
