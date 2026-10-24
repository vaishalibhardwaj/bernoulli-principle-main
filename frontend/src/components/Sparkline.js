import React from "react";

// Tiny inline SVG sparkline (no deps)
export default function Sparkline({ data = [], width = 120, height = 36, color = "hsl(var(--primary))", fill = true, id }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const sx = width / (data.length - 1 || 1);
  const sy = (v) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const pts = data.map((v, i) => [i * sx, sy(v)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L${width} ${height} L0 ${height} Z`;
  const gid = "sg-" + (id || Math.random().toString(36).slice(2, 7));
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="spark" data-testid={id}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

// Deterministic pseudo-series from a seed string so demo charts are stable
export function seriesFor(seed, len = 14, base = 6) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    v = Math.max(0, v + ((h % 7) - 3));
    out.push(v);
  }
  return out;
}
