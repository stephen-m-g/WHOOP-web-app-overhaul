const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

export function isToday(key: string): boolean {
  return key === toDateKey(new Date());
}

export function isFutureDate(key: string): boolean {
  return parseDateKey(key).getTime() > parseDateKey(toDateKey(new Date())).getTime();
}

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function formatDayLabel(key: string): string {
  const date = parseDateKey(key);
  const datePart = `${MONTHS[date.getMonth()]} ${date.getDate()}${ordinalSuffix(date.getDate())}`;
  if (isToday(key)) return `Today, ${datePart}`;
  return `${WEEKDAYS[date.getDay()]}, ${datePart}`;
}

/** Midnight-to-midnight ISO range for the given calendar day, for Whoop API start/end params. */
export function dayRange(key: string): { start: string; end: string } {
  const start = parseDateKey(key);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Rolling `days`-day ISO range ending at (and including) the given calendar day. */
export function rangeSpan(endKey: string, days: number): { start: string; end: string } {
  const start = parseDateKey(endKey);
  start.setDate(start.getDate() - (days - 1));
  const end = parseDateKey(endKey);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Date keys for the `days` calendar days ending at (and including) the given day, oldest first. */
export function dateKeysInRange(endKey: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(endKey, i - (days - 1)));
}

export function formatShortDate(key: string): string {
  const date = parseDateKey(key);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function formatDuration(milli: number): string {
  const totalMinutes = Math.round(milli / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

/** "2h 15m" / "45m" — for durations expressed in hours (as opposed to formatDuration's H:MM). */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
