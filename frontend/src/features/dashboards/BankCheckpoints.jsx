// Bank statement checkpoints: one light per bank for the chosen checkpoint, never one per account.
// Green = every account of that bank has crossed the checkpoint; amber = one or more have not.
// Clicking an amber bank lists only the accounts that have not crossed, with a download of that list.
// Statuses: Not uploaded, No transactions (file arrived with no rows), Uploaded, Pending, Failed.
// Prototype: arrival times are synthetic and shared with Closing balances, so both screens agree.
import React from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Download } from "lucide-react";
import { useStore } from "@/state/store";
import { inScope } from "@/lib/org";
import { maskAccount } from "@/lib/format";
import { downloadCsv } from "@/features/reports/csv";
import { minsNow, hhmm } from "./dashViz";
import { STATUS_TEXT, categoryOf, dayFacts } from "./positions";

export const CHECKPOINTS = [
  { key: "am", label: "Morning", at: 9 * 60 + 30, base: 9 * 60 },
  { key: "pm", label: "Afternoon", at: 15 * 60 + 30, base: 15 * 60 },
  { key: "eve", label: "Evening", at: 18 * 60 + 30, base: 18 * 60 },
];

export const businessDate = () => new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const REASON = { not_uploaded: "Statement has not been uploaded", pending: "Uploaded after the checkpoint, or still being processed", failed: "Upload or processing failed" };

/** Each account's state at one checkpoint, as seen at minute `now`. */
function accountAt(r, cp, now) {
  const facts = dayFacts(r, 0);
  const arrives = facts.missing ? null : cp.base + facts.offset;
  const failed = arrives != null && facts.failed;
  const crossed = arrives != null && !failed && arrives <= Math.min(now, cp.at);
  let status;
  if (crossed) status = facts.noTxn ? "no_txn" : "uploaded";
  else if (failed && arrives <= now) status = "failed";
  else if (arrives != null && arrives <= now) status = "pending";
  else status = "not_uploaded";
  return { ...r, arrives, crossed, status };
}

