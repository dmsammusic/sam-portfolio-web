// Shared by todo.js and insights.js. Always work in local calendar time — never route a
// "YYYY-MM-DD" string through `new Date(string)`, which parses as UTC and can shift the
// displayed day by one depending on the viewer's timezone.

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startOfWeek(d) {
  const day = d.getDay(); // 0 = Sun ... 6 = Sat
  const offset = day === 0 ? -6 : 1 - day; // shift back to Monday
  return addDays(d, offset);
}

export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// `format` is the user's stored date_format preference ("us" | "intl") — "us" reads
// Month Day ("Jul 22"), "intl" reads Day Month ("22 Jul"). Using en-US/en-GB gets that
// ordering from Intl directly rather than hand-building format strings ourselves; both
// stay in English, this isn't a translation switch.
export function formatShort(d, format = "us") {
  return d.toLocaleDateString(format === "intl" ? "en-GB" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDay(d, format = "us") {
  return d.toLocaleDateString(format === "intl" ? "en-GB" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function isSameDay(a, b) {
  return toISODate(a) === toISODate(b);
}

// `today` defaults to now but can be passed explicitly for testability.
export function calculateAge(dateOfBirth, today = new Date()) {
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() && today.getDate() >= dateOfBirth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}
