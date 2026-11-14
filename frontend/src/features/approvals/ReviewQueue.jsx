// The checker's queue: a short, grouped list, and a large review window for one item at a time.
// Works for any number of items: each type shows its first few, then "Show all"; long lists load more in steps.
// Opening an item shows everything needed to decide, then Approve or Send back, each confirmed in place.
// Decisions call the item's own approve / reject (from useApprovals); nothing here changes what they do.
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, X, Check, Search, FileText, User, History, Undo2, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/state/store";
import { ReviewBody } from "@/features/authQueue/AuthQueue";
import { BANK_MODES, CREDIT_MODES } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { Art } from "@/components/Art";
import Picker from "@/components/Picker";
import { inRange } from "@/components/DateRange";

export const KIND_ORDER = ["Fund release", "Bank file layout", "File uploaded by hand", "No transactions today", "Refund", "Manual match", "Case closure", "Document", "Match rule", "Bank setup", "Credit MIS setup", "Column mapping", "Transaction type", "Narration tag", "Cutoff time", "Access", "Day close", "Finished task"];

// What approving does, in the reader's words. Describes existing behaviour only.
const APPROVE_EFFECT = {
  "Bank setup": "The setup goes live now. Statements for this account are read with it from the next pickup.",
  "Credit MIS setup": "The setup goes live now. Files from this aggregator are read with it from the next pickup.",
  "Column mapping": "The mapping goes live now and replaces the approved one.",
  "Transaction type": "The mapping goes live now and replaces the approved one.",
  "Narration tag": "The tag goes live now and is applied to new statement rows.",
  "Cutoff time": "The new cutoff time replaces the current one now.",
  "Bank file layout": "The new layout becomes the approved one, and the rows held for this file are loaded.",
  "File uploaded by hand": "The uploaded statement is accepted for this account and business date.",
  "No transactions today": "No statement is expected for this account today, and it stops showing as late.",
  "Finished task": "The task is marked as reviewed. The person can no longer untick it.",
};
const FIRST = 4;      // rows shown per type before "Show all"
const STEP = 12;      // rows added each time "Show more" is pressed

export function useDecide() {
  const { collections, upsert, addAudit, currentUser } = useStore();
  const nav = useNavigate();
  const decide = (a, yes, comment) => {
    const fn = yes ? (a.approve || a.config?.approve) : a.reject;
    if (!fn) { nav(a.review); return false; }
    const res = yes ? fn() : fn(comment);
    if (res && res.ok === false) { toast.error(res.error); return false; }
    toast.success(yes ? `${a.kind} approved` : `Sent back to ${a.owner || "the maker"}`);
    return true;
  };
  const remark = (a, text) => {
    const rec = (collections[a.record._kind] || []).find((x) => x.id === a.id);
    if (!rec) return;
    upsert(a.record._kind, { ...rec, remarks: [...(rec.remarks || []), { by: currentUser, at: new Date().toISOString(), text }] });
    addAudit({ entityType: a.record._kind, entityId: a.id, entityLabel: a.title, action: "Authoriser remark", comment: text });
    toast.success("Remark saved. The maker sees it; nothing was changed or decided.");
  };
  return { decide, remark };
}

