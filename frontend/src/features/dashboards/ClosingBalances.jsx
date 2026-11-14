// Closing balances: each bank account's last closing balance next to the amount CAMS has reported as utilised.
// Built to the Closing Balance & Fund Utilisation requirements confirmed on 13 Nov:
// - one row per account, never a total across accounts;
// - closing balance = running balance on the last transaction row of the business date (no 3 PM rule);
// - one business date, from the last five calendar days, today by default. The date applies to this screen only;
// - indicator: closing < CAMS utilised = green, closing > = red, equal = none. Informational, not proof of a sweep;
// - no "Matches / Does not match" against a system balance, and no fund-position formula until the accounting sheet arrives.
// "Balance does not match" is a separate statement-data check whose rule is still to be confirmed.
import React from "react";
import { useSearchParams } from "react-router-dom";
import { Download, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { maskAccount } from "@/lib/format";
import { inr } from "@/features/ops/ui";
import { downloadCsv } from "@/features/reports/csv";
import { Kpi, minsNow, ago } from "./dashViz";
import BankCheckpoints from "./BankCheckpoints";
import { CategoryDateBar, usePositions, lastFiveDays, timeOn, STATUS_TEXT, STATUS_HELP, INDICATOR_TEXT } from "./positions";

const ACCT_TYPE = { scheme: "Scheme account", common: "Common account" };
const NO_FILTER = { bank: "all", type: "all" };

export default function ClosingBalances() {
  const { collections, perms, upsert, addAudit, actor } = useStore();
  const canResolve = hasCap(perms, "balances", "edit");
  const canExport = hasCap(perms, "balances", "export");
  const [category, setCategory] = React.useState("Subscription");
  const [back, setBack] = React.useState(0);
  const [f, setF] = React.useState(NO_FILTER);
  const [sp] = useSearchParams();
  // Opened from Today: ?only=broken (balances that do not match) or ?only=red (sweep may be pending).
  const [only, setOnly] = React.useState(() => (["broken", "red", "green", "missing"].includes(sp.get("only")) ? sp.get("only") : "all"));
  const day = lastFiveDays()[back];
  const now = minsNow();
  const all = usePositions(category, back);

  // A balance that does not match is one item per bank + account + business date. Resolving it clears that date only.
  const fixKey = (r) => `${r.bankName}|${r.accountNumber}|${day.iso}`;
  const fixes = new Map((collections.cb_resolutions || []).map((x) => [x.id, x]));
  const withFix = all.map((r) => ({ ...r, fix: r.balBreak ? fixes.get(fixKey(r)) : null }));

  const banks = [...new Set(withFix.map((r) => r.bankName))].sort();
  const rows = withFix.filter((r) => (f.bank === "all" || r.bankName === f.bank) && (f.type === "all" || r.accountType === f.type));
  const n = (pred) => rows.filter(pred).length;
  const withBalance = n((r) => r.closing != null);
  const red = n((r) => r.indicator === "red");
  const green = n((r) => r.indicator === "green");
  const broken = n((r) => r.balBreak && !r.fix);
  const PRED = { red: (r) => r.indicator === "red", green: (r) => r.indicator === "green", broken: (r) => r.balBreak && !r.fix, missing: (r) => r.closing == null };
  const rank = (r) => (r.balBreak && !r.fix ? 0 : r.indicator === "red" ? 1 : r.closing == null ? 2 : 3);
  const shown = rows.filter(PRED[only] || (() => true)).sort((a, b) => rank(a) - rank(b) || a.bankName.localeCompare(b.bankName) || a.accountNumber.localeCompare(b.accountNumber));
  const pick = (k) => setOnly(only === k ? "all" : k);
  const filtered = f.bank !== "all" || f.type !== "all" || only !== "all";

  const resolve = (r) => {
    const note = window.prompt(`What was wrong with the ${r.bankName} ${maskAccount(r.accountNumber)} statement, and how was it fixed? This note is kept with the record.`);
    if (!note || !note.trim()) return;
    upsert("cb_resolutions", { id: fixKey(r), note: note.trim(), by: actor?.name || "You", at: new Date().toISOString() });
    addAudit({ entityType: "balance", entityId: fixKey(r), entityLabel: `${r.bankName} ${maskAccount(r.accountNumber)}`, action: "Balance mismatch resolved", comment: note.trim() });
    toast.success(`Resolved for ${day.short}`);
  };

  const exportCsv = () => downloadCsv(`closing_balances_${category.toLowerCase()}_${day.iso}.csv`,
    ["S. No.", "Bank name", "Bank account number", "Classification", "Account type", "Business date", "Statement status", "Last closing balance", "CAMS fund utilised", "Last transaction date", "Last transaction time", "Last statement updated at", "Indicative status", "Balance does not match"],
    shown.map((r, i) => [i + 1, r.bankName, maskAccount(r.accountNumber), r.category, ACCT_TYPE[r.accountType], day.iso, STATUS_TEXT[r.status], r.closing != null ? r.closing.toFixed(2) : "", r.camsUtilised != null ? r.camsUtilised.toFixed(2) : "", r.lastTxnAt != null ? day.iso : "", r.lastTxnAt != null ? timeOn(r.lastTxnAt) : "", r.updatedAt != null ? `${day.iso} ${timeOn(r.updatedAt)}` : "", r.indicator ? INDICATOR_TEXT[r.indicator] : "", r.balBreak ? (r.fix ? "Resolved" : "Yes") : ""]));

  return (
    <div className="dz cbx" data-testid="closing-balances">
      <div className="dz-head">
        <div>
          <h1>Closing balances</h1>
          <p>Each bank account&apos;s latest closing balance, next to the amount CAMS has reported as utilised. Use it to see where an AMC sweep may still be pending.</p>
        </div>
        {canExport && <div className="dz-actions"><button className="btn btn-outline btn-sm" onClick={exportCsv} data-testid="cb-export"><Download size={14} /> Export what is shown</button></div>}
      </div>

      <CategoryDateBar category={category} onCategory={(c) => { setCategory(c); setF(NO_FILTER); setOnly("all"); }} back={back} onBack={setBack} dateNote="The date applies to this screen only." />

      <div className="fu-callout cbx-info" data-testid="cb-info">
        <Info size={16} />
        <div>This is for information. A green or red mark is a simple comparison of two numbers. It does not prove that the AMC has or has not swept the funds, because money keeps moving in and out of the account.</div>
      </div>

      <div className="dz-kpis cbx-kpis">
        <Kpi label="Accounts with a balance" value={`${withBalance} of ${rows.length}`} sub={`${category.toLowerCase()} accounts · ${day.short}`} onClick={() => setOnly("all")} active={only === "all"} testid="kpi-accounts" />
        <Kpi label="Sweep may be pending" value={red} sub="closing balance is above CAMS fund utilised" tone={red ? "warn" : "ok"} onClick={() => pick("red")} active={only === "red"} testid="kpi-red" />
        <Kpi label="Sweep likely done" value={green} sub="closing balance is below CAMS fund utilised" tone="ok" onClick={() => pick("green")} active={only === "green"} testid="kpi-green" />
        <Kpi label="Balance does not match" value={broken} sub={broken ? `not resolved for ${day.short}` : "none open"} tone={broken ? "warn" : "ok"} onClick={() => pick("broken")} active={only === "broken"} testid="kpi-mismatch" />
      </div>

      {back === 0 && <BankCheckpoints category={category} />}

      <div className="card dz-card cbx-card" data-testid="balance-table">
        <div className="cbx-card-h">
          <div>
            <h2>Closing balance by account</h2>
            <p>Business date {day.label}. The closing balance is the running balance on the last transaction of that date. Each account stands on its own; balances are not added together.</p>
          </div>
          <div className="cbx-filters" data-testid="cb-filters">
            <label>Bank<select className="select" value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} data-testid="cb-bank"><option value="all">All banks</option>{banks.map((b) => <option key={b}>{b}</option>)}</select></label>
            <label>Account type<select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} data-testid="cb-type"><option value="all">All</option><option value="scheme">Scheme account</option><option value="common">Common account</option></select></label>
            {filtered && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setF(NO_FILTER); setOnly("all"); }} data-testid="cb-clear">Show all</button>}
          </div>
        </div>

        <div className="cbx-scroll">
          <table className="table cbx-table">
            <thead><tr>
              <th>S. No.</th><th>Bank</th><th>Account</th><th className="num">Last closing balance</th><th className="num">CAMS fund utilised</th><th>Last transaction</th><th>Statement last updated</th><th>Indicative status</th>
            </tr></thead>
            <tbody>
              {shown.slice(0, 200).map((r, i) => (
                <tr key={r.id} data-testid={"bal-" + r.id} className={r.balBreak && !r.fix ? "is-broken" : ""}>
                  <td className="tnum muted">{i + 1}</td>
                  <td><b>{r.bankName}</b></td>
                  <td><span className="tnum">{maskAccount(r.accountNumber)}</span><small>{ACCT_TYPE[r.accountType]} · {r.schemeName}</small></td>
                  <td className="num">{r.closing != null ? <b className="tnum">{inr(r.closing)}</b> : <span className={"ck-st " + r.status} title={STATUS_HELP[r.status]}>{STATUS_TEXT[r.status]}</span>}
                    {r.status === "no_txn" && <small>No transactions on this date</small>}
                    {r.balBreak && (r.fix
                      ? <small className="cbx-fixed" title={`${r.fix.note} · ${r.fix.by}`}><CheckCircle2 size={11} /> Mismatch resolved by {r.fix.by}</small>
                      : <small className="cbx-break"><AlertTriangle size={11} /> Balance does not match{canResolve && <button type="button" className="link" onClick={() => resolve(r)} data-testid={"cb-resolve-" + r.id}>Resolve</button>}</small>)}
                  </td>
                  <td className="num">{r.camsUtilised != null ? <span className="tnum">{inr(r.camsUtilised)}</span> : <span className="muted">{r.closing != null ? "No report yet" : "—"}</span>}</td>
                  <td>{r.lastTxnAt != null ? <><span className="tnum">{timeOn(r.lastTxnAt)}</span><small>{day.short} · row {r.lastSeq}</small></> : <span className="muted">—</span>}</td>
                  <td>{r.updatedAt != null ? <><span className="tnum">{timeOn(r.updatedAt)}</span><small>{day.short}{back === 0 ? ` · ${ago(now - r.updatedAt)}` : ""}</small></> : <span className="muted">—</span>}</td>
                  <td>{r.indicator ? <span className={"cbx-ind " + r.indicator}><i aria-hidden="true" />{INDICATOR_TEXT[r.indicator]}</span> : <span className="muted">{r.closing != null && r.camsUtilised != null ? "Amounts are equal" : "—"}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length > 200 && <p className="muted card-pad">Showing 200 of {shown.length}. Pick a bank, or export.</p>}
        {shown.length === 0 && <p className="muted card-pad">No {category.toLowerCase()} accounts match.</p>}
      </div>

      <div className="cbx-legend" data-testid="cb-legend">
        <p><span className="cbx-ind green"><i aria-hidden="true" />Sweep likely done</span> The closing balance is below CAMS fund utilised.</p>
        <p><span className="cbx-ind red"><i aria-hidden="true" />Sweep may be pending</span> The closing balance is above CAMS fund utilised. Check with the AMC.</p>
        <p><b>CAMS fund utilised</b> is the total for which CAMS has generated the utilisation report and set the flag. <b>Balance does not match</b> means the statement&apos;s rows do not add up; the exact check is still being confirmed.</p>
      </div>
    </div>
  );
}
