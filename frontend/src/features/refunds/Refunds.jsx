import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "@/state/store";
import { Drawer } from "@/components/Drawer";
import { hasCap } from "@/lib/access";
import { delayedInterest, REFUND_SLA_DAYS } from "@/mock/opsSeed";
import { inr, inrShort, ReadOnlyNote } from "@/features/ops/ui";
import { JourneyBar } from "@/features/today/Cycle";
import { downloadCsv } from "@/features/reports/csv";
import { Undo2, BadgeCheck, Send, Check, Landmark, ArrowRight, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "sonner";

const STATUS = { draft: ["To prepare", "pill-draft"], pending: ["Waiting for approval", "pill-pending"], approved: ["Approved — ready to pay", "pill-active"], batched: ["In payment batch", "pill-active"], paid: ["Paid", "pill-active"] };
const VIEWS = [["todo", "To do", (r) => ["draft", "pending"].includes(r.status)], ["ready", "Ready to pay", (r) => r.status === "approved"], ["done", "Sent", (r) => ["batched", "paid"].includes(r.status)], ["all", "All", () => true]];

/** Stage 6 — refunds with 5-day SLA, bank-account verification, delayed interest and NEFT batch. */
export default function Refunds() {
  const { collections, perms, act, currentUser, simple } = useStore();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const all = collections.refunds || [];
  const canEdit = hasCap(perms, "refunds", "edit");
  const canApprove = hasCap(perms, "refunds", "approve");
  const [view, setView] = React.useState(canApprove && !canEdit ? "todo" : "todo");
  const [openId, setOpenId] = React.useState(sp.get("refund"));
  const rows = all.filter(VIEWS.find((v) => v[0] === view)[2]).sort((a, b) => b.ageDays - a.ageDays);
  const open = all.find((r) => r.id === openId);
  const totalOut = all.filter((r) => ["draft", "pending", "approved"].includes(r.status)).reduce((s, r) => s + r.amount + delayedInterest(r.amount, r.ageDays), 0);
  const interestPaid = all.reduce((s, r) => s + delayedInterest(r.amount, r.ageDays), 0);

  const upd = (r, patch, action, cap = "edit") => {
    const res = act({ screen: "refunds", cap, kind: "refunds", id: r.id, target: r, patch, audit: { entityLabel: `${r.ref} · ${r.investor}`, action, from: STATUS[r.status][0], to: STATUS[patch.status || r.status]?.[0] } });
    if (!res.ok) toast.error(res.error);
    return res.ok;
  };
  const verify = (r) => { if (upd(r, { verified: true }, "Verify bank account (penny drop)")) toast.success(`₹1 test credit succeeded. Name at bank matches ${r.investor}.`); };
  const submit = (r) => { if (!r.verified) { toast.error("Verify the bank account first"); return; } if (upd(r, { status: "pending", owner: currentUser }, "Submit refund")) toast.success(simple ? "Sent to your checker." : "Refund sent for approval"); };
  const approve = (r) => { if (upd(r, { status: "approved", approvedBy: currentUser }, "Approve refund", "approve")) toast.success("Refund approved"); };
  const batch = () => {
    const ready = all.filter((r) => r.status === "approved");
    ready.forEach((r) => upd(r, { status: "batched", batchRef: "NEFT-" + Date.now().toString().slice(-6) }, "Add to NEFT batch"));
    downloadCsv(`neft_refund_batch_${new Date().toISOString().slice(0, 10)}.csv`, ["Ref", "Beneficiary", "Account", "IFSC", "Amount", "Interest", "Total"], ready.map((r) => { const i = delayedInterest(r.amount, r.ageDays); return [r.ref, r.investor, r.bankAcct, r.ifsc, r.amount, i, r.amount + i]; }));
    toast.success(`${ready.length} refund${ready.length !== 1 ? "s" : ""} added to today's NEFT batch file`);
  };
  const ready = all.filter((r) => r.status === "approved");

  return (
    <div data-testid="refunds">
      <JourneyBar current="refunds" />
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Undo2 size={22} /> Refunds</h1>
          <p>{simple ? "Send money back to investors who paid twice, paid too much, or whose application was rejected. After 5 days CAMS has to add interest." : `Duplicate, excess and NIGO refunds. ${REFUND_SLA_DAYS}-day SLA from value date; after that delayed interest (15% p.a.) is added automatically. Accounts are verified by penny drop before payout.`}</p>
        </div>
        {canEdit && ready.length > 0 && <div className="actions"><button className="btn btn-primary" onClick={batch} data-testid="make-batch"><FileDown size={14} /> Create NEFT batch ({ready.length})</button></div>}
      </div>
      {!canEdit && !canApprove && <ReadOnlyNote what="Maker" />}

      <div className="ops-stats">
        <div className="ops-stat"><span className="os-label">To prepare</span><span className="os-value tnum">{all.filter((r) => r.status === "draft").length}</span></div>
        <div className="ops-stat tone-amber"><span className="os-label">Waiting for approval</span><span className="os-value tnum">{all.filter((r) => r.status === "pending").length}</span></div>
        <div className="ops-stat tone-blue"><span className="os-label">Still to send</span><span className="os-value tnum">{inrShort(totalOut)}</span></div>
        <div className="ops-stat tone-red"><span className="os-label">{simple ? "Interest CAMS is paying" : "Delayed interest accrued"}</span><span className="os-value tnum">{inr(interestPaid)}</span></div>
      </div>

      <div className="card">
        <div className="toolbar"><div className="segmented">{VIEWS.map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div></div>
        <table className="grid">
          <thead><tr><th>Refund</th><th>Investor</th><th>Why</th><th style={{ textAlign: "right" }}>Amount</th><th>Time</th><th>Bank account</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map((r) => {
            const int = delayedInterest(r.amount, r.ageDays);
            return (
              <tr key={r.id} onClick={() => setOpenId(r.id)} style={{ cursor: "pointer" }} data-testid={"rf-row-" + r.id}>
                <td className="tnum">{r.ref}</td><td><b>{r.investor}</b></td><td>{r.reason}</td>
                <td className="tnum r">{inr(r.amount)}{int > 0 && <div className="int-add">+ {inr(int)} interest</div>}</td>
                <td>{r.ageDays >= REFUND_SLA_DAYS ? <span className="clock red"><AlertTriangle size={12} /> {r.ageDays - REFUND_SLA_DAYS}d late</span> : <span className={"clock" + (r.ageDays >= 4 ? " amber" : "")}>{REFUND_SLA_DAYS - r.ageDays}d left</span>}</td>
                <td><span className="tnum">{r.bankAcct}</span> {r.verified ? <span className="ok-check"><BadgeCheck size={13} /> verified</span> : <span className="muted">not verified</span>}</td>
                <td><span className={"pill " + STATUS[r.status][1]}><span className="dot" />{STATUS[r.status][0]}</span></td>
                <td><ArrowRight size={14} className="muted" /></td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 28 }}>Nothing here.</td></tr>}</tbody>
        </table>
      </div>

      {open && (() => {
        const int = delayedInterest(open.amount, open.ageDays);
        return (
          <Drawer id="refund-drawer" title={`${open.ref} — ${open.investor}`} subtitle={open.reason} onClose={() => setOpenId(null)}>
            <div className="kv-line"><span>Refund amount</span><b className="tnum">{inr(open.amount)}</b></div>
            <div className="kv-line"><span>{simple ? "Interest CAMS must add" : "Delayed interest"}</span><span className="tnum">{int ? `${inr(int)} (${open.ageDays - REFUND_SLA_DAYS} days late × 15% p.a.)` : `None — ${REFUND_SLA_DAYS - open.ageDays} day(s) left`}</span></div>
            <div className="kv-line"><span>Total to pay</span><b className="tnum">{inr(open.amount + int)}</b></div>
            <div className="fd-section">
              <h4><Landmark size={14} /> Pay to</h4>
              <div className="kv-line"><span>Account</span><span className="tnum">{open.bankAcct} · {open.ifsc}</span></div>
              <div className="kv-line"><span>PAN</span><span className="tnum">{open.pan}</span></div>
              <div className="kv-line"><span>Verified</span>{open.verified ? <span className="ok-check"><BadgeCheck size={13} /> Yes — penny drop name match</span> : <span className="bad-check">Not yet</span>}</div>
            </div>
            <div className="fd-actions">
              {open.status === "draft" && canEdit && !open.verified && <button className="btn btn-outline" onClick={() => verify(open)} data-testid="verify-account"><BadgeCheck size={14} /> Verify bank account</button>}
              {open.status === "draft" && canEdit && <button className="btn btn-primary" disabled={!open.verified} onClick={() => submit(open)} data-testid="submit-refund"><Send size={14} /> Send for approval</button>}
              {open.status === "pending" && (canApprove && open.owner !== currentUser && !(open.owner || "").startsWith(currentUser) ? <button className="btn btn-success" onClick={() => approve(open)} data-testid="approve-refund"><Check size={14} /> Approve refund</button> : <span className="muted">Waiting for a checker.</span>)}
              {open.status === "approved" && <span className="muted">Approved. It goes out in the next NEFT batch.</span>}
            </div>
          </Drawer>
        );
      })()}
      {all.every((r) => !["draft", "pending"].includes(r.status)) && <div className="next-strip"><span>All refunds are handled.</span><button className="btn btn-primary btn-sm" onClick={() => nav("/today#close")}>Next: Close the day <ArrowRight size={13} /></button></div>}
    </div>
  );
}
