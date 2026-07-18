// Pure date/time helpers for GTFS scheduling in Europe/Dublin local time.
// Dependency-free so they can be unit-tested without the app/DB/network.

// YYYYMMDD for "today" in Dublin time.
export function todayYYYYMMDD(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Dublin" })
    .format(new Date())
    .replace(/-/g, "");
}

// Seconds elapsed since midnight in Dublin local time.
export function dublinSecsSinceMidnight(): number {
  const parts = new Intl.DateTimeFormat("en-IE", {
    timeZone: "Europe/Dublin",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value);
  return get("hour") * 3600 + get("minute") * 60 + get("second");
}

// GTFS scheduled arrival (seconds from midnight, local time) → Unix timestamp.
// Relies on the server running in Europe/Dublin (TZ=Europe/Dublin in production).
export function scheduledToUnix(arrivalSecs: number, startDate: string): number {
  const year = parseInt(startDate.slice(0, 4));
  const month = parseInt(startDate.slice(4, 6)) - 1;
  const day = parseInt(startDate.slice(6, 8));
  const midnightLocal = new Date(year, month, day, 0, 0, 0).getTime() / 1000;
  return midnightLocal + arrivalSecs;
}

// HH:MM for a Unix timestamp in the server's local time.
export function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// Whole minutes until an ETA (never negative).
export function minutesUntil(etaUnix: number, nowUnix: number): number {
  return Math.max(0, Math.floor((etaUnix - nowUnix) / 60));
}

// GTFS delay seconds → rounded minutes.
export function delayToMinutes(delaySeconds: number): number {
  return Math.round(delaySeconds / 60);
}
