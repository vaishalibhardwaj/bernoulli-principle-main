import React from "react";
import { MODULE_BY_KEY, CAPS, CAP_LABELS, CAP_HINTS } from "@/lib/access";
import { Check, Minus } from "lucide-react";

/**
 * Screen × capability grid. Editable (role builder) or read-only (drawers, previews).
 * perms: { screenKey: ["view","edit",...] }
 */
export default function PermissionMatrix({ module, perms, onChange, readOnly, compact, highlight = [] }) {
  const mod = MODULE_BY_KEY[module];
  if (!mod) return null;
  const has = (s, c) => (perms[s] || []).includes(c);
  const toggle = (screen, cap) => {
    if (readOnly) return;
    const cur = new Set(perms[screen] || []);
    if (cur.has(cap)) {
      cur.delete(cap);
      if (cap === "view") cur.clear(); // no view → no access at all
    } else {
      cur.add(cap);
      cur.add("view"); // any capability implies view
    }
    const next = { ...perms, [screen]: Array.from(cur) };
    if (!next[screen].length) delete next[screen];
    onChange(next);
  };
  return (
    <table className={"perm-matrix" + (compact ? " compact" : "")} data-testid={`perm-matrix-${module}`}>
      <thead>
        <tr>
          <th>Screen</th>
          {CAPS.map((c) => <th key={c} title={CAP_HINTS[c]}>{CAP_LABELS[c]}</th>)}
        </tr>
      </thead>
      <tbody>
        {mod.screens.filter((s) => !compact || perms[s.key]).map((s) => (
          <tr key={s.key} className={highlight.includes(s.label) ? "conflict" : ""}>
            <td>{s.label}{s.phase && s.phase !== "P1" && <span className={"phase-tag " + s.phase.toLowerCase()}>{s.phase}</span>}</td>
            {CAPS.map((c) => {
              const supported = s.caps.includes(c);
              const on = has(s.key, c);
              return (
                <td key={c} className="pm-cell">
                  {!supported ? <Minus size={12} className="pm-na" /> : readOnly ? (on ? <Check size={14} className="pm-on" /> : <span className="pm-off" />) : (
                    <input type="checkbox" className="cb" checked={on} onChange={() => toggle(s.key, c)} data-testid={`pm-${s.key}-${c}`} aria-label={`${s.label} ${CAP_LABELS[c]}`} />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
