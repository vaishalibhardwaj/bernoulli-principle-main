import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ReviewBody } from "@/features/authQueue/AuthQueue";
import { BANK_MODES, CREDIT_MODES } from "@/lib/constants";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/state/store";
import { useApprovals } from "./useApprovals";
import { Inbox, Check, X, ArrowRight, AlertTriangle, CheckCircle2, Keyboard, CheckCheck } from "lucide-react";
import { toast } from "sonner";

const KIND_ORDER = ["Fund release", "Bank file layout", "Refund", "Manual match", "Case closure", "Document", "Match rule", "Bank setup", "Credit MIS setup", "Column mapping", "Status mapping", "Access", "Day close"];
const WHY = {
  "Fund release": "Units can't be allotted until this money is released to Transaction Posting. Cut-off 3:00 PM.",
  "Bank file layout": "Rows from this bank are held until the new layout is accepted.",
  Refund: "Money goes back to the investor. Delayed interest applies after 5 days.",
  "Manual match": "Confirms that a payment belongs to a purchase, so it can be released.",
  "Case closure": "Closes a problem case with the reason the maker gave.",
  Document: "High-value values read from a PDF / email, checked by a maker.",
  "Match rule": "Changes how payments are matched automatically. Review the simulation first.",
  "Day close": "Signs off today's reconciliation and sends the summary to AMCs.",
  "Bank setup": "Controls how this account's statement is fetched and read. Once approved, it's live from the next file.",
  "Credit MIS setup": "Controls how this payment aggregator's MIS is fetched and read. Live from the next file once approved.",
  "Column mapping": "Decides which column in the bank file becomes which field. A wrong mapping mis-reads every row.",
  "Status mapping": "Decides whether rows carrying this value are read as credits or debits, for every bank file loaded from now on.",
};

/**
 * Checker inbox as a split view (like an email client): a contained list on the left,
 * one item in detail on the right, keyboard-driven, auto-advancing after each decision.
 */
