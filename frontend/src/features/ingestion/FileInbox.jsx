import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "@/state/store";
import { Drawer } from "@/components/Drawer";
import { Modal } from "@/components/Modal";
import { hasCap } from "@/lib/access";
import { formatDateTime, timeAgo } from "@/lib/format";
import { inrShort, num, Conf, ReadOnlyNote } from "@/features/ops/ui";
import { Spark } from "@/features/ops/charts";
import { CHANNEL_LABEL } from "@/mock/opsSeed";
import { Inbox, CheckCircle2, XCircle, Fingerprint, ArrowRight, RefreshCw, Send, Trash2, Wand2, Clock, UploadCloud, Mail, Plug, Bot, Server, PauseCircle, PlayCircle, KeyRound, History, FileText, Loader2, RotateCcw, Paperclip, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { JourneyBar } from "@/features/today/Cycle";
import { PLAIN_FILE_STATUS } from "@/lib/plain";
import { scopeToUser } from "@/lib/journey";
import { uiStatus, StatusStrip, BalanceBreak, TxnDupSection, DismissModal, SftpTab, ManualUploadModal, ManualLog } from "./ingestionBits";
import { withAutoVoid, unresolvedFingerprints } from "@/lib/events";

const STATUS = {
  loaded: { label: "Loaded", cls: "pill-active" },
  drift: { label: "Format drift", cls: "pill-pending" },
  drift_pending: { label: "Mapping change pending", cls: "pill-pending" },
  unknown: { label: "Unknown format", cls: "pill-rejected" },
  check_failed: { label: "Completeness check failed", cls: "pill-rejected" },
  duplicate: { label: "Duplicate", cls: "pill-inactive" },
  discarded: { label: "Discarded", cls: "pill-inactive" },
  late: { label: "Late", cls: "pill-rejected" },
  missing: { label: "Missing", cls: "pill-rejected" },
  retrying: { label: "Re-fetched — ready to reprocess", cls: "pill-draft" },
};
const EMAIL_STATUS = { matched: ["Matched to a setup", "pill-active"], rejected: ["Rejected", "pill-rejected"], ignored: ["Ignored (not a statement)", "pill-inactive"], discarded: ["Discarded", "pill-inactive"] };
const CONN_STATUS = { healthy: ["Healthy", "pill-active"], degraded: ["Slow", "pill-pending"], failing: ["Failing", "pill-rejected"], paused: ["Paused", "pill-inactive"] };
const CHANNEL_ICON = { manual: UploadCloud, email: Mail, api: Plug, auto: Bot, sftp: Server };
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
const stamp = (by, step, text, bad) => ({ at: new Date().toISOString(), by, step, text, bad });

/**
 * Statement upload with validation against the approved setup:
 * file type, layout, account number, statement date, duplicate, balance continuity.
 */
function UploadModal({ file, corrected, onClose }) {
  const { act, currentUser, collections, upsert } = useStore();
  const [reason, setReason] = React.useState(file.channel === "manual" ? "Bank has no automated channel for this account" : "");
  const acct = file.accountNumber.slice(-4);
  const otherAcct = String((Number(acct) + 4729) % 10000).padStart(4, "0");
  const choices = [
    { name: `${file.bankCode}_${acct}_${today()}.xlsx`, note: "Today's statement for this account" },
    { name: `${file.bankCode}_${otherAcct}_${today()}.xlsx`, note: "Statement for a different account" },
    { name: `${file.bankCode}_${acct}_${yesterday()}.xlsx`, note: "Yesterday's statement" },
  ];
  const [picked, setPicked] = React.useState(null);
  const [shown, setShown] = React.useState(0);
  const loadedHashes = (collections.files || []).filter((f) => f.status === "loaded").map((f) => f.fileName);

  const checks = picked ? [
    { label: "File type is allowed (CSV, XLS, XLSX, PDF)", ok: /\.(csv|xlsx?|pdf)$/i.test(picked), why: "Only CSV, XLS, XLSX or PDF can be read." },
    { label: "Layout matches the approved setup", ok: /\.(csv|xlsx?)$/i.test(picked), why: "PDF statements go through Document reading instead." },
    { label: `Account number in the file is ·${acct}`, ok: picked.includes(acct), why: `The file is for a different account (expected ·${acct}). Wrong statement downloaded?` },
    { label: "Statement date is today", ok: picked.includes(today()), why: `The statement isn't dated today (${new Date().toLocaleDateString("en-IN")}). Download today's statement.` },
    { label: "Opening balance = yesterday's closing balance", ok: picked.includes(acct) && picked.includes(today()), why: "Balance continuity can't be confirmed." },
  ] : [];
  const failed = checks.filter((c) => !c.ok);
  const doneChecking = picked && shown >= checks.length;

  React.useEffect(() => {
    if (!picked) return undefined;
    setShown(0);
    const t = setInterval(() => setShown((n) => (n >= 6 ? n : n + 1)), 260);
    return () => clearInterval(t);
  }, [picked]);

  const load = () => {
    const rows = 600 + (acct.charCodeAt(0) * 37) % 1800;
    if (!reason) { toast.error("Pick why you're uploading by hand — it's recorded for audit"); return; }
    const res = act({
      screen: "manual_upload", cap: "edit", kind: "files", id: file.id,
      patch: (f) => ({
        ...f, status: "loaded", fileName: picked, receivedAt: new Date().toISOString(), rows, credits: Math.floor(rows * 0.8), creditAmount: rows * 21000,
        checks: f.checks.map((c) => ({ ...c, ok: true, detail: null })), corrected: true, uploadedBy: currentUser, attempts: (f.attempts || 0) + 1, drift: f.drift,
        history: [...(f.history || []), stamp(currentUser, corrected ? "Corrected file uploaded" : "Uploaded by hand", picked), stamp("System", "Checks passed", "6 of 6 upload checks passed"), stamp("System", "Loaded", `${Math.floor(rows * 0.8)} credits loaded for matching`)],
      }),
      audit: { entityLabel: `${file.bankName} ·${acct}`, action: corrected ? "Upload corrected statement" : "Upload statement", from: STATUS[file.status]?.label, to: "Loaded", comment: picked },
    });
    if (!res.ok) { toast.error(res.error); return; }
    upsert("manual_uploads", { id: "mu_" + Date.now(), at: new Date().toISOString(), by: currentUser, reason, source: "Browser upload", accounts: [`${file.bankName} ·${acct}`], outcome: `${picked}: loaded` });
    toast.success(`${file.bankName} ·${acct} loaded. ${Math.floor(rows * 0.8)} credits are ready for matching.`);
    onClose();
  };
  const reject = () => {
    act({ screen: "ingestion", cap: "edit", kind: "files", id: file.id, patch: (f) => ({ ...f, history: [...(f.history || []), stamp(currentUser, "Upload rejected", `${picked}: ${failed.map((c) => c.why).join(" ")}`, true)] }), audit: { entityLabel: `${file.bankName} ·${acct}`, action: "Upload rejected", comment: `${picked}: ${failed.map((c) => c.label).join("; ")}` } });
    setPicked(null);
  };

  return (
    <Modal id="upload-modal" size="lg" title={`${corrected ? "Upload a corrected statement" : "Upload today's statement"} — ${file.bankName} ·${acct}`} onClose={onClose}
      footer={<>
        <span className="muted" style={{ marginRight: "auto" }}>Checked against the approved setup before anything is loaded.</span>
        {doneChecking && failed.length > 0 && <button className="btn btn-outline" onClick={reject} data-testid="upload-try-again"><RotateCcw size={14} /> Try another file</button>}
        {doneChecking && failed.length === 0 && <button className="btn btn-primary" onClick={load} data-testid="upload-load"><CheckCircle2 size={14} /> Load statement</button>}
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </>}>
      <div className="field" style={{ marginBottom: 12 }}><label className="field-label">Why by hand? (recorded for audit)</label>
        <select className="select" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="upload-reason"><option value="">Pick a reason…</option>{["Bank has no automated channel for this account", "SFTP outage", "Bank API / portal outage", "Statement missing from the normal channel", "Urgent processing requested", "Corrected statement from the bank"].map((r) => <option key={r}>{r}</option>)}</select></div>
      <div className="up-expect">
        <div><span>Bank · account</span><b>{file.bankName} ·{acct}</b></div>
        <div><span>Statement date</span><b>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</b></div>
        <div><span>Expected by</span><b>{formatDateTime(file.expectedBy).split(", ")[1]}</b></div>
        <div><span>Where to get it</span><b>Bank's internet banking → download statement</b></div>
      </div>
      {!picked ? (
        <>
          <label className="dropzone up-drop" data-testid="upload-drop">
            <UploadCloud size={24} />
            <h4>Drop the statement here, or click to browse</h4>
            <p className="muted">CSV, XLS, XLSX or PDF</p>
            <input type="file" accept=".csv,.xls,.xlsx,.pdf" style={{ display: "none" }} onChange={(e) => e.target.files[0] && setPicked(e.target.files[0].name)} />
          </label>
          <div className="up-demo"><span className="muted">Demo files:</span>
            {choices.map((c) => <button key={c.name} className="demo-file-link" onClick={() => setPicked(c.name)} title={c.note} data-testid={"upload-demo-" + choices.indexOf(c)}><FileText size={13} /> {c.name}<em>{c.note}</em></button>)}
          </div>
        </>
      ) : (
        <div className="up-checks">
          <div className="up-file"><Paperclip size={14} /> <b>{picked}</b></div>
          {checks.map((c, i) => (
            <div key={c.label} className={"check-row " + (i >= shown ? "pending" : c.ok ? "ok" : "bad")}>
              {i >= shown ? <Loader2 size={14} className="spin" /> : c.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              <div><div>{c.label}</div>{i < shown && !c.ok && <div className="muted">{c.why}</div>}</div>
            </div>
          ))}
          {doneChecking && <div className={"note " + (failed.length ? "warn" : "")}>{failed.length ? <>Not loaded. Fix the {failed.length} problem{failed.length > 1 ? "s" : ""} above and try another file. The attempt is recorded in the file's history.</> : <>All checks passed. Click <b>Load statement</b> to send it to matching.</>}</div>}
        </div>
      )}
    </Modal>
  );
}

/** Re-run the pipeline on a file, with a reason. Outcome depends on whether the cause was fixed. */
function ReprocessModal({ file, onClose, onUpload }) {
  const { act, currentUser } = useStore();
  const [reason, setReason] = React.useState("");
  const acct = file.accountNumber.slice(-4);
  const go = () => {
    if (!reason) { toast.error("Pick a reason — it goes in the audit trail"); return; }
    let patch; let msg; let ok = true;
    if (file.status === "unknown") { ok = false; msg = "No approved layout for this file. Onboard the format in Bank statement setup first."; }
    else if (file.status === "check_failed" && !file.corrected) { ok = false; msg = `Same result: ${file.checks.filter((c) => !c.ok).map((c) => c.label).join("; ")}. The file itself has to be corrected — ${file.channel === "manual" ? "upload a corrected statement" : "re-fetch it from the bank or upload it by hand"}.`; }
    if (ok) {
      patch = (f) => ({ ...f, status: "loaded", checks: f.checks.map((c) => ({ ...c, ok: true, detail: null })), attempts: (f.attempts || 0) + 1, history: [...(f.history || []), stamp(currentUser, "Reprocessed", `Reason: ${reason}`), stamp("System", "Checks passed", "All checks passed"), stamp("System", "Loaded", `${f.credits} credits loaded for matching`)] });
      msg = file.status === "loaded" ? `Re-run with the current mapping and rules. ${num(file.rows)} rows, no changes.` : "Reprocessed and loaded.";
    } else {
      patch = (f) => ({ ...f, attempts: (f.attempts || 0) + 1, history: [...(f.history || []), stamp(currentUser, "Reprocess failed", `Reason: ${reason}. ${msg}`, true)] });
    }
    const res = act({ screen: "ingestion", cap: "edit", kind: "files", id: file.id, patch, audit: { entityLabel: `${file.bankName} ·${acct}`, action: ok ? "Reprocess file" : "Reprocess failed", from: STATUS[file.status]?.label, to: ok ? "Loaded" : STATUS[file.status]?.label, comment: `${reason}. ${msg}` } });
    if (!res.ok) { toast.error(res.error); return; }
    if (ok) toast.success(msg); else toast.error(msg);
    onClose(ok);
  };
  return (
    <Modal id="reprocess-modal" title={`Reprocess ${file.bankName} ·${acct}`} onClose={() => onClose(false)}
      footer={<>
        {file.status === "check_failed" && !file.corrected && file.channel === "manual" && <button className="btn btn-outline" style={{ marginRight: "auto" }} onClick={onUpload}><UploadCloud size={14} /> Upload corrected file instead</button>}
        <button className="btn btn-ghost" onClick={() => onClose(false)}>Cancel</button>
        <button className="btn btn-primary" onClick={go} data-testid="reprocess-run"><RefreshCw size={14} /> Reprocess now</button>
      </>}>
      <p className="muted" style={{ marginTop: 0 }}>Runs the file through reading, checks and loading again, using the <b>current approved</b> mapping and rules. Attempt {(file.attempts || 0) + 1}.</p>
      <div className="field"><label className="field-label">Why are you reprocessing?</label>
        <select className="select" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="reprocess-reason">
          <option value="">Pick a reason…</option>
          {["Corrected file received", "Bank re-sent the statement", "Mapping or rules changed", "Previous run timed out", "Other"].map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      {file.status === "check_failed" && !file.corrected && <div className="note warn" style={{ marginTop: 12 }}><div>This file failed the closing-balance check. Reprocessing the <b>same</b> file will fail again. Get a corrected statement from the bank and upload it first.</div></div>}
    </Modal>
  );
}

/** Technical failures in words an operator can act on. */
const plainError = (c) => c.authIssue ? "The bank refused our login — the access token has expired. The setup maker renews it." : c.captcha ? "The bank's website now asks for a human check (CAPTCHA). We never bypass it — download the statement yourself and upload it." : c.status === "degraded" ? "The bank's service is slow, so some pulls time out. Pulls retry on their own." : c.error;

export default function FileInbox() {
  const { collections: rawCollections, perms, act, currentUser, simple, personaUser, amcUser } = useStore();
  const collections = { ...rawCollections, files: scopeToUser(rawCollections, amcUser).files }; // this person's AMCs
  const statusText = (st) => (simple ? PLAIN_FILE_STATUS[st] : STATUS[st]?.label) || st;
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [tab, setTab] = React.useState(sp.get("tab") || "files");
  const [filter, setFilter] = React.useState("attention");
  const [stFilter, setStFilter] = React.useState(null);
  const [manualOpen, setManualOpen] = React.useState(sp.get("manual") === "1");
  const [dismissing, setDismissing] = React.useState(null);
  const [openId, setOpenId] = React.useState(sp.get("file"));
  const [uploadFor, setUploadFor] = React.useState(sp.get("upload") && sp.get("file") ? { id: sp.get("file"), corrected: false } : null);
  const [reprocessId, setReprocessId] = React.useState(null);
  const [emailId, setEmailId] = React.useState(sp.get("email"));
  const [emailFilter, setEmailFilter] = React.useState("rejected");
  const [pickUpload, setPickUpload] = React.useState(false);
  const files = collections.files || [];
  const emails = collections.emails || [];
  const conns = collections.connections || [];
  const canEdit = hasCap(perms, "ingestion", "edit");
  const canApprove = hasCap(perms, "ingestion", "approve");
  const canSetup = hasCap(perms, "bank_setup", "edit");
  const canManual = hasCap(perms, "manual_upload", "edit");
  const sftp = rawCollections.sftp || [];
  const loadedIdsAll = (rawCollections.files || []).filter((f) => ["loaded", "nil"].includes(f.status)).map((f) => f.id);
  // A rejected email stops being an alert once the statement arrived some other way, or someone dismissed it.
  const emailResolved = (e) => e.dismissed ? `Dismissed by ${e.dismissed.by}: ${e.dismissed.why}` : (e.reason === "duplicate" || (e.suggestFileId && loadedIdsAll.includes(e.suggestFileId))) ? "Resolved — the statement is already loaded through another channel" : e.waiting ? `Waiting for a corrected email (${e.waiting.by})` : null;

  const rows = files.filter((f) => {
    const st = uiStatus(f, conns.find((c) => c.fileId === f.id)).key;
    if (stFilter && stFilter !== "all") return stFilter === "received" ? st !== "not_received" : st === stFilter;
    return filter === "all" || (filter === "loaded" ? st === "success" : !["loaded", "discarded", "nil"].includes(f.status));
  });
  const open = files.find((f) => f.id === openId);
  const uploadFile = uploadFor && files.find((f) => f.id === uploadFor.id);
  const reprocessFile = files.find((f) => f.id === reprocessId);
  const email = emails.find((e) => e.id === emailId);
  const label = (f) => (f ? `${f.bankName} ·${f.accountNumber.slice(-4)}` : "an account outside your AMC");
  const anyFile = (id) => (rawCollections.files || []).find((x) => x.id === id); // emails can point at any AMC's statement
  const connFor = (f) => conns.find((c) => c.fileId === f.id);
  const manualWaiting = files.filter((f) => f.channel === "manual" && ["late", "missing"].includes(f.status));
  const markNil = (f) => run(f, (x) => ({ ...x, status: "nil", nilBy: currentUser, history: [...(x.history || []), stamp(currentUser, "No transactions today", "Bank confirmed there is no statement / no transactions for today")] }), "Mark: no transactions today", "Bank confirmed");
  const counts = {
    files: files.filter((f) => !["loaded", "discarded"].includes(f.status)).length,
    email: emails.filter((e) => e.status === "rejected" && !emailResolved(e)).length,
    conns: conns.filter((c) => ["failing", "degraded"].includes(c.status)).length,
  };

  const run = (f, patch, action, comment, cap = "edit") => {
    const res = act({ screen: "ingestion", cap, kind: "files", id: f.id, patch, audit: { entityLabel: label(f), action, from: STATUS[f.status]?.label, to: STATUS[(typeof patch === "function" ? patch(f) : patch).status]?.label, comment } });
    if (!res.ok) toast.error(res.error); else toast.success(action);
    return res.ok;
  };
  const updConn = (c, patch, action, comment) => act({ screen: "ingestion", cap: "edit", kind: "connections", id: c.id, patch, audit: { entityLabel: `${c.bankName} ·${c.acct} (${CHANNEL_LABEL[c.type] || c.type})`, action, comment } });
  const updEmail = (e, patch, action, comment) => act({ screen: "ingestion", cap: "edit", kind: "emails", id: e.id, patch, audit: { entityLabel: `Email from ${e.from}`, action, comment } });

  // ---- Channel-specific "get the file" actions ----
  const pullNow = (c) => {
    if (c.status === "paused") { toast.error("This connection is paused. Resume it first."); return; }
    if (c.job) { toast(`Already running — started by ${c.job.by} at ${formatDateTime(c.job.at).split(", ")[1]}. Showing its progress instead of starting another.`); return; }
    if (c.userTrigger === false) { updConn(c, { itRequest: { by: currentUser, at: new Date().toISOString() } }, "Request run via IT support", "Direct triggering not permitted for this integration"); toast.success("Request sent to IT support. They run this integration; you'll see the result here."); return; }
    updConn(c, { job: { by: currentUser, at: new Date().toISOString() } }, c.type === "auto" ? "Start bot run" : "Start pull", "Job started");
    setTimeout(() => finishPull(c), 2200);
  };
  const finishPull = (c) => {
    const done = (ok, msg) => updConn(c, { job: null, lastRun: { ok, at: new Date().toISOString(), by: currentUser, msg } }, ok ? "Pull finished" : "Pull failed", msg);
    if (c.authIssue) { done(false, "The bank refused the login — the access token has expired"); toast.error("Pull failed: the bank refused the login (access token expired). It has to be renewed in Bank statement setup."); return; }
    if (c.captcha) { done(false, "The bank's website asked for a human check (CAPTCHA)"); toast.error("The bank's website asked for a human check. We never bypass that — download the statement yourself and upload it."); return; }
    pullDone(c, { job: null, lastRun: { ok: true, at: new Date().toISOString(), by: currentUser, msg: "Statement received" } });
  };
  const pullDone = (c, extra = {}) => {
    const added = c.type === "auto" ? 0 : 40 + (c.acct.charCodeAt(1) % 60);
    updConn(c, { lastPull: new Date().toISOString(), recordsToday: c.recordsToday + added, status: c.status === "degraded" ? "degraded" : "healthy", successRate: [...c.successRate.slice(1), 100], ...extra }, c.type === "auto" ? "Run bot now" : "Pull now", `${added} new records`);
    const f = files.find((x) => x.id === c.fileId);
    if (f && ["late", "missing"].includes(f.status)) {
      run(f, (x) => ({ ...x, status: "loaded", receivedAt: new Date().toISOString(), rows: 900, credits: 720, creditAmount: 720 * 23000, checks: x.checks.map((k) => ({ ...k, ok: true })), attempts: (x.attempts || 0) + 1, history: [...(x.history || []), stamp(currentUser, "Pulled now", `Manual pull via ${CHANNEL_LABEL[c.type]}`), stamp("System", "Loaded", "720 credits loaded for matching")] }), "Statement pulled and loaded", c.endpoint);
    } else toast.success(`${c.type === "auto" ? "Bot run" : "Pull"} succeeded · ${added} new records`);
  };
  const renewToken = (c) => {
    updConn(c, { authIssue: false, status: "healthy", error: null, tokenExpires: new Date(Date.now() + 90 * 86400000).toISOString() }, "Renew API credentials", "New token stored in the vault (maker–checker applies to the setup change)");
    toast.success("Token renewed and stored in the vault. Click Pull now to fetch today's statement.");
  };
  const togglePause = (c) => { const p = c.status !== "paused"; updConn(c, { status: p ? "paused" : (c.error ? "failing" : "healthy"), prevStatus: c.status }, p ? "Pause connection" : "Resume connection"); toast.success(p ? "Paused. No automatic pulls until resumed." : "Resumed."); };

  const getFile = (f) => {
    const c = connFor(f);
    if (f.channel === "manual") return setUploadFor({ id: f.id, corrected: f.status === "check_failed" });
    if (c) return pullNow(c);
    if (f.channel === "email") {
      const waiting = emails.find((e) => e.status === "rejected" && e.suggestFileId === f.id);
      if (waiting) { setTab("email"); setEmailId(waiting.id); toast("An email with this statement was rejected. Assign it to this setup."); return; }
      toast("Mailbox checked just now — no new statement email from this bank yet.");
    }
  };

  // ---- Email intake actions ----
  const assignEmail = (e, fileId) => {
    const f = anyFile(fileId);
    if (!f) return;
    updEmail(e, { status: "matched", fileId, setup: `${label(f)} (assigned by ${currentUser})` }, "Assign email to setup", `${e.attachment.name} → ${label(f)}`);
    run(f, (x) => ({ ...x, status: "loaded", fileName: e.attachment.name, receivedAt: new Date().toISOString(), rows: 1100, credits: 880, creditAmount: 880 * 19500, checks: x.checks.map((k) => ({ ...k, ok: true })), attempts: (x.attempts || 0) + 1, history: [...(x.history || []), stamp(currentUser, "Loaded from email", `Attachment from ${e.from} assigned to this setup`), stamp("System", "Checks passed", "All checks passed"), stamp("System", "Loaded", "880 credits loaded for matching")] }), "Statement loaded from email", e.attachment.name);
    setEmailId(null);
  };
  const retryZip = (e) => {
    if (!e.vaultUpdated) { updEmail(e, { attempts: (e.attempts || 1) + 1 }, "Retry ZIP (failed)", "Vault password unchanged"); toast.error("Still the old password in the vault. The setup maker must update the ZIP password first."); return; }
    updEmail(e, { status: "matched" }, "Retry ZIP", "Opened with updated password"); toast.success("ZIP opened with the new password and the statement was loaded.");
  };

  return (
    <div data-testid="file-inbox">
      <JourneyBar current="files" />
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Inbox size={22} /> Bank files</h1>
          <p>{simple ? "Every bank statement we expect today, how it reaches us, and what to do when it doesn't." : "Today's statements, arriving through each bank's approved setup: manual upload, email, API or portal bot. Check them, fix them, reprocess them."}
            {hasCap(perms, "bank_setup") && <> To change <i>how</i> a bank is connected or read, use <button className="link" onClick={() => nav("/bank-setup")}>Bank statement setup</button>.</>}</p>
        </div>
        {canManual && <div className="actions" style={{ marginRight: 8 }}><button className="btn btn-outline" onClick={() => setManualOpen(true)} data-testid="btn-manual-upload"><UploadCloud size={15} /> Manual upload (exception)</button></div>}
        {canEdit && canManual && manualWaiting.length > 0 && <div className="actions"><button className="btn btn-primary" onClick={() => (manualWaiting.length === 1 ? setUploadFor({ id: manualWaiting[0].id }) : setPickUpload(true))} data-testid="upload-statement-btn"><UploadCloud size={15} /> Upload a statement ({manualWaiting.length} waiting)</button></div>}
      </div>

      <div className="fi-tabs">
        {[["files", "Files today", Inbox, counts.files], ["sftp", "SFTP folders", Server, sftp.reduce((n, fo) => n + fo.accounts.filter((a) => a.state === "error").length, 0)], ["email", "Email intake", Mail, counts.email], ["conns", "API & portal", Plug, counts.conns]].map(([k, l, I, n]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={"fi-tab-" + k}><I size={14} /> {l}{n > 0 && <span className="fi-count">{n}</span>}</button>
        ))}
      </div>

      {tab === "sftp" && <SftpTab folders={sftp} files={files} canEdit={canEdit} onOpenFile={(id) => { setTab("files"); setOpenId(id); }} />}

      {tab === "files" && <>
        <StatusStrip files={files} conns={conns} active={stFilter} onPick={(k) => setStFilter(stFilter === k ? null : k)} />
        <div className="segmented" style={{ marginBottom: 12 }}>
          {[["attention", "Needs attention"], ["all", "All files today"], ["loaded", "Loaded"]].map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)} data-testid={"fi-filter-" + k}>{l}</button>)}
        </div>
        <div className="card">
          <table className="grid" data-testid="file-table">
            <thead><tr><th>Bank · account</th><th>How it arrives</th><th>Expected by</th><th>Received</th><th>Status</th><th>Status remarks</th><th className="r">Credits</th><th>Next step</th></tr></thead>
            <tbody>
              {rows.map((f) => {
                const Icon = CHANNEL_ICON[f.channel] || FileText;
                const c = connFor(f);
                const next = ["late", "missing"].includes(f.status) ? (canManual ? "Upload by hand if needed" : "Waiting — not a failure")
                  : f.status === "check_failed" ? (f.corrected ? "Reprocess" : "Corrected statement from bank") : f.status === "retrying" ? "Reprocess" : f.status === "drift" ? (canSetup ? "Confirm new layout" : "Setup team is confirming") : f.status === "drift_pending" ? "Waiting for checker" : f.status === "duplicate" ? "Discard" : f.status === "unknown" ? "Onboard format" : "—";
                return (
                  <tr key={f.id} onClick={() => setOpenId(f.id)} style={{ cursor: "pointer" }} data-testid={"file-row-" + f.id}>
                    <td><b>{f.bankName}</b> <span className="tnum muted">·{f.accountNumber.slice(-4)}</span></td>
                    <td><span className="chan"><Icon size={13} /> {CHANNEL_LABEL[f.channel]}</span></td>
                    <td className="tnum">{formatDateTime(f.expectedBy).split(", ")[1]}</td>
                    <td className="tnum">{f.receivedAt ? formatDateTime(f.receivedAt).split(", ")[1] : <span className="muted">—</span>}</td>
                    <td>{(() => { const u = uiStatus(f, c); return <span className={"pill " + u.cls} data-testid={"ui-status-" + f.id}><span className="dot" />{u.label}</span>; })()}</td>
                    <td className="remark-cell">{uiStatus(f, c).remark}</td>
                    <td className="tnum r">{f.creditAmount ? inrShort(f.creditAmount) : "—"}</td>
                    <td className={next === "—" ? "muted" : "next-cell"}>{next}{next !== "—" && <ArrowRight size={12} />}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 30 }}>All of today's files are clean.</td></tr>}
            </tbody>
          </table>
        </div>
        <ManualLog entries={rawCollections.manual_uploads || []} />
      </>}

      {tab === "email" && <>
        <div className="mailbox card">
          <Mail size={18} />
          <div><b>recon.ops@camsonline.com</b><span className="muted">Checked every 5 minutes · last check 2 min ago</span></div>
          <div className="mb-stats">
            {["matched", "rejected", "ignored"].map((s) => <button key={s} className={"mb-stat " + s + (emailFilter === s ? " on" : "")} onClick={() => setEmailFilter(s)}><b>{emails.filter((e) => e.status === s).length}</b><span>{EMAIL_STATUS[s][0].split(" (")[0]}</span></button>)}
            <button className={"mb-stat" + (emailFilter === "all" ? " on" : "")} onClick={() => setEmailFilter("all")}><b>{emails.length}</b><span>All today</span></button>
          </div>
        </div>
        <div className="card">
          <table className="grid" data-testid="email-table">
            <thead><tr><th>Received</th><th>From</th><th>Subject</th><th>Attachment</th><th>Result</th></tr></thead>
            <tbody>
              {emails.filter((e) => emailFilter === "all" || e.status === emailFilter).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)).map((e) => (
                <tr key={e.id} onClick={() => setEmailId(e.id)} style={{ cursor: "pointer" }} data-testid={"email-row-" + e.id}>
                  <td className="tnum">{formatDateTime(e.receivedAt).split(", ")[1]}</td>
                  <td>{e.from}</td>
                  <td>{e.subject}</td>
                  <td>{e.attachment.name ? <span className="chan"><Paperclip size={12} /> {e.attachment.name}</span> : <span className="muted">none</span>}</td>
                  <td><span className={"pill " + EMAIL_STATUS[e.status][1]}><span className="dot" />{EMAIL_STATUS[e.status][0]}</span>{e.status === "rejected" && emailResolved(e) && <div className="em-resolved">{emailResolved(e)}</div>}{e.status === "rejected" && <div className="muted em-why">{e.reasonText}</div>}{e.status === "matched" && <div className="muted em-why">→ {e.setup}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}

      {tab === "conns" && (
        <div className="conn-grid">
          {conns.map((c) => {
            const Icon = CHANNEL_ICON[c.type] || Plug;
            const f = files.find((x) => x.id === c.fileId);
            return (
              <div key={c.id} className={"card conn-card st-" + c.status} data-testid={"conn-" + c.id}>
                <div className="cc-head"><span className="cc-ico"><Icon size={16} /></span><div><b>{c.bankName} ·{c.acct}</b><span className="muted">{CHANNEL_LABEL[c.type] || "SFTP"} · every {c.every} min</span></div><span className={"pill " + CONN_STATUS[c.status][1]}><span className="dot" />{CONN_STATUS[c.status][0]}</span></div>
                <code className="cc-end">{c.endpoint}</code>
                <div className="cc-stats">
                  <div><span>Last successful pull</span><b>{timeAgo(c.lastPull)}</b></div>
                  <div><span>Next pull</span><b>{c.status === "paused" ? "paused" : `in ${Math.max(1, Math.round((new Date(c.nextPull) - Date.now()) / 60000))} min`}</b></div>
                  <div><span>Records today</span><b>{num(c.recordsToday)}</b></div>
                  <div><span>Response time</span><b>{c.latencyMs ? (c.latencyMs >= 1000 ? `${(c.latencyMs / 1000).toFixed(1)} s` : `${c.latencyMs} ms`) : "—"}</b></div>
                </div>
                <div className="cc-spark"><span className="muted">Last 7 pulls</span><Spark values={c.successRate} width={120} height={24} bad={c.status !== "healthy"} />{c.tokenExpires && <span className={"muted" + (new Date(c.tokenExpires) < Date.now() ? " neg" : "")}><KeyRound size={11} /> token {new Date(c.tokenExpires) < Date.now() ? "expired" : `expires ${new Date(c.tokenExpires).toLocaleDateString("en-IN")}`}</span>}</div>
                {c.job ? <div className="cc-run" data-testid={"job-" + c.id}><Loader2 size={13} className="spin" /> Running — started by {c.job.by} at {formatDateTime(c.job.at).split(", ")[1]}<i /></div>
                  : c.lastRun ? <div className={"cc-last " + (c.lastRun.ok ? "ok" : "bad")}>{c.lastRun.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} Last run: {c.lastRun.ok ? "Success" : "Failed"} at {formatDateTime(c.lastRun.at).split(", ")[1]} by {c.lastRun.by}{c.lastRun.msg ? ` — ${c.lastRun.msg}` : ""}</div> : null}
                {c.itRequest && <div className="muted cc-file">Run requested from IT support by {c.itRequest.by} at {formatDateTime(c.itRequest.at).split(", ")[1]}</div>}
                {c.error && <div className="note warn cc-err"><div>{plainError(c)}<details><summary>Technical detail</summary>{c.error}</details></div></div>}
                {c.dismissed && <div className="em-resolved">Alert dismissed by {c.dismissed.by}: {c.dismissed.why}. The connection itself is unchanged.</div>}
                {f && <div className="muted cc-file">Today's file: <button className="link" onClick={() => { setTab("files"); setOpenId(f.id); }}>{statusText(f.status)}</button></div>}
                {canEdit && <div className="cc-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => pullNow(c)} disabled={!!c.job} data-testid={"pull-" + c.id}>{c.job ? <><Loader2 size={13} className="spin" /> Running…</> : c.userTrigger === false ? <><Send size={13} /> Ask IT to run it</> : <><RefreshCw size={13} /> {c.type === "auto" ? "Run bot now" : "Pull now"}</>}</button>
                  {["failing", "degraded"].includes(c.status) && !c.dismissed && <button className="btn btn-ghost btn-sm" onClick={() => setDismissing({ kind: "conn", item: c })} data-testid={"dismiss-" + c.id}>Dismiss alert</button>}
                  {c.authIssue && (canSetup ? <button className="btn btn-outline btn-sm" onClick={() => renewToken(c)} data-testid={"renew-" + c.id}><KeyRound size={13} /> Renew token</button> : <span className="muted">Ask the setup maker to renew the token</span>)}
                  {c.captcha && f && <button className="btn btn-outline btn-sm" onClick={() => setUploadFor({ id: f.id, corrected: f.status === "check_failed" })}><UploadCloud size={13} /> Download by hand & upload</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => togglePause(c)}>{c.status === "paused" ? <><PlayCircle size={13} /> Resume</> : <><PauseCircle size={13} /> Pause</>}</button>
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <Drawer id="file-drawer" title={`${label(open)} — ${open.fileName}`} subtitle={`${CHANNEL_LABEL[open.channel]} · expected by ${formatDateTime(open.expectedBy)}`} onClose={() => setOpenId(null)}>
          {!canEdit && !canApprove && <ReadOnlyNote what="Maker" />}
          {(() => { const u = uiStatus(open, connFor(open)); return <div className="kv-line"><span>Status</span><span><span className={"pill " + u.cls}><span className="dot" />{u.label}</span> <span className="muted">{u.remark}</span></span></div>; })()}
          {!simple && <div className="fd-section">
            <h4><Fingerprint size={14} /> Structure fingerprint</h4>
            <div className="kv-line"><span>Fingerprint</span><code>{open.fingerprint || "—"}</code></div>
          </div>}

          <div className="fd-section">
            <h4>{simple ? "Checks" : "Completeness checks"}</h4>
            {open.receivedAt ? open.checks.map((c) => (
              <div key={c.key} className={"check-row " + (c.info ? "info" : c.ok ? "ok" : "bad")}>
                {c.info ? <Clock size={14} /> : c.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <div><div>{c.label}</div>{c.detail && <div className="muted">{c.detail}</div>}</div>
              </div>
            )) : <div className="muted">Not received yet (expected by {formatDateTime(open.expectedBy).split(", ")[1]}). This isn't counted as a failure: the bank may not have published it, or there may have been no transactions. A reminder went out 15 minutes after the expected time.</div>}
          </div>
          {(() => { const setups = (rawCollections.bank_config || []).filter((c) => c.bankName === open.bankName && c.status === "active" && c.formatName); if (setups.length < 2 || !open.receivedAt) return null;
            const hit = open.status === "drift" ? null : setups[open.id.charCodeAt(open.id.length - 1) % setups.length];
            return <div className="kv-line" data-testid="matched-setup"><span>Setup used</span><span>{hit ? <>{hit.formatName} <span className="muted">— {setups.length} setups exist for {open.bankName}; this layout matched</span></> : <span className="neg">None of the {setups.length} setups for {open.bankName} match this layout</span>}</span></div>; })()}
          {open.receivedAt && <BalanceBreak file={open} />}
          {["loaded", "nil"].includes(open.status) && <TxnDupSection file={open} />}

          {open.drift && open.status !== "loaded" && (
            <div className="fd-section">
              <h4><Wand2 size={14} /> {simple ? "The bank changed its file layout" : `Drift detected · ${open.drift.summary}`}</h4>
              <div className="muted" style={{ marginBottom: 8 }}>Compared with the approved fingerprint: column names and order, added / missing columns, header row, and the data type of each column's values. Nothing changes until a checker approves.</div>
              <div className="col-compare">
                <div><div className="muted">Approved structure</div>{open.drift.oldColumns.map((c) => <span key={c} className={"col-pill" + (open.drift.newColumns.includes(c) ? "" : " gone")}>{c}</span>)}</div>
                <div><div className="muted">Today's file</div>{open.drift.newColumns.map((c) => <span key={c} className={"col-pill" + (open.drift.oldColumns.includes(c) ? "" : " new")}>{c}</span>)}</div>
              </div>
              <table className="grid compact" style={{ marginTop: 10 }}>
                <thead><tr><th>Field</th><th>Was</th><th>Proposed</th><th>Confidence</th></tr></thead>
                <tbody>{open.drift.changes.map((c) => (
                  <tr key={c.field}><td className="tnum">{c.field}</td><td>{c.old || <span className="muted">unmapped</span>}</td><td><b>{c.proposed}</b><div className="muted">{c.reason}</div></td><td><Conf value={c.confidence} /></td></tr>
                ))}</tbody>
              </table>
              <div className="note" style={{ marginTop: 10 }}><Clock size={14} /><div>{num(open.drift.rowsHeld)} rows are <b>held, not rejected</b>. They load automatically the moment the mapping change is approved.</div></div>
            </div>
          )}

          <div className="fd-actions">
            {["late", "missing"].includes(open.status) && canEdit && <>
              <div className="note" style={{ width: "100%", marginBottom: 6 }}><div>Not received yet isn't a failure. If you need it now, upload it by hand{open.channel === "auto" ? ", or refetch the full statement with the portal bot" : ""}.</div></div>
              {canManual && <button className="btn btn-primary" onClick={() => setUploadFor({ id: open.id })} data-testid="fd-manual"><UploadCloud size={14} /> Upload it by hand (exception)</button>}
              {open.channel === "auto" && <button className="btn btn-outline" onClick={() => getFile(open)} data-testid="fd-get-file"><RefreshCw size={14} /> Refetch full statement (portal bot)</button>}
              {open.channel === "api" && <button className="btn btn-outline" onClick={() => getFile(open)} data-testid="fd-get-file"><RefreshCw size={14} /> Pull now</button>}
              <button className="btn btn-ghost" onClick={() => toast.success("Chaser email drafted to the bank's relationship manager")}><Send size={14} /> Chase bank RM</button>
              <button className="btn btn-ghost" onClick={() => markNil(open)} data-testid="fd-nil">Bank confirmed: no transactions today</button>
            </>}
            {["drift", "drift_pending"].includes(open.status) && hasCap(perms, "mapping") && <button className="btn btn-outline" onClick={() => { const m = (rawCollections.bank_mapping || []).find((x) => x.type === "bank" && x.bankName === open.bankName && !x.standard); nav(m ? `/mapping/bank/${m.id}?proposal=${open.id}` : "/mapping"); }} data-testid="fd-review-mapping"><ArrowRight size={14} /> Review proposal in Column mapping</button>}
            {open.status === "drift" && (canEdit && canSetup ? <button className="btn btn-primary" data-testid="fd-submit-mapping" onClick={() => run(open, { status: "drift_pending", owner: currentUser }, "Submit mapping change", open.drift.summary)}><Send size={14} /> Submit mapping change for approval</button> : <span className="muted">The setup maker confirms the new layout; a checker approves it.</span>)}
            {open.status === "drift_pending" && canApprove && <button className="btn btn-success" data-testid="fd-approve-mapping" onClick={() => run(open, { status: "loaded", fingerprint: open.fingerprint + "·v2", checks: open.checks.map((c) => ({ ...c, ok: true })) }, "Approve mapping change", `${num(open.drift.rowsHeld)} held rows released`, "approve")}><CheckCircle2 size={14} /> Approve & release {num(open.drift.rowsHeld)} rows</button>}
            {open.status === "drift_pending" && !canApprove && <span className="muted">Waiting for a checker to approve the mapping change.</span>}
            {open.status === "check_failed" && canEdit && !open.corrected && <>
              <button className="btn btn-primary" onClick={() => { run(open, (x) => ({ ...x, history: [...(x.history || []), stamp(currentUser, "Corrected statement requested", "Asked the bank for a corrected statement (balance mismatch)")] }), "Request corrected statement", "Balance mismatch"); }} data-testid="fd-ask-bank"><Send size={14} /> Ask the bank for a corrected statement</button>
              {canManual && <button className="btn btn-outline" onClick={() => setUploadFor({ id: open.id, corrected: true })}><UploadCloud size={14} /> Upload the corrected statement</button>}
            </>}
            {["check_failed", "retrying", "unknown", "loaded"].includes(open.status) && canEdit && <button className={"btn " + (open.status === "retrying" || (open.status === "check_failed" && open.corrected) ? "btn-primary" : "btn-outline")} onClick={() => setReprocessId(open.id)} data-testid="fd-reprocess"><RefreshCw size={14} /> Reprocess (rerun scheduler)</button>}
            {open.status === "duplicate" && canEdit && <button className="btn btn-outline" onClick={() => run(open, (x) => ({ ...x, status: "discarded", history: [...(x.history || []), stamp(currentUser, "Discarded", "Duplicate of an already-loaded file")] }), "Discard duplicate", "Identical content hash")}><Trash2 size={14} /> Discard duplicate</button>}
            {hasCap(perms, "bank_setup") && <button className="btn btn-ghost" onClick={() => nav(`/bank-setup?q=${open.accountNumber.slice(-4)}`)}><ArrowRight size={14} /> Open this bank's setup</button>}
            {open.status === "unknown" && canSetup && <button className="btn btn-primary" onClick={() => nav("/bank-setup/new")}><ArrowRight size={14} /> Start onboarding for this format</button>}
          </div>

          {unresolvedFingerprints([open]).map(({ reason }) => (
            <div key="fp" className="note warn" style={{ marginTop: 12 }} data-testid="fp-logged"><AlertTriangle size={14} /><div><b>Logged to the product report.</b> {reason}. The AI mapping couldn't resolve this on its own, so the product team gets it in their unresolved fingerprint list to act on.</div></div>
          ))}

          <div className="fd-section">
            <h4><History size={14} /> Processing history <span className="muted">· {open.attempts || 0} attempt{open.attempts === 1 ? "" : "s"}</span></h4>
            <ol className="ph-list">
              {withAutoVoid(open.history || []).slice().reverse().map((h, i) => (
                <li key={i} className={(h.bad ? "bad" : "") + (h.voided ? " voided" : "")} data-testid={h.voided ? "ph-voided" : undefined}><i /><div><b>{h.step}</b> <span className="muted">{formatDateTime(h.at).split(", ")[1]} · {h.by}</span><div className="muted">{h.text}</div>
                  {h.voided && <div className="ph-void">Voided automatically — a later run succeeded at {formatDateTime(h.voidedAt).split(", ")[1]}</div>}</div></li>
              ))}
            </ol>
          </div>
        </Drawer>
      )}

      {email && (
        <Drawer id="email-drawer" title={email.subject} subtitle={`From ${email.from} · ${formatDateTime(email.receivedAt)}`} onClose={() => setEmailId(null)}>
          <div className="kv-line"><span>To</span><span>{email.to}</span></div>
          <div className="kv-line"><span>Attachment</span><span>{email.attachment.name ? `${email.attachment.name} · ${email.attachment.size}${email.attachment.passwordProtected ? " · password-protected" : ""}` : "none"}</span></div>
          <div className="kv-line"><span>Result</span><span className={"pill " + EMAIL_STATUS[email.status][1]}><span className="dot" />{EMAIL_STATUS[email.status][0]}</span></div>
          {email.setup && <div className="kv-line"><span>Setup</span><span>{email.setup}</span></div>}
          {emailResolved(email) && <div className="em-resolved" style={{ marginTop: 10 }}>{emailResolved(email)}</div>}
          {email.reasonText && <div className={"note " + (email.status === "rejected" ? "warn" : "")} style={{ marginTop: 12 }}><div><b>{email.status === "rejected" ? "Why it was rejected: " : ""}</b>{email.reasonText}</div></div>}
          <div className="fd-section"><h4>How the mailbox decides</h4>
            <ol className="ph-list small">
              <li className="ok"><i /><div>Sender and subject compared with every email setup's patterns (<code>%like%</code>)</div></li>
              <li className={email.reason === "no_setup" ? "bad" : "ok"}><i /><div>A matching setup was {email.reason === "no_setup" ? "not found" : "found"}</div></li>
              <li className={["no_attachment", "bad_type", "zip_password"].includes(email.reason) ? "bad" : "ok"}><i /><div>Attachment present, allowed type, opens (ZIP password from vault)</div></li>
            </ol>
          </div>
          {canEdit && email.status === "rejected" && (
            <div className="fd-actions">
              {email.reason === "no_setup" && email.suggestFileId && (anyFile(email.suggestFileId)?.status === "loaded"
                ? <div className="note" style={{ width: "100%" }}><div>{label(anyFile(email.suggestFileId))} is already loaded today, so this email isn't needed. Discard it.</div></div>
                : <button className="btn btn-primary" onClick={() => assignEmail(email, email.suggestFileId)} data-testid="email-assign"><CheckCircle2 size={14} /> Use this attachment for {label(anyFile(email.suggestFileId))}</button>)}
              {email.reason === "no_setup" && canSetup && <button className="btn btn-outline" onClick={() => nav("/bank-setup/new")}><ArrowRight size={14} /> Create an email setup for this sender</button>}
              {email.reason === "zip_password" && <>
                <button className="btn btn-primary" onClick={() => retryZip(email)} data-testid="email-retry-zip"><RefreshCw size={14} /> Open the attachment again with the vault password</button>
                {canSetup && !email.vaultUpdated && <button className="btn btn-outline" onClick={() => { updEmail(email, { vaultUpdated: true }, "Update ZIP password in vault", "New password stored; setup change goes through maker–checker"); toast.success("New ZIP password stored in the vault."); }}><KeyRound size={14} /> Update ZIP password</button>}
              </>}
              {["no_attachment", "bad_type"].includes(email.reason) && <button className="btn btn-outline" onClick={() => { updEmail(email, { chased: true }, "Ask bank to resend", `Reply sent to ${email.from}`); toast.success(`Reply drafted to ${email.from} asking for the statement as CSV/XLSX.`); }}><Send size={14} /> Ask the bank to resend</button>}
              {!emailResolved(email) && email.suggestFileId && canManual && <button className="btn btn-outline" onClick={() => { setEmailId(null); setUploadFor({ id: email.suggestFileId }); }} data-testid="email-manual"><UploadCloud size={14} /> Upload the statement by hand instead</button>}
              {!emailResolved(email) && <button className="btn btn-outline" onClick={() => { updEmail(email, { waiting: { by: currentUser, at: new Date().toISOString() } }, "Wait for corrected email", "Bank asked to resend"); toast("OK — it stays out of your focus list until a new email arrives."); }} data-testid="email-wait">Wait for a corrected email</button>}
              {!email.dismissed && <button className="btn btn-ghost" onClick={() => setDismissing({ kind: "email", item: email })} data-testid="email-dismiss">Dismiss alert</button>}
              <button className="btn btn-ghost" onClick={() => { updEmail(email, { status: "discarded" }, "Discard email", email.reasonText); toast("Email discarded (kept in the audit trail)."); setEmailId(null); }}><Trash2 size={14} /> Discard</button>
            </div>
          )}
        </Drawer>
      )}

      {pickUpload && (
        <Modal id="pick-upload" title="Which statement are you uploading?" onClose={() => setPickUpload(false)}>
          {manualWaiting.map((f) => <button key={f.id} className="un-row" onClick={() => { setPickUpload(false); setUploadFor({ id: f.id }); }}><UploadCloud size={14} /><span className="un-title">{label(f)}<small>{STATUS[f.status].label} · expected by {formatDateTime(f.expectedBy).split(", ")[1]}</small></span><ArrowRight size={13} /></button>)}
        </Modal>
      )}
      {manualOpen && canManual && <ManualUploadModal files={files} folders={sftp} onClose={() => setManualOpen(false)} />}
      {dismissing && <DismissModal what={dismissing.kind === "email" ? `email from ${dismissing.item.from}` : `${dismissing.item.bankName} ${CHANNEL_LABEL[dismissing.item.type]}`} onClose={() => setDismissing(null)}
        onSubmit={(why) => { const d = { by: currentUser, at: new Date().toISOString(), why }; if (dismissing.kind === "email") updEmail(dismissing.item, { dismissed: d }, "Dismiss alert", why); else updConn(dismissing.item, { dismissed: d }, "Dismiss alert", why); toast("Alert dismissed and recorded. The underlying work is not marked complete."); setDismissing(null); }} />}
      {uploadFile && <UploadModal file={uploadFile} corrected={uploadFor.corrected} onClose={() => setUploadFor(null)} />}
      {reprocessFile && <ReprocessModal file={reprocessFile} onClose={() => setReprocessId(null)} onUpload={() => { setReprocessId(null); setUploadFor({ id: reprocessFile.id, corrected: true }); }} />}
    </div>
  );
}
