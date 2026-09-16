export const bratislavaTimeZone = "Europe/Bratislava";

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: bratislavaTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function bratislavaDateKey(date: Date) {
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function fromBratislavaLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return null;
  const wanted = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] ?? 0), Number(match[5] ?? 0));
  let guess = new Date(wanted);
  for (let index = 0; index < 3; index += 1) {
    const actual = zonedParts(guess);
    const actualUtc = Date.UTC(Number(actual.year), Number(actual.month) - 1, Number(actual.day), Number(actual.hour), Number(actual.minute));
    guess = new Date(guess.getTime() + wanted - actualUtc);
  }
  return Number.isNaN(guess.getTime()) ? null : guess;
}

function addLocalDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

export function nextBratislavaDayStart(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  return fromBratislavaLocal(addLocalDays(dateKey, 1));
}

export type PeriodKey = "today" | "7d" | "30d" | "month" | "custom";

export function resolvePeriod(period: string | undefined, from?: string, to?: string, now = new Date()) {
  const key: PeriodKey = ["today", "7d", "30d", "month", "custom"].includes(period ?? "") ? period as PeriodKey : "30d";
  const today = bratislavaDateKey(now);
  let startKey = addLocalDays(today, -29);
  let endKey = today;
  if (key === "today") startKey = today;
  if (key === "7d") startKey = addLocalDays(today, -6);
  if (key === "month") startKey = `${today.slice(0, 8)}01`;
  if (key === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(to ?? "") && from! <= to!) {
    startKey = from!;
    endKey = to!;
  }
  return {
    key,
    from: startKey,
    to: endKey,
    start: fromBratislavaLocal(startKey)!,
    end: fromBratislavaLocal(`${addLocalDays(endKey, 1)}`)!,
  };
}

export function formatDateTimeLocal(date: Date | null) {
  if (!date) return "";
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatBratislavaDateTime(date: Date) {
  return new Intl.DateTimeFormat("sk-SK", { dateStyle: "medium", timeStyle: "short", timeZone: bratislavaTimeZone }).format(date);
}
