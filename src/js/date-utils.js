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

export function formatShort(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatDay(d) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function isSameDay(a, b) {
  return toISODate(a) === toISODate(b);
}
