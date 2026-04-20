// ================= NAV ===============================
function toggleMenu() {
  document.getElementById("mobile-menu")?.classList.toggle("hidden");
}

function toggleProjectsDropdown() {
  document.getElementById("projects-dropdown")?.classList.toggle("hidden");
}

document.addEventListener("click", function (event) {
  const dropdown = document.getElementById("projects-dropdown");

  if (
    dropdown &&
    !event.target.closest("#projects-dropdown") &&
    !event.target.closest("button")
  ) {
    dropdown.classList.add("hidden");
  }
});
//------------------------------------------------------------

// ================= TIME CALCULATOR =================

let is24 = false;

function toggleTimeFormat() {
  is24 = document.getElementById("timeFormat").checked;
  calculate();
}

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function format24(m) {
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function format12(m) {
  let h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ap}`;
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h ? h + " hr " : ""}${m ? m + " min" : ""}`;
}

function calculate() {
  const worked = document.getElementById("worked").value;
  const lastIn = document.getElementById("lastIn").value;

  if (!worked || !lastIn) {
    alert("Enter both fields");
    return;
  }

  const remaining = 480 - toMin(worked);

  if (remaining <= 0) {
    show("✅ You already completed 8 hours");
    return;
  }

  const completion = toMin(lastIn) + remaining;

  show(`
        <div class="result-toggle">
          <label class="switch">
            <input type="checkbox" id="timeFormat" onchange="toggleTimeFormat()" ${is24 ? "checked" : ""}/>
            <span class="slider"></span>
          </label>
          <span>24 hrs</span>
        </div>

        <div style="font-size:14px;">You can leave at</div>

        <div class="big">
          ${is24 ? format24(completion) : format12(completion)}
        </div>

        <div style="margin-top:10px; font-size:14px;">
          ⌛ ${formatDuration(remaining)} remaining
        </div>
      `);
}

function show(html) {
  const el = document.getElementById("output");
  el.style.display = "block";
  el.innerHTML = html;
}

// ================= ORIGINAL LOGIC (UNCHANGED) =================

const charset =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:<>,.?";

function randomString(length) {
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  array.forEach((val) => (result += charset[val % charset.length]));
  return result;
}

function hexBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function generateSection(id, count, len, hex = false) {
  const el = document.getElementById(id);
  el.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const box = document.createElement("div");
    box.className = "key-box";
    box.textContent = hex ? hexBytes(len) : randomString(len);
    el.appendChild(box);
  }
}

function generateAll() {
  generateSection("memorable", 4, 10);
  generateSection("strong", 4, 18);
  generateSection("fortknox", 2, 24);
  generateSection("codeigniter", 2, 32);
  generateSection("wpa160", 2, 20, true);
  generateSection("wpa504", 2, 63, true);
  generateSection("wep64", 2, 5, true);
  generateSection("wep128", 2, 13, true);
  generateSection("wep152", 2, 16, true);
  generateSection("wep256", 2, 32, true);
}

function generateCustomBytes() {
  const len = parseInt(document.getElementById("customByteLength").value);
  if (!len || len <= 0) return alert("Enter valid length");

  const el = document.getElementById("customBytes");
  el.innerHTML = "";

  const box = document.createElement("div");
  box.className = "key-box";
  box.textContent = hexBytes(len);

  el.appendChild(box);
}

// Theme Logic

// Apply saved theme on load
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("theme") || "light";

  if (saved === "dark") {
    document.documentElement.classList.add("dark");
    document.getElementById("themeToggle")?.setAttribute("checked", true);
  }
});

// Toggle Theme
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");

  localStorage.setItem("theme", isDark ? "dark" : "light");

  // Monaco theme switch
  if (window.monaco && window.editor) {
    monaco.editor.setTheme(isDark ? "vs-dark" : "vs");
  }
}

const isDark = document.documentElement.classList.contains("dark");

editor = monaco.editor.create(document.getElementById("editor"), {
  value: `{ "userId": 1 }`,
  language: "json",
  theme: isDark ? "vs-dark" : "vs",
  automaticLayout: true,
  fontSize: 14,
  minimap: { enabled: false },
});