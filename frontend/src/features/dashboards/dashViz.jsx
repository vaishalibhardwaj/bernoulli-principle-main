import React from "react";
import { motion } from "framer-motion";

export const C = { ok: "#4ff0b4", bad: "#ff6b86", warn: "#ffc56b", info: "#39d0ff", mute: "rgba(120,165,255,.18)", blue: "#2f8cf0", violet: "#b48cff" };
export const minsNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const hhmm = (m) => { const h = Math.floor(((m % 1440) + 1440) % 1440 / 60), mm = Math.round(((m % 60) + 60) % 60); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
export const ago = (min) => (min == null ? "—" : min < 1 ? "just now" : min < 60 ? `${Math.round(min)}m ago` : `${Math.floor(min / 60)}h ${Math.round(min % 60)}m ago`);

/** Donut with a big centre number. segments: [{ v, color, label }] */
export function Donut({ segments, size = 150, thickness = 14, value, sub }) {
  const r = size / 2 - thickness / 2 - 2; const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.v, 0) || 1;
  let acc = 0;
  return (
    <div className="dz-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.mute} strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.v / total) * c; const off = acc; acc += len;
          return s.v ? <motion.circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeDasharray={`${len} ${c - len}`} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: -off }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }} style={{ filter: `drop-shadow(0 0 6px ${s.color}66)` }} /> : null;
        })}
      </svg>
      <div className="dz-center"><b className="fx-num">{value}</b>{sub && <span>{sub}</span>}</div>
    </div>
  );
}

/** Last N runs as small glowing bars, oldest → newest. */
export function RunStrip({ runs }) {
  return <span className="dz-runs" aria-label={`${runs.filter(Boolean).length} of ${runs.length} recent runs succeeded`}>{runs.map((ok, i) => <i key={i} style={{ background: ok ? C.ok : C.bad, boxShadow: `0 0 6px ${ok ? C.ok : C.bad}88` }} />)}</span>;
}

/**
 * Day timeline from `start` to `end` (minutes of day): one lane per row with run dots, a "now" line,
 * optional vertical marks (cutoffs) and a ghost dot for the next expected run.
 */
export function DayTimeline({ lanes, start = 7 * 60, end = 21 * 60, marks = [], height = 30, pxPerHour }) {
  const ref = React.useRef(null);
  const scrollRef = React.useRef(null);
  const [w, setW] = React.useState(700);
  React.useEffect(() => { const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width))); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }, []);
  // Scrollable mode: lane names stay pinned on the left, the hours scroll sideways and open on "now".
  const scroll = Boolean(pxPerHour);
  const L = scroll ? 0 : 190;
  const width = scroll ? Math.max(w - 200, ((end - start) / 60) * pxPerHour + 24) : w;
  const x = (m) => L + 12 + ((Math.min(end, Math.max(start, m)) - start) / (end - start)) * (width - L - 24);
  const now = minsNow(); const H = lanes.length * height + 26;
  const hours = []; for (let h = Math.ceil(start / 60); h <= end / 60; h += scroll ? 1 : 2) hours.push(h * 60);
  React.useEffect(() => { if (scroll && scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, x(now) - scrollRef.current.clientWidth * 0.7); }, [scroll, width]); // eslint-disable-line react-hooks/exhaustive-deps
  const svg = (
    <svg width={width} height={H}>
      {hours.map((m) => <g key={m}><line x1={x(m)} x2={x(m)} y1={0} y2={H - 20} className="dz-grid" /><text x={x(m)} y={H - 6} className="dz-axis" textAnchor="middle">{hhmm(m % (24 * 60)).replace(":00", "")}</text></g>)}
      {marks.map((mk) => <g key={mk.label}><line x1={x(mk.t)} x2={x(mk.t)} y1={0} y2={H - 20} stroke={mk.color || C.warn} strokeDasharray="4 4" strokeWidth="1.5" /><text x={x(mk.t) + 4} y={10} fill={mk.color || C.warn} fontSize="10.5">{mk.label}</text></g>)}
      {lanes.map((ln, i) => {
        const cy = i * height + height / 2 + 4;
        return (
          <g key={ln.label}>
            {!scroll && <text x={0} y={cy + 4} className="dz-lane">{ln.label.length > 28 ? ln.label.slice(0, 27) + "…" : ln.label}</text>}
            <line x1={L + 12} x2={width - 12} y1={cy} y2={cy} className="dz-lane-line" />
            {ln.runs.map((r, k) => <circle key={k} cx={x(r.t)} cy={cy} r={r.big ? 5 : 3.5} fill={r.ok ? C.ok : r.warn ? C.warn : C.bad} style={{ filter: `drop-shadow(0 0 4px ${r.ok ? C.ok : C.bad})` }}><title>{`${hhmm(r.t)} — ${r.ok ? "ok" : "failed"}${r.note ? " · " + r.note : ""}`}</title></circle>)}
            {ln.next != null && <circle cx={x(ln.next)} cy={cy} r={4} fill="none" stroke={ln.nextLate ? C.bad : C.info} strokeDasharray="2 2"><title>{`next ${hhmm(ln.next)}`}</title></circle>}
          </g>
        );
      })}
      {now > start && now < end && <g><line x1={x(now)} x2={x(now)} y1={0} y2={H - 20} stroke={C.info} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 6px ${C.info})` }} /><text x={x(now)} y={H - 20 + 0} dy="-4" textAnchor="middle" fill={C.info} fontSize="10">now</text></g>}
    </svg>
  );
  if (!scroll) return <div ref={ref} className="dz-timeline">{svg}</div>;
  return (
    <div ref={ref} className="dz-timeline dz-timeline-scroll" data-testid="day-timeline">
      <div className="dz-tl-labels" style={{ paddingTop: 4 }}>
        {lanes.map((ln) => <div key={ln.label} style={{ height }} title={ln.label}>{ln.label}</div>)}
      </div>
      <div className="dz-tl-scroll" ref={scrollRef}>{svg}</div>
    </div>
  );
}

/** Horizontal glowing bar with label and value. */
export function HBar({ label, value, max, color = C.info, right }) {
  return (
    <div className="dz-hbar">
      <span className="dz-hbar-l">{label}</span>
      <span className="dz-hbar-t"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(2, (value / (max || 1)) * 100)}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} style={{ background: color, boxShadow: `0 0 10px ${color}88` }} /></span>
      <b className="dz-hbar-v tnum">{right ?? value}</b>
    </div>
  );
}

/** KPI tile: label, big number, small context line, tone. */
export function Kpi({ label, value, sub, tone = "", onClick, active, testid }) {
  return (
    <button type="button" className={"dz-kpi tone-" + tone + (active ? " on" : "") + (onClick ? " clickable" : "")} onClick={onClick} data-testid={testid}>
      <span className="dz-kpi-l">{label}</span>
      <b className="dz-kpi-v fx-num">{value}</b>
      {sub && <span className="dz-kpi-s">{sub}</span>}
    </button>
  );
}
