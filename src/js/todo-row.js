import { supabase } from "./supabase-client.js";
import { createDismissibleMenu } from "./dismissible-menu.js";

// Shared by todo.js and insights.js so row behavior (checkbox, kebab menu,
// inline edit, delete, subtasks) can't drift between the two pages.
//
// `belongsInView(todo)` is supplied by the caller and decides whether a todo,
// after being toggled done/pending or having its date changed, still belongs
// in whatever's currently on screen (a single selected day for todo.js, a
// date range for insights.js) — if it returns false the row removes itself.

export function renderTodoRow(todo, subtasks, { belongsInView }) {
  const wrapper = document.createElement("div");
  wrapper.className = "rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/60";

  const row = document.createElement("div");
  row.className = "flex items-center gap-2 px-2 py-1.5";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = todo.done;
  checkbox.className = "w-4 h-4 accent-black dark:accent-white shrink-0";
  checkbox.addEventListener("change", async () => {
    await supabase.from("todos").update({ done: checkbox.checked }).eq("id", todo.id);
    todo.done = checkbox.checked;
    if (!belongsInView(todo)) {
      wrapper.remove();
      return;
    }
    title.classList.toggle("line-through", todo.done);
    title.classList.toggle("text-gray-400", todo.done);
  });

  const title = document.createElement("span");
  title.textContent = todo.title;
  title.className = `flex-1 text-sm ${todo.done ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`;

  const kebabWrap = document.createElement("div");
  kebabWrap.className = "relative shrink-0";

  const kebabBtn = document.createElement("button");
  kebabBtn.type = "button";
  kebabBtn.className = "icon-btn w-7 h-7";
  kebabBtn.setAttribute("aria-label", "Todo actions");
  kebabBtn.innerHTML = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>`;

  const menu = document.createElement("div");
  menu.className =
    "hidden absolute right-0 top-full mt-1 z-10 w-32 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg py-1";
  menu.innerHTML = `
    <button type="button" data-action="edit" class="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">Edit</button>
    <button type="button" data-action="delete" class="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800">Delete</button>
  `;

  const kebabMenu = createDismissibleMenu(kebabWrap, kebabBtn, menu);

  menu.querySelector('[data-action="edit"]').addEventListener("click", () => {
    kebabMenu.close();
    startEdit();
  });

  menu.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    kebabMenu.close();
    await supabase.from("todos").delete().eq("id", todo.id);
    wrapper.remove();
  });

  kebabWrap.append(kebabBtn, menu);
  row.append(checkbox, title, kebabWrap);
  wrapper.appendChild(row);

  function startEdit() {
    const resting = [checkbox, title, kebabWrap];
    row.innerHTML = "";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = todo.title;
    titleInput.className =
      "flex-1 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white";

    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = todo.date;
    dateInput.className =
      "text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shrink-0";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.className = "btn-primary text-xs px-2 py-1 shrink-0";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "nav-link text-xs px-2 py-1 shrink-0";

    function restore() {
      title.textContent = todo.title;
      title.className = `flex-1 text-sm ${todo.done ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`;
      row.innerHTML = "";
      row.append(...resting);
    }

    saveBtn.addEventListener("click", async () => {
      const newTitle = titleInput.value.trim();
      const newDate = dateInput.value;
      if (!newTitle || !newDate) return;

      if (newTitle !== todo.title || newDate !== todo.date) {
        await supabase.from("todos").update({ title: newTitle, date: newDate }).eq("id", todo.id);
        todo.title = newTitle;
        todo.date = newDate;
      }

      if (!belongsInView(todo)) {
        wrapper.remove();
        return;
      }
      restore();
    });

    cancelBtn.addEventListener("click", restore);

    row.append(titleInput, dateInput, saveBtn, cancelBtn);
    titleInput.focus();
  }

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
    const subtaskTitle = input.value.trim();
    if (!subtaskTitle) return;
    const { data, error } = await supabase
      .from("todo_subtasks")
      .insert({ todo_id: todo.id, title: subtaskTitle })
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
