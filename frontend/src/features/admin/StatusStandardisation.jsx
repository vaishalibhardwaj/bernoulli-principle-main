import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MoreHorizontal, Copy } from "lucide-react";
import { usePopover, PopoverPanel } from "@/components/Popover";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { StatusPill } from "@/components/bits";
import Picker from "@/components/Picker";
import { formatDate, uid } from "@/lib/format";
import { toast } from "sonner";

/**
 * PRD v1 "Transaction Status Standardization" + PRD v4 §5.3 — admin-maintained table that converts
 * bank-specific credit/debit indicators into the system values CREDIT / DEBIT.
 * Maintained by Recon Ops; every add/change waits for another member of the team.
 */
export default function StatusStandardisation({ embedded = false }) {
  const nav = useNavigate();
  const { collections, perms, act, currentUser } = useStore();
  const rows = collections.status_map || [];
  const canEdit = hasCap(perms, "status_std", "edit");
  const canApprove = hasCap(perms, "status_std", "approve");
  const [draft, setDraft] = React.useState({ source: "", system: "CREDIT", seenAt: "", table: "RECON_BANK_TXN", column: "INSTRM_STATUS" });
  const [answer, setAnswer] = React.useState({});

  const active = rows.filter((r) => r.status === "active");
  const pending = rows.filter((r) => r.status === "pending");
  const requests = rows.filter((r) => r.status === "requested");

  const save = (row, label) => {
    const r = act({ screen: "status_std", cap: "edit", kind: "status_map", id: row.id, target: row, patch: () => row, audit: { entityLabel: `Status “${row.source}” → ${row.system}`, action: label, from: null, to: "Pending approval" } });
    if (!r.ok) { toast.error(r.error); return false; }
    toast.success("Sent to another team member for approval");
    return true;
  };
  const add = () => {
    const src = draft.source.trim();
    if (!src) { toast.error("Enter the value as it appears in the bank file"); return false; }
    if (rows.some((r) => r.source.toUpperCase() === src.toUpperCase() && r.status !== "requested")) { toast.error(`“${src}” is already in the table`); return false; }
    if (save({ ...draft, source: src, id: uid("sm"), status: "pending", owner: currentUser, createdAt: new Date().toISOString() }, "Add status mapping")) { setDraft({ ...draft, source: "", seenAt: "" }); return true; }
    return false;
  };
  const fulfil = (req) => {
    const system = answer[req.id];
    if (!system) { toast.error("Pick CREDIT or DEBIT"); return; }
    save({ ...req, system, status: "pending", owner: currentUser, requestedBy: req.owner }, "Add status mapping (maker request)");
  };

  const ORDER = ["pending", "active"];
  const [status, setStatus] = React.useState("all");
  const [bank, setBank] = React.useState("all");
  const [adding, setAdding] = React.useState(false);
  const all = [...pending, ...active];
  const seen = [...new Set(all.map((r) => r.seenAt).filter(Boolean))].sort();
  const list = all.filter((r) => (status === "all" || r.status === status) && (bank === "all" || r.seenAt === bank)).sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status));
  const COLS = "40px minmax(0, 1.4fr) 120px minmax(0, 1.6fr) 210px 44px";

  return (
    <div data-testid="status-std">
      {!embedded && <div className="page-head"><div><h1>Transaction type mapping</h1></div></div>}

      <div className="dl-bar">
        <Picker value={status} onChange={setStatus} label="Status" testid="std-status" width={240}
          options={[["all", "All statuses"], ["active", "Active"], ["pending", "Pending for approval"]].map(([k, l]) => ({ value: k, label: l, count: k === "all" ? all.length : all.filter((r) => r.status === k).length }))} />
        <Picker value={bank} onChange={setBank} label="Seen at" testid="std-bank" width={240} options={[{ value: "all", label: "All", count: seen.length }, ...seen.map((b) => ({ value: b, label: b, count: all.filter((r) => r.seenAt === b).length }))]} />
        {canEdit && !adding && <button type="button" className="btn btn-primary" onClick={() => setAdding(true)} data-testid="std-add-open"><Plus size={15} /> Add value</button>}
      </div>

      {adding && (
        <div className="dl-form" data-testid="std-add">
          <h3>New value</h3>
          <label>Value in bank file<input className="input tnum" placeholder="e.g. CR" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} data-testid="std-source" autoFocus /></label>
          <label>System value<select className="select" value={draft.system} onChange={(e) => setDraft({ ...draft, system: e.target.value })}><option>CREDIT</option><option>DEBIT</option></select></label>
          <label>Seen at<input className="input" placeholder="Bank or aggregator (optional)" value={draft.seenAt} onChange={(e) => setDraft({ ...draft, seenAt: e.target.value })} /></label>
          <div className="acts"><button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => { if (add()) setAdding(false); }} data-testid="std-add-btn">Send for approval</button></div>
        </div>
      )}

      {canEdit && requests.length > 0 && (
        <>
          <h2 className="dl-sub">Asked for by makers <em className="tnum">{requests.length}</em></h2>
          <div className="dl" data-testid="std-requests" style={{ "--cols": "44px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 160px 170px" }}>
            <div className="dl-h" aria-hidden="true"><span /><span>Value in file</span><span>Seen at</span><span>Asked by</span><span>Convert to</span><span /></div>
            <ul className="rq-list">
              {requests.map((r) => (
                <li key={r.id}><div className="dl-r">
                  <span className="dl-ic" aria-hidden="true">?</span>
                  <span className="dl-c"><b className="dl-strong tnum">{r.source}</b></span>
                  <span className="dl-c">{r.seenAt || "—"}</span>
                  <span className="dl-c muted">{r.owner} · {formatDate(r.createdAt)}</span>
                  <select className="select dl-sel" aria-label={`Convert ${r.source} to`} value={answer[r.id] || ""} onChange={(e) => setAnswer({ ...answer, [r.id]: e.target.value })} data-testid={"std-answer-" + r.source}><option value="">Select…</option><option>CREDIT</option><option>DEBIT</option></select>
                  <span className="dl-act"><button className="btn btn-primary btn-sm" onClick={() => fulfil(r)} data-testid={"std-fulfil-" + r.source}>Send for approval</button></span>
                </div></li>
              ))}
            </ul>
          </div>
          <h2 className="dl-sub">All values</h2>
        </>
      )}

      <div className="dl" style={{ "--cols": COLS }}>
        <div className="dl-h" aria-hidden="true"><span /><span>Value in bank file</span><span>System value</span><span>Seen at</span><span>Status</span><span /></div>
        {list.length === 0 && <div className="dl-empty">No values here.</div>}
        <ul className="rq-list">
          {list.map((r) => (
            <li key={r.id}><div className="dl-r" data-testid={"std-row-" + r.source}>
              <span className="dl-ic" aria-hidden="true">{r.system === "CREDIT" ? "C" : "D"}</span>
              <span className="dl-main"><b className="tnum">{r.source}</b><small>{r.owner} · {formatDate(r.createdAt)}</small></span>
              <span className="dl-c"><span className={"dl-sys" + (r.system === "CREDIT" ? " credit" : "")}>{r.system}</span></span>
              <span className="dl-c">{r.seenAt || "—"}</span>
              <span className="dl-stack"><StatusPill status={r.status} />{r.status === "pending" && (r.owner === currentUser ? <small className="muted">Waiting for a teammate</small> : canApprove ? <button type="button" className="link" onClick={() => nav("/setup-todo?tab=approve")} data-testid={"std-review-" + r.id}>Review in To do</button> : null)}</span>
              <DbMenu row={r} />
            </div></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The "⋯" on a row: shows where the value is stored (database table and column), with a copy button. */
function DbMenu({ row }) {
  const pop = usePopover();
  const where = `${row.table} · ${row.column}`;
  return (
    <span className="dl-more">
      <button type="button" ref={pop.btn} className="dl-kebab" onClick={pop.toggle} aria-expanded={pop.open} aria-label={`More for ${row.source}`} data-testid={"std-more-" + row.source}><MoreHorizontal size={17} /></button>
      <PopoverPanel state={pop} align="right" width={320} label="Database table and column">
        <span className="pop-l">DB table · column</span>
        <code className="pop-code">{where}</code>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard?.writeText(where); toast.success("Copied"); pop.close(); }}><Copy size={13} /> Copy</button>
      </PopoverPanel>
    </span>
  );
}
