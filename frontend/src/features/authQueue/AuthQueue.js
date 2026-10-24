import React from "react";
import { ChangesCard } from "@/features/setup/SetupBits";
import { summarizeSetup } from "@/lib/setupSchema";
import { useStore } from "@/state/store";
import { KIND_LABELS } from "@/lib/constants";
import { Drawer } from "@/components/Drawer";
import { Modal } from "@/components/Modal";
import { StatusPill, EmptyState } from "@/components/bits";
import { maskAccount, formatDateTime, timeAgo } from "@/lib/format";
import { BANK_MODES, CREDIT_MODES } from "@/lib/constants";
import { Inbox, Clock, CheckCircle2, XCircle, ListChecks, ShieldCheck, Ban } from "lucide-react";
import { toast } from "sonner";

export default function AuthQueue({ embedded = false }) {
  const { collections, role, currentUser, approve, reject, audit } = useStore();
  const [filter, setFilter] = React.useState("awaiting");
  const [review, setReview] = React.useState(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [comment, setComment] = React.useState("");

  const pending = React.useMemo(() => {
    const out = [];
    ["bank_config", "credit_config", "bank_mapping"].forEach((k) => {
      collections[k].filter((x) => x.status === "pending").forEach((x) => out.push({ ...x, _kind: k }));
    });
    return out.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }, [collections]);

  // Approved/Rejected counts from audit (today-ish)
  const approved = audit.filter((a) => a.action === "Approve").length;
  const rejected = audit.filter((a) => a.action === "Reject").length;

  const metrics = [
    { key: "all", label: "Total in Queue", val: pending.length, icon: ListChecks },
    { key: "awaiting", label: "Awaiting Review", val: pending.length, icon: Clock },
    { key: "approved", label: "Approved", val: approved, icon: CheckCircle2 },
    { key: "rejected", label: "Rejected", val: rejected, icon: XCircle },
  ];

  const rows = filter === "approved" || filter === "rejected" ? [] : pending;

  const reqId = (x) => "REQ-" + x.id.slice(-6).toUpperCase();
  const changeType = (x) => (x.rejection || x.approved || x.sno) ? "Edit" : "New";

  const canAct = role === "auth"; // maker cannot approve own submissions
  const ownSubmission = role === "maker";

  const doApprove = (x) => {
    approve(x._kind, x.id, `${x.bankName} · ${maskAccount(x.accountNumber)}`);
    toast.success(`Approved — ${x.bankName}`);
    setReview(null);
  };
  const doReject = (x) => {
    if (comment.trim().length < 10) { toast.error("Reject comment must be at least 10 characters"); return; }
    reject(x._kind, x.id, comment.trim(), `${x.bankName} · ${maskAccount(x.accountNumber)}`);
    toast.success("Rejected with comment");
    setReview(null); setRejecting(false); setComment("");
  };

  const modeLabel = (x) => x._kind === "credit_config" ? CREDIT_MODES[x.feedMode]?.label : x._kind === "bank_config" ? BANK_MODES[x.downloadMode]?.label : x.fileType;

  return (
    <div data-testid="auth-queue">
      {embedded ? (
        <div className="card-head" style={{ padding: "0 0 12px", border: 0 }}>
          <h3>Authorisation queue</h3>
          <span className="muted">{role === "auth" ? `${pending.length} awaiting your decision` : "Read-only in Maker view — approvals are performed by Arun"}</span>
        </div>
      ) : (
        <div className="page-head"><div>
          <h1>Authoriser Queue</h1>
          <p>{role === "auth" ? `Review and action submissions awaiting your approval, ${currentUser}.` : "You are in Maker view — approvals are performed by the Authoriser (Arun)."}</p>
        </div></div>
      )}

      <div className={"stat-cards four" + (embedded ? " compact" : "")} data-testid="queue-metrics">
        {metrics.map((m) => (
          <button key={m.key} className={"stat-card" + (filter === m.key ? " on" : "")} onClick={() => setFilter(m.key)} data-testid={"metric-" + m.key}>
            <div className="lbl">{m.label}</div>
            <div className="val tnum">{m.val}</div>
            <div className="ico"><m.icon /></div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="grid-scroll">
          <table className="grid">
            <thead><tr><th>Request ID</th><th>Type</th><th>Bank</th><th>Account</th><th>Submitted By</th><th>Submitted</th><th>Change</th><th style={{ width: 110 }}>Action</th></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} data-testid={"queue-row-" + x.id}>
                  <td className="tnum" style={{ fontWeight: 600 }}>{reqId(x)}</td>
                  <td>{KIND_LABELS[x._kind]}</td>
                  <td>{x.bankName}</td>
                  <td className="tnum">{maskAccount(x.accountNumber)}</td>
                  <td>{x.owner}</td>
                  <td className="tnum" style={{ color: "hsl(var(--muted))" }}>{timeAgo(x.lastUpdated)}</td>
                  <td><span className={"chip " + (changeType(x) === "Edit" ? "chip-edited" : "chip-auto")}>{changeType(x)}</span></td>
                  <td><button className="btn btn-primary btn-sm" onClick={() => setReview(x)} data-testid={"review-" + x.id}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <EmptyState icon={filter === "rejected" ? XCircle : filter === "approved" ? CheckCircle2 : Inbox}
              title={filter === "approved" ? `${approved} item(s) approved` : filter === "rejected" ? `${rejected} item(s) rejected` : "Queue is empty — all caught up"}
              subtitle={filter === "approved" || filter === "rejected" ? "See the full trail in Audit History." : "New submissions from Makers will appear here for review."} />
          )}
        </div>
      </div>

      {review && (
        <Drawer id="review-drawer" title={`Review — ${reqId(review)}`} subtitle={`${KIND_LABELS[review._kind]} · submitted by ${review.owner} ${timeAgo(review.lastUpdated)}`} onClose={() => { setReview(null); setRejecting(false); setComment(""); }}
          footer={<>
            {rejecting ? (
              <div style={{ width: "100%" }}>
                <textarea className="textarea" placeholder="Reason for rejection (min 10 characters)…" value={comment} onChange={(e) => setComment(e.target.value)} data-testid="reject-comment" autoFocus />
                <div style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 11.5, color: comment.trim().length < 10 ? "hsl(var(--st-rejected))" : "hsl(var(--muted))", alignSelf: "center", marginRight: "auto" }}>{comment.trim().length}/10 min</span>
                  <button className="btn btn-ghost" onClick={() => { setRejecting(false); setComment(""); }}>Cancel</button>
                  <button className="btn btn-danger" disabled={comment.trim().length < 10} onClick={() => doReject(review)} data-testid="btn-confirm-reject">Confirm Reject</button>
                </div>
              </div>
            ) : (
              <>
                {ownSubmission && <span title="Makers cannot approve their own submissions" style={{ fontSize: 12.5, color: "hsl(var(--muted))", display: "flex", alignItems: "center", gap: 6 }}><Ban size={15} /> You cannot approve your own submission</span>}
                <div style={{ flex: 1 }} />
                <button className="btn btn-success" disabled={ownSubmission} onClick={() => !ownSubmission && doApprove(review)} data-testid="btn-approve"><ShieldCheck size={15} /> Approve</button>
                <button className="btn btn-danger" disabled={ownSubmission} onClick={() => !ownSubmission && setRejecting(true)} data-testid="btn-reject">Reject</button>
              </>
            )}
          </>}>
          <ReviewBody x={review} modeLabel={modeLabel(review)} audit={audit} />
        </Drawer>
      )}
    </div>
  );
}

