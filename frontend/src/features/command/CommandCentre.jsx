// Dashboard: one dashboard that grows by phase. Phase 1 shows only what Phase 1 data can answer;
// Phase 2 and 3 metrics are listed but carry no numbers until their data exists.
// Two filters lead the page: account classification (Subscription or Liability, never mixed) and one business date.
// There is no total of closing balances: each account's balance stands on its own.
// Order: what needs attention first, then the day's figures, then the last five days as two charts.
import React from "react";
import { useNavigate } from "react-router-dom";
import { Download, ArrowRight, ChevronDown } from "lucide-react";
import { Art } from "@/components/Art";
import { useApprovals } from "@/features/approvals/useApprovals";
import { RiseBars, Ring, AreaTrend } from "@/features/viz/Motion";
import { minsNow } from "@/features/dashboards/dashViz";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { inScope } from "@/lib/org";
import { maskAccount } from "@/lib/format";
import { inr, inrShort } from "@/features/ops/ui";
import { downloadCsv } from "@/features/reports/csv";
import { ago } from "@/features/dashboards/dashViz";
import { CategoryDateBar, usePositions, positionFor, categoryOf, lastFiveDays, timeOn, STATUS_TEXT, STATUS_HELP, INDICATOR_TEXT } from "@/features/dashboards/positions";

const STATUS_ORDER = ["uploaded", "no_txn", "pending", "failed", "not_uploaded"];
// Chart series: statement statuses, in the status colours of the design system.
const STATUS_SERIES = [
  { key: "uploaded", label: "Uploaded", cls: "ok" },
  { key: "no_txn", label: "No transactions", cls: "blue" },
  { key: "pending", label: "Pending", cls: "warn" },
  { key: "failed", label: "Failed", cls: "bad" },
  { key: "not_uploaded", label: "Not uploaded", cls: "mute" },
];
const PHASE_2 = ["Total transactions", "Reconciled transactions", "Unreconciled transactions", "Ageing buckets", "Matching status", "Exception metrics", "Expanded utilisation reporting", "Additional reconciliation metrics"];

