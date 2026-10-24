import React from "react";
import { useLocation } from "react-router-dom";
import { useStore } from "@/state/store";
import { screenForPath, CAPS, CAP_LABELS, hasCap, MODULE_BY_KEY } from "@/lib/access";
import { Layers, Check, Minus } from "lucide-react";

/** Brokerage / Posting / Refunds screens: shown to prove one access model serves every module. */
export default function ModulePlaceholder() {
  const { perms } = useStore();
  const loc = useLocation();
  const s = screenForPath(loc.pathname);
  if (!s) return null;
  const mod = MODULE_BY_KEY[s.module];
  return (
    <div data-testid="module-placeholder">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Layers size={24} style={{ color: mod.color }} /> {s.label}</h1>
          <p>{mod.label} module. Out of scope for the recon prototype; it appears here because your roles grant it.</p>
        </div>
      </div>
      <div className="card card-pad">
        <h3 style={{ marginTop: 0 }}>What you can do on this screen</h3>
        <div className="cap-strip">
          {CAPS.map((c) => {
            const offered = s.caps.includes(c); const on = hasCap(perms, s.key, c);
            return <span key={c} className={"cap-pill" + (on ? " on" : "") + (offered ? "" : " na")}>{on ? <Check size={12} /> : <Minus size={12} />}{CAP_LABELS[c]}</span>;
          })}
        </div>
        <p className="muted" style={{ marginTop: 14 }}>
          The {mod.label} team registers its screens in the platform catalogue (Administration › Roles & Access › Screen catalogue). Admins then build roles for it. Users, roles, maker–checker,
          segregation-of-duties checks and audit are shared with Reconciliation. The module needs no user-management code of its own.
        </p>
      </div>
    </div>
  );
}
