// One account's position for one business date: statement status, last closing balance, CAMS fund utilised
// and the indicative sweep status. Used by Closing balances and the Dashboard so both show the same numbers.
//
// Rules (Closing Balance & Fund Utilisation requirements, confirmed 13 Nov):
// - Last closing balance = running balance on the last transaction row for the account and business date.
//   It is not tied to 3 PM or any checkpoint, and it changes as later statement batches are loaded.
// - CAMS fund utilised = total of records where the utilisation report was generated and the flag set.
// - Indicator: closing < utilised = green, closing > utilised = red, equal = none. Informational only.
// - An account is Subscription or Liability, never both. Balances of different accounts are never added up.
// - There is no fund-position formula here: it waits for the accounting sheet (cell F2).
//
// Prototype: every figure is synthetic and worked out from the seed row, so it is stable between visits.
import React from "react";
import { useStore } from "@/state/store";
import { inScope } from "@/lib/org";
import { schemeAttrs } from "@/mock/bankMaster";
import { minsNow, hhmm } from "./dashViz";

export const CATEGORIES = ["Subscription", "Liability"];
export const STATUS_TEXT = { uploaded: "Uploaded", no_txn: "No transactions", not_uploaded: "Not uploaded", pending: "Pending", failed: "Failed" };
export const STATUS_HELP = {
  uploaded: "Statement uploaded successfully.",
  no_txn: "Statement downloaded successfully, but it has no transactions.",
  not_uploaded: "Bank statement has not been uploaded.",
  pending: "Expected processing is not complete yet.",
  failed: "Upload or processing failed.",
};
export const INDICATOR_TEXT = { green: "Sweep likely done", red: "Sweep may be pending" };

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const unit = (s) => (hash(s) % 10000) / 10000;
const round2 = (n) => Math.round(n * 100) / 100;

/** The last five calendar days, today first. */
export function lastFiveDays() {
  return Array.from({ length: 5 }, (_, back) => {
    const d = new Date(); d.setDate(d.getDate() - back);
    return { back, iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), short: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
  });
}

/** Subscription or Liability. Product: read from the account's bank statement setup ("What this account is for"). */
export const categoryOf = (r) => (hash(r.accountNumber) % 4 === 0 ? "Liability" : "Subscription");

// Statement batches land through the day; the closing balance follows the latest one loaded.
const BATCHES = [9 * 60, 12 * 60, 15 * 60, 18 * 60];

/** What happened to an account's statement on a day: missing, empty, failed, and how late its batches run. */
export function dayFacts(r, back) {
  const n = Number(r.id.split("_")[1]) || 0;
  const missing = (n + back) % 13 === 5;
  const noTxn = !missing && (n + back) % 7 === 3;
  const failed = !missing && !noTxn && (n + back * 3) % 31 === 9;
  return { missing, noTxn, failed, offset: hash(`${r.id}|${back}`) % 40 };
}

export function positionFor(r, back, now = minsNow()) {
  const key = `${r.id}|${back}`;
  const today = back === 0;
  const { missing, noTxn, failed, offset } = dayFacts(r, back);
  const landed = BATCHES.map((b) => b + offset).filter((t) => !today || t <= now);
  const updatedAt = missing || !landed.length ? null : landed[landed.length - 1];
  const processing = today && updatedAt != null && now - updatedAt < 6;
  const status = updatedAt == null ? "not_uploaded" : failed ? "failed" : processing ? "pending" : noTxn ? "no_txn" : "uploaded";
  const hasBalance = status === "uploaded" || status === "no_txn";
  // Earlier days: the day's final balance. Today: the balance after the latest batch loaded.
  const drift = today ? 1 - (BATCHES.length - landed.length) * 0.04 : 0.86 + unit(key + "c") * 0.3;
  const closing = hasBalance ? round2(r.closing * drift) : null;
  const lastTxnAt = status === "uploaded" ? updatedAt - 4 - (hash(key + "t") % 35) : null;
  const k = hash(key + "u") % 10;
  // k 0–4: utilised is above the balance (green); 5–7: below it (red); 8: no report yet; 9: equal.
  const camsUtilised = !hasBalance || k === 8 ? null : k === 9 ? closing : round2(closing * (k < 5 ? 1.15 + unit(key + "g") * 1.6 : 0.25 + unit(key + "r") * 0.6));
  const indicator = closing == null || camsUtilised == null || closing === camsUtilised ? null : closing < camsUtilised ? "green" : "red";
  const credits = status === "uploaded" ? round2(r.closing * (0.3 + unit(key + "cr") * 1.1)) : 0;
  // Balance does not match: the statement's rows do not add up. The exact check is still to be confirmed.
  const balBreak = today && hasBalance && Math.abs(r.closing - r.systemClosing) >= 0.005;
  return { ...r, ...schemeAttrs(r.schemeCode), category: categoryOf(r), back, status, closing, lastTxnAt, lastSeq: status === "uploaded" ? 12 + (hash(key + "s") % 480) : null, updatedAt, camsUtilised, indicator, credits, balBreak };
}

/** Every account of the signed-in user's AMC, in one category, for one business date. */
export function usePositions(category, back) {
  const { collections, amcUser } = useStore();
  const now = minsNow();
  return React.useMemo(() => (collections.balances || []).filter((r) => inScope(amcUser, r.amc)).map((r) => positionFor(r, back, now)).filter((r) => r.category === category),
    [collections.balances, amcUser, category, back, now]);
}

export const timeOn = (mins) => (mins == null ? "—" : hhmm(mins));

/** The two filters every money view starts with: account classification and one business date. */
export function CategoryDateBar({ category, onCategory, back, onBack, dateNote }) {
  const days = lastFiveDays();
  return (
    <div className="pf" data-testid="pos-filters">
      <div className="pf-group">
        <span className="pf-label">Account classification</span>
        <div className="segmented pf-cat" role="tablist" aria-label="Account classification">
          {CATEGORIES.map((c) => <button key={c} type="button" role="tab" aria-selected={category === c} className={category === c ? "on" : ""} onClick={() => onCategory(c)} data-testid={"pf-" + c.toLowerCase()}>{c}</button>)}
        </div>
      </div>
      <label className="pf-group">
        <span className="pf-label">Business date</span>
        <select className="select pf-date" value={back} onChange={(e) => onBack(Number(e.target.value))} data-testid="pf-date">
          {days.map((d) => <option key={d.back} value={d.back}>{d.label}{d.back === 0 ? " (today)" : ""}</option>)}
        </select>
      </label>
      <p className="pf-note">Only {category.toLowerCase()} accounts are shown. The two are never mixed.{dateNote ? ` ${dateNote}` : ""}</p>
    </div>
  );
}
