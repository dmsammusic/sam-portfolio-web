function toMin(t) {
  if (!t.includes(":")) return Number(t) * 60;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesNow() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
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
  return `${h ? h + " hr " : ""}${m ? m + " min" : ""}`.trim();
}

// Auto-inserts the ":" as the user types digits: "745" -> "7:45", "0545" -> "05:45".
function formatWorkedInput(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

const workedInput = document.getElementById("worked");
const lastOutField = document.getElementById("lastout-field");
const modeLastOut = document.getElementById("mode-lastout");
const modeNow = document.getElementById("mode-now");
const output = document.getElementById("output");
const outputTime = document.getElementById("output-time");
const outputRemaining = document.getElementById("output-remaining");
const formatToggle = document.getElementById("format-toggle");
const errorMsg = document.getElementById("error-msg");

let is24 = false;
let mode = "lastout"; // "lastout" | "now" — which reference point to calculate completion from
let completion = null; // absolute target minute-of-day for leaving; fixed once calculated

workedInput?.addEventListener("input", () => {
  workedInput.value = formatWorkedInput(workedInput.value);
});

function setMode(next) {
  mode = next;
  modeLastOut.setAttribute("data-active", String(mode === "lastout"));
  modeNow.setAttribute("data-active", String(mode === "now"));
  lastOutField.classList.toggle("hidden", mode !== "lastout");
  errorMsg.classList.add("hidden");
  output.classList.add("hidden");
  completion = null;
}

modeLastOut?.addEventListener("click", () => setMode("lastout"));
modeNow?.addEventListener("click", () => setMode("now"));

// Remaining time is measured against the actual current clock every time this
// runs, so it counts down correctly even if you leave the page open and check
// back later — it never freezes at whatever it was when you clicked Calculate.
function renderResult() {
  if (completion == null) return;
  output.classList.remove("hidden");

  const remaining = completion - minutesNow();

  if (remaining <= 0) {
    formatToggle.classList.add("hidden");
    outputTime.textContent = "✅ Done";
    outputRemaining.textContent = "You already completed 8 hours.";
    return;
  }

  formatToggle.classList.remove("hidden");
  formatToggle.textContent = is24 ? "12-hr" : "24-hr";
  outputTime.textContent = is24 ? format24(completion) : format12(completion);
  outputRemaining.textContent = `⌛ ${formatDuration(remaining)} remaining`;
}

function calculate() {
  const worked = workedInput.value;
  const lastIn = document.getElementById("lastIn").value;

  if (!worked || (mode === "lastout" && !lastIn)) {
    errorMsg.textContent = mode === "lastout" ? "Enter both fields." : "Enter your worked hours.";
    errorMsg.classList.remove("hidden");
    return;
  }
  errorMsg.classList.add("hidden");

  const base = mode === "lastout" ? toMin(lastIn) : minutesNow();
  completion = base + (480 - toMin(worked));
  renderResult();
}

formatToggle?.addEventListener("click", () => {
  is24 = !is24;
  renderResult();
});

document.getElementById("calculate")?.addEventListener("click", calculate);

setInterval(renderResult, 30000);
