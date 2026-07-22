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

function makeKeyBox(value) {
  const box = document.createElement("div");
  box.className = "key-box";
  box.textContent = value;
  box.title = "Click to copy";
  box.addEventListener("click", async () => {
    await navigator.clipboard.writeText(value);
    box.textContent = "Copied ✓";
    setTimeout(() => (box.textContent = value), 900);
  });
  return box;
}

function generateSection(id, count, len, hex = false) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  for (let i = 0; i < count; i++) {
    el.appendChild(makeKeyBox(hex ? hexBytes(len) : randomString(len)));
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
  const input = document.getElementById("customByteLength");
  const error = document.getElementById("customByteError");
  const len = parseInt(input.value, 10);

  if (!len || len <= 0) {
    error.classList.remove("hidden");
    return;
  }
  error.classList.add("hidden");

  const el = document.getElementById("customBytes");
  el.innerHTML = "";
  el.appendChild(makeKeyBox(hexBytes(len)));
}

document.getElementById("generate-all")?.addEventListener("click", generateAll);
document.getElementById("generate-custom")?.addEventListener("click", generateCustomBytes);

generateAll();
