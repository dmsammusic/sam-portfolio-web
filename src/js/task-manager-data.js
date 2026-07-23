import { supabase } from "./supabase-client.js";

// The dedicated data-access module for the Task Manager (issue #6) — every Supabase
// call for this feature goes through here, unlike todo.js/insights.js which inline
// supabase.from(...) directly. This is what lets task-manager.js's rendering/filtering
// logic be tested against a stubbed version of this module instead of a live database.

async function currentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

// ---- manageable lists: statuses, tags, people, projects, teams ----
// All five share the same shape (id, name, color[, sort_order]), so one set of
// generic helpers backs all of them instead of five near-identical copies.

function listRows(table, orderBy = "created_at") {
  return supabase.from(table).select("*").order(orderBy, { ascending: true }).then(({ data }) => data ?? []);
}

async function createRow(table, fields) {
  const user_id = await currentUserId();
  return supabase.from(table).insert({ ...fields, user_id }).select().single();
}

function updateRow(table, id, fields) {
  return supabase.from(table).update(fields).eq("id", id);
}

function deleteRow(table, id) {
  return supabase.from(table).delete().eq("id", id);
}

export const listStatuses = () => listRows("statuses", "sort_order");
export const createStatus = (fields) => createRow("statuses", fields);
export const updateStatus = (id, fields) => updateRow("statuses", id, fields);
export const deleteStatus = (id) => deleteRow("statuses", id);

export async function reorderStatuses(orderedIds) {
  await Promise.all(orderedIds.map((id, index) => updateRow("statuses", id, { sort_order: index })));
}

export const listTags = () => listRows("tags");
export const createTag = (fields) => createRow("tags", fields);
export const updateTag = (id, fields) => updateRow("tags", id, fields);
export const deleteTag = (id) => deleteRow("tags", id);

export const listPeople = () => listRows("people");
export const createPerson = (fields) => createRow("people", fields);
export const updatePerson = (id, fields) => updateRow("people", id, fields);
export const deletePerson = (id) => deleteRow("people", id);

export const listProjects = () => listRows("projects");
export const createProject = (fields) => createRow("projects", fields);
export const updateProject = (id, fields) => updateRow("projects", id, fields);
export const deleteProject = (id) => deleteRow("projects", id);

export const listTeams = () => listRows("teams");
export const createTeam = (fields) => createRow("teams", fields);
export const updateTeam = (id, fields) => updateRow("teams", id, fields);
export const deleteTeam = (id) => deleteRow("teams", id);

// ---- tasks ----

// `filters`: { statusId, weekStartDate, dateFrom, dateTo, projectId, assigneeId, tagId }
// — any subset, combined with AND. Returns tasks with their tag ids attached as `tagIds`.
export async function listTasks(filters = {}) {
  let query = supabase.from("tasks").select("*, task_tags(tag_id)").order("created_at", { ascending: true });

  if (filters.statusId) query = query.eq("status_id", filters.statusId);
  if (filters.weekStartDate) query = query.eq("week_start_date", filters.weekStartDate);
  if (filters.dateFrom) query = query.gte("due_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("due_date", filters.dateTo);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.assigneeId) query = query.eq("assignee_id", filters.assigneeId);

  const { data, error } = await query;
  if (error) return [];

  let tasks = (data ?? []).map((t) => ({ ...t, tagIds: (t.task_tags ?? []).map((tt) => tt.tag_id) }));

  if (filters.tagId) tasks = tasks.filter((t) => t.tagIds.includes(filters.tagId));

  return tasks;
}

export async function createTask(fields) {
  const user_id = await currentUserId();
  return supabase.from("tasks").insert({ ...fields, user_id }).select().single();
}

export function updateTask(id, fields) {
  return supabase.from("tasks").update(fields).eq("id", id);
}

export function deleteTask(id) {
  return supabase.from("tasks").delete().eq("id", id);
}

// Replaces every tag on a task with exactly this set — simplest correct approach for a
// personal tool with a handful of tags per task, avoids diffing add/remove sets.
export async function setTaskTags(taskId, tagIds) {
  await supabase.from("task_tags").delete().eq("task_id", taskId);
  if (tagIds.length === 0) return;
  await supabase.from("task_tags").insert(tagIds.map((tag_id) => ({ task_id: taskId, tag_id })));
}

// ---- saved views ----

export const listSavedViews = () => listRows("saved_views");
export const deleteSavedView = (id) => deleteRow("saved_views", id);

export async function createSavedView(fields) {
  const user_id = await currentUserId();
  return supabase.from("saved_views").insert({ ...fields, user_id }).select().single();
}

// Sets `isDefault` on `id` and clears it on every other saved view, since only one
// default is allowed per user (enforced by a partial unique index in the schema too).
export async function setDefaultSavedView(id) {
  const views = await listSavedViews();
  await Promise.all(
    views.filter((v) => v.is_default && v.id !== id).map((v) => updateRow("saved_views", v.id, { is_default: false })),
  );
  return updateRow("saved_views", id, { is_default: true });
}

export async function getDefaultSavedView() {
  const views = await listSavedViews();
  return views.find((v) => v.is_default) ?? null;
}