/** items: from useApprovals (already excludes nothing; own items are shown but cannot be decided). */
export default function ReviewQueue({ items, range, testid = "review-queue", extra = null }) {
  const [kind, setKind] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [shown, setShown] = React.useState({});
  const [openKey, setOpenKey] = React.useState(null);

  const dated = items.filter((a) => !range || inRange(a.when, range));
  const needle = q.trim().toLowerCase();
  const found = dated.filter((a) => !needle || `${a.title} ${a.owner || ""} ${a.kind}`.toLowerCase().includes(needle));
  const kinds = KIND_ORDER.filter((k) => found.some((a) => a.kind === k)).concat([...new Set(found.map((a) => a.kind))].filter((k) => !KIND_ORDER.includes(k)));
  const list = found.filter((a) => kind === "all" || a.kind === kind);
  const groups = (kind === "all" ? kinds : [kind]).map((k) => [k, list.filter((a) => a.kind === k)]).filter(([, l]) => l.length);
  const ordered = groups.flatMap(([, l]) => l);
  const keyOf = (a) => a.kind + a.id;
  const idx = ordered.findIndex((a) => keyOf(a) === openKey);
  const cur = idx >= 0 ? ordered[idx] : null;

  const options = [{ value: "all", label: "All types", count: found.length }, ...kinds.map((k) => ({ value: k, label: k, count: found.filter((a) => a.kind === k).length }))];
  const limitFor = (k, n) => shown[k] ?? (kind === "all" ? Math.min(FIRST, n) : Math.min(STEP, n));

  const afterDecision = () => {
    const next = ordered[idx + 1] || ordered[idx - 1];
    setOpenKey(next && keyOf(next) !== openKey ? keyOf(next) : null);
  };

  return (
    <div className="rq" data-testid={testid}>
      <div className="rq-bar">
        <Picker value={kind} options={options} onChange={(v) => { setKind(v); setShown({}); }} label="Show" testid="rq-kind" width={280} />
        <label className="rq-search"><Search size={15} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, account or person" aria-label="Search the queue" data-testid="rq-search" /></label>
        {extra}
      </div>

      {list.length === 0 ? (
        <div className="empty rq-empty" data-testid="rq-empty"><Art name="badges" size={64} /><h3>{dated.length ? "Nothing matches" : "Nothing is waiting for you"}</h3><p>{dated.length ? "Change the type, the search or the dates." : "When a teammate submits a change, it appears here."}</p></div>
      ) : <div className="rq-panel">{groups.map(([k, l]) => {
        const lim = limitFor(k, l.length);
        return (
          <section key={k} className="rq-group" data-testid={"rq-group-" + k}>
            {kind === "all" && <header className="rq-gh"><h3>{k}</h3><em className="tnum">{l.length}</em></header>}
            <ul className="rq-list">
              {l.slice(0, lim).map((a) => (
                <li key={keyOf(a)}>
                  <button type="button" className={"rq-row" + (a.urgent ? " urgent" : "")} onClick={() => setOpenKey(keyOf(a))} data-testid={"ap-" + a.id}>
                    <span className="rq-ic" aria-hidden="true"><FileText size={17} /></span>
                    <span className="rq-main"><b>{a.title}</b><small>{a.own ? "Your own submission. Someone else approves it." : `From ${a.owner || "a teammate"}`}{a.when ? ` · ${timeAgo(a.when)}` : ""}</small></span>
                    {kind !== "all" && <span className="rq-kind">{a.kind}</span>}
                    {a.urgent && <span className="pill pill-rejected"><span className="dot" />Blocks today</span>}
                    <span className="rq-go">Review <ArrowRight size={14} /></span>
                  </button>
                </li>
              ))}
            </ul>
            {l.length > lim && (
              <button type="button" className="rq-more" onClick={() => setShown({ ...shown, [k]: kind === "all" && lim === FIRST ? Math.min(l.length, STEP) : lim + STEP })} data-testid={"rq-more-" + k}>
                Show {Math.min(STEP, l.length - lim)} more <span className="tnum">· {l.length - lim} left</span>
              </button>
            )}
          </section>
        );
      })}</div>}

      {cur && <ReviewModal a={cur} pos={idx + 1} total={ordered.length} onClose={() => setOpenKey(null)} onPrev={idx > 0 ? () => setOpenKey(keyOf(ordered[idx - 1])) : null} onNext={idx < ordered.length - 1 ? () => setOpenKey(keyOf(ordered[idx + 1])) : null} onDone={afterDecision} />}
    </div>
  );
}