export function ReviewBody({ x, modeLabel, audit }) {
  const priorRejections = audit.filter((a) => a.entityId === x.id && a.action === "Reject");
  const row = (k, v, changed) => <div className="rev-row"><span className="k">{k}</span><span className="v">{changed ? <span className="changed">{v}</span> : v}</span></div>;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <StatusPill status="pending" /><span style={{ fontSize: 13, color: "hsl(var(--muted))" }}>Submitted {formatDateTime(x.lastUpdated)}</span>
      </div>
      <div className="rev-card" style={{ marginBottom: 16 }}>
        <div className="rc-head"><h4>Summary</h4></div>
        <div className="rc-body">
          {row("Type", KIND_LABELS[x._kind])}
          {row("Mode / File", modeLabel)}
          {row("Bank Name", x.bankName)}
          {row("Account Number", x.accountNumber ? maskAccount(x.accountNumber) : "From file (bulk)")}
          {x.schemeCode && row("Scheme Code", x.schemeCode)}
          {x.paCodes && row("PA Codes", x.paCodes.join(", "))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}><ChangesCard base={x.baseline ? { ...x.baseline, kind: x._kind } : null} cur={{ ...x, kind: x._kind }} /></div>

      <div className="rev-card" style={{ marginBottom: 16 }}>
        <div className="rc-head"><h4>Full setup</h4></div>
        <div className="rc-body">
          {summarizeSetup({ ...x, kind: x._kind }).filter(([k]) => !["Bank", "Account", "Download mode", "Feed mode"].includes(k)).map(([k, v]) => <React.Fragment key={k}>{row(k, v)}</React.Fragment>)}
          {x.connection && (x.connection.url || x.connection.loginId) && <div className="rev-row"><span className="k">Credential</span><span className="v"><span className="chip chip-previous"><ShieldCheck size={11} /> {x.connection.passwordSet ? "Set in vault" : "Replaced in this submission"}</span></span></div>}
        </div>
      </div>

      {(x.remarks || []).length > 0 && (
        <div className="rev-card" style={{ marginBottom: 16 }}>
          <div className="rc-head"><h4>Authoriser remarks</h4></div>
          <div className="rc-body">{x.remarks.map((r, i) => <div key={i} className="rev-row"><span className="k">{r.by} · {formatDateTime(r.at)}</span><span className="v">{r.text}</span></div>)}</div>
        </div>
      )}

      <div className="rev-card">
        <div className="rc-head"><h4>History</h4></div>
        <div className="rc-body">
          {priorRejections.length === 0 ? <span style={{ fontSize: 12.5, color: "hsl(var(--muted))" }}>No prior rejections.</span> : (
            <div className="timeline">
              {priorRejections.map((r) => (
                <div className="tl-item rej" key={r.id}><div className="tl-when">{formatDateTime(r.ts)} · {r.user}</div><div className="tl-what">Rejected</div><div className="tl-cmt">“{r.comment}”</div></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
