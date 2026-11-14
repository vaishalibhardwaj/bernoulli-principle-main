import React from "react";
import { FileSpreadsheet, FileText, Landmark, CreditCard, Users, X, CheckCircle2, AlertCircle, Server, Info } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { Art } from "@/components/Art";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { userAmcs, inScope } from "@/lib/org";
import { maskAccount } from "@/lib/format";
import { uid, timeAgo } from "@/lib/format";

const TYPES = [
  { key: "bank", label: "Bank statement", icon: Landmark, hint: "Account statement downloaded from the bank" },
  { key: "credit", label: "Credit MIS", icon: CreditCard, hint: "Collection MIS from a payment aggregator" },
  { key: "remitter", label: "Remitter", icon: Users, hint: "Who sent the money — remitter details file" },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.key, t.label]));
const OK_EXT = ["csv", "xlsx", "xls", "txt"];
const MAX_MB = 50;
const BUCKET = "gs://cams-odin-inbound";

const extOf = (n) => (n.split(".").pop() || "").toLowerCase();
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Phase 1 file upload: the user picks what the file is, drops it, and it lands in the same GCS bucket SFTP feeds.
 * File names must be unique across every file type, whichever way the file arrived.
 */
export default function FileUpload() {
  const { collections, perms, act, personaUser, amcUser } = useStore();
  const canUpload = hasCap(perms, "file_upload", "edit");
  const amc = userAmcs(amcUser)[0];
  // Opened from Today with a target: ?type=bank|credit|remitter, &bank=, &account=, and &view=status to land on today's list.
  const [sp] = useSearchParams();
  const want = ["bank", "credit", "remitter"].includes(sp.get("type")) ? sp.get("type") : null;
  const [type, setType] = React.useState(want);
  // Which statement this is: bank and account (bank statement), bank (remitter), and the business date for every type.
  const today = new Date().toISOString().slice(0, 10);
  const [meta, setMeta] = React.useState({ bank: sp.get("bank") || "", account: sp.get("account") || "", date: today });
  // A new target in the address (for example from a second Today item) refills the form.
  React.useEffect(() => { if (want) { setType(want); setMeta((m) => ({ ...m, bank: sp.get("bank") || "", account: sp.get("account") || "" })); } }, [want, sp]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (sp.get("view") === "status") setTimeout(() => document.querySelector('[data-testid="fu-status"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 120); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const accts = (collections.balances || []).filter((r) => inScope(amcUser, r.amc));
  const banks = [...new Set(accts.map((r) => r.bankName))].sort();
  const bankAccts = accts.filter((r) => r.bankName === meta.bank);
  const needBank = type === "bank" || type === "remitter";
  const needAcct = type === "bank";
  const metaMissing = !type ? null : !meta.date ? "Pick the business date." : meta.date > today ? "The business date can't be in the future." : needBank && !meta.bank ? "Pick the bank." : needAcct && !meta.account ? "Pick the account number." : null;
  const [queue, setQueue] = React.useState([]);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef(null);

  // Every name already received, by any route (SFTP, API, earlier uploads, statements on record)
  const taken = React.useMemo(() => {
    const m = new Map();
    const add = (name, info) => name && !m.has(name.toLowerCase()) && m.set(name.toLowerCase(), info);
    (collections.file_track || []).forEach((f) => add(f.name, `${TYPE_LABEL[f.fileType || "bank"] || "File"} · ${f.source === "ui" ? "uploaded on screen" : f.source === "api" ? "via API" : "via SFTP"}`));
    (collections.file_uploads || []).forEach((f) => add(f.name, `${TYPE_LABEL[f.fileType]} · uploaded by ${f.uploadedBy}`));
    (collections.files || []).forEach((f) => add(f.fileName, "Bank statement · on record"));
    return m;
  }, [collections.file_track, collections.file_uploads, collections.files]);

  const check = (name, size, others) => {
    if (!OK_EXT.includes(extOf(name))) return `Only ${OK_EXT.map((e) => "." + e).join(", ")} files can be uploaded.`;
    if (size > MAX_MB * 1048576) return `Larger than ${MAX_MB} MB.`;
    const hit = taken.get(name.toLowerCase());
    if (hit) return `A file with this name was already received (${hit}). File names must be unique across all file types — rename it and add it again.`;
    if (others.some((o) => o.name.toLowerCase() === name.toLowerCase())) return "Same name as another file in this batch.";
    return null;
  };

  const addFiles = (list) => {
    if (!type) { toast.error("Pick what you are uploading first."); return; }
    setQueue((q) => {
      const next = [...q];
      Array.from(list).forEach((f) => { next.push({ id: uid("upq"), name: f.name, size: f.size, fileType: type, error: check(f.name, f.size, next) }); });
      return next;
    });
  };
  const remove = (id) => setQueue((q) => q.filter((x) => x.id !== id).map((x, i, arr) => ({ ...x, error: check(x.name, x.size, arr.slice(0, i)) })));
  const good = queue.filter((x) => !x.error);

  const upload = () => {
    if (metaMissing) { toast.error(metaMissing); return; }
    const at = new Date().toISOString();
    const day = at.slice(0, 10);
    let done = 0;
    good.forEach((f) => {
      const gcsPath = `${BUCKET}/${slug(amc)}/${f.fileType}/${day}/${f.name}`;
      const details = { bankName: needBank ? meta.bank : null, accountNumber: needAcct ? meta.account : null, businessDate: meta.date };
      const rec = { id: uid("upl"), name: f.name, size: f.size, fileType: f.fileType, amc, uploadedBy: personaUser.name, uploadedAt: at, gcsPath, ...details };
      const res = act({ screen: "file_upload", cap: "edit", kind: "file_uploads", patch: rec, audit: { entityLabel: f.name, action: "Upload file", to: gcsPath } });
      if (!res.ok) { toast.error(res.error); return; }
      act({ screen: "file_upload", cap: "edit", kind: "file_track", patch: { id: uid("ft"), name: f.name, folder: `Uploaded on screen by ${personaUser.name}`, placedAt: at, picked: null, processed: null, outcome: "pending", note: "In GCS — waiting for the next pickup (every 5 min)", amc, source: "ui", fileType: f.fileType, uploadedBy: personaUser.name, gcsPath, ...details } });
      done += 1;
    });
    if (done) {
      toast.success(`${done} file${done > 1 ? "s" : ""} uploaded to GCS for ${amc}. Picked up within 5 minutes. Its processing status shows below.`);
      setQueue((q) => q.filter((x) => x.error));
    }
  };

  const recent = (collections.file_track || []).filter((f) => f.source === "ui" && f.amc === amc)
    .map((f) => ({ ...f, when: f.placedAt || new Date(Date.now() - (f.placed || 0) * 60000).toISOString() }))
    .sort((a, b) => b.when.localeCompare(a.when)).slice(0, 12);
  // Two separate statuses: the upload (did the file reach us) and the processing (were its rows read and loaded).
  const processingOf = (f) => (f.outcome === "failed" ? ["Failed", "bad"] : f.processed != null ? ["Loaded", "ok"] : f.picked != null ? ["Being read", "info"] : ["Waiting for pickup", "warn"]);

  return (
    <div className="fu" data-testid="file-upload">
      <div className="page-head">
        <div>
          <h1>File upload</h1>
          <p>Upload a bank statement, Credit MIS or remitter file for <b>{amc}</b>. It lands in the same GCS bucket as SFTP and is picked up within 5 minutes.</p>
        </div>
      </div>

      <div className="fu-callout" data-testid="fu-sftp-note">
        <Server size={16} />
        <div><b>SFTP still works.</b> Files placed in SFTP and files uploaded here land in the same GCS bucket and go through the same pickup. File names must be unique across all file types, whichever way they arrive.</div>
      </div>

      {!canUpload && <div className="fu-callout warn"><Info size={16} /><div>You can see uploads but not add files. Uploading needs the Recon Ops role.</div></div>}

      <div className="card fu-card">
        <div className="fu-step"><span>1</span>What are you uploading?</div>
        <div className="fu-types" role="radiogroup">
          {TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} type="button" role="radio" aria-checked={type === t.key} className={"fu-type" + (type === t.key ? " on" : "")} onClick={() => setType(t.key)} disabled={!canUpload} data-testid={"fu-type-" + t.key}>
                <Icon size={18} /><b>{t.label}</b><span>{t.hint}</span>
              </button>
            );
          })}
        </div>

        {type && <>
          <div className="fu-step"><span>2</span>Which {type === "credit" ? "day is it for" : "statement is it"}?</div>
          <div className="fu-details" data-testid="fu-details">
            {needBank && <label>Bank<select className="select" value={meta.bank} onChange={(e) => setMeta({ ...meta, bank: e.target.value, account: "" })} data-testid="fu-bank"><option value="">Pick a bank</option>{banks.map((b) => <option key={b}>{b}</option>)}</select></label>}
            {needAcct && <label>Account number<select className="select" value={meta.account} onChange={(e) => setMeta({ ...meta, account: e.target.value })} disabled={!meta.bank} data-testid="fu-account"><option value="">{meta.bank ? "Pick an account" : "Pick a bank first"}</option>{bankAccts.map((r) => <option key={r.id} value={r.accountNumber}>{maskAccount(r.accountNumber)} · {r.schemeName}</option>)}</select></label>}
            <label>Business date<input type="date" className="input" value={meta.date} max={today} onChange={(e) => setMeta({ ...meta, date: e.target.value })} data-testid="fu-date" /></label>
            <p className="hint">Before a file is processed, the system checks its format and mandatory columns, and that it matches the bank, account and date picked here.</p>
          </div>
        </>}

        <div className="fu-step"><span>{type ? 3 : 2}</span>Drop the file{queue.length ? "s" : ""}</div>
        <div className={"fu-drop" + (drag ? " drag" : "") + (!type || !canUpload ? " off" : "")} data-testid="fu-drop"
          onDragOver={(e) => { e.preventDefault(); if (type) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (canUpload) addFiles(e.dataTransfer.files); }}
          onClick={() => { if (type && canUpload) inputRef.current?.click(); }}>
          <Art name="upload" size={56} />
          <h4>{type ? `Drag & drop ${TYPE_LABEL[type]} files here, or click to browse` : "Pick a file type above first"}</h4>
          <p>CSV, XLSX, XLS or TXT · up to {MAX_MB} MB each · several files at once is fine</p>
          <input ref={inputRef} type="file" multiple hidden accept={OK_EXT.map((e) => "." + e).join(",")} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} data-testid="fu-input" />
        </div>

        {queue.length > 0 && (
          <div className="fu-queue" data-testid="fu-queue">
            {queue.map((f) => (
              <div key={f.id} className={"fu-row" + (f.error ? " bad" : "")} data-testid={"fu-row-" + f.name}>
                {/\.xlsx?$/i.test(f.name) ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
                <div className="fu-row-main">
                  <b className="tnum">{f.name}</b>
                  <span>{TYPE_LABEL[f.fileType]} · {fmtSize(f.size)} · {f.error ? <em className="neg">{f.error}</em> : <>to <code>{BUCKET}/{slug(amc)}/{f.fileType}/…</code></>}</span>
                </div>
                {f.error ? <AlertCircle size={16} className="neg" /> : <CheckCircle2 size={16} className="pos" />}
                <button type="button" className="row-icon-btn" onClick={() => remove(f.id)} aria-label={"Remove " + f.name}><X size={15} /></button>
              </div>
            ))}
            <div className="fu-actions">
              <span className="muted">{good.length} ready{queue.length - good.length ? ` · ${queue.length - good.length} need a fix (they won't be uploaded)` : ""}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQueue([])}>Clear</button>
              {metaMissing && <span className="neg" style={{ fontSize: 13 }}>{metaMissing}</span>}
              <button type="button" className="btn btn-primary" disabled={!good.length || !!metaMissing} onClick={upload} data-testid="fu-upload">Upload {good.length || ""} to GCS</button>
            </div>
          </div>
        )}
      </div>

      <div className="card fu-card" data-testid="fu-status">
        <div className="dz-card-h">Uploaded on screen today — {amc}</div>
        {recent.length === 0 ? <div className="empty" style={{ border: 0 }}><Art name="folder" size={64} /><h3>Nothing uploaded on screen today</h3><p>Files you upload here appear in this list with their upload and processing status.</p></div> : (
          <table className="grid" data-testid="fu-recent">
            <thead><tr><th>File</th><th>Type</th><th>Bank · account</th><th>Business date</th><th>Uploaded by</th><th>When</th><th>Upload status</th><th>Processing status</th></tr></thead>
            <tbody>
              {recent.map((f) => {
                const [label, tone] = processingOf(f);
                return (
                  <tr key={f.id}>
                    <td className="tnum"><b>{f.name}</b>{f.gcsPath && <div className="muted" style={{ fontSize: 11 }}>{f.gcsPath}</div>}</td>
                    <td>{TYPE_LABEL[f.fileType || "bank"]}</td>
                    <td>{f.bankName ? <>{f.bankName}{f.accountNumber ? <span className="tnum"> · {maskAccount(f.accountNumber)}</span> : ""}</> : <span className="muted">—</span>}</td>
                    <td className="tnum">{f.businessDate ? new Date(f.businessDate + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : <span className="muted">—</span>}</td>
                    <td>{f.uploadedBy || "—"}</td>
                    <td>{timeAgo(f.when)}</td>
                    <td><span className="fu-state ok">Uploaded</span></td>
                    <td><span className={"fu-state " + tone}>{label}</span>{f.outcome === "failed" && f.note && <div className="muted" style={{ fontSize: 12 }}>{f.note}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