/** The review window: most of the screen, scrolls inside, decision at the bottom. */
export function ReviewModal({ a, pos, total, onClose, onPrev, onNext, onDone }) {
  const { audit } = useStore();
  const nav = useNavigate();
  const { decide, remark } = useDecide();
  const [comment, setComment] = React.useState("");
  const [ask, setAsk] = React.useState(null); // true = approve, false = send back
  const bodyRef = React.useRef(null);
  React.useEffect(() => { setComment(""); setAsk(null); if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [a.kind, a.id]);
  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") { if (ask !== null) setAsk(null); else onClose(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [ask, onClose]);
  const canApprove = !a.own && (a.approve || a.config);
  const canReject = !a.own && a.reject;
  const tryAsk = (yes) => {
    if (!yes && a.needsComment && comment.trim().length < 10) { document.getElementById("rv-comment")?.focus(); toast.error("Say why you are sending it back (at least 10 characters)."); return; }
    setAsk(yes);
  };
  const confirm = () => { if (decide(a, ask, comment.trim())) onDone(); else setAsk(null); };
  const modeLabel = a.record?._kind === "credit_config" ? CREDIT_MODES[a.record.feedMode]?.label : a.record?._kind === "bank_config" ? BANK_MODES[a.record.downloadMode]?.label : a.record?.fileType;

  return (
    <div className="overlay rv-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rv" role="dialog" aria-modal="true" aria-labelledby="rv-title" data-testid="review-modal">
        <header className="rv-head">
          <span className="rv-kind">{a.kind}</span>
          <h2 id="rv-title">{a.title}</h2>
          <span className="rv-nav">
            <span className="tnum">{pos} of {total}</span>
            <button type="button" className="rv-ic" onClick={onPrev} disabled={!onPrev} aria-label="Previous item"><ChevronLeft size={17} /></button>
            <button type="button" className="rv-ic" onClick={onNext} disabled={!onNext} aria-label="Next item"><ChevronRight size={17} /></button>
            <button type="button" className="rv-ic" onClick={onClose} aria-label="Close" data-testid="review-close"><X size={17} /></button>
          </span>
        </header>

        <div className="rv-body" ref={bodyRef}>
          <div className="rv-meta">
            <span><User size={14} /> Submitted by <b>{a.owner || "a teammate"}</b></span>
            {a.when && <span><Clock3 size={14} /> {timeAgo(a.when)}</span>}
            {a.urgent && <span className="pill pill-rejected"><span className="dot" />Blocks today&apos;s cycle</span>}
          </div>
          {a.detail && !/^Submitted by/.test(a.detail) && <p className="rv-detail">{a.detail}</p>}
          {a.sample && (
            <section className="ap-sample" data-testid="ap-sample">
              <h3>What you are approving</h3>
              <dl>{a.sample.facts.map(([l, v]) => <React.Fragment key={l}><dt>{l}</dt><dd>{v}</dd></React.Fragment>)}</dl>
              {a.sample.cols && <div className="ap-cols">
                <div><span>Columns before</span>{a.sample.cols.was.map((c) => <em key={c} className={a.sample.cols.now.includes(c) ? "" : "gone"}>{c}</em>)}</div>
                <div><span>Columns now</span>{a.sample.cols.now.map((c) => <em key={c} className={a.sample.cols.was.includes(c) ? "" : "new"}>{c}</em>)}</div>
              </div>}
              {a.sample.rows && <div className="sp-scroll"><table className="sp ap-sp">
                <thead><tr>{a.sample.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{a.sample.rows.map((r, i) => <tr key={i}>{r.map((v, k) => <td key={k}>{v}</td>)}</tr>)}</tbody>
              </table></div>}
              {a.sample.note && <p>{a.sample.note}</p>}
            </section>
          )}
          {a.record && <div className="sd-review"><ReviewBody x={a.record} audit={audit} modeLabel={modeLabel} /></div>}
          {!a.sample && !a.record && a.review && <p className="rv-detail">This item is reviewed on its own screen.</p>}
        </div>

        <footer className="rv-foot">
          {a.own ? <span className="pill pill-pending"><span className="dot" />Your own submission. A teammate approves it.</span>
            : ask === null ? <>
              {canReject && <textarea id="rv-comment" className="textarea rv-comment" rows={1} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment for the maker"
                placeholder={a.needsComment ? "Why are you sending this back? Needed to send back (at least 10 characters)." : "Comment for the maker (optional)"} data-testid="rv-comment" />}
              <div className="rv-actions">
                {a.record && <button type="button" className="btn btn-ghost" onClick={() => { if (comment.trim().length < 3) { document.getElementById("rv-comment")?.focus(); toast("Type the remark first"); return; } remark(a, comment.trim()); setComment(""); }} data-testid="rv-remark">Add remark</button>}
                {a.review && !canApprove && <button type="button" className="btn btn-outline" onClick={() => { onClose(); nav(a.review); }}>Open its screen <ArrowRight size={15} /></button>}
                {canReject && <button type="button" className="btn btn-outline" onClick={() => tryAsk(false)} data-testid="rv-sendback"><X size={15} /> Send back</button>}
                {canApprove && <button type="button" className="btn btn-primary" onClick={() => tryAsk(true)} data-testid="rv-approve"><Check size={15} /> Approve</button>}
              </div>
            </> : (
              <div className="rv-confirm" role="alertdialog" aria-labelledby="rv-confirm-h" data-testid="rv-confirm">
                <div>
                  <b id="rv-confirm-h">{ask ? "Approve this?" : `Send this back to ${a.owner || "the maker"}?`}</b>
                  <ul className="confirm-list">
                    <li><FileText /><span>{ask ? (APPROVE_EFFECT[a.kind] || "The item is approved and leaves your list.") : "It goes back to be fixed and submitted again. Nothing goes live."}</span></li>
                    <li><History /><span>Your name and the time are recorded in History.</span></li>
                    <li><Undo2 /><span>{ask ? "An approval can't be undone from here." : "The approved values in use today stay as they are."}</span></li>
                  </ul>
                  {comment.trim() && <div className="confirm-quote"><span>Your comment</span>{comment.trim()}</div>}
                </div>
                <div className="rv-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)} data-testid="rv-confirm-cancel">Go back</button>
                  <button type="button" className={"btn " + (ask ? "btn-primary" : "btn-danger")} autoFocus onClick={confirm} data-testid="rv-confirm-ok">{ask ? "Yes, approve" : "Yes, send back"}</button>
                </div>
              </div>
            )}
        </footer>
      </div>
    </div>
  );
}
