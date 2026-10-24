import React from "react";
import { AlertTriangle, Check } from "lucide-react";

/**
 * Date / time format built from parts (as in the old screen): day–month–year order, 2- or 4-digit year, separator,
 * optional time with hours, minutes, optional seconds, 12/24-hour and an AM/PM marker for 12-hour. Custom stays available.
 */
const ORDERS = { DMY: ["DD", "MM", "YEAR"], MDY: ["MM", "DD", "YEAR"], YMD: ["YEAR", "MM", "DD"] };
const SEPS = [["/", "/"], ["-", "-"], [".", "."], [" ", "space"], ["", "none"]];
export const defaultDateFmt = () => ({ order: "DMY", year: "YYYY", sep: "/", time: false, h24: true, seconds: false, ampm: "A", custom: "", useCustom: false, confirmed: false });

export function fmtString(f) {
  if (f.useCustom) return f.custom || "—";
  const date = ORDERS[f.order].map((p) => (p === "YEAR" ? f.year : p)).join(f.sep);
  if (!f.time) return date;
  return `${date} ${f.h24 ? "HH" : "hh"}:mm${f.seconds ? ":ss" : ""}${f.h24 ? "" : " " + f.ampm}`;
}
function preview(f) {
  const v = { DD: "03", MM: "04", YYYY: "2026", YY: "26" };
  if (f.useCustom) return "as defined";
  const d = ORDERS[f.order].map((p) => (p === "YEAR" ? v[f.year] : v[p])).join(f.sep);
  return f.time ? `${d} ${f.h24 ? "14" : "02"}:05${f.seconds ? ":09" : ""}${f.h24 ? "" : " PM"}` : d;
}
/** Both parts ≤ 12 (e.g. 05/05, 03/04): we guess day-first and ask the user to confirm. */
export const isAmbiguous = (sample) => { const m = String(sample || "").match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/); return !!m && Number(m[1]) <= 12 && Number(m[2]) <= 12; };

export default function DateFormatBuilder({ value, onChange, sample, disabled }) {
  const f = value || defaultDateFmt();
  const set = (p) => onChange({ ...f, ...p });
  const amb = isAmbiguous(sample) && ["DMY", "MDY"].includes(f.order);
  const [a, b] = (String(sample).match(/^(\d{1,2})[/.-](\d{1,2})/) || []).slice(1);
  const month = (n) => new Date(2026, Number(n) - 1, 1).toLocaleString("en-IN", { month: "long" });
  return (
    <div className="dfb" data-testid="date-builder">
      <div className="dfb-row">
        <label>Order</label>
        <div className="segmented">{Object.entries(ORDERS).map(([k, parts]) => <button key={k} type="button" disabled={disabled || f.useCustom} className={f.order === k ? "on" : ""} onClick={() => set({ order: k, confirmed: false })} data-testid={"dfb-order-" + k}>{parts.map((p) => (p === "YEAR" ? "YYYY" : p)).join(" ")}</button>)}</div>
        <label>Year</label>
        <div className="segmented">{["YYYY", "YY"].map((y) => <button key={y} type="button" disabled={disabled || f.useCustom} className={f.year === y ? "on" : ""} onClick={() => set({ year: y })}>{y}</button>)}</div>
        <label>Separator</label>
        <select className="select dfb-sel" disabled={disabled || f.useCustom} value={f.sep} onChange={(e) => set({ sep: e.target.value })}>{SEPS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select>
      </div>
      <div className="dfb-row">
        <label><input type="checkbox" className="cb" disabled={disabled || f.useCustom} checked={f.time} onChange={(e) => set({ time: e.target.checked })} data-testid="dfb-time" /> Has a time part</label>
        {f.time && !f.useCustom && <>
          <div className="segmented">{[[true, "24-hour"], [false, "12-hour"]].map(([v, l]) => <button key={l} type="button" disabled={disabled} className={f.h24 === v ? "on" : ""} onClick={() => set({ h24: v })} data-testid={"dfb-" + (v ? "24" : "12")}>{l}</button>)}</div>
          <label><input type="checkbox" className="cb" disabled={disabled} checked={f.seconds} onChange={(e) => set({ seconds: e.target.checked })} /> Seconds</label>
          {!f.h24 && <><label>AM/PM field</label><select className="select dfb-sel" disabled={disabled} value={f.ampm} onChange={(e) => set({ ampm: e.target.value })}><option value="A">AM / PM</option><option value="a">am / pm</option></select></>}
        </>}
        <label style={{ marginLeft: "auto" }}><input type="checkbox" className="cb" disabled={disabled} checked={f.useCustom} onChange={(e) => set({ useCustom: e.target.checked })} data-testid="dfb-custom" /> Custom</label>
        {f.useCustom && <input className="input tnum dfb-custom" disabled={disabled} value={f.custom} onChange={(e) => set({ custom: e.target.value })} placeholder="e.g. DD-MMM-YYYY HH:mm" />}
      </div>
      <div className="dfb-out"><span>Format <code>{fmtString(f)}</code></span><span>Preview <code>{preview(f)}</code></span>{sample && <span>Sample in file <code>{sample}</code></span>}</div>
      {amb && (
        <div className={"dfb-amb" + (f.confirmed ? " ok" : "")} data-testid="dfb-ambiguous">
          {f.confirmed ? <Check size={13} /> : <AlertTriangle size={13} />}
          <span>{f.confirmed ? `Confirmed: ${f.order === "DMY" ? "day first" : "month first"}.` : `“${sample}” could be read either way. We guessed ${f.order === "DMY" ? "day first" : "month first"} — please confirm:`}</span>
          {!disabled && <>
            <button type="button" className={"btn btn-sm " + (f.order === "DMY" && f.confirmed ? "btn-primary" : "btn-outline")} onClick={() => set({ order: "DMY", confirmed: true })} data-testid="dfb-dmy">Day first ({Number(a)} {month(b)})</button>
            <button type="button" className={"btn btn-sm " + (f.order === "MDY" && f.confirmed ? "btn-primary" : "btn-outline")} onClick={() => set({ order: "MDY", confirmed: true })} data-testid="dfb-mdy">Month first ({Number(b)} {month(a)})</button>
          </>}
        </div>
      )}
    </div>
  );
}
