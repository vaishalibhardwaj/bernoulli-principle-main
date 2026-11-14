import React from "react";
import { STATUS, CHIP } from "@/lib/constants";
import { Eye, EyeOff, Info, AlertTriangle, Lock } from "lucide-react";
import { Art } from "@/components/Art";

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

export function Toggle({ checked, onChange, id, disabled, say }) {
  const sw = (
    <label className="switch">
      <input type="checkbox" checked={!!checked} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)} id={id} data-testid={id} />
      <span className="track" />
    </label>
  );
  // `say` prints On / Off beside the switch, so the state does not depend on colour alone.
  return say ? <span className={"sw-say" + (checked ? " on" : "")}><em>{checked ? "On" : "Off"}</em>{sw}</span> : sw;
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

export function EmptyState({ title, subtitle, art = "empty", action }) {
  return (
    <div className="empty" data-testid="empty-state">
      <Art name={art} size={72} />
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      {action}
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

/** A full-area state: something went wrong, no access, or nothing here. Says what happened and the way out. */
export function StateBlock({ art = "empty", title, children, action, testid }) {
  return (
    <div className="state" role="status" data-testid={testid}>
      <Art name={art} size={80} />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Loading placeholder lines, shown in place of a spinner while a file is being read. */
export function SkeletonBlock({ rows = 4, label = "Loading" }) {
  return (
    <div role="status" aria-label={label} data-testid="skeleton">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="sk-row">{[0, 1, 2, 3].map((k) => <span key={k} className="sk" style={{ width: `${[70, 90, 55, 40][k]}%` }} />)}</div>)}
    </div>
  );
}

/** A small "in progress" mark for inside a button or a row. */
export const Busy = () => <span className="sk sk-inline" aria-hidden="true" />;

/** Catches a screen that fails to draw, so one broken screen never blanks the whole app. */
export class ScreenBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <StateBlock art="error" title="This screen could not be shown" testid="screen-error"
        action={<button type="button" className="btn btn-primary" onClick={() => this.setState({ failed: false })}>Try again</button>}>
        Nothing you entered elsewhere is lost. Try again, or open another screen from the menu. If it keeps happening, tell IT Support which screen it was.
      </StateBlock>
    );
  }
}