export default function BankCheckpoints({ compact = false, category = null }) {
  const { collections, amcUser } = useStore();
  const now = minsNow();
  const passed = CHECKPOINTS.filter((c) => c.at <= now);
  const [sp] = useSearchParams();
  // Opened from Today: ?cp=am|pm|eve picks the checkpoint the task is about.
  const [cpKey, setCpKey] = React.useState(() => (CHECKPOINTS.some((c) => c.key === sp.get("cp")) ? sp.get("cp") : (passed[passed.length - 1] || CHECKPOINTS[0]).key));
  const [open, setOpen] = React.useState(null);
  const cp = CHECKPOINTS.find((c) => c.key === cpKey);
  const due = cp.at <= now;

  const rows = (collections.balances || []).filter((r) => inScope(amcUser, r.amc) && (!category || categoryOf(r) === category)).map((r) => accountAt(r, cp, now));
  const banks = [...new Set(rows.map((r) => r.bankName))].sort().map((name) => {
    const accts = rows.filter((r) => r.bankName === name);
    const pending = accts.filter((r) => !r.crossed);
    return { name, total: accts.length, pending, crossed: accts.filter((r) => r.crossed) };
  }).sort((a, b) => b.pending.length - a.pending.length || a.name.localeCompare(b.name));
  const amber = banks.filter((b) => b.pending.length).length;

  const download = (b) => downloadCsv(`pending_${b.name.replace(/\s+/g, "_")}_${cp.key}_${new Date().toISOString().slice(0, 10)}.csv`,
    ["Bank name", "Account number", "Business date", "Expected processing time", "Current processing status", "Pending reason"],
    b.pending.map((r) => [r.bankName, maskAccount(r.accountNumber), businessDate(), hhmm(cp.at), STATUS_TEXT[r.status], REASON[r.status] || ""]));

  const allCrossed = banks.flatMap((b) => b.crossed);
  const downloadCrossed = () => downloadCsv(`completed_${cp.key}_${new Date().toISOString().slice(0, 10)}.csv`,
    ["Bank name", "Account number", "Business date", "Checkpoint", "Status", "Uploaded at"],
    allCrossed.map((r) => [r.bankName, maskAccount(r.accountNumber), businessDate(), hhmm(cp.at), STATUS_TEXT[r.status], hhmm(r.arrives)]));

  return (
    <section className="card ck" data-testid="bank-checkpoints">
      <div className="ck-head">
        <div>
          <h2>Bank statements by checkpoint</h2>
          <p>Business date {businessDate()}{category ? ` · ${category.toLowerCase()} accounts` : ""} · one light per bank. Green means every account has crossed the checkpoint; amber means one or more have not. Open an amber bank to see which.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Checkpoint">
          {CHECKPOINTS.map((c) => (
            <button key={c.key} type="button" role="tab" aria-selected={c.key === cpKey} className={c.key === cpKey ? "on" : ""} onClick={() => { setCpKey(c.key); setOpen(null); }} data-testid={"ck-cp-" + c.key}>
              {c.label} · {hhmm(c.at)}
            </button>
          ))}
        </div>
      </div>

      <p className="ck-summary" data-testid="ck-summary">
        {allCrossed.length > 0 && <button type="button" className="link ck-done-export" onClick={downloadCrossed} data-testid="ck-download-done">Download completed accounts ({allCrossed.length})</button>}
        {!due ? `The ${hhmm(cp.at)} checkpoint has not come yet. Banks show what is in so far.`
          : amber ? `${amber} of ${banks.length} banks have accounts that missed the ${hhmm(cp.at)} checkpoint.`
            : `All ${banks.length} banks crossed the ${hhmm(cp.at)} checkpoint.`}
      </p>

      <ul className={"ck-list" + (compact ? " compact" : "")}>
        {banks.map((b) => {
          const tone = b.pending.length === 0 ? "green" : due ? "amber" : "wait";
          const isOpen = open === b.name && b.pending.length > 0;
          return (
            <li key={b.name} className={"ck-bank " + tone + (isOpen ? " open" : "")} data-testid={"ck-bank-" + b.name.split(" ")[0]}>
              <button type="button" className="ck-row" onClick={() => b.pending.length && setOpen(isOpen ? null : b.name)} disabled={!b.pending.length} aria-expanded={isOpen}>
                <i className={"ck-dot " + tone} aria-hidden="true" />
                <b>{b.name}</b>
                <span className="ck-state">{b.pending.length === 0 ? `All ${b.total} account${b.total === 1 ? "" : "s"} crossed` : `${b.pending.length} of ${b.total} account${b.total === 1 ? "" : "s"} ${due ? "pending" : "not in yet"}`}</span>
                {b.pending.length > 0 && <ChevronDown size={16} className="ck-chev" />}
              </button>
              {isOpen && (
                <div className="ck-drill" data-testid="ck-drill">
                  <div className="ck-drill-top">
                    <span>Accounts that have not crossed {hhmm(cp.at)}</span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => download(b)} data-testid="ck-download"><Download size={13} /> Download list</button>
                  </div>
                  <div className="ck-table-wrap">
                    <table className="table ck-table">
                      <thead><tr><th>Account</th><th>Status</th><th>Expected by</th><th>Uploaded at</th><th>Reason</th></tr></thead>
                      <tbody>
                        {b.pending.map((r) => (
                          <tr key={r.id}>
                            <td className="tnum">{maskAccount(r.accountNumber)}</td>
                            <td><span className={"ck-st " + r.status}>{STATUS_TEXT[r.status]}</span></td>
                            <td className="tnum">{hhmm(cp.at)}</td>
                            <td className="tnum">{r.arrives != null && r.arrives <= now ? hhmm(r.arrives) : "Not yet"}</td>
                            <td className="muted">{REASON[r.status]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {banks.length === 0 && <li className="muted">No bank accounts for this AMC.</li>}
      </ul>
    </section>
  );
}
