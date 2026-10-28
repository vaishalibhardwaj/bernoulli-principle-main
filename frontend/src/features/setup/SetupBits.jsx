import React from "react";
import { Check, X, PlugZap, Loader2, CalendarClock, GitCompareArrows, Info } from "lucide-react";
import { testNames, simulateTest, defaultSchedule, diffSetup, EFFECTIVE_NOTE } from "@/lib/setupSchema";

/** R4 / R6 — live preview of a file-name or subject pattern against names the bank actually sends. */
export function PatternTester({ pattern, kind = "regex", names, label = "Would these be picked up?" }) {
  const { invalid, results } = testNames(pattern, kind, names);
  if (!pattern) return <div className="pt-box muted" data-testid="pattern-tester">Type a pattern to see which names it picks up.</div>;
  if (invalid) return <div className="pt-box bad" data-testid="pattern-tester"><X size={13} /> This pattern is not valid. Check brackets and backslashes.</div>;
  const hits = results.filter((r) => r.ok).length;
  return (
    <div className="pt-box" data-testid="pattern-tester">
      <div className="pt-head">{label} <b>{hits} of {results.length} match</b></div>
      {results.map((r) => <div key={r.name} className={"pt-row " + (r.ok ? "ok" : "no")}>{r.ok ? <Check size={12} /> : <X size={12} />}<span className="tnum">{r.name}</span><em>{r.ok ? "picked up" : "ignored"}</em></div>)}
    </div>
  );
}

/** R5 — when Auto / API pulls run. */
export function ScheduleField({ value, onChange, disabled }) {
  const s = value || defaultSchedule();
  const set = (p) => onChange({ ...s, ...p });
  return (
    <div className="field full" data-testid="schedule-field">
      <label className="field-label"><CalendarClock size={13} style={{ verticalAlign: -2 }} /> Pull schedule</label>
      <div className="sched">
        <div className="segmented">
          <button type="button" disabled={disabled} className={s.kind === "interval" ? "on" : ""} onClick={() => set({ kind: "interval" })}>Every few minutes</button>
          <button type="button" disabled={disabled} className={s.kind === "daily" ? "on" : ""} onClick={() => set({ kind: "daily" })}>Once a day</button>
        </div>
        {s.kind === "interval" ? (
          <span className="sched-row">Every <select className="select sched-sel" disabled={disabled} value={s.every} onChange={(e) => set({ every: Number(e.target.value) })}>{[15, 30, 60, 120].map((n) => <option key={n} value={n}>{n} min</option>)}</select>
            between <input className="input sched-time" type="time" disabled={disabled} value={s.from} onChange={(e) => set({ from: e.target.value })} /> and <input className="input sched-time" type="time" disabled={disabled} value={s.to} onChange={(e) => set({ to: e.target.value })} /></span>
        ) : (
          <span className="sched-row">At <input className="input sched-time" type="time" disabled={disabled} value={s.at} onChange={(e) => set({ at: e.target.value })} /> every day</span>
        )}
      </div>
    </div>
  );
}

/** R5 — one real call with the entered credentials; shows the first rows so the maker sees it works before submitting. */
export function TestConnection({ conn, mode, onResult }) {
  const [state, setState] = React.useState(null);
  const run = () => {
    setState({ loading: true });
    setTimeout(() => { const r = simulateTest(conn, mode); setState(r); onResult && onResult(r); }, 900);
  };
  return (
    <div className="tc-box" data-testid="test-connection">
      <div className="tc-head">
        <button type="button" className="btn btn-outline" onClick={run} disabled={state?.loading} data-testid="btn-test-connection">{state?.loading ? <Loader2 className="spin" size={15} /> : <PlugZap size={15} />} Test connection</button>
        <span className="muted">Calls the bank once with these details. Nothing is loaded.</span>
      </div>
      {state && !state.loading && (
        state.ok ? (
          <div className="tc-ok" data-testid="test-ok">
            <div><Check size={14} /> {state.message} <span className="muted">({state.ms} ms)</span></div>
            <table className="tc-rows"><thead><tr><th>Date</th><th>Narration</th><th>Amount</th><th>Dr/Cr</th></tr></thead>
              <tbody>{state.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 2 ? "tnum" : ""}>{c}</td>)}</tr>)}</tbody></table>
          </div>
        ) : <div className="tc-bad" data-testid="test-fail"><X size={14} /> {state.message}</div>
      )}
    </div>
  );
}

/** R7 — what this submission changes against the live (last approved) version. */
export function ChangesCard({ base, cur, compact, exclude = [] }) {
  const full = diffSetup(base, cur);
  // Fields already shown elsewhere on the page (e.g. a layout-change proposal) are not repeated.
  const diff = full && exclude.length ? full.filter((d) => !exclude.some((x) => String(d.field).includes(x))) : full;
  if (full && full.length && exclude.length && !diff.length) return null;
  return (
    <div className="chg-card" data-testid="changes-card">
      <div className="chg-head"><GitCompareArrows size={15} /> {diff === null ? "New setup — nothing is live for this yet" : diff.length === 0 ? "No changes against the live version" : `${diff.length} change${diff.length > 1 ? "s" : ""} against the live version`}</div>
      {diff && diff.length > 0 && (
        <table className="chg-table"><thead><tr><th>Field</th><th>Live now</th><th>After approval</th></tr></thead>
          <tbody>{diff.slice(0, compact ? 8 : 40).map((d) => <tr key={d.field} data-testid={"chg-" + d.field}><td>{d.field}</td><td className="was">{d.from}</td><td className="now">{d.to}</td></tr>)}</tbody></table>
      )}
      <div className="chg-note"><Info size={13} /> {EFFECTIVE_NOTE}</div>
    </div>
  );
}
