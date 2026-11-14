// Calm, moving charts. Each draws in once when it appears and then rests; nothing loops except one soft
// pulse on a "live" end point. People who ask their computer to reduce motion see the finished chart.
// Colours come from theme/tokens.css. Every chart has a text label for screen readers.
import React from "react";

/** A row of dots whose size follows each value, like a quiet bar chart. values: number[]; tone: "accent" | "sage" | "bad". */
export function DotStrip({ values, max, tone = "accent", label, height = 22 }) {
  const top = max || Math.max(1, ...values);
  return (
    <span className={"mo-dots " + tone} style={{ height }} role="img" aria-label={label}>
      {values.map((v, i) => {
        const r = v <= 0 ? 2 : 3 + (v / top) * 6;
        return <i key={i} style={{ width: r * 2, height: r * 2, opacity: v <= 0 ? 0.35 : 0.45 + (v / top) * 0.55, animationDelay: `${i * 28}ms` }} />;
      })}
    </span>
  );
}

const smooth = (pts) => pts.reduce((d, [x, y], i, a) => {
  if (!i) return `M${x},${y}`;
  const [px, py] = a[i - 1]; const cx = (px + x) / 2;
  return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
}, "");

/** A smooth line with a soft fill that draws itself in. series: [{ label, value }]. */
export function AreaTrend({ series, label, format = (v) => v, height = 180, tone = "accent", width = 560 }) {
  const W = width, H = height, L = 8, R = 8, T = 16, B = 26;
  const max = Math.max(1, ...series.map((s) => s.value));
  const x = (i) => L + (series.length < 2 ? (W - L - R) / 2 : (i / (series.length - 1)) * (W - L - R));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const pts = series.map((s, i) => [x(i), y(s.value)]);
  const line = smooth(pts);
  const area = pts.length ? `${line} L${x(series.length - 1)},${H - B} L${x(0)},${H - B} Z` : "";
  const id = React.useId().replace(/:/g, "");
  const last = pts[pts.length - 1];
  return (
    <svg className={"mo-area " + tone} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${series.map((s) => `${s.label} ${format(s.value)}`).join(", ")}`}>
      <defs>
        <linearGradient id={"g" + id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".22" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient>
      </defs>
      {[0, .5, 1].map((f) => <line key={f} x1={L} x2={W - R} y1={T + (H - T - B) * f} y2={T + (H - T - B) * f} className="mo-grid" />)}
      {area && <path d={area} fill={`url(#g${id})`} className="mo-fill" />}
      {line && <path d={line} className="mo-line" pathLength="1" />}
      {series.map((s, i) => <text key={s.label} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"} className="mo-axis">{s.label}</text>)}
      {last && <g className="mo-end"><circle cx={last[0]} cy={last[1]} r="9" className="mo-halo" /><circle cx={last[0]} cy={last[1]} r="4.5" className="mo-dot" /></g>}
      {last && <text x={last[0] - 12} y={last[1] - 14} textAnchor="end" className="mo-val">{format(series[series.length - 1].value)}</text>}
    </svg>
  );
}

/** Stacked columns that rise in turn. cols: [{ label, parts: { key: n } }]; keys: [{ key, label, cls }]. */
export function RiseBars({ cols, keys, label, height = 180, width = 560 }) {
  const W = width, H = height, B = 24, T = 8;
  const max = Math.max(1, ...cols.map((c) => keys.reduce((t, k) => t + (c.parts[k.key] || 0), 0)));
  const band = W / Math.max(1, cols.length), bw = Math.min(18, band * 0.55);
  return (
    <svg className="mo-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${cols.map((c) => `${c.label} ${keys.map((k) => `${c.parts[k.key] || 0} ${k.label.toLowerCase()}`).join(", ")}`).join("; ")}`}>
      <line x1="0" x2={W} y1={H - B} y2={H - B} className="mo-grid" />
      {cols.map((c, i) => {
        let acc = 0; const cx = band * i + band / 2;
        return (
          <g key={c.label} className="mo-col" style={{ animationDelay: `${i * 40}ms` }}>
            <title>{`${c.label}: ${keys.map((k) => `${c.parts[k.key] || 0} ${k.label.toLowerCase()}`).join(", ")}`}</title>
            {keys.map((k) => {
              const v = c.parts[k.key] || 0; if (!v) return null;
              const h = (v / max) * (H - B - T); const yy = H - B - acc - h; acc += h + 2;
              return <rect key={k.key} x={cx - bw / 2} y={yy} width={bw} height={Math.max(1, h)} rx={Math.min(bw / 2, 6, h / 2)} className={"mo-seg " + k.cls} />;
            })}
            {(cols.length <= 12 || i % Math.ceil(cols.length / 12) === 0) && <text x={cx} y={H - 6} textAnchor="middle" className="mo-axis">{c.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** A ring split into parts, drawn in clockwise. parts: [{ label, value, cls }]. */
export function Ring({ parts, label, center, sub, size = 168 }) {
  const total = Math.max(1, parts.reduce((t, p) => t + p.value, 0));
  const r = 62, c = 2 * Math.PI * r; let off = 0;
  return (
    <div className="mo-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
        <circle cx="80" cy="80" r={r} className="mo-track" />
        {parts.map((p, i) => {
          const len = (p.value / total) * c; const gap = parts.filter((x) => x.value).length > 1 ? 3 : 0;
          const el = p.value ? <circle key={p.label} cx="80" cy="80" r={r} className={"mo-arc " + p.cls} strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-off} style={{ animationDelay: `${i * 120}ms` }} transform="rotate(-90 80 80)" /> : null;
          off += len; return el;
        })}
      </svg>
      <span className="mo-ring-c"><b className="tnum">{center}</b>{sub && <small>{sub}</small>}</span>
    </div>
  );
}
