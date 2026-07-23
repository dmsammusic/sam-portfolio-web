import { supabase } from "./supabase-client.js";
import { toISODate, parseISODate, startOfWeek } from "./date-utils.js";
import * as tm from "./task-manager-data.js";

// ---- DOM refs ----

const signedOutMessage = document.getElementById("signed-out-message");
const app = document.getElementById("tm-app");
const board = document.getElementById("tm-board");

const filterStatus = document.getElementById("tm-filter-status");
const filterProject = document.getElementById("tm-filter-project");
const filterAssignee = document.getElementById("tm-filter-assignee");
const filterTag = document.getElementById("tm-filter-tag");
const filterWeek = document.getElementById("tm-filter-week");
const filterFrom = document.getElementById("tm-filter-from");
const filterTo = document.getElementById("tm-filter-to");
const filterClear = document.getElementById("tm-filter-clear");

const viewSelect = document.getElementById("tm-view-select");
const viewDefaultBtn = document.getElementById("tm-view-default");
const viewDeleteBtn = document.getElementById("tm-view-delete");
const viewNameInput = document.getElementById("tm-view-name");
const viewSaveBtn = document.getElementById("tm-view-save");

const newTaskBtn = document.getElementById("tm-new-task");
const manageToggle = document.getElementById("tm-manage-toggle");
const managePanel = document.getElementById("tm-manage-panel");

const taskModal = document.getElementById("tm-task-modal");
const taskForm = document.getElementById("tm-task-form");
const modalTitle = document.getElementById("tm-modal-title");
const taskTitleInput = document.getElementById("tm-task-title");
const taskDescriptionInput = document.getElementById("tm-task-description");
const taskStatusSelect = document.getElementById("tm-task-status");
const taskPrioritySelect = document.getElementById("tm-task-priority");
const taskProjectSelect = document.getElementById("tm-task-project");
const taskTeamSelect = document.getElementById("tm-task-team");
const taskAssigneeSelect = document.getElementById("tm-task-assignee");
const taskTagsContainer = document.getElementById("tm-task-tags");
const taskDueInput = document.getElementById("tm-task-due");
const taskWeekInput = document.getElementById("tm-task-week");
const taskBlockedSelect = document.getElementById("tm-task-blocked");
const taskBlockedNotesField = document.getElementById("tm-task-blocked-notes-field");
const taskBlockedNotesInput = document.getElementById("tm-task-blocked-notes");
const taskDeleteBtn = document.getElementById("tm-task-delete");
const taskCancelBtn = document.getElementById("tm-task-cancel");

// ---- cached lists ----

let statuses = [];
let tags = [];
let people = [];
let projects = [];
let teams = [];
let savedViews = [];
let editingTaskId = null;

function byId(list, id) {
  return list.find((x) => x.id === id);
}

function populateSelect(select, items, { includeEmpty = true, emptyLabel = "Any" } = {}) {
  const current = select.value;
  select.innerHTML = "";
  if (includeEmpty) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = emptyLabel;
    select.appendChild(opt);
  }
  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
  if (items.some((i) => i.id === current)) select.value = current;
}

// ---- loading shared lists ----

async function loadLists() {
  [statuses, tags, people, projects, teams, savedViews] = await Promise.all([
    tm.listStatuses(),
    tm.listTags(),
    tm.listPeople(),
    tm.listProjects(),
    tm.listTeams(),
    tm.listSavedViews(),
  ]);

  populateSelect(filterStatus, statuses, { emptyLabel: "Any" });
  populateSelect(filterProject, projects, { emptyLabel: "Any" });
  populateSelect(filterAssignee, people, { emptyLabel: "Any" });
  populateSelect(filterTag, tags, { emptyLabel: "Any" });

  populateSelect(taskProjectSelect, projects, { emptyLabel: "None" });
  populateSelect(taskTeamSelect, teams, { emptyLabel: "None" });
  populateSelect(taskAssigneeSelect, people, { emptyLabel: "Unassigned" });
  populateSelect(taskStatusSelect, statuses, { includeEmpty: false });

  renderViewSelect();
  renderManagePanel();
}

