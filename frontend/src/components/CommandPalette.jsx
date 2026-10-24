import React from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/state/store";
import { navFor, screenLabel, PERSONAS, FUNCTIONS, hasCap } from "@/lib/access";
import { PLAIN_EXCEPTION } from "@/lib/plain";
import { Search, CornerDownLeft, ArrowRight, User, Zap } from "lucide-react";

/** ⌘K: jump to any screen you can open, find a case or refund by reference, or switch demo persona. */
export default function CommandPalette({ open, onClose }) {
  const { perms, simple, collections, switchPersona } = useStore();
  const nav = useNavigate();
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  const go = (path) => { nav(path); onClose(); };
  // One entry per screen even when several roles grant it (navFor merges roles), grouped by module.
  const modules = navFor(perms, simple);
  const screens = modules.flatMap((m) => m.groups.flatMap((g) => g.screens.map((s) => ({ ...s, group: m.label }))));
  const functions = FUNCTIONS.filter((f) => hasCap(perms, f.screen, f.cap));
  const can = (k) => screens.some((s) => s.key === k);

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Command className="cmdk" label="Search" loop>
        <div className="cmdk-input"><Search size={16} /><Command.Input autoFocus placeholder="Search any module, screen or task you have access to…" /><kbd>esc</kbd></div>
        <Command.List className="cmdk-list">
          <Command.Empty className="cmdk-empty">No results.</Command.Empty>
          {functions.length > 0 && <Command.Group heading="Do something">
            {functions.map((f) => (
              <Command.Item key={f.label} value={`${f.label} ${f.words}`} onSelect={() => go(f.path)} className="cmdk-item">
                <Zap size={14} /><span>{f.label}</span>
              </Command.Item>
            ))}
          </Command.Group>}
          {modules.map((m) => (
            <Command.Group key={m.key} heading={`Go to · ${m.label}`}>
              {m.groups.flatMap((g) => g.screens).map((s) => (
                <Command.Item key={s.key} value={`${screenLabel(s, simple)} ${m.label} ${s.group}`} onSelect={() => go(s.path)} className="cmdk-item">
                  <ArrowRight size={14} /><span>{screenLabel(s, simple)}</span><em>{m.label}</em>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
          {can("exceptions") && <Command.Group heading="Problem cases">
            {(collections.exceptions || []).filter((e) => e.status !== "closed").slice(0, 40).map((e) => (
              <Command.Item key={e.id} value={`${e.ref} ${e.investor} ${e.type}`} onSelect={() => go(`/exceptions?case=${e.id}`)} className="cmdk-item">
                <span className="tnum">{e.ref}</span><span>{simple ? PLAIN_EXCEPTION[e.type] || e.type : e.type}</span><em>{e.investor}</em>
              </Command.Item>
            ))}
          </Command.Group>}
          {can("refunds") && <Command.Group heading="Refunds">
            {(collections.refunds || []).map((r) => (
              <Command.Item key={r.id} value={`${r.ref} ${r.investor} refund`} onSelect={() => go(`/refunds?refund=${r.id}`)} className="cmdk-item">
                <span className="tnum">{r.ref}</span><span>{r.investor}</span><em>{r.reason}</em>
              </Command.Item>
            ))}
          </Command.Group>}
          <Command.Group heading="Demo: view as">
            {PERSONAS.map((p) => (
              <Command.Item key={p.id} value={`persona ${p.label}`} onSelect={() => { switchPersona(p.id); go("/"); }} className="cmdk-item">
                <User size={14} /><span>{p.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
        <div className="cmdk-foot"><span><CornerDownLeft size={12} /> open</span><span>↑↓ move</span><span>⌘K toggle</span></div>
      </Command>
    </div>
  );
}
