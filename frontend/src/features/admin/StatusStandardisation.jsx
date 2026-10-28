import React from "react";
import { Scale, Plus, Check, Clock, Inbox } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { Note } from "@/components/bits";
import { formatDate, uid } from "@/lib/format";
import { toast } from "sonner";

/**
 * PRD v1 "Transaction Status Standardization" + PRD v4 §5.3 — admin-maintained table that converts
 * bank-specific credit/debit indicators into the system values CREDIT / DEBIT.
 * Maintained by the recon setup maker; every add/change waits for the recon checker.
 */
export default function StatusStandardisation() {
  const { collections, perms, act, currentUser } = useStore();
  const rows = collections.status_map || [];
  const canEdit = hasCap(perms, "status_std", "edit");
  const canApprove = hasCap(perms, "status_std", "approve");
  const decide = (r, yes) => {
    const res = act({ screen: "status_std", cap: "approve", kind: "status_map", id: r.id, target: r, patch: yes ? { status: "active", approvedBy: currentUser } : { status: r.requestedBy ? "requested" : "rejected", owner: r.requestedBy || r.owner },
      audit: { entityLabel: `Status “${r.source}” → ${r.system}`, action: yes ? "Approve status mapping" : "Reject status mapping", from: "Pending", to: yes ? "Active" : "Rejected", comment: yes ? "Applies to files loaded from now on" : undefined } });
    if (!res.ok) toast.error(res.error); else toast.success(yes ? `“${r.source}” is now ${r.system}` : "Sent back");
  };
  const [draft, setDraft] = React.useState({ source: "", system: "CREDIT", seenAt: "", table: "RECON_BANK_TXN", column: "INSTRM_STATUS" });
  const [answer, setAnswer] = React.useState({});

  const active = rows.filter((r) => r.status === "active");
  const pending = rows.filter((r) => r.status === "pending");
  const requests = rows.filter((r) => r.status === "requested");

  const save = (row, label) => {
    const r = act({ screen: "status_std", cap: "edit", kind: "status_map", id: row.id, target: row, patch: () => row, audit: { entityLabel: `Status “${row.source}” → ${row.system}`, action: label, from: null, to: "Pending approval" } });
    if (!r.ok) { toast.error(r.error); return false; }
    toast.success("Sent to the checker for approval");
    return true;
  };
  const add = () => {
    const src = draft.source.trim();
    if (!src) { toast.error("Enter the value as it appears in the bank file"); return; }
    if (rows.some((r) => r.source.toUpperCase() === src.toUpperCase() && r.status !== "requested")) { toast.error(`“${src}” is already in the table`); return; }
    if (save({ ...draft, source: src, id: uid("sm"), status: "pending", owner: currentUser, createdAt: new Date().toISOString() }, "Add status mapping")) setDraft({ ...draft, source: "", seenAt: "" });
  };
  const fulfil = (req) => {
    const system = answer[req.id];
    if (!system) { toast.error("Pick CREDIT or DEBIT"); return; }
    save({ ...req, system, status: "pending", owner: currentUser, requestedBy: req.owner }, "Add status mapping (maker request)");
  };

  return (
    <div data-testid="status-std">
      <div className="page-head"><div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Scale size={22} /> Transaction status standardisation</h1>
        <p>How each bank's credit/debit indicator is converted to the system value. Used when a statement is loaded. The setup maker adds or changes values; the checker approves them.</p>
      </div></div>

      {!canEdit && <div style={{ marginBottom: 14 }}><Note kind="info">{canApprove ? "You are the checker: approve or send back values the setup maker added. Approved values apply to files loaded from then on." : "Read-only for you. The recon setup maker adds or changes these values; anyone can ask for a missing value from Column mapping."}</Note></div>}

      {canEdit && requests.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }} data-testid="std-requests">
          <h3 style={{ display: "flex", gap: 8, alignItems: "center", margin: "0 0 10px" }}><Inbox size={16} /> Asked for by makers <span className="pill pill-pending">{requests.length}</span></h3>
          <table className="grid"><thead><tr><th>Value in file</th><th>Seen at</th><th>Asked by</th><th>Convert to</th><th /></tr></thead>
            <tbody>{requests.map((r) => (
              <tr key={r.id}><td className="tnum"><b>{r.source}</b></td><td>{r.seenAt}</td><td>{r.owner} · {formatDate(r.createdAt)}</td>
                <td><select className="select" style={{ maxWidth: 140 }} value={answer[r.id] || ""} onChange={(e) => setAnswer({ ...answer, [r.id]: e.target.value })} data-testid={"std-answer-" + r.source}><option value="">Select…</option><option>CREDIT</option><option>DEBIT</option></select></td>
                <td><button className="btn btn-primary btn-sm" onClick={() => fulfil(r)} data-testid={"std-fulfil-" + r.source}>Send for approval</button></td></tr>
            ))}</tbody></table>
        </div>
      )}

      <div className="card">
        <div className="grid-scroll">
          <table className="grid">
            <thead><tr><th>Value in bank file</th><th>System value</th><th>Seen at</th><th>DB table · column</th><th>Status</th><th>Added</th>{canApprove && <th />}</tr></thead>
            <tbody>
              {[...pending, ...active].map((r) => (
                <tr key={r.id} data-testid={"std-row-" + r.source}>
                  <td className="tnum"><b>{r.source}</b></td>
                  <td><span className={"chip " + (r.system === "CREDIT" ? "chip-previous" : "chip-manual")}>{r.system}</span></td>
                  <td>{r.seenAt || "—"}</td>
                  <td className="tnum" style={{ fontSize: 12 }}>{r.table} · {r.column}</td>
                  <td>{r.status === "active" ? <span className="pill pill-active"><span className="dot" /><Check size={11} /> Active</span> : <span className="pill pill-pending"><span className="dot" /><Clock size={11} /> Pending approval</span>}</td>
                  <td>{r.owner} · {formatDate(r.createdAt)}</td>
                  {canApprove && <td>{r.status === "pending" && (r.owner === currentUser ? <span className="muted">Your own</span> : <span style={{ display: "flex", gap: 6 }}><button className="btn btn-success btn-sm" onClick={() => decide(r, true)} data-testid={"std-approve-" + r.source}><Check size={13} /> Approve</button><button className="btn btn-outline btn-sm" onClick={() => decide(r, false)}>Send back</button></span>)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="std-add" data-testid="std-add">
            <input className="input tnum" placeholder="Value as in file, e.g. CR" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} data-testid="std-source" />
            <select className="select" value={draft.system} onChange={(e) => setDraft({ ...draft, system: e.target.value })}><option>CREDIT</option><option>DEBIT</option></select>
            <input className="input" placeholder="Bank (optional)" value={draft.seenAt} onChange={(e) => setDraft({ ...draft, seenAt: e.target.value })} />
            <button className="btn btn-primary" onClick={add} data-testid="std-add-btn"><Plus size={15} /> Add — checker approves</button>
          </div>
        )}
      </div>
    </div>
  );
}
