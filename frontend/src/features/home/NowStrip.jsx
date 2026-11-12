// The top of both home screens (Recon Ops: Today; Central Setup Team: To do).
// Three counts that need you (approvals waiting, sent back, files that failed) and the time left to the fund release cutoff.
// A tile with work takes a soft tint; an empty tile turns quiet with a green "All clear".
import React from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { useStore } from "@/state/store";
import { inScope } from "@/lib/org";
import { RELEASE_CUTOFF } from "@/mock/opsSeed";
import { CountUp } from "@/features/viz/Viz";

/** Statuses that mean a file did not load: layout changed, unknown file, failed checks, or never arrived. */
export const FAILED_FILE = ["drift", "unknown", "check_failed", "missing"];

export function useFailedFiles() {
  const { collections, amcUser } = useStore();
  return (collections.files || []).filter((f) => FAILED_FILE.includes(f.status) && (!f.amc || inScope(amcUser, f.amc)));
}

/** Minutes left to today's fund release cutoff; refreshes every 30 seconds. */
export function useCutoffMins() {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  return Math.round((new Date(RELEASE_CUTOFF) - now) / 60000);
}

const DAY_START = 9; // the working day the bar is drawn against starts at 9:00
const fmtTime = (d) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export function NowTile({ kind, label, value, sub, clear, onClick, active, testid }) {
  const has = value > 0;
  return (
    <button type="button" className={"now-tile t-" + kind + (has ? " has" : " clear") + (active ? " on" : "")} onClick={onClick} aria-pressed={active} data-testid={testid}>
      <span className="now-tile-label"><i />{label}</span>
      <span className="now-go" aria-hidden="true"><ArrowUpRight size={16} /></span>
      <b className="tnum"><CountUp value={value} /></b>
      {has ? <small>{sub}</small> : <small><Check size={13} strokeWidth={2.5} /> {clear}</small>}
    </button>
  );
}

export function CutoffTile() {
  const mins = useCutoffMins();
  const cut = new Date(RELEASE_CUTOFF);
  const start = new Date(cut); start.setHours(DAY_START, 0, 0, 0);
  const pct = Math.max(0, Math.min(100, ((Date.now() - start) / (cut - start)) * 100));
  const tone = mins <= 0 ? "passed" : mins < 60 ? "soon" : "";
  const h = Math.floor(Math.max(mins, 0) / 60), m = Math.max(mins, 0) % 60;
  return (
    <div className={"now-tile now-cut " + tone} data-testid="now-cutoff" role="group" aria-label="Time left to fund release cutoff">
      <span className="now-cut-top"><span>Fund release cutoff</span><em>{fmtTime(cut)}</em></span>
      <b className="tnum">{mins > 0 ? <>{h > 0 && <>{h}<small>h</small> </>}{m}<small>min left</small></> : <>Passed</>}</b>
      <span className="now-day" aria-hidden="true"><i style={{ width: pct + "%" }} /><u style={{ left: pct + "%" }} /></span>
      <span className="now-day-scale"><span>{fmtTime(start)}</span><span>{mins > 0 ? `Now ${fmtTime(new Date())}` : "Release closed for today"}</span><span>{fmtTime(cut)}</span></span>
    </div>
  );
}

/** tiles: [{ kind: "approve" | "back" | "failed", label, value, sub, clear, onClick, active, testid }] */
export function NowStrip({ tiles, cutoff = true }) {
  return (
    <section className="now" aria-label="What needs you now" data-testid="now-strip">
      {tiles.map((t) => <NowTile key={t.kind} {...t} />)}
      {cutoff && <CutoffTile />}
    </section>
  );
}

export function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export const longDate = () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