function renderViewSelect() {
  const current = viewSelect.value;
  viewSelect.innerHTML = '<option value="">— none —</option>';
  savedViews.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.is_default ? `${v.name} (default)` : v.name;
    viewSelect.appendChild(opt);
  });
  if (savedViews.some((v) => v.id === current)) viewSelect.value = current;
}

// ---- manage lists panel (tags/people/projects/teams) ----

const MANAGE_TABLES = {
  tags: { list: () => tags, container: "tm-list-tags", update: tm.updateTag, del: tm.deleteTag },
  people: { list: () => people, container: "tm-list-people", update: tm.updatePerson, del: tm.deletePerson },
  projects: { list: () => projects, container: "tm-list-projects", update: tm.updateProject, del: tm.deleteProject },
  teams: { list: () => teams, container: "tm-list-teams", update: tm.updateTeam, del: tm.deleteTeam },
};

function renderManagePanel() {
  for (const [key, cfg] of Object.entries(MANAGE_TABLES)) {
    const container = document.getElementById(cfg.container);
    container.innerHTML = "";
    cfg.list().forEach((item) => container.appendChild(renderManageChip(key, item, cfg)));
  }
}

function renderManageChip(key, item, cfg) {
  const chip = document.createElement("span");
  chip.className =
    "inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-200";

  const name = document.createElement("span");
  name.textContent = item.name;
  name.className = "cursor-text";
  name.title = "Click to rename";
  name.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = item.name;
    input.className = "text-xs border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded px-1 w-24";
    async function commit() {
      const value = input.value.trim();
      if (value && value !== item.name) {
        await cfg.update(item.id, { name: value });
        await loadLists();
        await loadTasks();
      } else {
        renderManagePanel();
      }
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => e.key === "Enter" && input.blur());
    name.replaceWith(input);
    input.focus();
  });

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "×";
  del.className = "text-red-500";
  del.addEventListener("click", async () => {
    await cfg.del(item.id);
    await loadLists();
    await loadTasks();
  });

  chip.append(name, del);
  return chip;
}

document.querySelectorAll(".tm-add-form").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const name = input.value.trim();
    if (!name) return;
    const table = form.dataset.list;
    const create = { tags: tm.createTag, people: tm.createPerson, projects: tm.createProject, teams: tm.createTeam }[table];
    await create({ name });
    input.value = "";
    await loadLists();
  });
});

manageToggle.addEventListener("click", () => managePanel.classList.toggle("hidden"));

// ---- filters ----

function currentFilters() {
  const filters = {};
  if (filterStatus.value) filters.statusId = filterStatus.value;
  if (filterProject.value) filters.projectId = filterProject.value;
  if (filterAssignee.value) filters.assigneeId = filterAssignee.value;
  if (filterTag.value) filters.tagId = filterTag.value;
  if (filterWeek.value) filters.weekStartDate = toISODate(startOfWeek(parseISODate(filterWeek.value)));
  if (filterFrom.value) filters.dateFrom = filterFrom.value;
  if (filterTo.value) filters.dateTo = filterTo.value;
  return filters;
}

function applyFiltersToControls(filters) {
  filterStatus.value = filters.statusId ?? "";
  filterProject.value = filters.projectId ?? "";
  filterAssignee.value = filters.assigneeId ?? "";
  filterTag.value = filters.tagId ?? "";
  filterWeek.value = filters.weekStartDate ?? "";
  filterFrom.value = filters.dateFrom ?? "";
  filterTo.value = filters.dateTo ?? "";
}

[filterStatus, filterProject, filterAssignee, filterTag, filterWeek, filterFrom, filterTo].forEach((el) =>
  el.addEventListener("change", loadTasks),
);

filterClear.addEventListener("click", () => {
  applyFiltersToControls({});
  loadTasks();
});

// ---- saved views ----

viewSelect.addEventListener("change", () => {
  const view = byId(savedViews, viewSelect.value);
  applyFiltersToControls(view ? view.filters : {});
  loadTasks();
});

