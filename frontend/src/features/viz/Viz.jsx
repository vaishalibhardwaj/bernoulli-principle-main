// Interactive, depth-based visuals for the CAMS Command Deck.
// All SVG/CSS 3D + framer-motion (already a dependency) — no WebGL, so they stay light and crisp.
import React from "react";
import { motion, useMotionValue, useSpring, useTransform, animate } from "framer-motion";

/** Card that tilts toward the pointer in 3D, with a moving glare. */
export function TiltCard({ children, className = "", max = 8, ...rest }) {
  const mx = useMotionValue(0.5); const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [max, -max]), { stiffness: 160, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-max, max]), { stiffness: 160, damping: 18 });
  const gx = useTransform(mx, (v) => `${v * 100}%`); const gy = useTransform(my, (v) => `${v * 100}%`);
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width); my.set((e.clientY - r.top) / r.height); };
  return (
    <motion.div className={"tilt " + className} style={{ rotateX: rx, rotateY: ry, "--gx": gx, "--gy": gy }} onPointerMove={onMove} onPointerLeave={() => { mx.set(0.5); my.set(0.5); }} {...rest}>
      <div className="tilt-glare" />
      {children}
    </motion.div>
  );
}

/** Number that counts up when it changes. */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString("en-IN"), duration = 1.1 }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => { const c = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setV }); return () => c.stop(); }, [value, duration]);
  return <span className="fx-num">{format(v)}</span>;
}

