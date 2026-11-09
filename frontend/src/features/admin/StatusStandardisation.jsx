import React from "react";
import { Scale, Plus, Check, Clock, Inbox, Pencil } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { Note } from "@/components/bits";
import { formatDate, uid } from "@/lib/format";
import { PA_OPTIONS } from "@/lib/setupSchema";
import { toast } from "sonner";

/**
 * PRD v1 "Transaction Status Standardization" + PRD v4 §5.3 — admin-maintained table that converts
 * bank-specific credit/debit indicators into the system values CREDIT / DEBIT.
 * Maintained by Recon Ops; every add/change waits for another member of the team.
 */
const SRC = {
  bank: { file: "bank file", table: "RECON_BANK_TXN", column: "INSTRM_STATUS", every: "every bank", where: "Bank" },
  credit: { file: "MIS file", table: "RECON_CREDIT_MIS", column: "TXN_STATUS", every: "every aggregator", where: "Aggregator" },
};

/** source: "bank" | "credit". scope: one bank name / aggregator code ("" = rules for every one); undefined = all. */
export default function StatusStandardisation({ embedded = false, source = "bank", scope, scopeLabel }) {
  const { collections, perms, act, currentUser } = useStore();
  const S = SRC[source];
  // Who a value belongs to: one bank / aggregator, or "" for every one of them.
  const sources = source === "credit" ? PA_OPTIONS.map((o) => [o.code, o.label])
    : [...new Set((collections.bank_config || []).map((c) => c.bankName))].sort().map((b) => [b, b]);
  const whereLabel = (v) => (!v ? S.every[0].toUpperCase() + S.every.slice(1) : (sources.find(([k]) => k === v) || [v, v])[1]);
  const ofSource = (collections.status_map || []).filter((r) => (r.kind || "bank") === source);
  const rows = scope === undefined ? ofSource : ofSource.filter((r) => (r.seenAt || "") === scope);
  const canEdit = hasCap(perms, "status_std", "edit");
  const canApprove = hasCap(perms, "status_std", "approve");
  const decide = (r, yes) => {
    const res = act({ screen: "status_std", cap: "approve", kind: "status_map", id: r.id, target: r, patch: yes ? { status: "active", approvedBy: currentUser, previous: null } : r.previous ? { ...r.previous, status: "active", previous: null } : { status: r.requestedBy ? "requested" : "rejected", owner: r.requestedBy || r.owner },
      audit: { entityLabel: `Transaction type “${r.source}” → ${r.system}`, action: yes ? "Approve transaction type mapping" : "Reject transaction type mapping", from: "Pending", to: yes ? "Active" : r.previous ? "Kept as before" : "Rejected", comment: yes ? "Applies to files loaded from now on" : undefined } });
    if (!res.ok) toast.error(res.error); else toast.success(yes ? `“${r.source}” is now ${r.system}` : "Sent back");
  };
  const [draft, setDraft] = React.useState({ kind: source, source: "", system: "CREDIT", seenAt: scope || "", table: S.table, column: S.column });
  const [answer, setAnswer] = React.useState({});
  const [editing, setEditing] = React.useState(null); // { id, source, system }
  const saveEdit = (r) => {
    const src = editing.source.trim();
    if (!src) { toast.error(`Enter the value as it appears in the ${S.file}`); return; }
    if (src === r.source && editing.system === r.system) { setEditing(null); return; }
    if (ofSource.some((x) => x.id !== r.id && x.source.toUpperCase() === src.toUpperCase() && (x.seenAt || "") === (r.seenAt || "") && x.status !== "requested")) { toast.error(`“${src}” is already in the table`); return; }
    const res = act({ screen: "status_std", cap: "edit", kind: "status_map", id: r.id, target: r, patch: { source: src, system: editing.system, status: "pending", owner: currentUser, previous: { source: r.source, system: r.system, owner: r.owner } },
      audit: { entityLabel: `Transaction type “${r.source}”`, action: "Edit transaction type mapping", from: `${r.source} → ${r.system}`, to: `${src} → ${editing.system}` } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Change sent to another team member. The current value keeps working until then.");
    setEditing(null);
  };

  const active = rows.filter((r) => r.status === "active");
  const pending = rows.filter((r) => r.status === "pending");
  const requests = rows.filter((r) => r.status === "requested");

  const save = (row, label) => {
    const r = act({ screen: "status_std", cap: "edit", kind: "status_map", id: row.id, target: row, patch: () => row, audit: { entityLabel: `Transaction type “${row.source}” → ${row.system}`, action: label, from: null, to: "Pending approval" } });
    if (!r.ok) { toast.error(r.error); return false; }
    toast.success("Sent to another team member for approval");
    return true;
  };
  const add = () => {
    const src = draft.source.trim();
    if (!src) { toast.error(`Enter the value as it appears in the ${S.file}`); return; }
    if (ofSource.some((r) => r.source.toUpperCase() === src.toUpperCase() && (r.seenAt || "") === (draft.seenAt || "") && r.status !== "requested")) { toast.error(`“${src}” is already in the table`); return; }
    if (save({ ...draft, source: src, id: uid("sm"), status: "pending", owner: currentUser, createdAt: new Date().toISOString() }, "Add transaction type mapping")) setDraft({ ...draft, source: "", seenAt: scope || "" });
  };
  const fulfil = (req) => {
    const system = answer[req.id];
    if (!system) { toast.error("Pick CREDIT or DEBIT"); return; }
    save({ ...req, system, status: "pending", owner: currentUser, requestedBy: req.owner }, "Add transaction type mapping (maker request)");
  };

  return (
    <div data-testid="status-std">
      {!embedded && <div className="page-head"><div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Scale size={22} /> Transaction type mapping<span className="shared-amc" title="These settings are not per AMC: a change applies to every AMC.">Same for every AMC</span></h1>
        <p>The value a file uses for a credit or a debit, and what the system reads it as.</p>
      </div></div>}

      {!canEdit && <div style={{ marginBottom: 14 }}><Note kind="info">{canApprove ? "Approve or send back values someone else in the team added. Approved values apply to files loaded from then on." : "Read-only for you. Anyone can ask for a missing value from the Columns tab."}</Note></div>}

      {canEdit && requests.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }} data-testid="std-requests">
          <h3 style={{ display: "flex", gap: 8, alignItems: "center", margin: "0 0 10px" }}><Inbox size={16} /> Asked for by makers <span className="pill pill-pending">{requests.length}</span></h3>
          <table className="grid"><thead><tr><th>Value in file</th><th>{S.where}</th><th>Asked by</th><th>Convert to</th><th /></tr></thead>
            <tbody>{requests.map((r) => (
              <tr key={r.id}><td className="tnum"><b>{r.source}</b></td><td>{whereLabel(r.seenAt)}</td><td>{r.owner} · {formatDate(r.createdAt)}</td>
                <td><select className="select" style={{ maxWidth: 140 }} value={answer[r.id] || ""} onChange={(e) => setAnswer({ ...answer, [r.id]: e.target.value })} data-testid={"std-answer-" + r.source}><option value="">Select…</option><option>CREDIT</option><option>DEBIT</option></select></td>
                <td><button className="btn btn-primary btn-sm" onClick={() => fulfil(r)} data-testid={"std-fulfil-" + r.source}>Send for approval</button></td></tr>
            ))}</tbody></table>
        </div>
      )}

      <div className="card">
        <div className="grid-scroll">
          <table className="grid">
            <thead><tr><th>Value in {S.file}</th><th>System value</th>{scope === undefined && <th>{S.where}</th>}<th>DB table · column</th><th>Status</th><th>Added</th><th /></tr></thead>
            <tbody>
              {pending.length + active.length === 0 && <tr><td colSpan={7} className="muted">Nothing here yet{canEdit ? " — add the first one below." : "."}</td></tr>}
              {[...pending, ...active].sort((a, b) => (a.status === b.status ? whereLabel(a.seenAt).localeCompare(whereLabel(b.seenAt)) : a.status === "pending" ? -1 : 1)).map((r) => { const ed = editing && editing.id === r.id; return (
                <tr key={r.id} data-testid={"std-row-" + r.source}>
                  <td className="tnum">{ed ? <input className="input tnum" style={{ maxWidth: 160 }} value={editing.source} onChange={(e) => setEditing({ ...editing, source: e.target.value })} autoFocus data-testid="std-edit-source" /> : <><b>{r.source}</b>{r.previous && r.previous.source !== r.source && <span className="muted"> (was {r.previous.source})</span>}</>}</td>
                  <td>{ed ? <select className="select" style={{ maxWidth: 120 }} value={editing.system} onChange={(e) => setEditing({ ...editing, system: e.target.value })} data-testid="std-edit-system"><option>CREDIT</option><option>DEBIT</option></select>
                    : <><span className={"chip " + (r.system === "CREDIT" ? "chip-previous" : "chip-manual")}>{r.system}</span>{r.previous && r.previous.system !== r.system && <span className="muted"> (was {r.previous.system})</span>}</>}</td>
                  {scope === undefined && <td>{whereLabel(r.seenAt)}</td>}
                  <td className="tnum" style={{ fontSize: 12 }}>{r.table} · {r.column}</td>
                  <td>{r.status === "active" ? <span className="pill pill-active"><span className="dot" /><Check size={11} /> Active</span> : <span className="pill pill-pending"><span className="dot" /><Clock size={11} /> Pending approval</span>}</td>
                  <td>{r.owner} · {formatDate(r.createdAt)}</td>
                  <td>
                    {ed ? <span style={{ display: "flex", gap: 6 }}><button className="btn btn-primary btn-sm" onClick={() => saveEdit(r)} data-testid="std-edit-save">Save</button><button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button></span>
                      : r.status === "pending" ? (canApprove && (r.owner === currentUser ? <span className="muted">Your own</span> : <span style={{ display: "flex", gap: 6 }}><button className="btn btn-success btn-sm" onClick={() => decide(r, true)} data-testid={"std-approve-" + r.source}><Check size={13} /> Approve</button><button className="btn btn-outline btn-sm" onClick={() => decide(r, false)}>Send back</button></span>))
                      : canEdit && <button className="au-round row-edit" title="Edit" aria-label={`Edit ${r.source}`} onClick={() => setEditing({ id: r.id, source: r.source, system: r.system })} data-testid={"std-edit-" + r.source}><Pencil size={14} /></button>}
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="std-add" data-testid="std-add">
            <input className="input tnum" placeholder="Value as in file, e.g. CR" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} data-testid="std-source" />
            <select className="select" value={draft.system} onChange={(e) => setDraft({ ...draft, system: e.target.value })}><option>CREDIT</option><option>DEBIT</option></select>
            {scope === undefined && (
              <select className="select" value={draft.seenAt} onChange={(e) => setDraft({ ...draft, seenAt: e.target.value })} aria-label={S.where} data-testid="std-where">
                <option value="">{S.every[0].toUpperCase() + S.every.slice(1)}</option>
                {sources.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
            <button className="btn btn-primary" onClick={add} data-testid="std-add-btn"><Plus size={15} /> Add</button>
          </div>
        )}
      </div>
    </div>
  );
}
