import { supabase } from "./supabase-client.js";
import { toISODate, addDays, startOfWeek, isSameDay } from "./date-utils.js";
import { renderTodoRow } from "./todo-row.js";
import { resolveEmailForLogin } from "./profile.js";

// ---- DOM refs ----

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const authForm = document.getElementById("auth-form");
const authTabs = document.getElementById("auth-tabs");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authConfirmPassword = document.getElementById("auth-confirm-password");
const authMessage = document.getElementById("auth-message");
const authSubmit = document.getElementById("auth-submit");
const authTabLogin = document.getElementById("auth-tab-login");
const authTabSignup = document.getElementById("auth-tab-signup");
const signupFields = document.getElementById("signup-fields");
const authFirstName = document.getElementById("auth-first-name");
const authLastName = document.getElementById("auth-last-name");
const authUsername = document.getElementById("auth-username");
const authDob = document.getElementById("auth-dob");
const usernameStatus = document.getElementById("username-status");
const authEmailLabel = document.getElementById("auth-email-label");
const authPasswordLabel = document.getElementById("auth-password-label");
const authConfirmPasswordLabel = document.getElementById("auth-confirm-password-label");
const emailField = document.getElementById("email-field");
const passwordField = document.getElementById("password-field");
const confirmPasswordField = document.getElementById("confirm-password-field");
const forgotPasswordLink = document.getElementById("forgot-password-link");
const resetBackLink = document.getElementById("reset-back-link");
const addForm = document.getElementById("add-form");
const todoTitleInput = document.getElementById("todo-title");
const todoDateInput = document.getElementById("todo-date");
const dateStrip = document.getElementById("date-strip");
const stripPrev = document.getElementById("strip-prev");
const stripNext = document.getElementById("strip-next");
const statusTabs = document.querySelectorAll(".status-tab");
const todoList = document.getElementById("todo-list");
const todoEmpty = document.getElementById("todo-empty");

let authMode = "login"; // "login" | "signup" | "reset-request" | "recovery"
let isRecoveryFlow = false; // set once Supabase reports a PASSWORD_RECOVERY session

function showMessage(text, type = "error") {
  authMessage.textContent = text;
  authMessage.className = `text-sm ${type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`;
  authMessage.classList.remove("hidden");
}

const SUBMIT_LABEL = {
  login: "Log in",
  signup: "Sign up",
  "reset-request": "Send reset link",
  recovery: "Set new password",
};

function setAuthMode(mode) {
  authMode = mode;
  authMessage.classList.add("hidden");

  authTabs.classList.toggle("hidden", mode === "reset-request" || mode === "recovery");
  authTabLogin.setAttribute("data-active", String(mode === "login"));
  authTabSignup.setAttribute("data-active", String(mode === "signup"));

  signupFields.classList.toggle("hidden", mode !== "signup");
  emailField.classList.toggle("hidden", mode === "recovery");
  passwordField.classList.toggle("hidden", mode === "reset-request");
  confirmPasswordField.classList.toggle("hidden", mode !== "signup" && mode !== "recovery");
  forgotPasswordLink.classList.toggle("hidden", mode !== "login");
  resetBackLink.classList.toggle("hidden", mode === "login" || mode === "signup");

  authEmailLabel.textContent = mode === "login" ? "Email or username" : "Email";
  authPasswordLabel.textContent = mode === "recovery" ? "New password" : "Password";
  authConfirmPasswordLabel.textContent = mode === "recovery" ? "Confirm new password" : "Confirm password";
  authPassword.autocomplete = mode === "login" ? "current-password" : "new-password";
  authSubmit.textContent = SUBMIT_LABEL[mode];
}

authTabLogin.addEventListener("click", () => setAuthMode("login"));
authTabSignup.addEventListener("click", () => setAuthMode("signup"));
forgotPasswordLink.addEventListener("click", () => setAuthMode("reset-request"));
resetBackLink.addEventListener("click", (e) => {
  e.preventDefault();
  setAuthMode("login");
});

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

  if (authMode === "reset-request") {
    const email = authEmail.value.trim();
    if (!email) return;
    await supabase.auth.resetPasswordForEmail(email);
    // Same message regardless of whether the email has an account — otherwise
    // this form could be used to enumerate registered emails.
    showMessage("If that email has an account, a reset link is on its way.", "success");
    return;
  }

  if (authMode === "recovery") {
    const password = authPassword.value;
    const confirmPassword = authConfirmPassword.value;

    if (!password || password.length < 6) {
      showMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      showMessage("Passwords don't match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      showMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    isRecoveryFlow = false;
    setAuthMode("login");
    showMessage("Password updated — log in with your new password.", "success");
    return;
  }

  const identifier = authEmail.value.trim();
  const password = authPassword.value;

  if (authMode === "login") {
    // "identifier" may be an email or a username — resolve a username to its
    // email first, since Supabase Auth's sign-in only accepts email/phone. An
    // unknown username resolves to null; passing that straight to
    // signInWithPassword would send a non-email string and get back a
    // *different* error (invalid email format) than a real wrong-password
    // attempt does, which would let this be used to tell whether a username
    // exists. Show the exact same generic message ourselves instead of ever
    // making that call.
    const email = await resolveEmailForLogin(identifier);
    if (!email) {
      showMessage("Invalid login credentials");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showMessage(error.message);
    return;
  }

  // signup
  const confirmPassword = authConfirmPassword.value;
  if (password !== confirmPassword) {
    showMessage("Passwords don't match.");
    return;
  }

  const firstName = authFirstName.value.trim();
  const lastName = authLastName.value.trim();
  const username = authUsername.value.trim();
  const dob = authDob.value;

  if (!firstName || !lastName || !username || !dob) {
    showMessage("First name, last name, username, and date of birth are all required.");
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
    email: identifier,
    password,
    options: { data: { username, first_name: firstName, last_name: lastName, date_of_birth: dob } },
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

function belongsInView(todo) {
  return todo.date === toISODate(selectedDate) && todo.done === (statusFilter === "completed");
}

function renderTodos(todos, subtasksByTodo) {
  todoList.innerHTML = "";
  todoEmpty.classList.toggle("hidden", todos.length > 0);
  todos.forEach((todo) =>
    todoList.appendChild(renderTodoRow(todo, subtasksByTodo.get(todo.id) ?? [], { belongsInView })),
  );
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

  // A password-recovery link also establishes a session, but that shouldn't
  // drop the user straight into the app — they need to set a new password first.
  if (session && !isRecoveryFlow) {
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

supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    isRecoveryFlow = true;
    setAuthMode("recovery");
  }
  refreshAuthUI();
});
refreshAuthUI();