/** Glowing ring gauge with orbiting particles — the "reconciliation core". */
export function CoreOrb({ value, target = 90, label, sub, size = 240 }) {
  const r = size / 2 - 18; const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const t = (target / 100) * 360 - 90;
  return (
    <div className="core-orb" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="orbArc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#39d0ff" /><stop offset="100%" stopColor="#2f8cf0" /></linearGradient>
          <radialGradient id="orbCore"><stop offset="0%" stopColor="rgba(57,208,255,.35)" /><stop offset="70%" stopColor="rgba(11,80,157,.15)" /><stop offset="100%" stopColor="rgba(11,80,157,0)" /></radialGradient>
          <filter id="orbGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r - 18} fill="url(#orbCore)" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(120,165,255,.12)" strokeWidth="12" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#orbArc)" strokeWidth="12" strokeLinecap="round" filter="url(#orbGlow)"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }} />
        <line x1={size / 2 + (r - 10) * Math.cos((t * Math.PI) / 180)} y1={size / 2 + (r - 10) * Math.sin((t * Math.PI) / 180)} x2={size / 2 + (r + 10) * Math.cos((t * Math.PI) / 180)} y2={size / 2 + (r + 10) * Math.sin((t * Math.PI) / 180)} stroke="#fff" strokeWidth="2" opacity=".8" />
        <g className="orb-spin"><circle cx={size / 2} cy={size / 2} r={r - 26} fill="none" stroke="rgba(57,208,255,.35)" strokeDasharray="2 10" /></g>
        <g className="orb-spin rev"><circle cx={size / 2} cy={size / 2} r={r + 12} fill="none" stroke="rgba(120,165,255,.18)" strokeDasharray="1 6" /></g>
        <g className="orb-orbit"><circle cx={size / 2} cy={size / 2 - r} r="4" fill="#39d0ff" filter="url(#orbGlow)" /></g>
      </svg>
      <div className="orb-center">
        <b className="fx-num"><CountUp value={pct} format={(v) => v.toFixed(1)} />%</b>
        <span>{label}</span>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

/** Small progress ring (e.g. "3 of 6 steps"). */
export function RingProgress({ value, max, size = 120, label }) {
  const r = size / 2 - 10; const c = 2 * Math.PI * r; const p = max ? value / max : 0;
  return (
    <div className="ring-prog" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(120,165,255,.14)" strokeWidth="8" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#orbArc2)" strokeWidth="8" strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} style={{ filter: "drop-shadow(0 0 6px rgba(57,208,255,.8))" }} />
        <defs><linearGradient id="orbArc2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#39d0ff" /><stop offset="100%" stopColor="#2f8cf0" /></linearGradient></defs>
      </svg>
      <div className="ring-center"><b className="fx-num">{value}<em>/{max}</em></b><span>{label}</span></div>
    </div>
  );
}

/**
 * Animated money-flow: sources → matching engine → outcomes.
 * Stream width = share of value; particles travel along each stream; hover isolates a stream.
 */
export function FlowStreams({ sources, outcomes, centerLabel = "Matching engine", height = 300, format = (v) => v }) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(760);
  const [hover, setHover] = React.useState(null);
  React.useEffect(() => { const ro = new ResizeObserver(([e]) => setW(Math.max(420, e.contentRect.width))); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }, []);
  const total = sources.reduce((s, x) => s + x.v, 0);
  const cx = w / 2; const cy = height / 2; const maxW = 54;
  const lay = (list, x) => { let y = 24; const gap = (height - 48 - list.length * 0) / list.length; return list.map((n) => { const h = Math.max(6, (n.v / total) * maxW * 2.2); const node = { ...n, x, y: y + gap / 2, h }; y += gap; return node; }); };
  const L = lay(sources, 130); const R = lay(outcomes, w - 210);
  const path = (x1, y1, x2, y2) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
  return (
    <div className="flow" ref={ref}>
      <svg width={w} height={height}>
        <defs>
          <linearGradient id="flowIn" x1="0" x2="1"><stop offset="0%" stopColor="#2f8cf0" stopOpacity=".15" /><stop offset="100%" stopColor="#39d0ff" stopOpacity=".55" /></linearGradient>
          <filter id="flowGlow"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        {L.map((n) => {
          const d = path(n.x, n.y, cx - 46, cy); const sw = Math.max(2, (n.v / total) * maxW);
          const dim = hover && hover !== n.label;
          return (
            <g key={"s" + n.label} onPointerEnter={() => setHover(n.label)} onPointerLeave={() => setHover(null)} style={{ opacity: dim ? 0.18 : 1, transition: "opacity .2s" }}>
              <path d={d} stroke="url(#flowIn)" strokeWidth={sw} fill="none" />
              <path d={d} stroke="#39d0ff" strokeWidth="2.5" fill="none" strokeDasharray="2 22" className="flow-dash" style={{ animationDuration: `${2.6 - (n.v / total)}s` }} />
              <circle cx={n.x} cy={n.y} r="6" className="flow-node" />
              <text x={n.x - 14} y={n.y - 2} textAnchor="end" className="flow-lbl">{n.label}</text>
              <text x={n.x - 14} y={n.y + 13} textAnchor="end" className="flow-val">{format(n.v)}</text>
            </g>
          );
        })}
        {R.map((n) => {
          const d = path(cx + 46, cy, n.x, n.y); const sw = Math.max(2, (n.v / total) * maxW);
          const dim = hover && hover !== n.label;
          return (
            <g key={"o" + n.label} onPointerEnter={() => setHover(n.label)} onPointerLeave={() => setHover(null)} style={{ opacity: dim ? 0.18 : 1, transition: "opacity .2s" }}>
              <path d={d} stroke={n.color} strokeOpacity=".35" strokeWidth={sw} fill="none" />
              <path d={d} stroke={n.color} strokeWidth="2.5" fill="none" strokeDasharray="2 22" className="flow-dash" style={{ animationDuration: `${2.8 - (n.v / total)}s`, filter: `drop-shadow(0 0 4px ${n.color})` }} />
              <circle cx={n.x} cy={n.y} r="6" fill={n.color} style={{ filter: `drop-shadow(0 0 8px ${n.color})` }} />
              <text x={n.x + 14} y={n.y - 2} className="flow-lbl">{n.label}</text>
              <text x={n.x + 14} y={n.y + 13} className="flow-val">{`${format(n.v)} · ${((n.v / total) * 100).toFixed(1)}%`}</text>
            </g>
          );
        })}
        <g className="flow-core">
          <circle cx={cx} cy={cy} r="46" className="core-bg" />
          <circle cx={cx} cy={cy} r="54" className="core-ring orb-spin" fill="none" strokeDasharray="3 8" />
          <text x={cx} y={cy - 4} textAnchor="middle" className="core-t">{centerLabel.split(" ")[0]}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" className="core-s">{centerLabel.split(" ").slice(1).join(" ")}</text>
        </g>
      </svg>
    </div>
  );
}

/** Isometric 3D towers, one per item; height = value. Scene tilts with the pointer; hover lifts a tower. */
export function Towers3D({ items, min = 70, max = 100, format = (v) => v, onPick }) {
  const [hover, setHover] = React.useState(null);
  const mx = useMotionValue(0);
  const rz = useSpring(useTransform(mx, [-1, 1], [-40, -30]), { stiffness: 120, damping: 16 });
  return (
    <div className="towers-wrap" onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set(((e.clientX - r.left) / r.width) * 2 - 1); }}>
      <motion.div className="towers-scene" style={{ rotateX: 58, rotateZ: rz }}>
        <div className="towers-floor" />
        {items.map((it, i) => {
          const h = 14 + ((Math.max(min, it.v) - min) / (max - min)) * 92;
          const lift = hover === i ? 14 : 0;
          return (
            <div key={it.label} className={"tower" + (it.bad ? " bad" : "") + (hover === i ? " on" : "")} style={{ "--h": `${h}px`, "--i": i, transform: `translate3d(${(i % 4) * 70}px, ${Math.floor(i / 4) * 74}px, ${lift}px)` }}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onClick={() => onPick && onPick(it)}>
              <div className="tw-face tw-top" /><div className="tw-face tw-front" /><div className="tw-face tw-side" />
            </div>
          );
        })}
      </motion.div>
      <div className="towers-legend">
        {items.map((it, i) => (
          <button key={it.label} className={"tl-row" + (hover === i ? " on" : "") + (it.bad ? " bad" : "")} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onClick={() => onPick && onPick(it)}>
            <i /><span>{it.label}</span><b className="fx-num">{format(it.v)}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Admin: modules orbit the CAMS core; node size = users with access. */
export function ModuleOrbit({ modules, onPick, active, total }) {
  const size = 300; const c = size / 2; const r = 108;
  const maxU = Math.max(...modules.map((m) => m.users), 1);
  return (
    <div className="mod-orbit" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(120,165,255,.18)" strokeDasharray="2 6" />
        <circle cx={c} cy={c} r={r - 44} fill="none" stroke="rgba(120,165,255,.1)" />
        {modules.map((m, i) => {
          const a = (i / modules.length) * Math.PI * 2 - Math.PI / 2; const x = c + r * Math.cos(a); const y = c + r * Math.sin(a);
          return <line key={"l" + m.key} x1={c} y1={c} x2={x} y2={y} stroke={m.color} strokeOpacity={active && active !== m.key ? 0.12 : 0.45} strokeWidth="1.5" className="orbit-link" />;
        })}
      </svg>
      <div className="mo-core"><b>CAMS</b><span>{total ?? modules.reduce((s, m) => s + m.users, 0)} users</span></div>
      {modules.map((m, i) => {
        const a = (i / modules.length) * Math.PI * 2 - Math.PI / 2; const x = c + r * Math.cos(a); const y = c + r * Math.sin(a);
        const d = 40 + (m.users / maxU) * 34;
        return (
          <motion.button key={m.key} className={"mo-node" + (active === m.key ? " on" : "")} style={{ left: x - d / 2, top: y - d / 2, width: d, height: d, "--mc": m.color }}
            whileHover={{ scale: 1.12 }} onClick={() => onPick(m.key)} title={`${m.label}: ${m.users} users`}>
            <b>{m.users}</b>
            <span className="mo-label">{m.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
