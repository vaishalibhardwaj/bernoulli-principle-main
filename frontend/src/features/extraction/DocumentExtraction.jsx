import React from "react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { EXTRACTION_THRESHOLDS as T } from "@/mock/opsSeed";
import { formatDateTime } from "@/lib/format";
import { Conf, PhaseBadge, ReadOnlyNote } from "@/features/ops/ui";
import { ScanText, Mail, FileText, Image, CheckCircle2, XCircle, Check, ShieldCheck, Ban } from "lucide-react";
import { toast } from "sonner";
import { JourneyBar } from "@/features/today/Cycle";
import { useSearchParams } from "react-router-dom";
import { PLAIN_DOC_STATUS, plainField, plainCheck } from "@/lib/plain";

const PIPELINE = [
  ["Capture", "Mailbox / SFTP listener stores file + body, hashes for duplicates"],
  ["Classify", "Rules (sender, subject, filename), then LLM fallback"],
  ["Read page", "PDF text layer, or OCR with layout for scans"],
  ["Extract", "LLM fills the mapping schema and quotes the source span for each value"],
  ["Validate", "Totals, UTR/PAN/IFSC formats, master lookups, duplicates"],
  ["Score", "OCR conf × span match × validators × 2-pass agreement"],
  ["Route", `≥ ${T.auto * 100}% auto-load · ${T.review * 100}–${T.auto * 100}% human · < ${T.review * 100}% reject`],
  ["Review", "Human fixes only the flagged fields"],
  ["Learn", "Corrections refine templates and thresholds"],
];
const STATUS = { needs_review: ["Needs review", "pill-pending"], auto_loaded: ["Auto-loaded", "pill-active"], ignored: ["Not a recon document", "pill-inactive"], approved: ["Loaded after review", "pill-active"], pending_checker: ["Awaiting checker (high value)", "pill-pending"] };
const KIND_ICON = { "Digital PDF": FileText, "Email body": Mail, "Scanned image": Image };
const HIGH_VALUE = 10000000; // ₹1 Cr → second person

