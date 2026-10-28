import React from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/state/store";
import { TODAY } from "@/mock/opsSeed";
import { hasCap } from "@/lib/access";
import { inrShort, num, dur } from "@/features/ops/ui";
import { LineChart, Spark, BarList } from "@/features/ops/charts";
import { useCycle } from "@/features/today/Cycle";
import { TiltCard, CoreOrb, FlowStreams, Towers3D, CountUp } from "@/features/viz/Viz";
import { Gauge, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { downloadCsv } from "@/features/reports/csv";
import ManagerData from "./ManagerData";

const BUCKETS = [["0–1d", 0, 24], ["1–2d", 24, 48], ["2–3d", 48, 72], ["3–5d", 72, 120], [">5d", 120, 9999]];
const dayLabel = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); };

/** Team-lead dashboard: is today on track, where is the risk, who is overloaded. */
export default function CommandCentre() {
  const { collections, perms } = useStore();
  const nav = useNavigate();
  const { all: steps } = useCycle();
  const [range, setRange] = React.useState(14);
  const canExport = hasCap(perms, "command", "export");
  const today = new Date().toISOString().slice(0, 10);
  const go = (screen, path) => (hasCap(perms, screen) ? () => nav(path) : undefined);
  const files = collections.files || [];
  const ex = collections.exceptions || [];
  const openEx = ex.filter((e) => e.status !== "closed");
  const atRisk = openEx.filter((e) => e.amount > 0 && e.interestHoursLeft < 24);
  const proposed = (collections.matches || []).filter((m) => m.status !== "rejected").length;

  // Aggregate auto-match rate across banks, per day
  const days = TODAY.matchTrend[0].series.length;
  const trend = Array.from({ length: days }, (_, d) => ({ v: TODAY.matchTrend.reduce((s, b) => s + b.series[d], 0) / TODAY.matchTrend.length, label: dayLabel(days - 1 - d) })).slice(-range);
  trend[trend.length - 1].note = "ICICI layout change";
  const stp = (TODAY.auto / TODAY.credits) * 100;
  const prevStp = trend[trend.length - 2].v;

  const kpis = [
    { label: "Auto-match rate", value: `${stp.toFixed(1)}%`, delta: stp - prevStp, unit: "pts vs yesterday", spark: trend.map((t) => t.v), good: stp >= 90, upIsGood: true, note: "North-star · target 90%" },
    { label: "Realised for allotment", value: inrShort(TODAY.realisedForAllotment), delta: 4.2, unit: "% vs 7-day avg", spark: [18, 19, 17, 21, 20, 19, 22, 20, 21, 23, 22, 21, 22, 24], good: true, upIsGood: true, note: `${inrShort(TODAY.heldForAllotment)} held` },
    { label: "Open problem cases", value: num(openEx.length), delta: -3, unit: "vs yesterday", spark: [52, 49, 47, 51, 45, 44, 46, 43, 41, 44, 40, 39, 41, openEx.length], good: true, upIsGood: false, onClick: go("exceptions", "/exceptions"), note: `${ex.filter((e) => e.status === "pending_approval").length} waiting for checker` },
    { label: "Penalty-interest risk", value: inrShort(atRisk.reduce((s, e) => s + e.amount, 0)), delta: atRisk.length, unit: "cases under 24h", spark: [3, 4, 2, 5, 6, 4, 7, 5, 8, 6, 9, 7, 10, atRisk.length], good: false, upIsGood: false, onClick: go("exceptions", "/exceptions?risk=1"), note: "Clear before 5 days to avoid interest" },
  ];

  const funnel = [
    { label: "Matched by rules", v: TODAY.auto },
    { label: "Suggested → confirmed", v: TODAY.aiAccepted + proposed },
    { label: "Matched by hand", v: TODAY.manual },
    { label: "Still open", v: TODAY.credits - TODAY.auto - TODAY.aiAccepted - TODAY.manual - proposed, tone: "warn" },
  ];

  // Ageing watch: only the three case types the business tracks here.
  const WATCH = [["NIGO rejection", "NIGO refund pending"], ["Excess credit", "Excess credit"], ["Unmatched purchase", "Unmatched purchase"]];
  const heat = WATCH.map(([type, label]) => {
    const list = openEx.filter((e) => e.type === type);
    return { type, label, total: list.length, amt: list.reduce((s, e) => s + e.amount, 0), breach: list.filter((e) => e.ageHours >= 120).length,
      cells: BUCKETS.map(([, lo, hi]) => { const l = list.filter((e) => e.ageHours >= lo && e.ageHours < hi); return { n: l.length, amt: l.reduce((s, e) => s + e.amount, 0) }; }) };
  });
  const maxHeat = Math.max(1, ...heat.flatMap((r) => r.cells.map((c) => c.n)));


  const release = (collections.releases || [])[0] || { status: "not_started" };
  const refundsOut = (collections.refunds || []).filter((r) => ["draft", "pending", "approved"].includes(r.status)).reduce((x, r) => x + r.amount, 0);
  const exAmt = openEx.reduce((x, e) => x + e.amount, 0);
  const flowSources = [
    { label: "Bank statements", v: TODAY.creditValue * 0.78 },
    { label: "PA settlements", v: TODAY.creditValue * 0.17 },
    { label: "PDF / email MIS", v: TODAY.creditValue * 0.05 },
  ];
  const flowOut = [
    { label: release.status === "released" ? "Released to Posting" : "Ready to release", v: TODAY.realisedForAllotment, color: "#4ff0b4" },
    { label: "Held — not matched", v: Math.max(0, TODAY.heldForAllotment - exAmt - refundsOut), color: "#ffc56b" },
    { label: "Problem cases", v: exAmt, color: "#ff6b86" },
    { label: "Refunds", v: refundsOut, color: "#b48cff" },
  ];
  const towers = TODAY.matchTrend.map((b) => { const s = b.series.slice(-range); const last = s[s.length - 1]; return { label: b.bank, code: b.code, v: last, bad: last < s[s.length - 2] - 4 }; });

  return (
    <div className="dash" data-testid="command-centre">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Gauge size={22} /> Command deck</h1>
          <p>Live picture of today's money: how much matched, where it went, which banks are slipping, and who needs help.</p>
        </div>
        <div className="actions"><span className="live-dot">Live</span><div className="segmented">{[[7, "7 days"], [14, "14 days"]].map(([v, l]) => <button key={v} className={range === v ? "on" : ""} onClick={() => setRange(v)}>{l}</button>)}</div></div>
      </div>

      <div className="dash-hero">
        <TiltCard className="card orb-card">
          <div className="card-head"><h3>Reconciliation core</h3><span className="muted">Payments matched automatically today</span></div>
          <div className="orb-wrap">
            <CoreOrb value={stp} target={90} label="auto-matched" sub="target 90%" size={230} />
            <div className="orb-facts">
              <div><span>Payments today</span><b className="fx-num"><CountUp value={TODAY.credits} /></b></div>
              <div><span>Value</span><b className="fx-num">{inrShort(TODAY.creditValue)}</b></div>
              <div><span>Steps done</span><b className="fx-num">{steps.filter((x) => x.state === "done").length}/6</b></div>
            </div>
          </div>
        </TiltCard>
        <div className="card flow-card">
          <div className="card-head"><h3>Where today's money went</h3><span className="muted">Hover a stream to isolate it</span></div>
          <div className="card-pad"><FlowStreams sources={flowSources} outcomes={flowOut} format={inrShort} height={250} /></div>
        </div>
      </div>

      <div className="kpi-cards">
        {kpis.map((k) => (
          <TiltCard key={k.label} className="kpi-card" max={6} onClick={k.onClick} role={k.onClick ? "button" : undefined} style={{ cursor: k.onClick ? "pointer" : "default" }}>
            <span className="kc-label">{k.label}</span>
            <div className="kc-row"><b className="tnum">{k.value}</b><Spark values={k.spark} bad={!k.good} /></div>
            <span className={"kc-delta " + ((k.delta >= 0) === k.upIsGood ? "up" : "down")}>{k.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(k.delta).toFixed(k.delta % 1 ? 1 : 0)} {k.unit}</span>
            <span className="kc-note">{k.note}</span>
          </TiltCard>
        ))}
      </div>

      <div className="dash-2">
        <div className="card">
          <div className="card-head"><h3>Auto-match rate by bank</h3><span className="muted">Taller = better · red = dropped today · click to open bank files</span>
            {canExport && <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => downloadCsv(`auto_match_by_bank_${today}.csv`, ["Bank", ...TODAY.matchTrend[0].series.map((_, i) => dayLabel(TODAY.matchTrend[0].series.length - 1 - i))], TODAY.matchTrend.map((b) => [b.bank, ...b.series.map((v) => v.toFixed(1))]))} data-testid="export-towers"><Download size={13} /> Export</button>}</div>
          <div className="card-pad"><Towers3D items={towers} format={(v) => `${v.toFixed(1)}%`} onPick={() => go("ingestion", "/ingestion")?.()} /></div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Auto-match trend · all banks</h3><span className="muted">Hover for daily values</span></div>
          <div className="card-pad"><LineChart id="match-trend" data={trend} min={80} max={100} target={90} format={(v) => `${v.toFixed(0)}%`} label="Auto-match rate trend" height={250} /></div>
        </div>
      </div>

      <ManagerData />

      <div className="card age-watch" data-testid="ageing-watch">
        <div className="card-head"><h3>Ageing watch</h3><span className="muted">Open cases by age · penalty interest starts after 5 days · click a row to open them</span>
          {canExport && <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => downloadCsv(`ageing_watch_${today}.csv`, ["Case type", "Open", ...BUCKETS.map(([l]) => l), "Amount", "Past 5 days"], heat.map((r) => [r.label, r.total, ...r.cells.map((x) => x.n), r.amt, r.breach]))} data-testid="export-ageing"><Download size={13} /> Export</button>}</div>
        <div className="aw-grid">
          <div className="aw-h"><span /><span>Open</span>{BUCKETS.map(([l]) => <span key={l} className={l === ">5d" ? "hot" : ""}>{l}</span>)}<span>Past 5 days</span></div>
          {heat.map((r) => (
            <button key={r.type} className="aw-row" onClick={go("exceptions", "/exceptions?age=over5")} data-testid={"aw-" + r.type}>
              <span className="aw-label"><b>{r.label}</b><em>{inrShort(r.amt)}</em></span>
              <span className="aw-total fx-num">{r.total}</span>
              {r.cells.map((c, i) => (
                <span key={i} className={"aw-cell" + (i === 4 && c.n ? " hot" : "")} style={{ "--h": c.n / maxHeat }} title={`${r.label}, ${BUCKETS[i][0]}: ${c.n} · ${inrShort(c.amt)}`}>
                  {c.n ? <><b>{c.n}</b><small>{inrShort(c.amt)}</small></> : <small className="muted">—</small>}
                </span>
              ))}
              <span className={"aw-breach" + (r.breach ? " on" : "")}>{r.breach ? `${r.breach} breached` : "none"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
