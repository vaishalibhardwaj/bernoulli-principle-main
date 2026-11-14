// From and to dates. Screens start on today.
// A list of pending work (To do, Approvals) passes `touched: false` at first: it shows everything still pending
// today, and only filters by date once someone changes a date.
import React from "react";
import { CalendarDays } from "lucide-react";

export const isoDay = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
export const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); };
export const todayRange = (touched) => ({ from: isoDay(new Date()), to: isoDay(new Date()), ...(touched === false ? { touched: false } : {}) });
/** True when an ISO date-time falls inside the range. Items without a date, or a range nobody has changed yet, always pass. */
export const inRange = (when, range) => {
  if (!when || !range || range.touched === false) return true;
  const day = isoDay(when);
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
};

export default function DateRange({ value, onChange, testid = "dr" }) {
  const today = isoDay(new Date());
  const set = (patch) => onChange({ ...value, ...patch, touched: true });
  return (
    <div className="dr" data-testid={testid}>
      <CalendarDays size={15} aria-hidden="true" />
      <label className="dr-f"><span>From</span><input type="date" value={value.from || ""} max={value.to || today} onChange={(e) => set({ from: e.target.value })} data-testid={testid + "-from"} /></label>
      <span className="dr-sep" aria-hidden="true">–</span>
      <label className="dr-f"><span>To</span><input type="date" value={value.to || ""} min={value.from || undefined} max={today} onChange={(e) => set({ to: e.target.value })} data-testid={testid + "-to"} /></label>
    </div>
  );
}
