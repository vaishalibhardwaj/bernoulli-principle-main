// The panel for a statement whose layout changed. Same checks as before (structure fingerprint, completeness,
// which setup matched, each column's proposed mapping and confidence), laid out to answer three questions in order:
// what happened, what changed, and what do I do. Rows are held, never lost, until the new mapping is approved.
//
// Choices, by who is looking:
// - Central Setup (can change mappings): fix it in Column mapping, or send the proposed mapping for approval.
// - Recon Ops: ask Central Setup to fix it (a setup request with the proposal attached).
// - Anyone who can act: leave it held, with a reason. That call goes to the functional manager to check.
// - A checker, once a mapping change is waiting: approve it, which loads the held rows.
import React from "react";
import { CheckCircle2, XCircle, Clock, Fingerprint, ArrowRight, Send, PauseCircle, ChevronDown, Columns3 } from "lucide-react";
import { num } from "@/features/ops/ui";

const pct = (v) => Math.round(v * 100);
const tone = (v) => (v >= 0.95 ? "lc-hi" : v >= 0.6 ? "lc-mid" : "lc-lo");

export default function LayoutChange({ file, setupUsed, canFix, canSubmit, canAsk, asked, canApprove, canLeave, onFix, onSubmit, onAsk, onApprove, onLeave, history }) {
  const d = file.drift;
  const low = Math.min(...d.changes.map((c) => c.confidence));
  const waiting = file.status === "drift_pending";
  const failed = file.checks.filter((c) => !c.ok && !c.info).length;
  return (
    <div className="lc" data-testid="layout-change">
      <section className="lc-hero">
        <span className={"pill " + (waiting ? "pill-pending" : "pill-rejected")}><span className="dot" />{waiting ? "Waiting for approval" : "Layout changed"}</span>
        <h3>{file.bankName} changed the layout of this statement</h3>
        <p>{d.summary}.</p>
        <div className="lc-stats">
          <div><b className="tnum">{d.changes.length}</b><span>column{d.changes.length === 1 ? "" : "s"} changed</span></div>
          <div className={tone(low)}><b className="tnum">{pct(low)}%</b><span>lowest confidence</span></div>
          <div><b className="tnum">{num(d.rowsHeld)}</b><span>rows held, not lost</span></div>
        </div>
      </section>

      <section className="lc-sec">
        <h4><Columns3 size={15} /> What changed</h4>
        <div className="lc-cols">
          <div><span className="lc-cap">Approved layout</span><div className="lc-pills">{d.oldColumns.map((c) => <em key={c} className={d.newColumns.includes(c) ? "" : "gone"}>{c}</em>)}</div></div>
          <div><span className="lc-cap">Today's file</span><div className="lc-pills">{d.newColumns.map((c) => <em key={c} className={d.oldColumns.includes(c) ? "" : "new"}>{c}</em>)}</div></div>
        </div>
      </section>

      <section className="lc-sec">
        <h4>Proposed mapping</h4>
        <ul className="lc-map">
          {d.changes.map((c) => (
            <li key={c.field}>
              <div className="lc-map-top">
                <code>{c.field}</code>
                <span className="lc-arrow"><span className={c.old ? "" : "muted"}>{c.old || "not mapped"}</span><ArrowRight size={13} /><b>{c.proposed}</b></span>
                <span className={"lc-conf " + tone(c.confidence)}><i><u style={{ width: `${pct(c.confidence)}%` }} /></i><b className="tnum">{pct(c.confidence)}%</b></span>
              </div>
              <p>{c.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      <details className="lc-sec lc-checks">
        <summary><span><Fingerprint size={15} /> Checks</span><em>{failed ? `${failed} failed` : "All passed"} · fingerprint <code>{file.fingerprint || "—"}</code></em><ChevronDown size={15} /></summary>
        <ul>
          {file.checks.map((c) => (
            <li key={c.key} className={c.info ? "info" : c.ok ? "ok" : "bad"}>
              {c.info ? <Clock size={14} /> : c.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              <span>{c.label}{c.detail && <small>{c.detail}</small>}</span>
            </li>
          ))}
          {setupUsed && <li className="bad"><XCircle size={14} /><span>{setupUsed}</span></li>}
        </ul>
      </details>

      {history}

      <footer className="lc-do">
        <h4>{waiting ? "Waiting for a checker" : "What do you want to do?"}</h4>
        <div className="lc-choices">
          {waiting && canApprove && <button type="button" className="lc-choice primary" onClick={onApprove} data-testid="fd-approve-mapping"><CheckCircle2 size={18} /><span><b>Approve and load {num(d.rowsHeld)} rows</b><small>The new mapping goes live and the held rows load now.</small></span></button>}
          {!waiting && canFix && <button type="button" className="lc-choice" onClick={onFix} data-testid="fd-review-mapping"><Columns3 size={18} /><span><b>Fix it in Column mapping</b><small>Open the bank's mapping with this proposal filled in.</small></span></button>}
          {!waiting && canSubmit && <button type="button" className="lc-choice primary" onClick={onSubmit} data-testid="fd-submit-mapping"><Send size={18} /><span><b>Use the proposed mapping</b><small>Sent to a teammate to approve. Rows load once approved.</small></span></button>}
          {!waiting && canAsk && <button type="button" className="lc-choice primary" onClick={onAsk} disabled={asked} data-testid="fd-ask-setup"><Send size={18} /><span><b>{asked ? "Central Setup has been asked" : "Ask Central Setup to fix it"}</b><small>{asked ? "They will update the mapping; you will see it here." : "Sends this proposal to Central Setup as a request."}</small></span></button>}
          {canLeave && <button type="button" className="lc-choice" onClick={onLeave} data-testid="fd-leave"><PauseCircle size={18} /><span><b>Leave it held</b><small>Give a reason. Your functional manager checks the call.</small></span></button>}
          {waiting && !canApprove && <p className="lc-wait">A teammate is approving the new mapping. The held rows load as soon as it is approved.</p>}
        </div>
      </footer>
    </div>
  );
}
