// Business-day arithmetic for matching: weekends and bank holidays don't count.
// Sample holiday list — production reads the RBI / NSE settlement-holiday calendar.
export const HOLIDAYS = ["2026-10-02", "2026-10-20", "2026-11-09", "2026-11-24", "2026-12-25"];
const key = (d) => d.toISOString().slice(0, 10);
export const isBusinessDay = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !HOLIDAYS.includes(key(d));

/** Business days between two dates (0 = same business day). */
export function bizGap(a, b) {
  let x = new Date(Math.min(new Date(a), new Date(b))); const y = new Date(Math.max(new Date(a), new Date(b)));
  x.setHours(0, 0, 0, 0); y.setHours(0, 0, 0, 0);
  let n = 0;
  while (x < y) { x = new Date(x.getTime() + 86400000); if (isBusinessDay(x)) n++; }
  return n;
}
export const calGap = (a, b) => Math.round(Math.abs(new Date(a) - new Date(b)) / 86400000);
/** SIP debits can settle a few business days after the instalment date. */
export const SIP_ALLOWANCE = 3;
