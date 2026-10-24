import React from "react";
import { STATUS, CHIP } from "@/lib/constants";
import { Eye, EyeOff, Inbox, Info, AlertTriangle, Lock } from "lucide-react";

export function StatusPill({ status, id }) {
  const m = STATUS[status] || STATUS.draft;
  return (
    <span className={`pill ${m.cls}`} id={id} data-testid={id}>
      <span className="dot" />{m.label}
    </span>
  );
}

export function Chip({ type, id }) {
  const m = CHIP[type];
  if (!m) return null;
  const Icon = m.icon;
  return (
    <span className={`chip ${m.cls}`} id={id} data-testid={id}>
      <Icon />{m.label}
    </span>
  );
}

export function Toggle({ checked, onChange, id, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)} id={id} data-testid={id} />
      <span className="track" />
    </label>
  );
}

export function PasswordInput({ value, onChange, id, placeholder, onFocus }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="input-wrap">
      <input className="input tnum" type={show ? "text" : "password"} value={value || ""}
        placeholder={placeholder || "••••••••"} id={id} data-testid={id} onFocus={onFocus}
        title={value ? undefined : "Click to auto-fill with sample data"}
        onChange={(e) => onChange && onChange(e.target.value)} />
      <button type="button" className="input-eye" id={id + "-eye"} data-testid={id + "-eye"}
        aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}>
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

export function Note({ kind = "info", icon, children }) {
  const Ico = icon || (kind === "warn" ? AlertTriangle : kind === "vault" ? Lock : Info);
  return <div className={`note ${kind}`}><Ico /><div>{children}</div></div>;
}

export function VaultNote() {
  return <Note kind="vault" icon={Lock}>Stored in the secure vault. Never shown again after saving.</Note>;
}

export function EmptyState({ title, subtitle, icon }) {
  const Ico = icon || Inbox;
  return (
    <div className="empty" data-testid="empty-state">
      <div className="emoji"><Ico /></div>
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  );
}

export function SkeletonRows({ rows = 8, cols = 7 }) {
  return (
    <tbody data-testid="skeleton-rows">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><div className="skel" style={{ height: 14, width: c === 0 ? 20 : `${50 + ((r + c) % 4) * 12}%` }} /></td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function InfoTip({ text, id }) {
  return (
    <span className="info-tip" title={text} id={id} data-testid={id}><Info /></span>
  );
}
