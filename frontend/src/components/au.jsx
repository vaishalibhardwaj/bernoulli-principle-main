// Shared pieces for the light "Aurora" screens: avatars, stat cards, ring and hatched bars.
import React from "react";
import { ArrowUpRight } from "lucide-react";

const AVATAR_TONES = ["#2557ff", "#16a34a", "#f2541b", "#e11d74", "#7c3aed", "#0891b2", "#ca8a04", "#0f766e", "#4f46e5", "#dc2626"];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const toneFor = (name) => AVATAR_TONES[hash(name) % AVATAR_TONES.length];
const initials = (name) => String(name).replace(/\b(Bank|of|Ltd|Limited)\b/gi, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/** Round logo stand-in: initials on a soft tint of a colour fixed per name. */
export function Avatar({ name, size = 40, color, icon: Icon, badge }) {
  const c = color || toneFor(name);
  return (
    <span className="au-avatar" style={{ "--c": c, width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {Icon ? <Icon size={Math.round(size * 0.45)} /> : initials(name)}
      {badge && <i className={"au-avatar-badge " + badge} />}
    </span>
  );
}

/** Stack of people, like "Manage customers" in the reference. */
export function AvatarStack({ names = [], max = 3 }) {
  const shown = names.slice(0, max);
  return (
    <span className="au-stack">
      {shown.map((n) => <Avatar key={n} name={n} size={30} />)}
      {names.length > max && <span className="au-stack-more">+{names.length - max}</span>}
    </span>
  );
}

/** Stat card: ringed colour badge + label, a big number, optional change, and a round arrow button. */
export function StatCard({ icon: Icon, tone = "blue", label, value, delta, deltaDir, foot, footAction, onClick, active, testid, arrowTitle }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={"au-stat tone-" + tone + (active ? " on" : "") + (onClick ? " clickable" : "")} onClick={onClick} data-testid={testid}>
      <span className="au-stat-top">
        <span className="au-badge">{Icon && <Icon size={18} />}</span>
        <span className="au-stat-label">{label}</span>
        {onClick && <span className="au-arrow" title={arrowTitle || "Open"}><ArrowUpRight size={17} /></span>}
      </span>
      <span className="au-stat-value">
        <b>{value}</b>
        {delta != null && <em className={deltaDir === "down" ? "down" : "up"}>{deltaDir === "down" ? "↓" : "↑"} {delta}</em>}
      </span>
      {(foot || footAction) && <span className="au-stat-foot"><span>{foot}</span>{footAction && <span className="au-chip">{footAction}</span>}</span>}
    </Tag>
  );
}

/** Progress row: label, "x/total" on the right, hatched bar in the given colour. */
export function HatchBar({ label, value, total, color = "#2557ff", onClick, active, right, testid, children }) {
  const pct = total ? Math.max(value ? 3 : 0, Math.min(100, (value / total) * 100)) : 0;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={"au-hbar" + (active ? " on" : "") + (onClick ? " clickable" : "")} onClick={onClick} style={{ "--c": color }} data-testid={testid}>
      <span className="au-hbar-top"><span>{label}</span><span className="au-hbar-n">{right || <><b>{value}</b>/{total}</>}</span></span>
      <span className="au-hbar-track"><i style={{ width: pct + "%" }} /></span>
      {children}
    </Tag>
  );
}

/** Segmented ring with gaps and round ends; centre shows the total; hovering or picking a segment shows a pill. */
export function SegmentRing({ segments, total, centre, sub, size = 230, thickness = 18, active, onPick }) {
  const [hover, setHover] = React.useState(null);
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2 - 6; const c = size / 2; const circ = 2 * Math.PI * r;
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 10 : 0;
  let acc = 0;
  const arcs = segments.filter((s) => s.value > 0).map((s) => {
    const len = (s.value / sum) * circ; const start = acc; acc += len;
    const mid = ((start + len / 2) / circ) * 2 * Math.PI - Math.PI / 2;
    return { ...s, len: Math.max(1, len - gap), start, mid };
  });
  const focus = arcs.find((a) => a.key === (hover || active)) || null;
  return (
    <div className="au-ring" style={{ width: size, height: size }} onPointerLeave={() => setHover(null)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${total} ${sub || ""}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(15,23,42,.05)" strokeWidth={thickness} />
        {arcs.map((a, i) => (
          <circle key={a.key} cx={c} cy={c} r={r} fill="none" stroke={a.color} strokeWidth={focus && focus.key === a.key ? thickness + 6 : thickness} strokeLinecap="round"
            strokeDasharray={`${a.len} ${circ}`} strokeDashoffset={-a.start} transform={`rotate(-90 ${c} ${c})`}
            className="au-ring-arc" style={{ "--len": a.len, "--circ": circ, animationDelay: `${i * 70}ms`, opacity: focus && focus.key !== a.key ? 0.35 : 1 }}
            onPointerEnter={() => setHover(a.key)} onClick={() => onPick && onPick(a.key)} />
        ))}
      </svg>
      <div className="au-ring-centre"><b>{focus ? focus.value : total}</b><span>{focus ? focus.label : sub}</span></div>
      {focus && (
        <span className="au-ring-pill" style={{ left: c + Math.cos(focus.mid) * (r + thickness + 22), top: c + Math.sin(focus.mid) * (r + thickness + 22) }}>
          <i style={{ background: focus.color }} />{focus.value} ({Math.round((focus.value / sum) * 100)}%)
        </span>
      )}
      {centre}
    </div>
  );
}

/** One finding that needs attention: big number, plain sentence, what it means, and what to do about it. */
export function InsightCard({ tone = "risk", eyebrow, value, of, unit, title, detail, actions = [], meter, testid }) {
  const pct = meter && meter.total ? Math.min(100, (meter.value / meter.total) * 100) : 0;
  return (
    <div className={"au-insight tone-" + tone} data-testid={testid}>
      <div className="au-insight-num">
        <span className="au-insight-eyebrow">{eyebrow}</span>
        <b>{value}</b>
        {of != null && <em>of {of} {unit}</em>}
      </div>
      <div className="au-insight-body">
        <h3>{title}</h3>
        {detail && <p>{detail}</p>}
        {meter && <div className="au-insight-meter"><span><i style={{ width: pct + "%" }} /></span><small>{meter.label}</small></div>}
        {actions.length > 0 && (
          <div className="au-insight-acts">
            {actions.map((a, i) => (
              <button key={a.label} type="button" className={"btn btn-sm " + (i === 0 ? "btn-primary" : "btn-outline")} onClick={a.onClick} data-testid={a.testid}>
                {a.label}{a.icon && <a.icon size={13} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** A row of counts that doubles as a filter: click a count to show only those. */
export function CountStrip({ label, value, onChange, items }) {
  return (
    <div className="au-cstrip" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.key} type="button" role="tab" aria-selected={value === it.key} className={"au-cstrip-i tone-" + (it.tone || "ink") + (value === it.key ? " on" : "")}
          onClick={() => onChange(it.key)} title={it.hint} data-testid={it.testid}>
          <i /><span>{it.label}</span><b>{it.count}</b>
        </button>
      ))}
    </div>
  );
}
