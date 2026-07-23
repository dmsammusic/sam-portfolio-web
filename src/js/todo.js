import { supabase } from "./supabase-client.js";
import { toISODate, addDays, startOfWeek, isSameDay } from "./date-utils.js";

// ---- DOM refs ----

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authMessage = document.getElementById("auth-message");
const authSubmit = document.getElementById("auth-submit");
const authTabLogin = document.getElementById("auth-tab-login");
const authTabSignup = document.getElementById("auth-tab-signup");
const signupFields = document.getElementById("signup-fields");
const authFirstName = document.getElementById("auth-first-name");
const authLastName = document.getElementById("auth-last-name");
const authUsername = document.getElementById("auth-username");
const usernameStatus = document.getElementById("username-status");
const addForm = document.getElementById("add-form");
const todoTitleInput = document.getElementById("todo-title");
const todoDateInput = document.getElementById("todo-date");
const dateStrip = document.getElementById("date-strip");
const stripPrev = document.getElementById("strip-prev");
const stripNext = document.getElementById("strip-next");
const statusTabs = document.querySelectorAll(".status-tab");
const todoList = document.getElementById("todo-list");
const todoEmpty = document.getElementById("todo-empty");

let authMode = "login"; // "login" | "signup"

function showMessage(text, type = "error") {
  authMessage.textContent = text;
  authMessage.className = `text-sm ${type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`;
  authMessage.classList.remove("hidden");
}

function setAuthMode(mode) {
  authMode = mode;
  authTabLogin.setAttribute("data-active", String(mode === "login"));
  authTabSignup.setAttribute("data-active", String(mode === "signup"));
  authSubmit.textContent = mode === "login" ? "Log in" : "Sign up";
  authPassword.autocomplete = mode === "login" ? "current-password" : "new-password";
  signupFields.classList.toggle("hidden", mode !== "signup");
  authMessage.classList.add("hidden");
}

authTabLogin.addEventListener("click", () => setAuthMode("login"));
authTabSignup.addEventListener("click", () => setAuthMode("signup"));

// Debounced availability check as the user types — the unique constraint in
// profiles_schema.sql is the real enforcement; this is just early feedback.
let usernameCheckTimer;
let usernameAvailable = false;

authUsername.addEventListener("input", () => {
  const username = authUsername.value.trim();
  usernameAvailable = false;
  clearTimeout(usernameCheckTimer);

  if (username.length <= 3) {
    usernameStatus.textContent = username ? "Must be more than 3 characters." : "";
    usernameStatus.className = "text-xs mt-1 text-gray-400 dark:text-gray-500";
    return;
  }

  usernameStatus.textContent = "Checking…";
  usernameStatus.className = "text-xs mt-1 text-gray-400 dark:text-gray-500";

  usernameCheckTimer = setTimeout(async () => {
    const { data, error } = await supabase.rpc("is_username_available", { check_username: username });
    if (error) return;
    usernameAvailable = data;
    usernameStatus.textContent = data ? "✓ Available" : "✗ Already taken";
    usernameStatus.className = `text-xs mt-1 ${data ? "text-green-600 dark:text-green-400" : "text-red-500"}`;
  }, 400);
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (authMode === "login") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showMessage(error.message);
    return;
  }

  const firstName = authFirstName.value.trim();
  const lastName = authLastName.value.trim();
  const username = authUsername.value.trim();

  if (!firstName || !lastName || !username) {
    showMessage("First name, last name, and username are all required.");
    return;
  }
  if (username.length <= 3) {
    showMessage("Username must be more than 3 characters.");
    return;
  }
  if (!usernameAvailable) {
    showMessage("Choose an available username before signing up.");
    return;
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, first_name: firstName, last_name: lastName } },
  });

  if (error) {
    showMessage(
      error.message.includes("duplicate key") || error.message.includes("profiles_username_key")
        ? "That username was just taken — pick another one."
        : error.message,
    );
  } else {
    showMessage("Check your email to confirm your account, then log in.", "success");
  }
});

// ---- day-strip + status filter state ----

let selectedDate = new Date();
let statusFilter = "pending"; // "pending" | "completed"

function renderDateStrip() {
  const start = startOfWeek(selectedDate);
  dateStrip.innerHTML = "";

  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "date-day";
    btn.setAttribute("data-today", String(isSameDay(day, new Date())));
    btn.setAttribute("data-active", String(isSameDay(day, selectedDate)));
    btn.innerHTML = `
      <span class="text-xs text-gray-400 dark:text-gray-500">${day.toLocaleDateString(undefined, { weekday: "short" })}</span>
      <span class="date-day-num text-sm font-semibold">${day.getDate()}</span>
    `;
    btn.addEventListener("click", () => {
      selectedDate = day;
      todoDateInput.value = toISODate(selectedDate);
      renderDateStrip();
      loadTodos();
    });
    dateStrip.appendChild(btn);
  }
}

stripPrev.addEventListener("click", () => {
  selectedDate = addDays(selectedDate, -7);
  todoDateInput.value = toISODate(selectedDate);
  renderDateStrip();
  loadTodos();
});

