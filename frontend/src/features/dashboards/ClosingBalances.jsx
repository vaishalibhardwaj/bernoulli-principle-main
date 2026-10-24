import React from "react";
import { Banknote, Download, CheckCircle2, Clock, Moon, ArrowUpRight, ArrowDownRight, Cpu } from "lucide-react";
import { useStore } from "@/state/store";
import { inScope } from "@/lib/org";
import { maskAccount } from "@/lib/format";
import { inr, inrShort } from "@/features/ops/ui";
import { cutoffFor, fmtTime } from "@/features/cutoffs/Cutoffs";
import { downloadCsv } from "@/features/reports/csv";
import { TiltCard } from "@/features/viz/Viz";
import { C, Donut, DayTimeline, HBar, Kpi, minsNow, hhmm, ago } from "./dashViz";

const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/**
 * Closing balance per bank account, built around the same-day NAV cutoff: what has come in, what is still
 * awaited before its cutoff, and each account's latest closing balance. After an account's cutoff a missing
 * statement no longer matters for today, so it is set aside rather than highlighted.
 */
export default function ClosingBalances() {
  const { collections, amcUser } = useStore();
  const [asAt, setAsAt] = React.useState("now");
  const [only, setOnly] = React.useState("all");
  const now = asAt === "now" ? minsNow() : toMin(asAt);

  const rows = (collections.balances || []).filter((r) => inScope(amcUser, r.amc)).map((r) => {
    const cut = cutoffFor(collections.cutoffs, r.assetClass, r.schemeCode);
    const upAt = r.uploadedAgo != null ? minsNow() - r.uploadedAgo : null;
    const received = upAt != null && upAt <= now;
    const left = toMin(cut) - now;
    const state = received ? "in" : left > 0 ? "awaiting" : "missed";
    return { ...r, cut, upAt, state, left, delta: r.closing - r.prevClosing };
  });
  const order = { awaiting: 0, in: 1, missed: 2 };
  const count = (s) => rows.filter((r) => r.state === s).length;
  const shown = rows.filter((r) => only === "all" || (only === "computed" ? r.source === "computed" : r.state === only)).sort((a, b) => order[a.state] - order[b.state] || a.left - b.left || a.bankName.localeCompare(b.bankName));
  const total = rows.reduce((s, r) => s + r.closing, 0);
  const prev = rows.reduce((s, r) => s + r.prevClosing, 0);
  const awaiting = rows.filter((r) => r.state === "awaiting").sort((a, b) => a.left - b.left);
  const cutoffs = [...new Set(rows.map((r) => r.cut))].sort();
  const banks = Object.entries(rows.reduce((m, r) => ({ ...m, [r.bankName]: (m[r.bankName] || 0) + r.closing }), {})).sort((a, b) => b[1] - a[1]);
  const lanes = [...new Set(rows.map((r) => r.bankName))].map((b) => ({ label: b, runs: rows.filter((r) => r.bankName === b && r.upAt != null && r.upAt <= now).map((r) => ({ t: r.upAt, ok: r.upAt <= toMin(r.cut), warn: r.upAt > toMin(r.cut), big: true, note: maskAccount(r.accountNumber) })) }));

  const exportCsv = () => downloadCsv(`closing_balances_${new Date().toISOString().slice(0, 10)}.csv`, ["Bank", "Account", "Status", "Last uploaded", "Last closing balance", "Balance source", "Cutoff"],
    shown.map((r) => [r.bankName, maskAccount(r.accountNumber), { in: "Received", awaiting: "Awaiting", missed: "Missed cutoff" }[r.state], r.upAt != null && r.state === "in" ? hhmm(r.upAt) : "yesterday 6:40 PM", r.closing.toFixed(2), r.source === "computed" ? "Computed from our data" : "Bank statement", fmtTime(r.cut)]));

  return (
    <div className="dz" data-testid="closing-balances">
      <div className="dz-head">
        <div>
          <h1><Banknote size={22} /> Closing balances</h1>
          <p>Every account's latest closing balance, and whether its statement is in before the same-day NAV cutoff.</p>
        </div>
        <div className="dz-actions">
          <div className="segmented dz-asat" title="See the day at another time">{[["now", "Now"], ["12:00", "12 PM"], ["15:30", "3:30 PM"]].map(([v, l]) => <button key={v} className={asAt === v ? "on" : ""} onClick={() => setAsAt(v)} data-testid={"asat-" + v}>{l}</button>)}</div>
          <button className="btn btn-outline btn-sm" onClick={exportCsv}><Download size={14} /> Export</button>
        </div>
      </div>

      <div className="dz-hero">
        <TiltCard className="card dz-card" max={4}>
          <div className="dz-card-h">Statements in today</div>
          <div className="dz-health">
            <Donut size={156} value={`${count("in")}/${rows.length}`} sub="received"
              segments={[{ v: count("in"), color: C.ok }, { v: count("awaiting"), color: C.warn }, { v: count("missed"), color: "rgba(140,160,200,.45)" }]} />
            <ul className="dz-legend">
              <li><i style={{ background: C.ok }} />Received <b>{count("in")}</b></li>
              <li><i style={{ background: C.warn }} />Awaiting <b>{count("awaiting")}</b></li>
              <li><i style={{ background: "rgba(140,160,200,.6)" }} />Missed cutoff <b>{count("missed")}</b></li>
            </ul>
          </div>
        </TiltCard>

        <TiltCard className="card dz-card dz-cutoff" max={4}>
          <div className="dz-card-h">Next cutoff</div>
          {awaiting.length ? (<>
            <div className="dz-count"><b>{`${Math.floor(awaiting[0].left / 60)}h ${awaiting[0].left % 60}m`}</b><span>{`until the ${fmtTime(awaiting[0].cut)} cutoff · ${awaiting.length} still awaited`}</span></div>
            <div className="dz-await">{awaiting.slice(0, 3).map((r) => <span key={r.id}><Clock size={11} /> {r.bankName} ·{r.accountNumber.slice(-4)}</span>)}{awaiting.length > 3 && <span>+{awaiting.length - 3} more</span>}</div>
          </>) : (
            <div className="dz-count ok"><b><CheckCircle2 size={26} /></b><span>{count("missed") ? "Cutoffs passed — remaining statements aren't needed for today's NAV" : "Every statement is in"}</span></div>
          )}
          <div className="dz-cut-list">{cutoffs.map((c) => <span key={c} className={toMin(c) <= now ? "past" : ""}>{fmtTime(c)}</span>)}</div>
        </TiltCard>

        <div className="dz-kpis">
          <Kpi label="Total closing balance" value={inrShort(total)} sub={<span className={total >= prev ? "up" : "down"}>{total >= prev ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{`${Math.abs(((total - prev) / prev) * 100).toFixed(1)}% vs previous`}</span>} tone="info" />
          <Kpi label="Awaiting before cutoff" value={count("awaiting")} sub={count("awaiting") ? "chase the bank" : "none"} tone={count("awaiting") ? "warn" : "ok"} onClick={() => setOnly(only === "awaiting" ? "all" : "awaiting")} active={only === "awaiting"} testid="kpi-awaiting" />
          <Kpi label="Balances we computed" value={rows.filter((r) => r.source === "computed").length} sub="bank gives none" onClick={() => setOnly(only === "computed" ? "all" : "computed")} active={only === "computed"} testid="kpi-computed" />
          <Kpi label="Accounts" value={rows.length} sub={amcUser.amcs?.length === 1 ? amcUser.amcs[0] : "all your AMCs"} onClick={() => setOnly("all")} active={only === "all"} />
        </div>
      </div>

      <div className="dz-adv-grid">
        <div className="card dz-card">
          <div className="dz-card-h">When statements arrived <span className="muted">· dashed lines are cutoffs</span></div>
          <DayTimeline lanes={lanes} start={6 * 60} end={18 * 60} height={26} marks={cutoffs.map((c) => ({ t: toMin(c), label: fmtTime(c) }))} />
        </div>
        <div className="card dz-card">
          <div className="dz-card-h">Closing balance by bank</div>
          {banks.map(([b, v]) => <HBar key={b} label={b} value={v} max={banks[0][1]} right={inrShort(v)} />)}
        </div>
      </div>

      <div className="card dz-card dz-acc" data-testid="balance-table">
        <div className="dz-card-h">Accounts <span className="muted">· {shown.length}{only !== "all" ? ` · filtered` : ""}</span>{only !== "all" && <button className="link" style={{ marginLeft: "auto" }} onClick={() => setOnly("all")}>Show all</button>}</div>
        {shown.map((r) => (
          <div key={r.id} className={"dz-acc-row s-" + r.state} data-testid={"bal-" + r.id}>
            <span className={"dz-state s-" + r.state}>{r.state === "in" ? <><CheckCircle2 size={12} /> Received</> : r.state === "awaiting" ? <><Clock size={12} /> {Math.floor(r.left / 60)}h {r.left % 60}m left</> : <><Moon size={12} /> Missed cutoff</>}</span>
            <div className="dz-acc-name"><b>{r.bankName}</b><span className="tnum">{maskAccount(r.accountNumber)} · {r.assetClass}</span></div>
            <div className="dz-acc-up">{r.state === "in" ? <><b className="tnum">{hhmm(r.upAt)}</b><span>{ago(minsNow() - r.upAt)}</span></> : <><b>Yesterday 6:40 PM</b><span>{r.state === "missed" ? "not needed for today's NAV" : `cutoff ${fmtTime(r.cut)}`}</span></>}</div>
            <div className="dz-acc-bal"><b className="tnum">{inr(r.closing)}</b><span className={r.delta >= 0 ? "up" : "down"}>{r.delta >= 0 ? "+" : "−"}{inrShort(Math.abs(r.delta))} vs previous</span></div>
            <div className="dz-acc-src">{r.source === "computed" ? <span className="dz-chip info" title="Standard Chartered statements carry no closing balance"><Cpu size={11} /> computed by us</span> : <span className="muted">from bank</span>}</div>
            <span className="dz-cut tnum">{fmtTime(r.cut)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
