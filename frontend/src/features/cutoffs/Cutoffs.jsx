import React from "react";
import { Clock, Check, X, Lock } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { Note } from "@/components/bits";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

/** Cutoff for an account: a scheme-level time wins, then its asset class, then 3:00 PM. */
export function cutoffFor(cutoffs, assetClass, schemeCode) {
  const live = (cutoffs || []).filter((c) => c.status === "active");
  const s = live.find((c) => c.level === "scheme" && c.key === schemeCode);
  if (s) return s.time;
  const a = live.find((c) => c.level === "asset" && assetClass && assetClass.startsWith(c.key));
  return a ? a.time : "15:00";
}
export const fmtTime = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/**
 * Same-day NAV cutoffs by asset class and scheme. Scheme-master times are reused read-only;
 * recon keeps its own asset-class times only where the scheme master has none. Changes are maker–checker.
 */
export default function Cutoffs() {
  const { collections, perms, act, currentUser } = useStore();
  const rows = collections.cutoffs || [];
  const canEdit = hasCap(perms, "cutoffs", "edit");
  const canApprove = hasCap(perms, "cutoffs", "approve");
  const [edit, setEdit] = React.useState({});

  const propose = (r) => {
    const t = edit[r.id];
    if (!/^\d{2}:\d{2}$/.test(t || "")) { toast.error("Use HH:MM, e.g. 15:00"); return; }
    const res = act({ screen: "cutoffs", cap: "edit", kind: "cutoffs", id: r.id, patch: { proposed: t, status: "pending", owner: currentUser }, audit: { entityLabel: `Cutoff · ${r.label}`, action: "Propose cutoff change", from: r.time, to: t } });
    if (!res.ok) toast.error(res.error); else { toast.success("Sent to a checker"); setEdit({ ...edit, [r.id]: undefined }); }
  };
  const decide = (r, yes) => {
    const res = act({ screen: "cutoffs", cap: "approve", kind: "cutoffs", id: r.id, target: r, patch: yes ? { time: r.proposed, proposed: null, status: "active", approvedBy: currentUser, updatedAt: new Date().toISOString() } : { proposed: null, status: "active" }, audit: { entityLabel: `Cutoff · ${r.label}`, action: yes ? "Approve cutoff change" : "Reject cutoff change", from: r.time, to: yes ? r.proposed : r.time } });
    if (!res.ok) toast.error(res.error); else toast.success(yes ? "Cutoff updated" : "Change rejected");
  };

  const group = (level, title, sub) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><h3>{title}</h3><span className="muted">{sub}</span></div>
      <table className="grid">
        <thead><tr><th>{level === "scheme" ? "Scheme" : "Asset class"}</th><th>Cutoff</th><th>Source</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.filter((r) => r.level === level).map((r) => (
          <tr key={r.id} data-testid={"cutoff-" + r.id}>
            <td><b>{r.label}</b></td>
            <td className="tnum">{fmtTime(r.time)}{r.proposed && <span className="muted"> → {fmtTime(r.proposed)}</span>}</td>
            <td>{r.source === "Scheme master" ? <span className="chip chip-previous"><Lock size={10} /> Scheme master</span> : <span className="chip chip-auto">Recon setup</span>}</td>
            <td>{r.status === "pending" ? <span className="pill pill-pending"><span className="dot" />Pending for approval</span> : <span className="pill pill-active"><span className="dot" />Active</span>}</td>
            <td>
              {r.source !== "Scheme master" && r.status === "active" && canEdit && (
                <span style={{ display: "flex", gap: 6 }}><input className="input tnum" style={{ width: 90 }} placeholder={r.time} value={edit[r.id] || ""} onChange={(e) => setEdit({ ...edit, [r.id]: e.target.value })} /><button className="btn btn-outline btn-sm" onClick={() => propose(r)}>Propose</button></span>
              )}
              {r.status === "pending" && canApprove && r.owner !== currentUser && (
                <span style={{ display: "flex", gap: 6 }}><button className="btn btn-success btn-sm" onClick={() => decide(r, true)}><Check size={13} /> Approve</button><button className="btn btn-outline btn-sm" onClick={() => decide(r, false)}><X size={13} /> Reject</button></span>
              )}
              {r.source === "Scheme master" && <span className="muted">Change it in the scheme master{r.updatedAt ? ` · ${formatDate(r.updatedAt)}` : ""}</span>}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );

  return (
    <div data-testid="cutoffs">
      <div className="page-head"><div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Clock size={22} /> Cutoff times</h1>
        <p>When money must be in for same-day NAV. Used by the closing-balance view and fund release. A scheme-level time wins over its asset class.</p>
      </div></div>
      <Note kind="info">Where the scheme master already holds a cutoff, it is reused here read-only. Recon keeps its own times only for asset classes the scheme master doesn't cover. Changes need a checker.</Note>
      <div style={{ height: 14 }} />
      {group("scheme", "Scheme-level cutoffs", "From the scheme master")}
      {group("asset", "Asset-class cutoffs", "Default for every scheme in the class")}
    </div>
  );
}