stripNext.addEventListener("click", () => {
  selectedDate = addDays(selectedDate, 7);
  todoDateInput.value = toISODate(selectedDate);
  renderDateStrip();
  loadTodos();
});

statusTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    statusTabs.forEach((t) => t.setAttribute("data-active", "false"));
    tab.setAttribute("data-active", "true");
    statusFilter = tab.dataset.status;
    loadTodos();
  });
});

// ---- todo CRUD + rendering ----

async function loadTodos() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { data: todos, error } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("date", toISODate(selectedDate))
    .eq("done", statusFilter === "completed")
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

  renderTodos(todos ?? [], subtasksByTodo);
}

function renderTodos(todos, subtasksByTodo) {
  todoList.innerHTML = "";
  todoEmpty.classList.toggle("hidden", todos.length > 0);
  todos.forEach((todo) => todoList.appendChild(todoRow(todo, subtasksByTodo.get(todo.id) ?? [])));
}

function todoRow(todo, subtasks) {
  const wrapper = document.createElement("div");
  wrapper.className = "rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/60";

  const row = document.createElement("div");
  row.className = "flex items-center gap-2 px-2 py-1.5 group";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = todo.done;
  checkbox.className = "w-4 h-4 accent-black dark:accent-white shrink-0";
  checkbox.addEventListener("change", async () => {
    await supabase.from("todos").update({ done: checkbox.checked }).eq("id", todo.id);
    wrapper.remove(); // no longer belongs to the current Pending/Completed filter
  });

  const title = document.createElement("span");
  title.textContent = todo.title;
  title.className = `flex-1 text-sm cursor-text ${todo.done ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`;
  title.title = "Click to edit";
  title.addEventListener("click", () => startEdit(title, todo));

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "Delete";
  del.className = "text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0";
  del.addEventListener("click", async () => {
    await supabase.from("todos").delete().eq("id", todo.id);
    wrapper.remove();
  });

  row.append(checkbox, title, del);
  wrapper.appendChild(row);

  const subtaskList = document.createElement("div");
  subtaskList.className = "pl-8 pr-2 space-y-1";
  subtasks.forEach((s) => subtaskList.appendChild(subtaskRow(s)));
  wrapper.appendChild(subtaskList);

  const addSubtaskForm = document.createElement("form");
  addSubtaskForm.className = "pl-8 pr-2 pb-1.5";
  addSubtaskForm.innerHTML = `<input type="text" placeholder="+ Add subtask" class="w-full text-xs bg-transparent placeholder:text-gray-400 focus:outline-none text-gray-600 dark:text-gray-300" />`;
  addSubtaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = addSubtaskForm.querySelector("input");
    const title = input.value.trim();
    if (!title) return;
    const { data, error } = await supabase
      .from("todo_subtasks")
      .insert({ todo_id: todo.id, title })
      .select()
      .single();
    if (!error) {
      subtaskList.appendChild(subtaskRow(data));
      input.value = "";
    }
  });
  wrapper.appendChild(addSubtaskForm);

  return wrapper;
}

function subtaskRow(subtask) {
  const row = document.createElement("div");
  row.className = "flex items-center gap-2 group";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = subtask.done;
  checkbox.className = "w-3.5 h-3.5 accent-black dark:accent-white shrink-0";
  checkbox.addEventListener("change", async () => {
    await supabase.from("todo_subtasks").update({ done: checkbox.checked }).eq("id", subtask.id);
    subtask.done = checkbox.checked;
    title.classList.toggle("line-through", subtask.done);
    title.classList.toggle("text-gray-400", subtask.done);
  });

  const title = document.createElement("span");
  title.textContent = subtask.title;
  title.className = `flex-1 text-xs ${subtask.done ? "line-through text-gray-400" : "text-gray-600 dark:text-gray-300"}`;

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "×";
  del.className = "text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0";
  del.addEventListener("click", async () => {
    await supabase.from("todo_subtasks").delete().eq("id", subtask.id);
    row.remove();
  });

  row.append(checkbox, title, del);
  return row;
}

function startEdit(titleEl, todo) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = todo.title;
  input.className = "flex-1 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white";

  async function save() {
    const value = input.value.trim();
    if (value && value !== todo.title) {
      await supabase.from("todos").update({ title: value }).eq("id", todo.id);
      todo.title = value;
    }
    titleEl.textContent = todo.title;
    input.replaceWith(titleEl);
  }

  input.addEventListener("blur", save);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.value = todo.title;
      input.blur();
    }
  });

  titleEl.replaceWith(input);
  input.focus();
}

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const title = todoTitleInput.value.trim();
  const date = todoDateInput.value;
  if (!title || !date) return;

  const { error } = await supabase.from("todos").insert({ user_id: session.user.id, title, date });
  if (!error) {
    todoTitleInput.value = "";
    loadTodos();
  }
});

// ---- auth state -> which section shows ----

async function refreshAuthUI() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    todoDateInput.value = toISODate(selectedDate);
    renderDateStrip();
    loadTodos();
  } else {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
  }
}

supabase.auth.onAuthStateChange(() => refreshAuthUI());
refreshAuthUI();
