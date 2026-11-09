// Scheduler timing for a bank statement, by how it arrives. Schedulers run every 15 or 30 minutes, so a single
// "expected by" time does not apply: each file shows its scheduler interval, last run and next run instead.
// Prototype values; production reads them from the scheduler.
export const EVERY_MIN = { sftp: 15, email: 15, api: 30, auto: 60 };

const minsNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const clock = (m) => { const h = Math.floor((((m % 1440) + 1440) % 1440) / 60); const mm = Math.round(((m % 60) + 60) % 60); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** { every, last, next } in minutes since midnight; null for files that only arrive by hand. */
export function fileSchedule(f) {
  const every = EVERY_MIN[f.channel];
  if (!every) return null;
  const now = minsNow();
  const last = Math.floor(now / every) * every;
  return { every, last, next: last + every };
}