export default function CommandCentre() {
  // Opened from Today: ?focus=remitter scrolls to the remitter schedules.
  React.useEffect(() => { if (new URLSearchParams(window.location.search).get("focus") === "remitter") setTimeout(() => document.querySelector('[data-testid="db-remitter"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); }, []);
  const { collections, perms, amcUser } = useStore();
  const nav = useNavigate();
  const canExport = hasCap(perms, "command", "export");
  const canBalances = hasCap(perms, "balances");
  const [category, setCategory] = React.useState("Subscription");
  const [back, setBack] = React.useState(0);
  const [open2, setOpen2] = React.useState(false);
  const day = lastFiveDays()[back];
  const rows = usePositions(category, back);

  const n = (pred) => rows.filter(pred).length;
  const byStatus = STATUS_ORDER.map((s) => [s, n((r) => r.status === s)]);
  const statementsIn = n((r) => r.status === "uploaded" || r.status === "no_txn");
  const totalCredit = rows.reduce((t, r) => t + r.credits, 0);
  const red = n((r) => r.indicator === "red");
  const green = n((r) => r.indicator === "green");
  const noReport = n((r) => r.closing != null && r.camsUtilised == null);
  const banks = [...new Set(rows.map((r) => r.bankName))].sort().map((b) => {
    const acc = rows.filter((r) => r.bankName === b);
    return { b, total: acc.length, inN: acc.filter((r) => r.closing != null).length, red: acc.filter((r) => r.indicator === "red").length };
  });
  // Remitter files arrive on bank-specific schedules; a missed or failed run is flagged here.
  const remitter = (collections.jobs || []).filter((j) => j.topic === "remitter" && (!j.amcs || j.amcs.some((a) => inScope(amcUser, a))));

  // What needs attention, most urgent first. Each line opens the screen where it is dealt with.
  const approvals = useApprovals().filter((a) => !a.own).length;
  const failed = n((r) => r.status === "failed");
  const notUp = n((r) => r.status === "not_uploaded");
  const broken = n((r) => r.balBreak);
  const remFailed = remitter.filter((j) => j.status === "failure").length;
  const canFiles = hasCap(perms, "ingestion");
  const attention = [
    { key: "failed", tone: "bad", count: failed, text: "Statements failed", sub: "Upload or processing failed. Reprocess or upload again.", go: canFiles ? "/ingestion" : null },
    { key: "broken", tone: "bad", count: broken, text: "Balances that do not match", sub: "The statement's rows do not add up.", go: canBalances ? "/closing-balances" : null },
    { key: "approvals", tone: "info", count: approvals, text: "Approvals waiting for you", sub: "Work submitted by teammates.", go: hasCap(perms, "inbox") ? "/approvals" : null },
    { key: "notup", tone: "warn", count: notUp, text: "Statements not uploaded", sub: `No statement for ${day.short} yet.`, go: canFiles ? "/ingestion" : null },
    { key: "red", tone: "warn", count: red, text: "Accounts where a sweep may be pending", sub: "Closing balance is above CAMS fund utilised.", go: canBalances ? "/closing-balances" : null },
    { key: "rem", tone: "warn", count: remFailed, text: "Remitter pickups that failed", sub: "A scheduled remitter file did not load.", go: hasCap(perms, "scheduler") ? "/scheduler" : null },
  ];
  const open = attention.filter((a) => a.count > 0);

  // The last five days, oldest first, for the two charts. Same figures as the rest of the page.
  const now = minsNow();
  const trend = lastFiveDays().slice().reverse().map((d) => {
    const pos = (collections.balances || []).filter((r) => inScope(amcUser, r.amc) && categoryOf(r) === category).map((r) => positionFor(r, d.back, now));
    return { label: d.short, values: Object.fromEntries(STATUS_ORDER.map((s) => [s, pos.filter((r) => r.status === s).length])), value: pos.reduce((t, r) => t + r.credits, 0) };
  });

  const exportCsv = () => downloadCsv(`dashboard_${category.toLowerCase()}_${day.iso}.csv`,
    ["Bank name", "Bank account number", "Classification", "Business date", "Statement status", "Credit amount", "Last closing balance", "CAMS fund utilised", "Last statement updated at", "Indicative status"],
    rows.map((r) => [r.bankName, maskAccount(r.accountNumber), r.category, day.iso, STATUS_TEXT[r.status], r.credits ? r.credits.toFixed(2) : "", r.closing != null ? r.closing.toFixed(2) : "", r.camsUtilised != null ? r.camsUtilised.toFixed(2) : "", r.updatedAt != null ? `${day.iso} ${timeOn(r.updatedAt)}` : "", r.indicator ? INDICATOR_TEXT[r.indicator] : ""]));

  return (
    <div className="dz db" data-testid="command-centre">
      <div className="dz-head">
        <div>
          <h1>Dashboard</h1>
          <p>The day in one place: statements in, credits received, each account&apos;s closing balance and where an AMC sweep may be pending.</p>
        </div>
        {canExport && <div className="dz-actions"><button className="btn btn-outline btn-sm" onClick={exportCsv} data-testid="db-export"><Download size={14} /> Export what is shown</button></div>}
      </div>

      <CategoryDateBar category={category} onCategory={setCategory} back={back} onBack={setBack} />

      <h2 className="sec-h">Needs attention <span>{open.length ? `${day.short}, ${category.toLowerCase()} accounts` : ""}</span></h2>
      {open.length === 0 ? (
        <div className="empty" data-testid="db-clear"><Art name="badges" size={64} /><h3>Nothing needs attention</h3><p>No failed or missing statements, no open approvals and no pending sweeps for {day.short}.</p></div>
      ) : (
        <ul className="att" data-testid="db-attention">
          {open.map((a) => (
            <li key={a.key}><button type="button" className={"att-row " + a.tone} onClick={() => a.go && nav(a.go)} disabled={!a.go} data-testid={"att-" + a.key}>
              <i aria-hidden="true" /><b className="tnum">{a.count}</b><span>{a.text}<small>{a.sub}</small></span>{a.go && <em>Open <ArrowRight size={12} /></em>}
            </button></li>
          ))}
        </ul>
      )}

      <section className="db-phase" data-testid="db-phase-1">
        <h2 className="sec-h">Today&apos;s figures <span>Phase 1: bank statements, closing balances and fund utilisation</span></h2>

        <div className="db-grid">
          <div className="card db-card" data-testid="db-credit">
            <span className="db-l">Total credit amount</span>
            <b className="db-v tnum">{inrShort(totalCredit)}</b>
            <span className="db-s">Credits on statements uploaded for {day.short}, {category.toLowerCase()} accounts.</span>
          </div>
          <div className="card db-card off" data-testid="db-reconciled">
            <span className="db-l">Reconciled amount</span>
            <b className="db-v">Not available yet</b>
            <span className="db-s">Shown once reconciled amounts are available in the data.</span>
          </div>
          <div className="card db-card off" data-testid="db-unreconciled">
            <span className="db-l">Unreconciled amount</span>
            <b className="db-v">Not available yet</b>
            <span className="db-s">Shown once unreconciled amounts are available in the data.</span>
          </div>
        </div>

        <div className="db-two">
          <div className="card db-card" data-testid="db-statements">
            <span className="db-l">Bank statements</span>
            <b className="db-v tnum">{statementsIn} <em>of {rows.length} accounts</em></b>
            <ul className="db-status">
              {byStatus.map(([s, c]) => <li key={s} title={STATUS_HELP[s]}><span className={"ck-st " + s}>{STATUS_TEXT[s]}</span><b className="tnum">{c}</b><small>{STATUS_HELP[s]}</small></li>)}
            </ul>
          </div>

          <div className="card db-card" data-testid="db-utilisation">
            <span className="db-l">Fund utilisation</span>
            <b className="db-v tnum">{red} <em>account{red === 1 ? "" : "s"} where a sweep may be pending</em></b>
            <ul className="db-util">
              <li><span className="cbx-ind red"><i aria-hidden="true" />Sweep may be pending</span><b className="tnum">{red}</b><small>Closing balance is above CAMS fund utilised.</small></li>
              <li><span className="cbx-ind green"><i aria-hidden="true" />Sweep likely done</span><b className="tnum">{green}</b><small>Closing balance is below CAMS fund utilised.</small></li>
              <li><span className="muted">No report yet</span><b className="tnum">{noReport}</b><small>CAMS has not generated a utilisation report.</small></li>
            </ul>
            <p className="db-s">A comparison of two numbers, for information. It is not proof of a sweep.</p>
          </div>
        </div>

        <div className="card db-card" data-testid="db-balances">
          <div className="db-card-top">
            <div><span className="db-l">Closing balance by account</span><p className="db-s">Open a bank to see each account. Balances are never added together.</p></div>
            {canBalances && <button type="button" className="btn btn-outline btn-sm" onClick={() => nav("/closing-balances")} data-testid="db-open-balances">Open Closing balances <ArrowRight size={13} /></button>}
          </div>
          {banks.map((bk) => <BankBalances key={bk.b} bank={bk} rows={rows.filter((r) => r.bankName === bk.b)} />)}
          {banks.length === 0 && <p className="muted">No {category.toLowerCase()} accounts for this AMC.</p>}
        </div>

        <div className="card db-card" data-testid="db-remitter">
          <span className="db-l">Remitter schedules</span>
          <p className="db-s">Remitter files come in on each bank&apos;s own schedule. A run that failed or did not happen is marked.</p>
          <table className="table db-table">
            <thead><tr><th>Pickup</th><th>Schedule</th><th>Last run</th><th>Result</th></tr></thead>
            <tbody>
              {remitter.map((j) => (
                <tr key={j.id}><td><b>{j.name}</b></td><td>{j.every}</td><td>{ago(j.lastAgo)}</td>
                  <td><span className={"ck-st " + (j.status === "failure" ? "failed" : "uploaded")}>{j.status === "failure" ? "Failed" : "Ran"}</span> <small className="muted">{j.remarks}</small></td></tr>
              ))}
              {remitter.length === 0 && <tr><td colSpan={4} className="muted">No remitter pickups set up.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <h2 className="sec-h">Last five days <span>{category} accounts</span></h2>
      <div className="fp2-charts db-charts">
        <section className="card fp2-chart" data-testid="chart-status">
          <header><h2>Statement status by day</h2>
            <ul className="mo-legend row">{STATUS_SERIES.map((x) => <li key={x.key}><i className={x.cls} />{x.label}</li>)}</ul></header>
          <RiseBars key={category} cols={trend.map((d) => ({ label: d.label, parts: d.values }))} keys={STATUS_SERIES.map((x) => ({ key: x.key, label: x.label, cls: x.cls }))} label="Statement status by day" width={680} />
        </section>
        <section className="card fp2-chart fp2-ring" data-testid="chart-today">
          <header><h2>Statements today</h2></header>
          <div className="fp2-ring-body">
            <Ring key={category + back} parts={STATUS_SERIES.map((x) => ({ label: x.label, value: byStatus.find(([k]) => k === x.key)?.[1] || 0, cls: x.cls }))} label="Statement status" center={statementsIn} sub={`of ${rows.length} in`} />
            <ul className="mo-legend">{STATUS_SERIES.map((x) => <li key={x.key}><i className={x.cls} /><span>{x.label}</span><b>{byStatus.find(([k]) => k === x.key)?.[1] || 0}</b></li>)}</ul>
          </div>
        </section>
        <section className="card fp2-chart fp2-wide" data-testid="chart-credit">
          <header><h2>Total credit amount</h2></header>
          <AreaTrend key={category} series={trend.map((d) => ({ label: d.label, value: d.value }))} label="Total credit amount" format={inrShort} height={190} width={1120} />
        </section>
      </div>

      <section className="db-phase later" data-testid="db-phase-2">
        <button type="button" className="db-phase-toggle" onClick={() => setOpen2(!open2)} aria-expanded={open2}>
          <h2 className="sec-h" style={{ margin: 0 }}>Phase 2 <span>Added to this dashboard when matching and exceptions go live</span></h2>
          <ChevronDown size={18} className={open2 ? "up" : ""} />
        </button>
        {open2 && <ul className="db-later">{PHASE_2.map((m) => <li key={m}>{m}<small>No data yet</small></li>)}</ul>}
      </section>
    </div>
  );
}

function BankBalances({ bank, rows }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={"db-bank" + (open ? " open" : "")} data-testid={"db-bank-" + bank.b.split(" ")[0]}>
      <button type="button" className="db-bank-row" onClick={() => setOpen(!open)} aria-expanded={open}>
        <b>{bank.b}</b>
        <span>{bank.inN} of {bank.total} account{bank.total === 1 ? "" : "s"} with a balance{bank.red ? <> · <em>{bank.red} where a sweep may be pending</em></> : ""}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <table className="table db-table">
          <thead><tr><th>Account</th><th className="num">Last closing balance</th><th className="num">CAMS fund utilised</th><th>Statement last updated</th><th>Indicative status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="tnum">{maskAccount(r.accountNumber)}</td>
                <td className="num">{r.closing != null ? <b className="tnum">{inr(r.closing)}</b> : <span className={"ck-st " + r.status}>{STATUS_TEXT[r.status]}</span>}</td>
                <td className="num">{r.camsUtilised != null ? <span className="tnum">{inr(r.camsUtilised)}</span> : <span className="muted">{r.closing != null ? "No report yet" : "—"}</span>}</td>
                <td className="tnum">{r.updatedAt != null ? timeOn(r.updatedAt) : "—"}</td>
                <td>{r.indicator ? <span className={"cbx-ind " + r.indicator}><i aria-hidden="true" />{INDICATOR_TEXT[r.indicator]}</span> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
