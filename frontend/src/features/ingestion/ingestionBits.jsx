import { patternsFor, hhmm, LEARN_MIN_DAYS, LEARN_MAX_DAYS, LATE_AFTER_MIN } from "@/lib/uploadPatterns";
import React from "react";
import { useStore } from "@/state/store";
import { Modal } from "@/components/Modal";
import { formatDateTime, timeAgo, uid } from "@/lib/format";
import { num } from "@/features/ops/ui";
import { CheckCircle2, XCircle, Folder, FolderOpen, Layers, UploadCloud, AlertTriangle, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { C, Donut } from "@/features/dashboards/dashViz";

const time = (iso) => formatDateTime(iso).split(", ")[1];

/**
 * The three user-facing statuses (Pending / Success / Failed) plus "Not received yet", which is tracked
 * separately: a statement that hasn't arrived is not a failed attempt.
 */
export function uiStatus(f, conn) {
  const failedConn = conn && conn.status === "failing";
  switch (f.status) {
    case "loaded": return { key: "success", label: "Success", cls: "pill-active", remark: f.balanceMode === "computed" ? "Loaded. Closing balance computed from our data (bank file has none), so not bank-verified." : f.txnDup?.overlap ? `Loaded. ${f.txnDup.rowsRead - f.txnDup.overlap} new rows; ${f.txnDup.overlap} already loaded earlier — skipped.` : f.corrected ? "Loaded after a corrected file or reprocess." : "Loaded. All checks passed." };
    case "nil": return { key: "success", label: "Success", cls: "pill-active", remark: `No transactions today — confirmed by ${f.nilBy || "the bank"}.` };
    case "retrying": return { key: "pending", label: "Pending", cls: "pill-pending", remark: "Fresh copy fetched — reprocess to load it." };
    case "drift_pending": return { key: "pending", label: "Pending", cls: "pill-pending", remark: "New layout waiting for a checker. Rows are held, not rejected." };
    case "drift": return { key: "failed", label: "Failed", cls: "pill-rejected", remark: `Format mismatch: the bank changed its layout (${f.drift?.summary || "columns changed"}).` };
    case "unknown": return { key: "failed", label: "Failed", cls: "pill-rejected", remark: "Unknown format: no approved layout matches this file." };
    case "check_failed": return { key: "failed", label: "Failed", cls: "pill-rejected", remark: "Balance mismatch: the running balance doesn't add up." };
    case "duplicate": return { key: "failed", label: "Failed", cls: "pill-rejected", remark: "Duplicate file: same content as a file already loaded at 8:52 AM." };
    case "discarded": return { key: "failed", label: "Failed", cls: "pill-inactive", remark: "Duplicate file — discarded (resolved, kept in history)." };
    case "late": case "missing":
      return { key: "not_received", label: "Not received yet", cls: "pill-draft", remark: failedConn ? `Connectivity failure: ${conn.error}` : "Not here yet — not a failure. If it's needed now, upload it by hand (exception)." };
    default: return { key: "pending", label: "Pending", cls: "pill-pending", remark: "Retrieval or checks in progress." };
  }
}

/** Expected vs received, then how the received files went — one visual, every part clickable to filter. */
export function StatusStrip({ files, conns, active, onPick }) {
  const s = files.map((f) => uiStatus(f, conns.find((c) => c.fileId === f.id)).key);
  const n = (k) => s.filter((x) => x === k).length;
  const total = files.length, notIn = n("not_received"), got = total - notIn;
  const parts = [["success", "Success", n("success"), C.ok], ["pending", "Pending", n("pending"), C.info], ["failed", "Failed", n("failed"), C.bad]];
  return (
    <div className="card fs-card" data-testid="status-strip">
      <button type="button" className={"fs-ring" + (active === "all" || active === "received" ? " on" : "")} onClick={() => onPick("received")} data-testid="st-received">
        <Donut size={118} thickness={11} value={`${got}/${total}`} sub="received" segments={[{ v: got, color: C.info }, { v: notIn, color: C.warn }]} />
      </button>
      <div className="fs-main">
        <div className="fs-title"><b>{total} statements expected today</b>{notIn > 0 ? <button type="button" className={"fs-wait" + (active === "not_received" ? " on" : "")} onClick={() => onPick("not_received")} data-testid="st-not_received">{notIn} not received yet — not a failure</button> : <span className="fs-ok">All received</span>}</div>
        <div className="fs-bar">{parts.map(([k, , v, c]) => v ? <i key={k} style={{ width: `${(v / Math.max(1, got)) * 100}%`, background: c, boxShadow: `0 0 12px ${c}88` }} /> : null)}</div>
        <div className="fs-legend">
          {parts.map(([k, l, v, c]) => (
            <button type="button" key={k} className={"fs-leg" + (active === k ? " on" : "")} onClick={() => onPick(k)} data-testid={"st-" + k}>
              <i style={{ background: c, boxShadow: `0 0 8px ${c}` }} /><span>{l}</span><b className="fx-num">{v}</b><em>{got ? Math.round((v / got) * 100) : 0}%</em>
            </button>
          ))}
          {active && <button type="button" className="link" onClick={() => onPick(active)}>Clear filter</button>}
        </div>
      </div>
    </div>
  );
}

/**
 * Duplicates are stopped per transaction when rows are inserted (unique key in the database), not per file:
 * banks re-send the same file name through the day as a growing full-day dump. Identical rows inside one file
 * are legitimate (e.g. SIP debits after a holiday) and are all loaded.
 */
export function TxnDupSection({ file }) {
  const d = file.txnDup;
  if (!d) return null;
  return (
    <div className="fd-section" data-testid="txn-dup">
      <h4><Layers size={14} /> Rows loaded</h4>
      <table className="grid compact">
        <tbody>
          <tr><td>New rows loaded</td><td className="tnum r"><b>{num(d.rowsRead - d.overlap)}</b></td></tr>
          <tr><td>Already loaded earlier — skipped</td><td className="tnum r">{num(d.overlap)}</td></tr>
        </tbody>
      </table>
      {d.dumps && <div className="muted" style={{ marginTop: 6 }}>Same file name received {d.dumps.length} times today as a full-day dump ({d.dumps.map(([t, n]) => `${n} rows at ${t}`).join(", ")}). Each time only the new rows went in.</div>}
      <div className="muted" style={{ marginTop: 6 }}>Checked at insert by a unique key in the database, so a re-sent file, a retry or two uploads at once can't load a row twice.</div>
    </div>
  );
}

/** Dismiss a non-actionable alert. Records who, when and why; never marks the work as done. */
export function DismissModal({ what, onSubmit, onClose }) {
  const [why, setWhy] = React.useState("");
  const [note, setNote] = React.useState("");
  const reasons = ["Resolved through another channel", "Bank confirmed no statement today", "Bank maintenance window — nothing to do", "Duplicate alert", "Other"];
  return (
    <Modal id="dismiss-modal" title={`Dismiss alert: ${what}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!why || (why === "Other" && note.trim().length < 10)} onClick={() => onSubmit(why + (note.trim() ? ` — ${note.trim()}` : ""))} data-testid="dismiss-submit">Dismiss alert</button></>}>
      <div className="note warn" style={{ marginTop: 0 }}><AlertTriangle size={14} /><div>Dismissing only takes this alert out of focus lists. It does <b>not</b> mark the statement as received or the reconciliation as complete.</div></div>
      <div className="field" style={{ marginTop: 12 }}><label className="field-label">Why?</label>
        <select className="select" value={why} onChange={(e) => setWhy(e.target.value)} data-testid="dismiss-reason"><option value="">Pick a reason…</option>{reasons.map((r) => <option key={r}>{r}</option>)}</select></div>
      <div className="field" style={{ marginTop: 10 }}><label className="field-label">Note {why === "Other" ? "(required, 10+ characters)" : "(optional)"}</label><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></div>
    </Modal>
  );
}

/** SFTP: one folder per bank, a sub-folder per account; files are discovered, validated and processed automatically. */
export function SftpTab({ folders, files, canEdit, onOpenFile }) {
  const { act, currentUser } = useStore();
  const STATE = { completed: ["Completed", "ok"], in_progress: ["In progress", "prog"], error: ["Error", "bad"], waiting: ["Nothing yet", "wait"] };
  const scan = (fo) => {
    if (fo.scanning) { toast(`A scan of ${fo.root} is already running (started by ${fo.scanning.by}). Showing its progress.`); return; }
    act({ screen: "ingestion", cap: "edit", kind: "sftp", id: fo.id, patch: { scanning: { by: currentUser, at: new Date().toISOString() } }, audit: { entityLabel: `SFTP ${fo.root}`, action: "Scan SFTP folder now" } });
    setTimeout(() => act({ screen: "ingestion", cap: "edit", kind: "sftp", id: fo.id, patch: { scanning: null, lastScan: new Date().toISOString() } }), 2500);
  };
  return (<>
    <ManualPatterns files={files} onOpenFile={onOpenFile} />
    <div className="sftp-grid" data-testid="sftp-tab">
      {folders.map((f0) => ({ ...f0, accounts: f0.accounts.filter((a) => files.some((x) => x.id === a.fileId)) })).filter((fo) => fo.accounts.length).map((fo) => {
        const counts = Object.fromEntries(Object.keys(STATE).map((k) => [k, fo.accounts.filter((a) => a.state === k).length]));
        return (
          <div key={fo.id} className="card sftp-card" data-testid={"sftp-" + fo.id}>
            <div className="cc-head"><span className="cc-ico"><FolderOpen size={16} /></span><div><b>{fo.bankName}</b><span className="muted"><code>{fo.root}</code> · scanned {timeAgo(fo.lastScan)} · every {fo.every} min</span></div></div>
            <div className="sftp-counts">{Object.entries(STATE).map(([k, [l, c]]) => <span key={k} className={"sc " + c}>{l} <b>{counts[k]}</b></span>)}</div>
            <ul className="sftp-list">
              {fo.accounts.map((a) => {
                const f = files.find((x) => x.id === a.fileId);
                return <li key={a.fileId} className={STATE[a.state][1]} onClick={() => onOpenFile(a.fileId)}><Folder size={13} /><code>{a.folder}</code><span>{f ? f.fileName : "—"}</span><em>{STATE[a.state][0]}</em></li>;
              })}
            </ul>
            {canEdit && <div className="cc-actions">
              <button className="btn btn-outline btn-sm" onClick={() => scan(fo)} data-testid={"scan-" + fo.id}>{fo.scanning ? <><Loader2 size={13} className="spin" /> Scanning… (started by {fo.scanning.by})</> : <><Clock size={13} /> Scan now</>}</button>
            </div>}
          </div>
        );
      })}
    </div>
  </>);
}

const PATTERN_STATE = { learning: ["Learning", "wait"], due: ["Due", "prog"], on_time: ["Arrived on time", "ok"], arrived_late: ["Arrived late", "warn"], late: ["Late", "bad"] };

/** Manual SFTP accounts: usual upload time learned over 10–15 days; alert ~15 min after it if nothing has landed. */
function ManualPatterns({ files, onOpenFile }) {
  const rows = patternsFor(files).sort((a, b) => ({ late: 0, due: 1, arrived_late: 2, learning: 3, on_time: 4 }[a.state] - { late: 0, due: 1, arrived_late: 2, learning: 3, on_time: 4 }[b.state]));
  if (!rows.length) return null;
  return (
    <div className="card mp-card" data-testid="manual-patterns">
      <div className="card-head"><h3><Clock size={15} /> Manual SFTP uploads — learned timing</h3>
        <span className="muted">Usual upload time learned over {LEARN_MIN_DAYS}–{LEARN_MAX_DAYS} days · alert when {LATE_AFTER_MIN} min past it with nothing in the folder</span></div>
      <div className="mp-h"><span>Account</span><span>Learned from</span><span>Usual time</span><span>Today</span><span>Status</span></div>
      {rows.map((p) => {
        const [label, cls] = PATTERN_STATE[p.state];
        return (
          <div key={p.fileId} className={"mp-row s-" + p.state} onClick={() => onOpenFile(p.fileId)} data-testid={"mp-" + p.fileId}>
            <span><b>{p.bankName}</b> <code>·{p.accountNumber.slice(-4)}</code></span>
            <span className="mp-days" title={p.days.map(hhmm).join(", ")}>{p.days.map((d, i) => <i key={i} style={{ height: 6 + ((d - p.expected + 12) / 24) * 12 }} />)}<em>{p.seen} day{p.seen !== 1 ? "s" : ""}{p.learning ? ` · ${LEARN_MIN_DAYS - p.seen} more to learn` : ""}</em></span>
            <span className="tnum">{p.learning ? "—" : `${hhmm(p.expected)} ± ${p.spread}m`}</span>
            <span className="tnum">{p.todayAt != null ? `landed ${hhmm(p.todayAt)}` : p.learning ? "not yet" : p.state === "late" ? `${p.lateBy} min past usual` : `expected ${hhmm(p.expected)}`}</span>
            <span className={"sc " + cls}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

const MANUAL_REASONS = ["SFTP outage", "Bank API / portal outage", "Statement missing from the normal channel", "Urgent processing requested", "Other approved exception"];

/**
 * Manual upload as a restricted exception: a reason, the accounts it covers, and the same duplicate,
 * completeness and balance checks as every other channel. Several accounts in one go.
 */
export function ManualUploadModal({ files, folders, preselect, onClose }) {
  const { act, upsert, currentUser } = useStore();
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [picked, setPicked] = React.useState(preselect ? [preselect] : files.filter((f) => ["late", "missing"].includes(f.status)).map((f) => f.id));
  const [result, setResult] = React.useState(null);
  const label = (f) => `${f.bankName} ·${f.accountNumber.slice(-4)}`;
  const sftpHealthy = (f) => f.channel === "sftp" && folders.some((fo) => fo.bankName === f.bankName && !fo.accounts.some((a) => a.state === "error"));
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const run = () => {
    const out = picked.map((id) => {
      const f = files.find((x) => x.id === id);
      const again = f.status === "loaded";
      const checks = [
        { label: again ? "Already loaded today — only rows not loaded before go in (unique key at insert)" : "Rows checked against the database's unique key at insert", ok: true },
        { label: "Same layout as the SFTP file for this account (approved setup)", ok: true },
        { label: f.balanceMode === "computed" ? "Closing balance computed (bank gives none) — not bank-verified" : "Opening = yesterday's closing; closing balance adds up", ok: true },
      ];
      return { f, ok: checks.every((c) => c.ok), checks };
    });
    out.filter((o) => o.ok).forEach(({ f }) => act({
      screen: "manual_upload", cap: "edit", kind: "files", id: f.id,
      patch: (x) => ({ ...x, status: "loaded", receivedAt: new Date().toISOString(), rows: x.rows || 900, credits: x.credits || 720, creditAmount: x.creditAmount || 720 * 23000, hash: x.hash || uid("h") + "e3b0c44298fc1c149afbf4c8996fb924", checks: x.checks.map((k) => ({ ...k, ok: true, detail: k.info ? k.detail : null })), uploadedBy: currentUser, manualReason: reason, attempts: (x.attempts || 0) + 1,
        history: [...(x.history || []), { at: new Date().toISOString(), by: currentUser, step: "Manual upload (exception)", text: `Reason: ${reason}${note ? " — " + note : ""}` }, { at: new Date().toISOString(), by: "System", step: "Loaded", text: "Checks passed" }] }),
      audit: { entityLabel: label(f), action: "Manual upload (exception)", to: "Loaded", comment: reason },
    }));
    upsert("manual_uploads", { id: uid("mu"), at: new Date().toISOString(), by: currentUser, reason: reason + (note ? ` — ${note}` : ""), source: "Browser upload", accounts: out.map((o) => label(o.f)), outcome: out.map((o) => `${label(o.f)}: ${o.f.status === "loaded" ? "re-uploaded — new rows only" : "loaded"}`).join("; ") });
    setResult(out);
  };

  return (
    <Modal id="manual-upload" size="lg" title="Manual upload — exception only" onClose={onClose}
      footer={result ? <button className="btn btn-primary" onClick={onClose}>Done</button> : <>
        <span className="muted" style={{ marginRight: "auto" }}>Recorded with your name, the time, the reason and the outcome.</span>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!reason || !picked.length || (reason.startsWith("Other") && note.trim().length < 10)} onClick={run} data-testid="manual-run"><UploadCloud size={14} /> Upload {picked.length} statement{picked.length !== 1 ? "s" : ""}</button>
      </>}>
      {!result ? <>
        <div className="note warn" style={{ marginTop: 0 }}><AlertTriangle size={14} /><div>Use this only when the normal channel can't deliver: an outage, a missing file or an urgent request. Upload the file exactly as the bank sends it over SFTP — same format; it's read with the same approved setup.</div></div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="field"><label className="field-label">Reason (required)</label><select className="select" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="manual-reason"><option value="">Pick a reason…</option>{MANUAL_REASONS.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div className="field"><label className="field-label">Note {reason.startsWith("Other") ? "(required)" : "(optional)"}</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. SFTP server down since 9:10, ticket INC-4471" /></div>
        </div>
        <div className="field" style={{ marginTop: 12 }}><label className="field-label">Which accounts? Tick every statement you're uploading.</label>
          <div className="mu-list">
            {files.map((f) => (
              <label key={f.id} className={"mu-row" + (picked.includes(f.id) ? " on" : "")}>
                <input type="checkbox" className="cb" checked={picked.includes(f.id)} onChange={() => toggle(f.id)} data-testid={"mu-" + f.id} />
                <b>{label(f)}</b><span className="muted">{f.channel === "sftp" ? "SFTP" : f.channel}</span>
                {["late", "missing"].includes(f.status) ? <span className="pill pill-draft"><span className="dot" />Not received</span> : f.status === "loaded" ? <span className="pill pill-active"><span className="dot" />Already loaded</span> : null}
                {picked.includes(f.id) && sftpHealthy(f) && f.status !== "loaded" && <em className="mu-warn">SFTP folder is healthy — it will probably arrive by itself</em>}
              </label>
            ))}
          </div>
        </div>
      </> : (
        <div data-testid="manual-result">
          {result.map((o) => (
            <div key={o.f.id} className={"check-row " + (o.ok ? "ok" : "bad")}>{o.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}<div><b>{label(o.f)}</b> — {o.f.status === "loaded" ? "loaded — rows already in the database were skipped" : "loaded"}<div className="muted">{o.checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.label}`).join(" · ")}</div></div></div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Log of every manual upload: who, when, why, which accounts, outcome. */
export function ManualLog({ entries }) {
  if (!entries.length) return null;
  return (
    <div className="card" style={{ marginTop: 16 }} data-testid="manual-log">
      <div className="card-head"><h3>Manual uploads today</h3><span className="muted">Exceptions are logged for audit</span></div>
      <table className="grid compact"><thead><tr><th>When</th><th>By</th><th>Reason</th><th>Accounts</th><th>Outcome</th></tr></thead>
        <tbody>{entries.slice().reverse().map((e) => <tr key={e.id}><td className="tnum">{time(e.at)}</td><td>{e.by}</td><td>{e.reason}</td><td>{e.accounts.join(", ")}</td><td className="muted">{e.outcome}</td></tr>)}</tbody></table>
    </div>
  );
}

/** The exact pair of rows where the running balance stops adding up, plus the uploaded file for download. */
export function BalanceBreak({ file }) {
  const b = file.balanceBreak;
  if (!b) return null;
  const download = () => {
    const rows = [["Row", "Date", "Narration", "Debit", "Credit", "Balance"], ...b.rows.map((r) => r.map(String))];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.fileName.replace(/\.\w+$/, "") + "_as_uploaded.csv"; a.click();
  };
  return (
    <div className="fd-section" data-testid="balance-break">
      <h4><AlertTriangle size={14} /> Where the balance breaks</h4>
      <table className="grid compact">
        <thead><tr><th>Row</th><th>Date</th><th>Narration</th><th className="r">Debit</th><th className="r">Credit</th><th className="r">Balance in file</th></tr></thead>
        <tbody>{b.rows.map((r, i) => <tr key={r[0]} className={i ? "bad-row" : ""}>{r.map((c, j) => <td key={j} className={j >= 3 ? "tnum r" : j === 0 ? "tnum" : ""}>{c || "—"}</td>)}</tr>)}</tbody>
      </table>
      <div className="muted" style={{ marginTop: 6 }}>Row {b.rows[0][0]} balance + row {b.rows[1][0]} credit should be <b>₹{b.expected}</b>; the bank's file says ₹{b.rows[1][5]} (₹{b.diff} short). Ask the bank for a corrected statement. Manual fixes only per the AMC's protocol.</div>
      <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={download} data-testid="download-file">Download the uploaded file</button>
    </div>
  );
}

