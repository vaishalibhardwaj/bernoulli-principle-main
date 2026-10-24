import React from "react";
import { Lock, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useStore } from "@/state/store";

/** ₹ in Indian short form: 2.15 Cr, 4.3 L, 12,500 */
export function inrShort(n) {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (a >= 1e5) return "₹" + (n / 1e5).toFixed(2) + " L";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
export const inr = (n) => (n < 0 ? "−₹" : "₹") + Math.abs(Number(n || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const num = (n) => Number(n || 0).toLocaleString("en-IN");

export function PhaseBadge({ phase, children }) {
  return <span className={"phase-banner " + phase.toLowerCase()}><b>{phase}</b>{children}</span>;
}

/** Confidence meter 0–1 with threshold colouring. */
export function Conf({ value, auto = 0.95, review = 0.6, id }) {
  const { simple } = useStore();
  const tone = value >= auto ? "hi" : value >= review ? "mid" : "lo";
  if (simple) return <Light tone={tone === "hi" ? "green" : tone === "mid" ? "amber" : "red"} id={id}>{tone === "hi" ? "High" : tone === "mid" ? "Check needed" : "Low — check carefully"}</Light>;
  return (
    <span className={"conf " + tone} data-testid={id} title={`Confidence ${(value * 100).toFixed(0)}%`}>
      <i style={{ width: `${Math.round(value * 100)}%` }} />
      <b>{(value * 100).toFixed(0)}%</b>
    </span>
  );
}

export function Stat({ label, value, sub, tone, onClick, id }) {
  return (
    <button className={"ops-stat" + (tone ? " tone-" + tone : "")} onClick={onClick} data-testid={id} disabled={!onClick}>
      <span className="os-label">{label}</span>
      <span className="os-value tnum">{value}</span>
      {sub && <span className="os-sub">{sub}</span>}
    </button>
  );
}

/** Hours → "2d 4h" */
export function dur(h) {
  if (h <= 0) return "overdue";
  const d = Math.floor(h / 24); const r = Math.round(h % 24);
  return d ? `${d}d ${r}h` : `${r}h`;
}

export function ReadOnlyNote({ what }) {
  const { simple } = useStore();
  if (simple) return <div className="note" style={{ marginBottom: 12 }}><Lock size={14} /><div>You can look at this page. Changes here are made by your team lead.</div></div>;
  return <div className="note" style={{ marginBottom: 12 }}><Lock size={14} /><div>Read-only: your roles don't include the <b>{what}</b> capability on this screen.</div></div>;
}

/** Traffic light used by the simple view instead of numbers. */
export function Light({ tone, children, id }) {
  const Icon = tone === "green" ? CheckCircle2 : tone === "amber" ? AlertTriangle : XCircle;
  return <span className={"light " + tone} data-testid={id}><Icon size={13} />{children}</span>;
}

/** Simple-view time left before delayed interest: words, not "1d 4h". */
export function timeLeftWords(h) {
  if (h <= 0) return "Late — penalty already running";
  if (h < 24) return `Only ${Math.max(1, Math.round(h))} hours left`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? "s" : ""} left`;
}
