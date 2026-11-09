import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardList, Hand, ArrowRight, CheckCircle2, Landmark, CreditCard, GitCompareArrows, Plus } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { AMCS, inScope, userAmcs } from "@/lib/org";
import { BANKS, ACCOUNTS } from "@/mock/bankMaster";
import { uid, timeAgo, maskAccount } from "@/lib/format";
import { Modal } from "@/components/Modal";

export const TASK_TYPES = {
  bank: { label: "Bank statement setup", icon: Landmark, path: "/bank-setup/new" },
  credit: { label: "Credit MIS setup", icon: CreditCard, path: "/credit-mis/new" },
  mapping: { label: "Column mapping", icon: GitCompareArrows, path: "/mapping" },
};
const TABS = [["open", "Open"], ["in_progress", "In progress"], ["done", "Done"]];

/**
 * Central Setup › Recon › Pending tasks. Ops raise a ticket ("got an HDFC statement for account X, please set it up");
 * the Central Setup Team picks it up, does the setup and closes the ticket. Oldest first, so nothing waits unseen.
 */
export default function SetupTasks({ embedded = false }) {
  const { collections, perms, act, personaUser, amcUser } = useStore();
  const nav = useNavigate();
  const canWork = hasCap(perms, "setup_tasks", "edit");
  const [tab, setTab] = React.useState("open");
  const all = (collections.setup_requests || []).filter((t) => inScope(amcUser, t.amc)); // the AMC picked for Recon setup
  const rows = all.filter((t) => t.status === tab).sort((a, b) => new Date(a.raisedAt) - new Date(b.raisedAt));
  const count = (st) => all.filter((t) => t.status === st).length;

  const update = (t, patch, action, toastText) => {
    const res = act({ screen: "setup_tasks", cap: "edit", kind: "setup_requests", id: t.id, patch, audit: { entityLabel: `${TASK_TYPES[t.type].label} · ${t.bankName}`, action } });
    if (!res.ok) { toast.error(res.error); return; }
    if (toastText) toast.success(toastText);
  };
  const pickUp = (t) => update(t, { status: "in_progress", assignee: personaUser.name, assigneeId: personaUser.id, pickedAt: new Date().toISOString() }, "Pick up setup task", "Picked up. It is yours now.");
  const start = (t) => { if (t.status === "open") pickUp(t); nav(`${TASK_TYPES[t.type].path}?task=${t.id}`); };
  const done = (t) => update(t, { status: "done", doneAt: new Date().toISOString(), doneBy: personaUser.name }, "Close setup task", "Closed. Ops can see it is done.");

  return (
    <div data-testid="setup-tasks">
      {!embedded && <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><ClipboardList size={22} /> Pending tasks</h1>
          <p>Setup requests raised by Ops for {userAmcs(amcUser).length === 1 ? userAmcs(amcUser)[0] : "your AMCs"}. Pick one up, do the setup, then close it. Oldest first.</p>
        </div>
      </div>}

      <div className="segmented" style={{ marginBottom: 14 }}>
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={"task-tab-" + k}>{l} <em>{count(k)}</em></button>)}
      </div>

      <div className="card st-list">
        {rows.length === 0 && <p className="muted card-pad">{tab === "open" ? "No open requests. Ops raise them from Bank files." : "Nothing here."}</p>}
        {rows.map((t) => {
          const T = TASK_TYPES[t.type]; const Icon = T.icon;
          const mine = t.assigneeId === personaUser.id;
          return (
            <div key={t.id} className={"st-row s-" + t.status} data-testid={"task-" + t.id}>
              <span className="st-ico"><Icon size={16} /></span>
              <div className="st-main">
                <b>{T.label} · {t.bankName}{t.accountNumber ? ` · ${maskAccount(t.accountNumber)}` : ""}</b>
                <span>{t.amc} · raised by {t.raisedBy} {timeAgo(t.raisedAt)}{t.assignee ? ` · ${t.status === "done" ? "done" : "with"} ${t.assignee === personaUser.name ? "you" : t.assignee}` : ""}</span>
                {t.note && <q>{t.note}</q>}
              </div>
              <div className="st-acts">
                {t.status === "open" && canWork && <button className="btn btn-outline btn-sm" onClick={() => pickUp(t)} data-testid={"task-pick-" + t.id}><Hand size={13} /> Pick up</button>}
                {t.status !== "done" && canWork && (t.status === "open" || mine) && <button className="btn btn-primary btn-sm" onClick={() => start(t)} data-testid={"task-start-" + t.id}>Start setup <ArrowRight size={13} /></button>}
                {t.status === "in_progress" && canWork && mine && <button className="btn btn-ghost btn-sm" onClick={() => done(t)} data-testid={"task-done-" + t.id}><CheckCircle2 size={13} /> Mark done</button>}
                {t.status === "done" && <span className="muted">closed {timeAgo(t.doneAt)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ops side: raise a setup request to the Central Setup Team. */
export function RequestSetupButton({ className = "btn btn-outline", prefill = {} }) {
  const { act, personaUser, perms, amcUser } = useStore();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ type: "bank", amc: userAmcs(amcUser)[0] || AMCS[0], bankName: prefill.bankName || "", accountNumber: prefill.accountNumber || "", note: "" });
  if (!hasCap(perms, "ingestion", "edit")) return null;
  const accounts = f.bankName ? (ACCOUNTS[f.bankName] || []) : [];
  const ok = f.bankName && (f.type !== "bank" || f.accountNumber) && f.note.trim().length >= 5;
  const send = () => {
    const id = uid("str");
    const res = act({ screen: "ingestion", cap: "edit", kind: "setup_requests", id, patch: { id, ...f, note: f.note.trim(), status: "open", raisedBy: personaUser.name, raisedById: personaUser.id, raisedAt: new Date().toISOString() },
      audit: { entityLabel: `${TASK_TYPES[f.type].label} · ${f.bankName}`, action: "Raise setup request", to: "Central Setup Team" } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Sent to the Central Setup Team. It shows in their Pending tasks.");
    setOpen(false); setF({ ...f, accountNumber: "", note: "" });
  };
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} data-testid="btn-request-setup"><Plus size={15} /> Request a setup</button>
      {open && (
        <Modal id="request-setup" title="Ask the Central Setup Team for a setup" onClose={() => setOpen(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={!ok} onClick={send} data-testid="req-send">Send request</button></>}>
          <div className="st-form">
            <label className="field"><span className="field-label">What needs setting up</span>
              <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} data-testid="req-type">{Object.entries(TASK_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></label>
            <label className="field"><span className="field-label">AMC</span>
              <select className="select" value={f.amc} onChange={(e) => setF({ ...f, amc: e.target.value })} data-testid="req-amc">{AMCS.map((a) => <option key={a}>{a}</option>)}</select></label>
            <label className="field"><span className="field-label">Bank</span>
              <select className="select" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value, accountNumber: "" })} data-testid="req-bank"><option value="">Pick a bank…</option>{BANKS.map((b) => <option key={b.name}>{b.name}</option>)}</select></label>
            <label className="field"><span className="field-label">Account number{f.type === "bank" ? "" : " (optional)"}</span>
              <select className="select" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} disabled={!f.bankName} data-testid="req-acct"><option value="">{f.bankName ? "Pick the account…" : "Pick a bank first"}</option>{accounts.map((a) => <option key={a.accountNumber} value={a.accountNumber}>{maskAccount(a.accountNumber)} · {a.schemeName}</option>)}</select></label>
            <label className="field st-wide"><span className="field-label">What happened (the team sees this)</span>
              <textarea className="textarea" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Got an HDFC Bank statement for this account by email today. Please set it up." data-testid="req-note" /></label>
          </div>
        </Modal>
      )}
    </>
  );
}
