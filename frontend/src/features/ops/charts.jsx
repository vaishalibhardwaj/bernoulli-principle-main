import React from "react";

/**
 * Single-series line chart with crosshair + tooltip and an optional dashed target line.
 * Thin 2px line, recessive grid, values in text ink (dataviz method: one hue, one axis).
 */
export function LineChart({ data, height = 200, min, max, target, format = (v) => v, label = "", id }) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(600);
  const [hover, setHover] = React.useState(null);
  React.useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const lo = min ?? Math.min(...data.map((d) => d.v)); const hi = max ?? Math.max(...data.map((d) => d.v));
  const x = (i) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.v)}`).join(" ");
  const area = `${path} L${x(data.length - 1)},${height - pad.b} L${x(0)},${height - pad.b} Z`;
  const ticks = 4; const tv = Array.from({ length: ticks + 1 }, (_, i) => lo + ((hi - lo) * i) / ticks);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect(); const px = e.clientX - r.left;
    const i = Math.round(((px - pad.l) / (w - pad.l - pad.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <div className="lc" ref={ref} onPointerMove={onMove} onPointerLeave={() => setHover(null)} data-testid={id} role="img" aria-label={label}>
      <svg width={w} height={height}>
        <defs><linearGradient id="lcGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#39d0ff" stopOpacity=".35" /><stop offset="100%" stopColor="#39d0ff" stopOpacity="0" /></linearGradient></defs>
        {tv.map((v) => <g key={v}><line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} className="lc-grid" /><text x={pad.l - 8} y={y(v) + 4} className="lc-axis" textAnchor="end">{format(v)}</text></g>)}
        {data.map((d, i) => (i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && <text key={i} x={x(i)} y={height - 8} className="lc-axis" textAnchor="middle">{d.label}</text>)}
        {target != null && <g><line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} className="lc-target" /><text x={w - pad.r} y={y(target) - 5} textAnchor="end" className="lc-target-label">Target {format(target)}</text></g>}
        <path d={area} className="lc-area" />
        <path d={path} className="lc-line" />
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].v)} r="4" className="lc-dot" />
        {hover != null && <g><line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} className="lc-cross" /><circle cx={x(hover)} cy={y(data[hover].v)} r="5" className="lc-dot hover" /></g>}
      </svg>
      {hover != null && (
        <div className="lc-tip" style={{ left: Math.min(w - 140, Math.max(0, x(hover) - 60)), top: Math.max(0, y(data[hover].v) - 58) }}>
          <b>{format(data[hover].v)}</b><span>{data[hover].label}{data[hover].note ? ` · ${data[hover].note}` : ""}</span>
        </div>
      )}
    </div>
  );
}

/** Tiny trend line for KPI tiles and table rows (no axes; the number beside it carries the value). */
export function Spark({ values, width = 90, height = 28, bad }) {
  const lo = Math.min(...values); const hi = Math.max(...values) || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - lo) / (hi - lo || 1)) * (height - 4)}`).join(" ");
  return <svg width={width} height={height} className={"spark-svg" + (bad ? " bad" : "")} aria-hidden="true"><polyline points={pts} /></svg>;
}

/** Horizontal bars with per-bar hover (value + share). One hue: magnitude, not identity. */
export function BarList({ rows, total, format = (v) => v }) {
  const max = Math.max(...rows.map((r) => r.v), 1);
  return (
    <div className="barlist">
      {rows.map((r) => (
        <div key={r.label} className={"bl-row" + (r.tone ? " " + r.tone : "")} title={`${r.label}: ${format(r.v)}${total ? ` (${((r.v / total) * 100).toFixed(1)}%)` : ""}`}>
          <span className="bl-label">{r.label}</span>
          <span className="bl-track"><i style={{ width: `${Math.max(1, (r.v / max) * 100)}%` }} /></span>
          <b className="tnum">{format(r.v)}</b>
          {total && <span className="bl-pct tnum">{((r.v / total) * 100).toFixed(1)}%</span>}
        </div>
      ))}
    </div>
  );
}
