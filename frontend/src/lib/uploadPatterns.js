// Manual SFTP accounts: an operator (not the bank's host-to-host link) drops the statement into SFTP.
// The system learns each account's usual upload time over 10–15 working days, then raises a "late" alert
// when today's upload is about 15 minutes past that time. Until 10 days are seen, it only learns.

export const LEARN_MIN_DAYS = 10;
export const LEARN_MAX_DAYS = 15;
export const LATE_AFTER_MIN = 15;

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);
const minsNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const hhmm = (m) => { const h = Math.floor(m / 60); const mm = Math.round(m % 60); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** Which SFTP accounts are fed by hand (prototype: a stable subset; production: flagged in bank statement setup). */
export const isManualSftp = (f) => f.channel === "sftp" && hash(f.accountNumber) % 3 === 1;

/**
 * Learned pattern per manual SFTP account. Prototype: upload history is generated from the account number so it
 * is stable; production reads the actual upload times from the SFTP landing log.
 */
export function patternFor(f) {
  const h = hash(f.accountNumber);
  const base = 9 * 60 + 30 + (h % 210); // usual upload between 9:30 AM and 1:00 PM
  const seen = 6 + (h % 10); // days of history so far (6–15)
  const days = Array.from({ length: Math.min(seen, LEARN_MAX_DAYS) }, (_, i) => base + (((h >> (i % 16)) % 21) - 10));
  const sorted = [...days].sort((a, b) => a - b);
  const expected = sorted[Math.floor(sorted.length / 2)];
  const spread = Math.round((sorted[sorted.length - 1] - sorted[0]) / 2);
  const learning = days.length < LEARN_MIN_DAYS;
  const now = minsNow();
  const at = f.receivedAt ? new Date(f.receivedAt) : null;
  const todayAt = at ? at.getHours() * 60 + at.getMinutes() : null;
  const lateBy = todayAt != null ? todayAt - expected : now - expected;
  const state = learning ? "learning" : todayAt != null ? (lateBy > LATE_AFTER_MIN ? "arrived_late" : "on_time") : lateBy > LATE_AFTER_MIN ? "late" : "due";
  return { fileId: f.id, bankName: f.bankName, accountNumber: f.accountNumber, days, seen: days.length, expected, spread, learning, todayAt, lateBy, state };
}

export const patternsFor = (files) => (files || []).filter(isManualSftp).map(patternFor);