export default function Approvals() {
  const nav = useNavigate();
  const { currentUser, audit, collections, upsert, addAudit } = useStore();
  const all = useApprovals();
  const [sp] = useSearchParams();
  const [kind, setKind] = React.useState(sp.get("kind") || "all");
  const [comment, setComment] = React.useState("");
  const [selId, setSelId] = React.useState(null);
  const [done, setDone] = React.useState(0);
  const items = all.filter((a) => kind === "all" || a.kind === kind);
  const counts = KIND_ORDER.map((k) => [k, all.filter((a) => a.kind === k).length]).filter(([, n]) => n);
  const idx = Math.max(0, items.findIndex((a) => a.kind + a.id === selId));
  const cur = items[idx];

  const go = (d) => { const n = items[Math.max(0, Math.min(items.length - 1, idx + d))]; if (n) setSelId(n.kind + n.id); };
  const decide = React.useCallback((a, yes) => {
    if (!a || a.own) return;
    const fn = yes ? (a.approve || a.config?.approve) : a.reject;
    if (!fn) { nav(a.review); return; }
    const res = yes ? fn() : fn(comment);
    if (res && res.ok === false) { toast.error(res.error); return; }
    setDone((d) => d + 1);
    setComment("");
    toast.success(yes ? `${a.kind} approved` : `Sent back to ${a.owner || "the maker"}`);
    const nextItem = items[idx + 1] || items[idx - 1];
    setSelId(nextItem ? nextItem.kind + nextItem.id : null);
  }, [items, idx, nav, comment]);

  // Authorisers comment; they never edit the record. A remark is saved without approving or sending back.
  const addRemark = (a) => {
    const t = comment.trim();
    if (t.length < 3) { document.getElementById("ap-comment")?.focus(); toast("Type the remark in the box first"); return; }
    const rec = (collections[a.record._kind] || []).find((x) => x.id === a.id);
    if (!rec) return;
    upsert(a.record._kind, { ...rec, remarks: [...(rec.remarks || []), { by: currentUser, at: new Date().toISOString(), text: t }] });
    addAudit({ entityType: a.record._kind, entityId: a.id, entityLabel: a.title, action: "Authoriser remark", comment: t });
    setComment(""); toast.success("Remark saved. The maker sees it; nothing was changed or decided.");
  };

  React.useEffect(() => {
    const h = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === "s" && cur?.needsComment && comment.trim().length < 10) { document.getElementById("ap-comment")?.focus(); toast("Write why you're sending it back (10+ characters), then press Send back"); return; }
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); go(1); }
      if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); go(-1); }
      if (e.key === "a") decide(cur, true);
      if (e.key === "s") decide(cur, false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const groups = KIND_ORDER.map((k) => [k, items.filter((a) => a.kind === k)]).filter(([, l]) => l.length);

  return (
    <div className="inbox-page" data-testid="approvals-inbox">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Inbox size={22} /> Approvals</h1>
          <p>One item at a time. Approve with <kbd>A</kbd>, send back with <kbd>S</kbd>, move with <kbd>J</kbd>/<kbd>K</kbd>. The next item opens automatically.</p>
        </div>
        <div className="actions"><span className="inbox-done"><CheckCheck size={15} /> {done} done this session · {all.length} left</span></div>
      </div>

      <div className="ap-metrics">
        {[["Total submissions", all.length + audit.filter((x) => /^(Approve|Reject|Sign off|Release funds)/.test(x.action) && !x.denied).length],
          ["Awaiting review", all.length],
          ["Approved", audit.filter((x) => /^(Approve|Sign off|Release funds)/.test(x.action) && !x.denied).length],
          ["Rejected / sent back", audit.filter((x) => /^(Reject|Return|Reopen)/.test(x.action) && !x.denied).length]].map(([l, v]) => (
          <div key={l} className="ap-metric"><span>{l}</span><b className="fx-num">{v}</b></div>
        ))}
      </div>

      <div className="chip-row" style={{ marginBottom: 12 }}>
        <button className={"filter-chip" + (kind === "all" ? " on" : "")} onClick={() => setKind("all")}>All <b>{all.length}</b></button>
        {counts.map(([k, n]) => <button key={k} className={"filter-chip" + (kind === k ? " on" : "")} onClick={() => setKind(k)}>{k} <b>{n}</b></button>)}
      </div>

      <div className="split">
        <div className="split-list card">
          {items.length === 0 && <div className="mw-empty"><CheckCircle2 size={30} /><h2>Inbox zero</h2><p className="muted">Nothing is waiting for your approval.</p></div>}
          {groups.map(([k, list]) => (
            <div key={k}>
              <div className="sl-group">{k} <span>{list.length}</span></div>
              {list.map((a) => (
                <button key={a.kind + a.id} className={"sl-row" + (cur && a.kind + a.id === cur.kind + cur.id ? " on" : "") + (a.urgent ? " urgent" : "")} onClick={() => setSelId(a.kind + a.id)} data-testid={"ap-" + a.id}>
                  <span className="sl-title">{a.urgent && <AlertTriangle size={12} />}{a.title}</span>
                  <span className="sl-sub">{a.own ? "Your own — another checker approves" : `from ${a.owner || "—"}`}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="split-detail">
          <AnimatePresence mode="wait">
            {cur && (
              <motion.div key={cur.kind + cur.id} className="sd-card card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                <div className="sd-top"><span className="ap-kind">{cur.kind}</span>{cur.urgent && <span className="pill pill-rejected"><span className="dot" />Blocks today's cycle</span>}<span className="sd-pos">{idx + 1} / {items.length}</span></div>
                <h2>{cur.title}</h2>
                <p className="sd-detail">{cur.detail}</p>
                <div className="sd-facts">
                  <div><span>Submitted by</span><b>{cur.owner || "—"}</b></div>
                  <div><span>Why it matters</span><b>{WHY[cur.kind] || "Needs a second person before it takes effect."}</b></div>
                  <div><span>Rule</span><b>{cur.own ? "You created this — another checker must approve it." : "Maker–checker: your approval is recorded in the audit trail."}</b></div>
                </div>
                {cur.record && <div className="sd-review"><ReviewBody x={cur.record} audit={audit} modeLabel={cur.record._kind === "credit_config" ? CREDIT_MODES[cur.record.feedMode]?.label : cur.record._kind === "bank_config" ? BANK_MODES[cur.record.downloadMode]?.label : cur.record.fileType} /></div>}
                {!cur.own && cur.reject && <textarea id="ap-comment" className="textarea ap-comment" value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder={cur.needsComment ? "Why are you sending this back? (required, at least 10 characters — the maker sees this)" : "Comment for the maker (optional)"} data-testid="ap-comment" />}
                <div className="sd-actions">
                  {cur.own ? <span className="pill pill-pending"><span className="dot" />Your own submission</span> : <>
                    {(cur.approve || cur.config) && <button className="btn btn-success btn-lg" onClick={() => decide(cur, true)} data-testid={"ap-approve-" + cur.id}><Check size={16} /> Approve <kbd>A</kbd></button>}
                    {cur.reject && <button className="btn btn-outline btn-lg" onClick={() => decide(cur, false)}><X size={16} /> Send back <kbd>S</kbd></button>}
                    {cur.record && <button className="btn btn-ghost btn-lg" onClick={() => addRemark(cur)} data-testid="ap-remark">Add remark only</button>}
                    {cur.review && <button className="btn btn-outline btn-lg" onClick={() => nav(cur.review)}>Review in full <ArrowRight size={15} /></button>}
                  </>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {cur && <div className="sd-next muted"><Keyboard size={13} /> Next: {items[idx + 1] ? items[idx + 1].title : "nothing — this is the last one"}</div>}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>Signed in as {currentUser}. You can't approve anything you created.</p>
    </div>
  );
}
