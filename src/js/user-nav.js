import { supabase } from "./supabase-client.js";
import { getProfile } from "./profile.js";
import { createDismissibleMenu } from "./dismissible-menu.js";

const navUser = document.getElementById("nav-user");
const navProfileBtn = document.getElementById("nav-profile-btn");
const navProfileMenu = document.getElementById("nav-profile-menu");
const navProfileFullname = document.getElementById("nav-profile-fullname");
const navProfileUsername = document.getElementById("nav-profile-username");
const navLogout = document.getElementById("nav-logout");

navLogout?.addEventListener("click", () => supabase.auth.signOut());

const profileMenu = createDismissibleMenu(navUser, navProfileBtn, navProfileMenu);

const toast = document.getElementById("onboarding-toast");
const toastOpen = document.getElementById("onboarding-toast-open");
const toastDismiss = document.getElementById("onboarding-toast-dismiss");

const modal = document.getElementById("onboarding-modal");
const form = document.getElementById("onboarding-form");
const firstNameInput = document.getElementById("onboarding-first-name");
const lastNameInput = document.getElementById("onboarding-last-name");
const usernameInput = document.getElementById("onboarding-username");
const usernameStatus = document.getElementById("onboarding-username-status");
const message = document.getElementById("onboarding-message");
const cancelBtn = document.getElementById("onboarding-cancel");

const DISMISS_KEY = "onboarding-toast-dismissed";

function showNavUser(profile) {
  navProfileFullname.textContent = `${profile.first_name} ${profile.last_name}`;
  navProfileUsername.textContent = `@${profile.username}`;
  navUser.classList.remove("hidden");
}

function hideNavUser() {
  navUser.classList.add("hidden");
  profileMenu.close();
}

function openModal() {
  toast?.classList.add("hidden");
  modal?.classList.remove("hidden");
}

function closeModal() {
  modal?.classList.add("hidden");
}

toastOpen?.addEventListener("click", openModal);
cancelBtn?.addEventListener("click", closeModal);

toastDismiss?.addEventListener("click", () => {
  toast.classList.add("hidden");
  sessionStorage.setItem(DISMISS_KEY, "1");
});

let usernameCheckTimer;
let usernameAvailable = false;

usernameInput?.addEventListener("input", () => {
  const username = usernameInput.value.trim();
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

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.classList.add("hidden");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const username = usernameInput.value.trim();

  if (!firstName || !lastName || !username) {
    message.textContent = "First name, last name, and username are all required.";
    message.classList.remove("hidden");
    return;
  }
  if (username.length <= 3) {
    message.textContent = "Username must be more than 3 characters.";
    message.classList.remove("hidden");
    return;
  }
  if (!usernameAvailable) {
    message.textContent = "Choose an available username first.";
    message.classList.remove("hidden");
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .insert({ id: session.user.id, username, first_name: firstName, last_name: lastName });

  if (error) {
    message.textContent = error.message.includes("duplicate key")
      ? "That username was just taken — pick another one."
      : error.message;
    message.classList.remove("hidden");
    return;
  }

  closeModal();
  sessionStorage.removeItem(DISMISS_KEY);
  showNavUser({ first_name: firstName, last_name: lastName, username });
});

async function refreshUserNav() {
  if (!navUser) return; // partial not present on this page

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    hideNavUser();
    toast?.classList.add("hidden");
    return;
  }

  const profile = await getProfile();

  if (profile) {
    showNavUser(profile);
    toast?.classList.add("hidden");
  } else {
    hideNavUser();
    if (toast && sessionStorage.getItem(DISMISS_KEY) !== "1") {
      toast.classList.remove("hidden");
    }
  }
}

supabase.auth.onAuthStateChange(() => refreshUserNav());
refreshUserNav();
