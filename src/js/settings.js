import { supabase } from "./supabase-client.js";
import { getProfile, updateProfile } from "./profile.js";

const signedOutMessage = document.getElementById("signed-out-message");
const form = document.getElementById("settings-form");
const firstNameInput = document.getElementById("settings-first-name");
const lastNameInput = document.getElementById("settings-last-name");
const message = document.getElementById("settings-message");
const formatTabs = document.querySelectorAll(".format-tab");

const selected = { date_format: "us", time_format: "12h" };

formatTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const field = tab.dataset.field;
    document.querySelectorAll(`.format-tab[data-field="${field}"]`).forEach((t) => t.setAttribute("data-active", "false"));
    tab.setAttribute("data-active", "true");
    selected[field] = tab.dataset.value;
  });
});

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `text-sm ${type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`;
  message.classList.remove("hidden");
}

function selectTab(field, value) {
  document.querySelectorAll(`.format-tab[data-field="${field}"]`).forEach((t) => {
    t.setAttribute("data-active", String(t.dataset.value === value));
  });
  selected[field] = value;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  if (!firstName || !lastName) {
    showMessage("First name and last name are required.");
    return;
  }

  const { error } = await updateProfile({
    first_name: firstName,
    last_name: lastName,
    date_format: selected.date_format,
    time_format: selected.time_format,
  });

  if (error) showMessage(error.message);
  else showMessage("Saved.", "success");
});

async function init() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    signedOutMessage.classList.remove("hidden");
    form.classList.add("hidden");
    return;
  }

  signedOutMessage.classList.add("hidden");
  form.classList.remove("hidden");

  const profile = await getProfile();
  if (!profile) return;

  firstNameInput.value = profile.first_name;
  lastNameInput.value = profile.last_name;
  selectTab("date_format", profile.date_format ?? "us");
  selectTab("time_format", profile.time_format ?? "12h");
}

supabase.auth.onAuthStateChange(() => init());
init();