export default function DocumentExtraction() {
  const { collections, perms, act, currentUser, simple } = useStore();
  const [sp] = useSearchParams();
  const ST = simple ? PLAIN_DOC_STATUS : STATUS;
  const docs = collections.documents || [];
  const canEdit = hasCap(perms, "extraction", "edit");
  const canApprove = hasCap(perms, "extraction", "approve");
  const [selId, setSelId] = React.useState(sp.get("doc") || docs.find((d) => d.status === "needs_review")?.id || docs[0]?.id);
  const doc = docs.find((d) => d.id === selId);
  const [edits, setEdits] = React.useState({});
  const [confirmed, setConfirmed] = React.useState({});
  React.useEffect(() => { setEdits({}); setConfirmed({}); }, [selId]);

  if (!doc) return null;
  const flaggedFields = doc.fields.filter((f) => f.conf < T.auto || (f.validator && !f.validator.ok));
  const flaggedCells = doc.lines.flatMap((l, i) => Object.entries(l).filter(([, v]) => v[1] < T.auto).map(([k]) => `${i}.${k}`));
  const unresolved = [...flaggedFields.map((f) => f.key), ...flaggedCells].filter((k) => !confirmed[k]);
  const amountField = doc.fields.find((f) => /amount|net/i.test(f.key));
  const value = amountField ? Number(String(amountField.value).replace(/,/g, "")) : 0;
  const lowSpans = [...doc.fields.filter((f) => f.conf < T.auto).map((f) => f.value), ...doc.lines.flatMap((l) => Object.values(l).filter((v) => v[1] < T.auto).map((v) => v[0]))];

  const markLine = (line) => {
    const hit = lowSpans.find((s) => s && line.includes(s));
    if (!hit) return line;
    const i = line.indexOf(hit);
    return <>{line.slice(0, i)}<mark className="low">{hit}</mark>{line.slice(i + hit.length)}</>;
  };

  const submit = () => {
    if (unresolved.length) { toast.error(`${unresolved.length} flagged value(s) still need a decision`); return; }
    const needsChecker = value >= HIGH_VALUE;
    const corrections = Object.entries(edits).filter(([, v]) => v);
    const res = act({ screen: "extraction", cap: "edit", kind: "documents", id: doc.id, patch: { status: needsChecker ? "pending_checker" : "approved", owner: currentUser, corrections: corrections.length }, audit: { entityLabel: doc.name, action: needsChecker ? "Submit extraction (high value)" : "Approve extraction & load", from: "Needs review", to: needsChecker ? "Awaiting checker" : "Loaded", comment: `${corrections.length} correction(s) captured for learning` } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(simple ? (needsChecker ? "Saved. Big amount, so your team lead will approve it." : "Saved. Thank you!") : needsChecker ? "Above ₹1 Cr — sent to a checker" : "Rows loaded into the recon ledger, linked to this document");
  };
  const checker = (yes) => {
    const res = act({ screen: "extraction", cap: "approve", kind: "documents", id: doc.id, patch: { status: yes ? "approved" : "needs_review" }, audit: { entityLabel: doc.name, action: yes ? "Approve extraction" : "Return extraction", from: "Awaiting checker", to: yes ? "Loaded" : "Needs review" } });
    if (!res.ok) toast.error(res.error); else toast.success(yes ? "Approved and loaded" : "Returned to maker");
  };

  const fieldRow = (f) => {
    const flagged = f.conf < T.auto || (f.validator && !f.validator.ok);
    const done = confirmed[f.key];
    return (
      <div key={f.key} className={"xf-row" + (flagged && !done ? " flagged" : "")} data-testid={"xf-" + f.key}>
        <div className="xf-label">{simple ? plainField(f.label) : f.label}</div>
        <div className="xf-val">
          {flagged && canEdit && doc.status === "needs_review" ? (
            <input className="input tnum" value={edits[f.key] ?? f.value} onChange={(e) => setEdits((x) => ({ ...x, [f.key]: e.target.value }))} />
          ) : <span className="tnum">{edits[f.key] || f.value}</span>}
          {f.validator && <div className={"xf-valid " + (f.validator.ok ? "ok" : "bad")}>{f.validator.ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />} {simple ? plainCheck(f.validator.msg) : f.validator.msg}</div>}
        </div>
        <Conf value={f.conf} auto={T.auto} review={T.review} />
        {flagged && canEdit && doc.status === "needs_review" && <button className={"btn btn-sm " + (done ? "btn-success" : "btn-outline")} onClick={() => setConfirmed((c) => ({ ...c, [f.key]: !c[f.key] }))} data-testid={"confirm-" + f.key}><Check size={12} /> {simple ? (done ? "Checked ✓" : "This is correct") : done ? "Confirmed" : "Confirm"}</button>}
      </div>
    );
  };

  return (
    <div data-testid="doc-extraction">
      <JourneyBar current="match" />
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><ScanText size={24} /> {simple ? "Read PDFs & emails" : "Document Extraction"}</h1>
          <p>{simple ? "The system has read these documents. Check only the values marked in orange, then save." : "PDF MIS files, scanned slips and email bodies become the same rows a CSV would. A person checks only the values the system is unsure about."}</p>
        </div>
        {!simple && <div className="actions"><PhaseBadge phase="P3">AI extraction · field confidence · human-in-the-loop</PhaseBadge></div>}
      </div>
      {!canEdit && !canApprove && <ReadOnlyNote what="Maker" />}

      {!simple && <div className="pipeline" data-testid="pipeline">
        {PIPELINE.map(([t, d], i) => <div key={t} className="pl-step"><span>{i + 1}</span><b>{t}</b><small>{d}</small></div>)}
      </div>}

      <div className="xt-layout">
        <div className="card xt-list">
          {docs.map((d) => {
            const Icon = KIND_ICON[d.kind] || FileText;
            return (
              <button key={d.id} className={"xt-doc" + (d.id === selId ? " on" : "")} onClick={() => setSelId(d.id)} data-testid={"doc-" + d.id}>
                <Icon size={16} />
                <div><b>{d.name}</b><div className="muted">{d.docType} · {d.source}</div><span className={"pill " + ST[d.status][1]}><span className="dot" />{ST[d.status][0]}</span></div>
              </button>
            );
          })}
        </div>

        <div className="card xt-preview">
          <div className="card-head"><h3>{doc.kind}</h3><span className="muted">received {formatDateTime(doc.receivedAt)}</span></div>
          <pre className="doc-page">{doc.text.map((l, i) => <div key={i}>{markLine(l) || " "}</div>)}</pre>
          <div className="muted" style={{ padding: "0 16px 14px" }}><mark className="low">Highlighted</mark> = {simple ? "the system wasn't sure it read this correctly. Please compare." : `value extracted below the ${T.auto * 100}% auto-load threshold.`}</div>
        </div>

        <div className="card xt-fields">
          <div className="card-head"><h3>{simple ? "What the system read" : "Extracted values"}</h3><span className={"pill " + ST[doc.status][1]}><span className="dot" />{ST[doc.status][0]}</span></div>
          <div className="card-pad">
            {doc.status === "ignored" ? <div className="muted"><Ban size={14} /> {simple ? "This is not a payment document (e.g. an advert). Nothing to do." : "Classified as not a reconciliation document. Nothing extracted. Kept for audit."}</div> : <>
              {doc.fields.map(fieldRow)}
              {doc.lines.length > 0 && (
                <table className="grid compact xt-lines" style={{ marginTop: 12 }}>
                  <thead><tr><th>{simple ? "Payment reference" : "Txn ref"}</th><th>{simple ? "Application" : "App no"}</th><th style={{ textAlign: "right" }}>Amount</th><th>Status</th><th>Reason</th></tr></thead>
                  <tbody>{doc.lines.map((l, i) => (
                    <tr key={i}>{["utr", "app", "amount", "status", "reason"].map((k) => {
                      if (!l[k]) return <td key={k} className="muted">—</td>;
                      const [v, c, hint] = l[k]; const key = `${i}.${k}`; const low = c < T.auto;
                      return <td key={k} className={(low && !confirmed[key] ? "cell-low" : "") + (k === "amount" ? " tnum r" : " tnum")} title={hint || `${Math.round(c * 100)}%`}>
                        {low && canEdit && doc.status === "needs_review" ? <span className="cell-fix">{v}<button className="link" onClick={() => setConfirmed((x) => ({ ...x, [key]: !x[key] }))} data-testid={"fix-" + key}>{simple ? (confirmed[key] ? "✓ checked" : "check") : confirmed[key] ? "✓ fixed" : "fix"}</button></span> : v}
                        {hint && <div className="muted" style={{ fontSize: 10.5 }}>{hint}</div>}
                      </td>;
                    })}</tr>
                  ))}</tbody>
                </table>
              )}
              {doc.status === "auto_loaded" && <div className="note" style={{ marginTop: 12 }}><CheckCircle2 size={14} /><div>{simple ? <>The system read everything clearly, so this was <b>saved automatically</b>. Nothing to do.</> : <>Every value ≥ {T.auto * 100}% and every validator passed, so this loaded with <b>no human touch</b>.</>}</div></div>}
              {doc.status === "needs_review" && canEdit && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                  <span className="muted">{simple ? (unresolved.length ? `${unresolved.length} orange value${unresolved.length !== 1 ? "s" : ""} still to check` : "All checked") : unresolved.length ? `${unresolved.length} flagged value(s) left` : "All flagged values resolved"}</span>
                  <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={unresolved.length > 0} onClick={submit} data-testid="approve-extraction"><ShieldCheck size={14} /> {simple ? (value >= HIGH_VALUE ? "Looks right — send for approval" : "Looks right — save") : value >= HIGH_VALUE ? "Submit to checker (≥ ₹1 Cr)" : "Approve & load rows"}</button>
                </div>
              )}
              {doc.status === "pending_checker" && (canApprove && doc.owner !== currentUser ? (
                <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => checker(false)}>Return</button>
                  <button className="btn btn-success btn-sm" onClick={() => checker(true)} data-testid="checker-approve-doc"><Check size={13} /> Approve & load</button>
                </div>
              ) : <div className="muted" style={{ marginTop: 12 }}>Waiting for a checker (high-value document).</div>)}
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
