import React from "react";
import { HeroArt } from "@/components/Art";
import { Banknote, Download, CheckCircle2, AlertTriangle, MinusCircle, FileX2, ArrowUpRight, ArrowDownRight, Cpu, Info, Filter, ListChecks, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { inScope } from "@/lib/org";
import { maskAccount } from "@/lib/format";
import { inr, inrShort } from "@/features/ops/ui";
import { downloadCsv } from "@/features/reports/csv";
import { schemeAttrs, SEBI_ASSET_CLASSES } from "@/mock/bankMaster";
import { TiltCard } from "@/features/viz/Viz";
import { C, Donut, DayTimeline, HBar, Kpi, minsNow, hhmm } from "./dashViz";

const THREE_PM = 15 * 60;
const FOUR_PM = 16 * 60;
// Balance check (green / orange) and sweep (violet / blue) use different palettes on purpose.
const BAL = { match: "#16a34a", mismatch: "#ff9f43", none: "rgba(140,160,200,.5)" };
const STMT = { txn: "#16a34a", no_txn: "#7b61e8", not_received: "rgba(140,160,200,.5)" };
const SWP = { full: "#6366f1", partial: "#5b3fd1", pending: "rgba(99,102,241,.22)" };
const STMT_TEXT = { txn: "Received", no_txn: "No transactions today", not_received: "Not received" };
const ACCT_TYPE = { scheme: "Scheme account", common: "Common collection account" };
const NO_FILTER = { bank: "all", account: "all", sebi: "all", type: "all" };

/**
 * Closing balance per bank account (counted per account, never per bank).
 * PRD 5.9: statements are downloaded after 3 PM; take the last transaction before 3 PM; compare its closing
 * balance with the system's — green if they match, orange if not. Recon managers also see fund utilisation:
 * how many matched accounts are fully swept, and when.
 */
export default function ClosingBalances() {
  const { collections, amcUser, perms } = useStore();
  const nav = useNavigate();
  // Bank statement makers see the closing balance graph only; recon managers (approve fund release) see both.
  const isManager = hasCap(perms, "release", "approve");
  const [asAt, setAsAt] = React.useState("now");
  const [f, setF] = React.useState(NO_FILTER);
  const [only, setOnly] = React.useState("all");
  const now = asAt === "now" ? minsNow() : Number(asAt);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === "bank" ? { account: "all" } : {}) }));

  const all = (collections.balances || []).filter((r) => inScope(amcUser, r.amc)).map((r) => {
    const attrs = schemeAttrs(r.schemeCode);
    const received = r.stmt !== "not_received" && r.downloadedAt != null && r.downloadedAt <= now;
    const stmtNow = received ? r.stmt : "not_received";
    const check = !received ? "none" : Math.abs(r.closing - r.systemClosing) < 0.005 ? "match" : "mismatch";
    const swept = check !== "match" ? null : r.sweep === "full" && r.sweepAt <= now ? "full" : r.sweep && r.sweep !== "pending" && r.sweepAt <= now ? "partial" : "pending";
    // Fund utilisation: a disbursement report flags the transactions it pays out; utilised = the sum of flagged transactions,
    // remaining = closing balance − utilised (e.g. ₹23.7 Cr − ₹20 Cr = ₹3.7 Cr). Prototype: flagged amount follows the sweep.
    const utilised = received && r.sweep && r.sweepAt != null && r.sweepAt <= now ? Math.round(r.closing * (r.sweptPct / 100) * 0.97 * 100) / 100 : 0;
    return { ...r, ...attrs, received, stmtNow, check, swept, utilised, remaining: received ? r.closing - utilised : null, delta: r.closing - r.prevClosing };
  });
  const banksAll = [...new Set(all.map((r) => r.bankName))].sort();
  // Filters cascade: pick a bank → its account numbers appear; account type and SEBI asset class then offer only the values those accounts have.
  const inBank = all.filter((r) => f.bank === "all" || r.bankName === f.bank);
  const inAccount = inBank.filter((r) => f.account === "all" || r.accountNumber === f.account);
  const typeOpts = [["scheme", "Scheme"], ["common", "Common collection"]].filter(([k]) => inAccount.some((r) => r.accountType === k));
  const sebiOpts = SEBI_ASSET_CLASSES.filter((k) => inAccount.some((r) => r.sebiClass === k)).map((k) => [k, k]);
  const rows = inAccount.filter((r) => (f.sebi === "all" || r.sebiClass === f.sebi) && (f.type === "all" || r.accountType === f.type));
  const filtered = Object.values(f).some((v) => v !== "all");

  const n = (pred) => rows.filter(pred).length;
  const inCount = n((r) => r.received);
  const matched = rows.filter((r) => r.check === "match");
  const mism = n((r) => r.check === "mismatch");
  const pctSweptAt = (t) => (matched.length ? Math.round((matched.filter((r) => r.sweep === "full" && r.sweepAt <= t).length / matched.length) * 100) : 0);
  const order = { mismatch: 0, none: 1, match: 2 };
  const shown = rows.filter((r) => only === "all" || (only === "computed" ? r.source === "computed" : r.check === only || r.stmtNow === only || r.swept === only))
    .sort((a, b) => order[a.check] - order[b.check] || a.bankName.localeCompare(b.bankName));
  const total = rows.filter((r) => r.received).reduce((s, r) => s + r.closing, 0);
  const prev = rows.filter((r) => r.received).reduce((s, r) => s + r.prevClosing, 0);
  // Only statements that came in count. A bank with nothing received shows "Not received", never ₹0.
  const byBank = Object.entries(rows.reduce((m, r) => ({ ...m, [r.bankName]: r.received ? (m[r.bankName] || 0) + r.closing : (m[r.bankName] ?? null) }), {}))
    .sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1));
  const topBank = byBank[0]?.[1] || 1;
  const utilisedAll = rows.reduce((t, r) => t + r.utilised, 0);
  // Today's tasks and file counts for this AMC: failing pickups, statements in, statements that failed.
  const inAmcFile = (x) => inScope(amcUser, x.amc);
  const files = (collections.files || []).filter(inAmcFile);
  const failedFiles = files.filter((x) => ["check_failed", "drift", "unknown", "duplicate"].includes(x.status));
  const failingJobs = (collections.jobs || []).filter((j) => j.status === "failure" && j.topic === "bank" && (!j.amcs || j.amcs.some((a) => inScope(amcUser, a))));
  const tasks = [...failingJobs.map((j) => ({ k: j.id, text: `${j.name.replace(/^SFTP pickup — |^Portal bot — /, "")} failing`, sub: j.remarks })), ...failedFiles.slice(0, 4).map((x) => ({ k: x.id, text: `${x.bankName} ·${x.accountNumber.slice(-4)} statement failed`, sub: x.status.replace("_", " ") }))];
  // When statements arrived: one dot per account at its download time, green = balance matches, orange = doesn't.
  const lanes = [...new Set(rows.map((r) => r.bankName))].map((b) => ({ label: b, runs: rows.filter((r) => r.bankName === b && r.received).map((r) => ({ t: r.downloadedAt, ok: r.check === "match", warn: r.check === "mismatch", big: true, note: `${maskAccount(r.accountNumber)} · ${r.check === "match" ? "matches system" : "doesn't match system"}${r.stmt === "no_txn" ? " · no transactions" : ""}` })) }));
  const pick = (k) => setOnly(only === k ? "all" : k);

  const exportCsv = () => downloadCsv(`closing_balances_${new Date().toISOString().slice(0, 10)}.csv`,
    ["Bank", "Account", "Account type", "Scheme", "SEBI category", "SEBI asset class", "Statement", "Downloaded", "Last txn before 3 PM", "Bank closing", "System closing (last line item)", "Fund utilised", "Remaining", "Check", "Balance source", ...(isManager ? ["Sweep", "Swept at"] : [])],
    shown.map((r) => [r.bankName, maskAccount(r.accountNumber), ACCT_TYPE[r.accountType], r.schemeName, r.sebiCategory, r.sebiClass, STMT_TEXT[r.stmtNow], r.received ? hhmm(r.downloadedAt) : "", r.lastTxnAt != null && r.received ? hhmm(r.lastTxnAt) : "", r.received ? r.closing.toFixed(2) : "Not received", r.systemClosing.toFixed(2), r.utilised.toFixed(2), r.remaining != null ? r.remaining.toFixed(2) : "", { match: "Match", mismatch: "Mismatch", none: "Not checked" }[r.check], r.source === "computed" ? "Computed from our data" : "Bank statement", ...(isManager ? [r.swept || "", r.swept === "full" ? hhmm(r.sweepAt) : ""] : [])]));

  return (
    <div className="dz" data-testid="closing-balances">
      <div className="dz-head">
        <div>
          <h1><Banknote size={22} /> Closing balances</h1>
          <p>Every bank account's closing balance as at its last transaction before 3 PM, checked against the system's closing balance (the balance on the last line item in our tables){isManager ? ", and how much of it has been utilised" : ""}.</p>
        </div>
        <HeroArt name="cubes" />
        <div className="dz-actions">
          <div className="segmented dz-asat" title="See the day at another time">{[["now", "Now"], [String(THREE_PM + 30), "3:30 PM"], [String(FOUR_PM), "4 PM"], [String(17 * 60), "5 PM"]].map(([v, l]) => <button key={v} className={asAt === v ? "on" : ""} onClick={() => setAsAt(v)} data-testid={"asat-" + v}>{l}</button>)}</div>
          <button className="btn btn-outline btn-sm" onClick={exportCsv} data-testid="cb-export"><Download size={14} /> Export</button>
        </div>
      </div>

      <div className="cb-filters" data-testid="cb-filters">
        <Filter size={14} />
        <Sel label="Bank" v={f.bank} on={(v) => setF({ ...NO_FILTER, bank: v })} opts={banksAll.map((b) => [b, b])} all="All banks" t="cb-bank" />
        {f.bank !== "all" && <>
          <Sel label="Account number" v={f.account} on={(v) => setF({ ...f, account: v, type: "all", sebi: "all" })} opts={inBank.map((r) => [r.accountNumber, maskAccount(r.accountNumber)])} all="All accounts" t="cb-account" />
          <Sel label="Account type" v={f.type} on={(v) => set("type", v)} opts={typeOpts.length > 1 ? typeOpts : []} all={typeOpts.length === 1 ? typeOpts[0][1] : "All"} t="cb-type" />
          <Sel label="SEBI asset class" v={f.sebi} on={(v) => set("sebi", v)} opts={sebiOpts.length > 1 ? sebiOpts : []} all={sebiOpts.length === 1 ? sebiOpts[0][1] : "All"} t="cb-sebi" />
        </>}
        {filtered && <button className="btn btn-ghost btn-sm" onClick={() => setF(NO_FILTER)} data-testid="cb-clear">Clear</button>}
        <span className="cb-src" title="SEBI asset class comes from each scheme's SEBI category in the scheme master"><Info size={12} /> {f.bank === "all" ? "pick a bank to filter by account" : "SEBI asset class from the scheme master"}</span>
      </div>

      <div className="cb-today" data-testid="cb-today">
        <div className="cb-today-counts">
          <span className="cb-tc"><b className="fx-num">{files.filter((x) => x.receivedAt).length}</b>statements received</span>
          <span className="cb-tc bad"><b className="fx-num">{failedFiles.length}</b>failed</span>
          <span className="cb-tc"><b className="fx-num">{files.filter((x) => !x.receivedAt).length}</b>not received yet</span>
        </div>
        <div className="cb-today-tasks">
          <span className="cb-today-h"><ListChecks size={14} /> Today's tasks</span>
          {tasks.length === 0 ? <span className="muted">Nothing failing.</span> : tasks.slice(0, 6).map((t) => <button key={t.k} className="cb-task" onClick={() => nav("/ingestion")} title={t.sub}><AlertTriangle size={12} /> {t.text}</button>)}
          {tasks.length > 6 && <button className="link" onClick={() => nav("/ingestion")}>+{tasks.length - 6} more <ArrowRight size={12} /></button>}
        </div>
      </div>

      {now < THREE_PM && (
        <div className="fu-callout" data-testid="cb-before3">
          <Info size={16} />
          <div>It's before 3 PM. Today's statements are downloaded after 3 PM, so nothing has been checked yet. <button className="link" onClick={() => setAsAt(String(FOUR_PM))} data-testid="cb-preview">Preview the day at 4 PM</button></div>
        </div>
      )}

      <div className="dz-hero">
        <TiltCard className="card dz-card" max={4} data-testid="stmt-donut">
          <div className="dz-card-h">Statements in today <span className="muted">· by account</span></div>
          <div className="dz-health">
            <Donut size={156} value={`${inCount}/${rows.length}`} sub="accounts received"
              segments={[{ v: n((r) => r.stmtNow === "txn"), color: STMT.txn }, { v: n((r) => r.stmtNow === "no_txn"), color: STMT.no_txn }, { v: n((r) => r.stmtNow === "not_received"), color: STMT.not_received }]} />
            <ul className="dz-legend">
              <li className="clickable" onClick={() => pick("txn")} data-testid="cb-txn"><i style={{ background: STMT.txn }} />Received <b>{n((r) => r.stmtNow === "txn")}</b></li>
              <li className="clickable" onClick={() => pick("no_txn")} data-testid="cb-notxn"><i style={{ background: STMT.no_txn }} />No transactions today <b>{n((r) => r.stmtNow === "no_txn")}</b></li>
              <li className="clickable" onClick={() => pick("not_received")} data-testid="cb-notrec"><i style={{ background: STMT.not_received }} />Not received <b>{n((r) => r.stmtNow === "not_received")}</b></li>
            </ul>
          </div>
        </TiltCard>

        <TiltCard className="card dz-card" max={4} data-testid="graph-balance">
          <div className="dz-card-h">Closing balance check · 3 PM rule</div>
          <div className="dz-health">
            <Donut size={156} value={`${matched.length}/${inCount}`} sub="match the system"
              segments={[{ v: matched.length, color: BAL.match }, { v: mism, color: BAL.mismatch }]} />
            <ul className="dz-legend">
              <li className="clickable" onClick={() => pick("match")}><i style={{ background: BAL.match }} />Matches system <b>{matched.length}</b></li>
              <li className="clickable" onClick={() => pick("mismatch")}><i style={{ background: BAL.mismatch }} />Doesn't match <b>{mism}</b></li>
            </ul>
          </div>
          <ol className="cb-rule"><li>Download after 3 PM</li><li>Last transaction before 3 PM</li><li>Its closing balance vs system</li></ol>
        </TiltCard>

        <div className="dz-kpis">
          <Kpi label="Total closing balance" value={inrShort(total)} sub={<span className={total >= prev ? "up" : "down"}>{total >= prev ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{`${Math.abs(((total - prev) / (prev || 1)) * 100).toFixed(1)}% vs previous`}</span>} tone="info" />
          <Kpi label="Balances that don't match" value={mism} sub={mism ? "check before release" : "none"} tone={mism ? "warn" : "ok"} onClick={() => pick("mismatch")} active={only === "mismatch"} testid="kpi-mismatch" />
          <Kpi label="Fund utilised" value={inrShort(utilisedAll)} sub={`remaining ${inrShort(total - utilisedAll)} of ${inrShort(total)}`} tone="info" testid="kpi-utilised" />
          <Kpi label="Balances we computed" value={n((r) => r.source === "computed")} sub="bank gives none" onClick={() => pick("computed")} active={only === "computed"} testid="kpi-computed" />
          <Kpi label="Bank accounts" value={rows.length} sub={`${amcUser.amcs?.length === 1 ? amcUser.amcs[0] : "your AMCs"}${filtered ? " · filtered" : ""}`} onClick={() => setOnly("all")} active={only === "all"} />
        </div>
      </div>

      <div className="dz-adv-grid">
        <div className="card dz-card">
          <div className="dz-card-h">When statements arrived <span className="muted">· dot = an account · green matches, orange doesn&apos;t</span></div>
          <DayTimeline lanes={lanes} start={12 * 60} end={18 * 60} height={26} marks={[{ t: THREE_PM, label: "3 PM", color: C.info }]} />
        </div>
        <div className="card dz-card">
          <div className="dz-card-h">Closing balance by bank <span className="muted">· click a bank to drill down</span></div>
          {byBank.map(([b, v]) => (
            <button key={b} type="button" className={"cb-drill" + (f.bank === b ? " on" : "")} onClick={() => setF(f.bank === b ? NO_FILTER : { ...NO_FILTER, bank: b })} data-testid={"cb-drill-" + b.split(" ")[0]}>
              {v == null ? <div className="dz-hbar"><span className="dz-hbar-l">{b}</span><span className="dz-hbar-t" /><b className="dz-hbar-v cb-nr">Not received</b></div> : <HBar label={b} value={v} max={topBank} right={inrShort(v)} />}
            </button>
          ))}
        </div>
      </div>

      {isManager && (
        <div className="card dz-card cb-sweep-card" data-testid="graph-sweep">
          <div className="dz-card-h">Fund utilisation · sweep of matched accounts <span className="muted">· completion % pinned at 3 PM and 4 PM</span></div>
          <div className="cb-sweep-wrap">
            <SweepChart rows={matched} now={now} pctAt={pctSweptAt} />
            <ul className="dz-legend">
              <li className="clickable" onClick={() => pick("full")}><i style={{ background: SWP.full }} />Fully swept <b>{n((r) => r.swept === "full")}</b></li>
              <li className="clickable" onClick={() => pick("partial")}><i style={{ background: SWP.partial }} />Partly swept <b>{n((r) => r.swept === "partial")}</b></li>
              <li className="clickable" onClick={() => pick("pending")}><i style={{ background: SWP.pending }} />Not swept yet <b>{n((r) => r.swept === "pending")}</b></li>
              <li className="muted" style={{ fontSize: 12 }}>of {matched.length} matched accounts</li>
            </ul>
          </div>
        </div>
      )}

      <div className="card dz-card dz-acc" data-testid="balance-table">
        <div className="dz-card-h">Accounts <span className="muted">· {shown.length}{only !== "all" ? " · filtered" : ""}</span>{only !== "all" && <button className="link" style={{ marginLeft: "auto" }} onClick={() => setOnly("all")}>Show all</button>}</div>
        {shown.slice(0, 200).map((r) => (
          <div key={r.id} className={"dz-acc-row cb-acc-row c-" + r.check + (f.account === r.accountNumber ? " on" : "")} data-testid={"bal-" + r.id} role="button" tabIndex={0} title="Show only this account"
            onClick={() => setF(f.account === r.accountNumber ? { ...NO_FILTER, bank: r.bankName } : { ...NO_FILTER, bank: r.bankName, account: r.accountNumber })}>
            <span className={"dz-state cb-st s-" + r.stmtNow}>{r.stmtNow === "txn" ? <><CheckCircle2 size={12} /> Received</> : r.stmtNow === "no_txn" ? <><MinusCircle size={12} /> No transactions</> : <><FileX2 size={12} /> Not received</>}</span>
            <div className="dz-acc-name"><b>{r.bankName}</b><span className="tnum">{maskAccount(r.accountNumber)} · {r.schemeName} · {r.sebiClass} ({r.sebiCategory}) · {r.accountType === "common" ? "common collection" : "scheme a/c"}</span></div>
            <div className="dz-acc-up">{r.received ? <><b className="tnum">{r.lastTxnAt != null ? `last txn ${hhmm(r.lastTxnAt)}` : "nothing moved"}</b><span>downloaded {hhmm(r.downloadedAt)}</span></> : <><b>—</b><span>{now < THREE_PM ? "downloads start after 3 PM" : "chase the bank"}</span></>}</div>
            <div className="dz-acc-bal"><b className="tnum">{r.received ? inr(r.closing) : "Not received"}</b><span title="System closing balance = the closing balance on the last line item in our tables for this account">system {inr(r.systemClosing)} · last line {r.lastTxnAt != null ? hhmm(r.lastTxnAt) : "opening"}{r.received ? `, updated ${hhmm(r.downloadedAt)}` : ""}</span>{r.received && r.utilised > 0 && <span className="cb-util">utilised {inrShort(r.utilised)} · remaining {inrShort(r.remaining)}</span>}</div>
            <div className="dz-acc-src">{r.check === "match" ? <span className="cb-chk match"><CheckCircle2 size={11} /> Matches</span> : r.check === "mismatch" ? <span className="cb-chk mismatch"><AlertTriangle size={11} /> Off by {inrShort(Math.abs(r.closing - r.systemClosing))}</span> : <span className="muted">not checked</span>}{r.source === "computed" && <span className="dz-chip info" title="Standard Chartered statements carry no closing balance"><Cpu size={11} /> computed</span>}</div>
            <span className={"dz-cut cb-sw s-" + (r.swept || "none")}>{isManager ? (r.swept === "full" ? `swept ${hhmm(r.sweepAt)}` : r.swept === "partial" ? `${r.sweptPct}% swept` : r.swept === "pending" ? "not swept" : "") : ""}</span>
          </div>
        ))}
        {shown.length > 200 && <p className="muted card-pad">Showing 200 of {shown.length}. Narrow with the filters, or export.</p>}
        {shown.length === 0 && <p className="muted card-pad">No accounts match these filters.</p>}
      </div>
    </div>
  );
}