viewSaveBtn.addEventListener("click", async () => {
  const name = viewNameInput.value.trim();
  if (!name) return;
  const { data } = await tm.createSavedView({ name, filters: currentFilters(), is_default: false });
  viewNameInput.value = "";
  await loadLists();
  if (data) viewSelect.value = data.id;
});

viewDefaultBtn.addEventListener("click", async () => {
  if (!viewSelect.value) return;
  await tm.setDefaultSavedView(viewSelect.value);
  await loadLists();
  viewSelect.value = viewSelect.value;
});

viewDeleteBtn.addEventListener("click", async () => {
  if (!viewSelect.value) return;
  await tm.deleteSavedView(viewSelect.value);
  viewSelect.value = "";
  await loadLists();
});

// ---- board rendering ----

async function loadTasks() {
  const tasks = await tm.listTasks(currentFilters());
  renderBoard(tasks);
}

const PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
const PRIORITY_COLOR = { low: "text-gray-400", medium: "text-gray-600 dark:text-gray-300", high: "text-orange-500", urgent: "text-red-500" };
const BLOCKED_LABEL = { needs_clarification: "Needs clarification", tech_difficulty: "Tech difficulty", other: "Blocked" };

function renderBoard(tasks) {
  board.innerHTML = "";

  statuses.forEach((status, index) => {
    const columnTasks = tasks.filter((t) => t.status_id === status.id);
    board.appendChild(renderColumn(status, columnTasks, index));
  });

  board.appendChild(renderAddColumn());
}

