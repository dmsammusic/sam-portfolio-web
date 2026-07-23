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
import { renderTodoRow } from "./todo-row.js";
import { getProfile } from "./profile.js";

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
let dateFormat = "us"; // the signed-in user's date_format preference

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
  return `${formatShort(start, dateFormat)} – ${formatShort(end, dateFormat)}`;
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

function belongsInView(todo) {
  const [start, end] = rangeFor();
  const d = parseISODate(todo.date);
  return d >= start && d <= end;
}

async function load() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const [start, end] = rangeFor();
  rangeLabelEl.textContent = rangeLabel();

  const { data: todos, error } = await supabase
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

  const todoIds = (todos ?? []).map((t) => t.id);
  let subtasksByTodo = new Map();

  if (todoIds.length > 0) {
    const { data: subtasks } = await supabase
      .from("todo_subtasks")
      .select("*")
      .in("todo_id", todoIds)
      .order("created_at", { ascending: true });

    subtasksByTodo = (subtasks ?? []).reduce((map, s) => {
      if (!map.has(s.todo_id)) map.set(s.todo_id, []);
      map.get(s.todo_id).push(s);
      return map;
    }, new Map());
  }

  render(todos ?? [], subtasksByTodo);
}

function render(todos, subtasksByTodo) {
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
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">${formatDay(parseISODate(date), dateFormat)}</h3>
      <span class="text-xs text-gray-400 dark:text-gray-500">${done}/${items.length} done</span>
    `;
    group.appendChild(header);

    const list = document.createElement("div");
    list.className = "space-y-1";
    items.forEach((todo) =>
      list.appendChild(renderTodoRow(todo, subtasksByTodo.get(todo.id) ?? [], { belongsInView })),
    );
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
    const profile = await getProfile();
    dateFormat = profile?.date_format ?? "us";
    load();
  } else {
    signedOutMessage.classList.remove("hidden");
    app.classList.add("hidden");
  }
}

supabase.auth.onAuthStateChange(() => refreshAuthUI());
refreshAuthUI();