function Sel({ label, v, on, opts, all, t }) {
  return (
    <label className="cb-sel"><span>{label}</span>
      <select className="select" value={v} onChange={(e) => on(e.target.value)} data-testid={t}>
        <option value="all">{all}</option>
        {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  );
}

/** Cumulative % of matched accounts fully swept, 10 AM–6 PM, with the 3 PM and 4 PM completion always labelled. */
function SweepChart({ rows, now, pctAt }) {
  const W = 460; const H = 170; const L = 34; const B = 24; const start = 10 * 60; const end = 18 * 60;
  const x = (m) => L + ((m - start) / (end - start)) * (W - L - 10);
  const y = (p) => 10 + (1 - p / 100) * (H - B - 10);
  const upto = Math.min(end, Math.max(start, now));
  const pts = []; for (let t = start; t <= upto; t += 5) pts.push([t, pctAt(t)]);
  if (pts.length && pts[pts.length - 1][0] !== upto) pts.push([upto, pctAt(upto)]);
  const line = pts.map(([t, p], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const area = pts.length ? `${line} L${x(pts[pts.length - 1][0]).toFixed(1)},${y(0)} L${x(start)},${y(0)} Z` : "";
  const pins = [[THREE_PM, "3 PM"], [FOUR_PM, "4 PM"]];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cb-sweep" role="img" aria-label={`Fully swept: ${pctAt(THREE_PM)}% at 3 PM, ${now >= FOUR_PM ? pctAt(FOUR_PM) + "%" : "not yet"} at 4 PM`}>
      <defs><linearGradient id="swg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={SWP.full} stopOpacity=".45" /><stop offset="1" stopColor={SWP.full} stopOpacity="0" /></linearGradient></defs>
      {[0, 50, 100].map((p) => <g key={p}><line x1={L} x2={W - 10} y1={y(p)} y2={y(p)} className="dz-grid" /><text x={L - 6} y={y(p) + 3} textAnchor="end" className="dz-axis">{`${p}%`}</text></g>)}
      {[10, 12, 14, 16, 18].map((h) => <text key={h} x={x(h * 60)} y={H - 6} textAnchor="middle" className="dz-axis">{`${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}`}</text>)}
      {area && <path d={area} fill="url(#swg)" />}
      {line && <path d={line} fill="none" stroke={SWP.full} strokeWidth="2.2" style={{ filter: `drop-shadow(0 0 6px ${SWP.full})` }} />}
      {pins.map(([t, l]) => {
        const reached = now >= t; const p = pctAt(t); const lx = l === "3 PM" ? x(t) - 70 : x(t) + 4; const ly = reached ? Math.max(12, y(p) - 26) : 12;
        return (
          <g key={l} data-testid={"sweep-pin-" + l.replace(" ", "")}>
            <line x1={x(t)} x2={x(t)} y1={10} y2={H - B} stroke={SWP.partial} strokeDasharray="3 3" />
            <rect x={lx} y={ly} width="66" height="18" rx="5" fill="#ffffff" stroke={SWP.partial} />
            <text x={lx + 33} y={ly + 12.5} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0f172a">{`${l}: ${reached ? p + "%" : "—"}`}</text>
            {reached && <circle cx={x(t)} cy={y(p)} r="4" fill={SWP.full} />}
          </g>
        );
      })}
      {!rows.length && <text x={W / 2} y={H / 2} textAnchor="middle" className="dz-axis">No matched accounts yet</text>}
    </svg>
  );
}