function renderColumn(status, columnTasks, index) {
  const col = document.createElement("div");
  col.className = "w-64 shrink-0 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col max-h-[70vh]";

  const header = document.createElement("div");
  header.className = "flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800";

  const titleWrap = document.createElement("span");
  titleWrap.className = "flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white min-w-0";

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = status.color;
  colorInput.title = "Column color";
  colorInput.className = "w-2.5 h-2.5 rounded-full shrink-0 border-0 p-0 cursor-pointer appearance-none";
  colorInput.addEventListener("input", async () => {
    await tm.updateStatus(status.id, { color: colorInput.value });
    status.color = colorInput.value;
    loadTasks();
  });

  const nameEl = document.createElement("span");
  nameEl.className = "truncate cursor-text";
  nameEl.title = "Click to rename";
  nameEl.textContent = status.name;
  nameEl.addEventListener("click", () => startRenameStatus(nameEl, status));
  const count = document.createElement("span");
  count.className = "text-xs text-gray-400 dark:text-gray-500 shrink-0";
  count.textContent = columnTasks.length;
  titleWrap.append(colorInput, nameEl, count);
  header.appendChild(titleWrap);

  const kebabWrap = document.createElement("div");
  kebabWrap.className = "relative shrink-0";
  const kebabBtn = document.createElement("button");
  kebabBtn.type = "button";
  kebabBtn.className = "icon-btn w-6 h-6";
  kebabBtn.setAttribute("aria-label", "Column actions");
  kebabBtn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>`;
  const menu = document.createElement("div");
  menu.className =
    "hidden absolute right-0 top-full mt-1 z-10 w-36 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg py-1";
  menu.innerHTML = `
    <button type="button" data-action="left" class="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">Move left</button>
    <button type="button" data-action="right" class="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">Move right</button>
    <button type="button" data-action="delete" class="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800">Delete</button>
  `;
  function closeMenu() {
    menu.classList.add("hidden");
    document.removeEventListener("click", onDocClick);
  }
  function onDocClick(e) {
    if (!kebabWrap.contains(e.target)) closeMenu();
  }
  kebabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = menu.classList.contains("hidden");
    menu.classList.toggle("hidden");
    if (wasHidden) document.addEventListener("click", onDocClick);
    else document.removeEventListener("click", onDocClick);
  });
  menu.querySelector('[data-action="left"]').addEventListener("click", async () => {
    closeMenu();
    if (index > 0) {
      const ids = statuses.map((s) => s.id);
      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
      await tm.reorderStatuses(ids);
      await loadLists();
      await loadTasks();
    }
  });
  menu.querySelector('[data-action="right"]').addEventListener("click", async () => {
    closeMenu();
    if (index < statuses.length - 1) {
      const ids = statuses.map((s) => s.id);
      [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
      await tm.reorderStatuses(ids);
      await loadLists();
      await loadTasks();
    }
  });
  menu.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    closeMenu();
    await tm.deleteStatus(status.id);
    await loadLists();
    await loadTasks();
  });
  kebabWrap.append(kebabBtn, menu);
  header.appendChild(kebabWrap);
  col.appendChild(header);

  const list = document.createElement("div");
  list.className = "flex-1 overflow-y-auto p-2 space-y-2";
  columnTasks.forEach((task) => list.appendChild(renderCard(task)));
  col.appendChild(list);

  const quickAdd = document.createElement("form");
  quickAdd.className = "p-2 border-t border-gray-200 dark:border-gray-800";
  quickAdd.innerHTML = `<input type="text" placeholder="+ Add task" class="w-full text-sm bg-transparent placeholder:text-gray-400 focus:outline-none" />`;
  quickAdd.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = quickAdd.querySelector("input");
    const title = input.value.trim();
    if (!title) return;
    await tm.createTask({ title, status_id: status.id, priority: "medium" });
    input.value = "";
    await loadTasks();
  });
  col.appendChild(quickAdd);

  return col;
}

function renderCard(task) {
  const card = document.createElement("div");
  card.className =
    "rounded-md border border-gray-200 dark:border-gray-800 p-2 text-sm cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors";
  card.addEventListener("click", () => openTaskModal(task));

  const title = document.createElement("p");
  title.className = "font-medium text-gray-900 dark:text-white mb-1";
  title.textContent = task.title;
  card.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "flex items-center gap-2 flex-wrap text-xs";

  const priority = document.createElement("span");
  priority.className = PRIORITY_COLOR[task.priority];
  priority.textContent = PRIORITY_LABEL[task.priority];
  meta.appendChild(priority);

  const assignee = task.assignee_id && byId(people, task.assignee_id);
  if (assignee) {
    const el = document.createElement("span");
    el.className = "text-gray-500 dark:text-gray-400";
    el.textContent = `· ${assignee.name}`;
    meta.appendChild(el);
  }

  if (task.blocked_reason) {
    const el = document.createElement("span");
    el.className = "text-red-500";
    el.textContent = `⚑ ${BLOCKED_LABEL[task.blocked_reason]}`;
    meta.appendChild(el);
  }

  card.appendChild(meta);

  if (task.tagIds?.length) {
    const tagsRow = document.createElement("div");
    tagsRow.className = "flex flex-wrap gap-1 mt-1.5";
    task.tagIds.forEach((tagId) => {
      const tag = byId(tags, tagId);
      if (!tag) return;
      const pill = document.createElement("span");
      pill.className = "text-xs px-1.5 py-0.5 rounded-full text-white";
      pill.style.background = tag.color;
      pill.textContent = tag.name;
      tagsRow.appendChild(pill);
    });
    card.appendChild(tagsRow);
  }

  return card;
}

function renderAddColumn() {
  const col = document.createElement("div");
  col.className = "w-48 shrink-0";
  const form = document.createElement("form");
  form.className = "rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 flex gap-2 items-center";
  form.innerHTML = `
    <input type="color" value="#6b7280" class="w-5 h-5 rounded-full shrink-0 border-0 p-0 cursor-pointer" />
    <input type="text" placeholder="+ Add status column" class="flex-1 min-w-0 text-sm bg-transparent placeholder:text-gray-400 focus:outline-none" />
  `;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const [colorInput, nameInput] = form.querySelectorAll("input");
    const name = nameInput.value.trim();
    if (!name) return;
    await tm.createStatus({ name, color: colorInput.value, sort_order: statuses.length });
    nameInput.value = "";
    await loadLists();
    await loadTasks();
  });
  col.appendChild(form);
  return col;
}

function startRenameStatus(nameEl, status) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = status.name;
  input.className = "text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded px-1 min-w-0 flex-1";

  async function commit() {
    const value = input.value.trim();
    if (value && value !== status.name) {
      await tm.updateStatus(status.id, { name: value });
      await loadLists();
      await loadTasks();
    } else {
      input.replaceWith(nameEl); // unchanged/empty — restore without a full re-render
    }
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => e.key === "Enter" && input.blur());
  nameEl.replaceWith(input);
  input.focus();
}

// ---- task detail modal ----

function renderTaskTagCheckboxes(selectedIds) {
  taskTagsContainer.innerHTML = "";
  tags.forEach((tag) => {
    const label = document.createElement("label");
    label.className = "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-800 cursor-pointer";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = tag.id;
    checkbox.checked = selectedIds.includes(tag.id);
    checkbox.className = "w-3 h-3 accent-black dark:accent-white";
    label.append(checkbox, document.createTextNode(tag.name));
    taskTagsContainer.appendChild(label);
  });
}

function openTaskModal(task) {
  editingTaskId = task?.id ?? null;
  modalTitle.textContent = task ? "Edit task" : "New task";
  taskDeleteBtn.classList.toggle("hidden", !task);

  taskTitleInput.value = task?.title ?? "";
  taskDescriptionInput.value = task?.description ?? "";
  taskStatusSelect.value = task?.status_id ?? statuses[0]?.id ?? "";
  taskPrioritySelect.value = task?.priority ?? "medium";
  taskProjectSelect.value = task?.project_id ?? "";
  taskTeamSelect.value = task?.team_id ?? "";
  taskAssigneeSelect.value = task?.assignee_id ?? "";
  taskDueInput.value = task?.due_date ?? "";
  taskWeekInput.value = task?.week_start_date ?? "";
  taskBlockedSelect.value = task?.blocked_reason ?? "";
  taskBlockedNotesInput.value = task?.blocked_notes ?? "";
  taskBlockedNotesField.classList.toggle("hidden", !taskBlockedSelect.value);

  renderTaskTagCheckboxes(task?.tagIds ?? []);
  taskModal.classList.remove("hidden");
}

function closeTaskModal() {
  taskModal.classList.add("hidden");
  editingTaskId = null;
}

taskBlockedSelect.addEventListener("change", () => {
  taskBlockedNotesField.classList.toggle("hidden", !taskBlockedSelect.value);
});

newTaskBtn.addEventListener("click", () => openTaskModal(null));
taskCancelBtn.addEventListener("click", closeTaskModal);

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fields = {
    title: taskTitleInput.value.trim(),
    description: taskDescriptionInput.value.trim() || null,
    status_id: taskStatusSelect.value || null,
    priority: taskPrioritySelect.value,
    project_id: taskProjectSelect.value || null,
    team_id: taskTeamSelect.value || null,
    assignee_id: taskAssigneeSelect.value || null,
    due_date: taskDueInput.value || null,
    week_start_date: taskWeekInput.value ? toISODate(startOfWeek(parseISODate(taskWeekInput.value))) : null,
    blocked_reason: taskBlockedSelect.value || null,
    blocked_notes: taskBlockedSelect.value ? taskBlockedNotesInput.value.trim() || null : null,
  };

  if (!fields.title) return;

  const selectedTagIds = Array.from(taskTagsContainer.querySelectorAll("input:checked")).map((el) => el.value);

  let taskId = editingTaskId;
  if (taskId) {
    await tm.updateTask(taskId, fields);
  } else {
    const { data } = await tm.createTask(fields);
    taskId = data?.id;
  }
  if (taskId) await tm.setTaskTags(taskId, selectedTagIds);

  closeTaskModal();
  loadTasks();
});

taskDeleteBtn.addEventListener("click", async () => {
  if (!editingTaskId) return;
  await tm.deleteTask(editingTaskId);
  closeTaskModal();
  loadTasks();
});

// ---- auth gate ----

async function init() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    signedOutMessage.classList.remove("hidden");
    app.classList.add("hidden");
    return;
  }

  signedOutMessage.classList.add("hidden");
  app.classList.remove("hidden");

  await loadLists();

  const defaultView = await tm.getDefaultSavedView();
  if (defaultView) {
    viewSelect.value = defaultView.id;
    applyFiltersToControls(defaultView.filters);
  }

  loadTasks();
}

supabase.auth.onAuthStateChange(() => init());
init();
