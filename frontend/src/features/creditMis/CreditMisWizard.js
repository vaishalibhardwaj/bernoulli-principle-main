import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Save, RotateCcw, Send, X, Wand2, Check } from "lucide-react";
import { useStore } from "@/state/store";
import { CREDIT_MODES, RECON_TYPES, PAY_MECHANISMS } from "@/lib/constants";
import { PA_OPTIONS, FEED_OPTIONS, paLabel, feedOptionLabel, normPa } from "@/lib/setupSchema";
import { BANKS, accountsFor, accountMeta } from "@/mock/bankMaster";
import { af, mockValue, pick } from "@/lib/autofill";
import { DEMO_FILES } from "@/mock/sampleFiles";
import StepIndicator from "@/components/StepIndicator";
import FileDropZone from "@/components/FileDropZone";
import PreviewTable from "@/components/PreviewTable";
import { ConfirmModal } from "@/components/Modal";
import { Toggle, PasswordInput, Note, VaultNote } from "@/components/bits";
import { detectFor, buildPreview } from "@/mock/sampleFiles";
import { FILE_TYPES, isDelimited, SEPARATORS, REVERSAL_CODES, LIABILITY_CATEGORIES, attachmentTypesFor, CAMS_DOMAIN, defaultSchedule } from "@/lib/setupSchema";
import { PatternTester, ScheduleField, TestConnection, ChangesCard } from "@/features/setup/SetupBits";
import { maskAccount, uid } from "@/lib/format";
import { toast } from "sonner";

const STEPS = [
  { key: "mode", label: "Mode & Feed" }, { key: "agg", label: "Aggregator & Account" },
  { key: "file", label: "File Configuration" }, { key: "modespec", label: "Mode-Specific Details" },
  { key: "proc", label: "Processing Controls" }, { key: "feed", label: "Feed Option" }, { key: "review", label: "Review & Submit" },
];

function defaults() {
  return {
    id: uid("cm"), kind: "credit_config", sno: null, feedMode: "email",
    bankName: "", bankCode: "", accountNumber: "", paCode: "", feedOption: "", payMechanism: "", accountCategory: "Pool",
    schemeCode: "", assetClass: "", fileFormat: "", status: "new", owner: "Priya", rejection: null, lastUpdated: null,
    connection: { url: "", userId: "", _password: "", schedule: defaultSchedule(), fromEmail: "", receiverEmail: "", subject: "", fileNamePattern: "", matchType: "Prefix", zipOption: "none", _zipPassword: "" },
    fileConfig: { fileFormat: "", separator: "", startRow: "", startColumn: "", instrumentStatus: "", failureReasonCode: "", reversalCode: "", sampleFileName: null, detected: {}, edited: {} },
    processing: { dateTimeUpdate: true, reconciliationType: "Subscription", liabilityCategory: "", isActive: true },
  };
}

export default function CreditMisWizard() {
  const { mode, id } = useParams();
  const nav = useNavigate();
  const { get, saveDraft, submit } = useStore();

  const isView = mode === "view";
  const initial = React.useMemo(() => {
    const base = defaults();
    if (id) {
      const rec = get("credit_config", id);
      if (rec) {
        const c = JSON.parse(JSON.stringify(rec));
        c.paCode = c.paCode || normPa((c.paCodes || [])[0]);
        if (mode === "edit" && ["active", "inactive"].includes(rec.status)) c.baseline = JSON.parse(JSON.stringify(rec));
        // Copy setup: everything except the account number.
        if (mode === "copy") Object.assign(c, { id: uid("cm"), status: "new", rejection: null, accountNumber: "", schemeCode: "", assetClass: "", baseline: null, approved: false, sno: null, remarks: [] });
        return { ...base, ...c, connection: { ...base.connection, ...c.connection }, fileConfig: { ...base.fileConfig, ...c.fileConfig }, processing: { ...base.processing, ...c.processing } };
      }
    }
    return base;
  }, [id, get, mode]);

  const [form, setForm] = React.useState(initial);
  const savedRef = React.useRef(initial);
  const [step, setStep] = React.useState(0);
  const [maxReached, setMaxReached] = React.useState(id ? STEPS.length - 1 : 0);
  const [errors, setErrors] = React.useState({});
  const [errorSteps, setErrorSteps] = React.useState({});
  const [analysing, setAnalysing] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(!!initial.fileConfig.sampleFileName);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  const isApi = form.feedMode === "api";
  const label = `${form.bankName || "New"} · ${form.accountNumber ? maskAccount(form.accountNumber) : "—"}`;

  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const setConn = (p) => setForm((f) => ({ ...f, connection: { ...f.connection, ...p } }));
  const setFile = (p) => setForm((f) => ({ ...f, fileConfig: { ...f.fileConfig, ...p } }));
  const setProc = (p) => setForm((f) => ({ ...f, processing: { ...f.processing, ...p } }));
  const markEdited = (k) => setForm((f) => ({ ...f, fileConfig: { ...f.fileConfig, edited: { ...f.fileConfig.edited, [k]: true } } }));

  const statusMap = {};
  STEPS.forEach((s, i) => {
    if (s.key === "modespec" && isApi) statusMap[s.key] = "na";
    else if (errorSteps[i]) statusMap[s.key] = "error";
    else statusMap[s.key] = i === step ? "current" : i < step ? "complete" : "upcoming";
  });

  const gotoStep = (i) => { setStep(i); setMaxReached((m) => Math.max(m, i)); window.scrollTo(0, 0); };
  const next = () => { let n = step + 1; if (STEPS[n]?.key === "modespec" && isApi) n += 1; gotoStep(Math.min(n, STEPS.length - 1)); };
  const back = () => { let p = step - 1; if (STEPS[p]?.key === "modespec" && isApi) p -= 1; gotoStep(Math.max(p, 0)); };

  const onPickFile = (name) => {
    setFile({ sampleFileName: name }); setAnalysing(true); setShowPreview(false);
    setTimeout(() => {
      const d = detectFor(name);
      if (!d) { setAnalysing(false); setShowPreview(false); toast.error("Could not analyse this file — please use one of the demo files"); return; }
      setFile({ fileFormat: d.detect.fileType, separator: d.detect.separator || "", startRow: String(d.detect.startRow), startColumn: String(d.detect.startColumn), detected: { fileFormat: true, separator: !!d.detect.separator, startRow: true, startColumn: true }, edited: {} });
      setAnalysing(false); setShowPreview(true); toast.success("Sample analysed — file settings auto-filled");
    }, 850);
  };



  const validate = () => {
    const e = {}, es = {};
    if (!form.bankName) { e.bankName = "Select bank"; es[1] = true; }
    if (!form.accountNumber) { e.accountNumber = "Select account"; es[1] = true; }
    if (!form.paCode) { e.paCodes = "Select the payment aggregator for this file"; es[1] = true; }
    if (!form.feedOption) { e.feedOption = "Pick the feed option"; es[5] = true; }
    if (!form.fileConfig.fileFormat) { e.fileFormat = "File format required"; es[2] = true; }
    if (!form.fileConfig.startRow) { e.startRow = "Header position required"; es[2] = true; }
    if (isDelimited(form.fileConfig.fileFormat) && !form.fileConfig.separator) { e.separator = "File separator required"; es[2] = true; }
    if (form.feedMode === "email") {
      if (form.connection.receiverEmail && !form.connection.receiverEmail.toLowerCase().endsWith(CAMS_DOMAIN)) { e.receiverEmail = `Receiver must be a CAMS mailbox (${CAMS_DOMAIN})`; es[3] = true; }
      if (form.connection.zipOption === "zippw" && !form.connection._zipPassword && !form.connection.zipPasswordSet) { e.zipPassword = "ZIP password required"; es[3] = true; }
    }
    if (form.processing.reconciliationType === "Liability" && !form.processing.liabilityCategory) { e.liabilityCategory = "Pick the liability category"; es[4] = true; }
    return { e, es };
  };

  const persist = (d) => { const o = { ...d }; if (o.connection._password) o.connection = { ...o.connection, passwordSet: true, _password: "" }; if (o.connection._zipPassword) o.connection = { ...o.connection, zipPasswordSet: true, _zipPassword: "" }; return o; };

  const doSaveDraft = () => { savedRef.current = saveDraft("credit_config", persist(form), label); toast.success("Saved as Draft"); nav("/credit-mis"); };
  const doSubmit = () => {
    const { e, es } = validate();
    if (Object.keys(es).length) { setErrors(e); setErrorSteps(es); gotoStep(Object.keys(es).map(Number).sort((a, b) => a - b)[0]); toast.error("Please fix the highlighted fields"); return; }
    setErrors({}); setErrorSteps({}); submit("credit_config", persist(form), label); toast.success("Submitted for Approval"); nav("/credit-mis");
  };
  const doReset = () => { setForm(JSON.parse(JSON.stringify(savedRef.current))); setErrors({}); setErrorSteps({}); toast("Changes reset"); };

  const accounts = accountsFor(form.bankName);
  const A = (key, value, apply) => af(key, value, apply, { bankName: form.bankName });

  const fillAgg = () => { const b = pick(BANKS); const a = pick(accountsFor(b.name)); set({ bankName: b.name, bankCode: b.code, accountNumber: a.accountNumber, schemeCode: a.schemeCode, assetClass: a.assetClass, paCode: form.paCode || pick(PA_OPTIONS).code, payMechanism: form.payMechanism || pick(PAY_MECHANISMS) }); };
  const fillModeSpec = (fm) => {
    if (fm === "email") setConn({ fromEmail: mockValue("fromEmail"), receiverEmail: mockValue("receiverEmail"), subject: mockValue("subject") + "%", fileNamePattern: mockValue("fileNamePattern"), zipOption: "zippw", _zipPassword: mockValue("password") });
    else if (fm === "auto") setConn({ url: "https://dashboard.razorpay.com/app/settlements/export", userId: mockValue("userId"), _password: mockValue("password") });
    else if (fm === "manual") setConn({ fileNamePattern: mockValue("fileNamePattern") + ".csv" });
  };
  const fillFile = () => { if (!form.fileConfig.sampleFileName) onPickFile(pick(Object.keys(DEMO_FILES).filter((f) => !DEMO_FILES[f].standard))); setFile({ instrumentStatus: "D", failureReasonCode: "R01" }); };
  const fillStep = () => {
    const k = STEPS[step].key;
    if (k === "mode") set({ feedMode: pick(Object.keys(CREDIT_MODES)) });
    else if (k === "agg") fillAgg();
    else if (k === "file") fillFile();
    else if (k === "modespec") fillModeSpec(form.feedMode);
    else if (k === "feed") set({ feedOption: pick(FEED_OPTIONS).code });
    else if (k === "proc") { const t = pick(RECON_TYPES); setProc({ reconciliationType: t, liabilityCategory: t === "Liability" ? pick(LIABILITY_CATEGORIES) : "" }); }
    else { if (!form.feedOption) set({ feedOption: "CREDIT_FEED" }); if (!form.bankName) fillAgg(); fillFile(); fillModeSpec(form.feedMode); }
    toast.success(k === "review" ? "All steps filled with sample data" : "Step filled with sample data");
  };

  return (
    <div data-testid="credit-mis-wizard">
      <div className="page-head"><div>
        <button className="link" onClick={() => nav("/credit-mis")}><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Back to list</button>
        <h1 style={{ marginTop: 6 }}>{isView ? "View" : mode === "edit" ? "Edit" : mode === "copy" ? "Copy" : "New"} Credit MIS Configuration</h1>
      </div></div>

      <div className="card wizard">
        <StepIndicator steps={STEPS} current={step} status={statusMap} onJump={gotoStep} maxReachable={Math.max(maxReached, step)} />
        <div style={{ padding: "0 24px 8px" }}><span className="af-hint" data-testid="autofill-hint"><Wand2 /> Prototype tip: click any empty field to auto-fill it with sample data</span></div>
        <fieldset className="wiz-body" disabled={isView} style={{ border: 0, margin: 0, minWidth: 0 }}>
          {STEPS[step].key === "mode" && (<>
            <div className="step-title">Mode &amp; Feed</div><p className="step-desc">How are Credit MIS files delivered?</p>
            <div className="mode-cards">{Object.entries(CREDIT_MODES).map(([k, m]) => (
              <button key={k} className={"mode-card" + (form.feedMode === k ? " on" : "")} data-testid={"feed-" + k} onClick={() => set({ feedMode: k })}>
                <div className="mc-ico"><m.icon size={20} /></div><div><h4>{m.label}</h4><p>{m.desc}</p><div className="req">{m.req}</div></div>
              </button>))}</div>
          </>)}

          {STEPS[step].key === "agg" && (<>
            <div className="step-title">Aggregator &amp; Account</div><p className="step-desc">Link payment aggregators and the collection account.</p>
            <div className="form-grid">
              <div className="field full">
                <label className="field-label">Payment aggregator (one per file){errors.paCodes && <span className="field-error"> — {errors.paCodes}</span>}</label>
                <select className={"select" + (errors.paCodes ? " invalid" : "")} value={form.paCode} onChange={(e) => set({ paCode: e.target.value })} data-testid="field-pa">
                  <option value="">Select aggregator…</option>
                  {PA_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label} — {o.code}</option>)}
                </select>
                <span className="muted" style={{ fontSize: 12 }}>Sub-types (e.g. Razorpay Online vs Razorpay CMS) are separate codes because their files differ. Codes shown are placeholders until the exact identifiers from the Credit MIS document are loaded — matching depends on them.</span>
              </div>
              <div className="field"><label className="field-label">Payment Mechanism</label>
                <select className="select" value={form.payMechanism} data-testid="field-pay-mech" onFocus={() => { if (!form.payMechanism) set({ payMechanism: pick(PAY_MECHANISMS) }); }} onChange={(e) => set({ payMechanism: e.target.value })}><option value="">Select…</option>{PAY_MECHANISMS.map((m) => <option key={m}>{m}</option>)}</select></div>
              <div className="field"><label className="field-label">Account Category</label>
                <select className="select" value={form.accountCategory} data-testid="field-acc-cat" onChange={(e) => set({ accountCategory: e.target.value })}><option>Pool</option><option>Scheme</option></select></div>
              <div className="field"><label className="field-label">Bank Name</label>
                <select className={"select" + (errors.bankName ? " invalid" : "")} value={form.bankName} data-testid="field-credit-bank" onFocus={() => { if (!form.bankName) fillAgg(); }} onChange={(e) => { const b = BANKS.find((x) => x.name === e.target.value); set({ bankName: e.target.value, bankCode: b?.code || "", accountNumber: "", schemeCode: "", assetClass: "" }); }}><option value="">Select bank…</option>{BANKS.map((b) => <option key={b.code} value={b.name}>{b.name}</option>)}</select></div>
              <div className="field"><label className="field-label">Account Number</label>
                <select className={"select tnum" + (errors.accountNumber ? " invalid" : "")} value={form.accountNumber} disabled={!form.bankName} data-testid="field-credit-account" onFocus={() => { if (!form.accountNumber && accounts.length) { const a = pick(accounts); set({ accountNumber: a.accountNumber, schemeCode: a.schemeCode, assetClass: a.assetClass }); } }} onChange={(e) => { const a = accountMeta(form.bankName, e.target.value); set({ accountNumber: e.target.value, schemeCode: a?.schemeCode || "", assetClass: a?.assetClass || "" }); }}><option value="">{form.bankName ? "Select account…" : "Select bank first"}</option>{accounts.map((a) => <option key={a.accountNumber} value={a.accountNumber}>{maskAccount(a.accountNumber)} — {a.schemeName}</option>)}</select></div>
              <div className="field"><label className="field-label">Scheme Code</label><input className="input tnum" readOnly value={form.schemeCode} placeholder={form.accountCategory === "Pool" ? "Optional for Pool" : "Auto-filled"} /></div>
              <div className="field"><label className="field-label">Asset Class</label><input className="input" readOnly value={form.assetClass} placeholder="Auto-filled" /></div>
            </div>
          </>)}

          {STEPS[step].key === "file" && (<>
            <div className="step-title">File Configuration</div><p className="step-desc">Upload a sample Credit MIS to auto-detect layout.</p>
            <FileDropZone fileName={form.fileConfig.sampleFileName} onPick={onPickFile} onClear={() => { setFile({ sampleFileName: null, detected: {}, edited: {} }); setShowPreview(false); }} />
            {detectFor(form.fileConfig.sampleFileName)?.mismatch && showPreview && <div style={{ marginTop: 14 }}><Note kind="warn">File extension says <b>XLS</b> but content looks like <b>HTML/CSV</b> — settings pre-filled from content.</Note></div>}
            {analysing && <div className="analysing"><div className="spinner" /><div><b>Analysing file…</b></div></div>}
            {showPreview && !analysing && (<>
              <div className="form-grid" style={{ marginTop: 18 }}>
                <div className="field"><label className="field-label">File Format</label>
                  <select className="select" value={form.fileConfig.fileFormat} data-testid="field-credit-format" onChange={(e) => { setFile({ fileFormat: e.target.value }); markEdited("fileFormat"); }}>{FILE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                {isDelimited(form.fileConfig.fileFormat) && <div className="field"><label className="field-label">File Separator</label><select className={"select" + (errors.separator ? " invalid" : "")} value={form.fileConfig.separator} onChange={(e) => { setFile({ separator: e.target.value }); markEdited("separator"); }}><option value="">Select…</option>{SEPARATORS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select></div>}
                <div className="field"><label className="field-label">Header Position (row, column)</label>
                  <div style={{ display: "flex", gap: 8 }}><input className="input tnum" style={{ width: 80 }} value={form.fileConfig.startRow} data-testid="field-credit-row" onChange={(e) => { setFile({ startRow: e.target.value }); markEdited("startRow"); }} /><input className="input tnum" style={{ width: 80 }} value={form.fileConfig.startColumn} onChange={(e) => { setFile({ startColumn: e.target.value }); markEdited("startRow"); }} /></div></div>
                <div className="field"><label className="field-label">Instrument Status <span className="muted">(optional)</span></label>
                  <select className="select" value={form.fileConfig.instrumentStatus} data-testid="field-instrument-status" onChange={(e) => setFile({ instrumentStatus: e.target.value, failureReasonCode: e.target.value === "C" ? "" : form.fileConfig.failureReasonCode })}>
                    <option value="">Not selected — use the file's status column</option><option value="C">Credit only</option><option value="D">Debit only</option>
                  </select>
                  <span className="muted" style={{ fontSize: 12 }} data-testid="instrument-hint">{form.fileConfig.instrumentStatus === "C" ? "Credit-only file: every row is a successful payment. The status column is not needed in mapping." : form.fileConfig.instrumentStatus === "D" ? "Debit-only file: every row is a failed / reversed payment. The status column is not needed in mapping." : "Not selected: the file's own status column is used, so it becomes mandatory in Column mapping."}</span></div>
                <div className="field"><label className="field-label">Reversal code (default)</label>
                  <select className="select" value={form.fileConfig.reversalCode} disabled={form.fileConfig.instrumentStatus === "C"} data-testid="field-reversal-code" onChange={(e) => setFile({ reversalCode: e.target.value })}>
                    <option value="">{form.fileConfig.instrumentStatus === "C" ? "Not needed for credit-only" : "Select reversal code…"}</option>
                    {REVERSAL_CODES.filter((r) => r.active).map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
                  </select></div>
                <div className="field full reversal-order"><b>Which reversal reason is used?</b> 1. The reversal code / reason mapped from the file. 2. Only if that is blank: the default you pick here.</div>
                <div className="field"><label className="field-label">Failure Reason Code (default reason)</label>
                  <select className="select" value={form.fileConfig.failureReasonCode} disabled={form.fileConfig.instrumentStatus === "C"} data-testid="field-failure-code" onChange={(e) => setFile({ failureReasonCode: e.target.value })}>
                    <option value="">{form.fileConfig.instrumentStatus === "C" ? "Not needed for C (Credit)" : "Select reversal code…"}</option>
                    {REVERSAL_CODES.filter((r) => r.active).map((r) => <option key={r.code} value={r.code}>{r.code} — {r.remark}</option>)}
                  </select>
                  <span className="muted" style={{ fontSize: 12 }}>From the Reversal Remarks table. A code in the file always wins.</span></div>
              </div>
              <PreviewTable {...buildPreview(form.fileConfig.sampleFileName)} maxRows={40} caption="Whole sample — the highlighted row is the header" startColumn={parseInt(form.fileConfig.startColumn, 10) || 1} headerIdx={(parseInt(form.fileConfig.startRow, 10) || buildPreview(form.fileConfig.sampleFileName).headerIdx + 1) - 1} onPickRow={isView ? undefined : (i) => { setFile({ startRow: String(i + 1) }); markEdited("startRow"); }} />
            </>)}
          </>)}

          {STEPS[step].key === "modespec" && (<>
            <div className="step-title">Mode-Specific Details — {CREDIT_MODES[form.feedMode].label}</div><p className="step-desc">Delivery details for the selected feed mode.</p>
            {form.feedMode === "email" && (<>
              <div className="form-grid">
                <div className="field"><label className="field-label">From Email ID</label><input className="input" value={form.connection.fromEmail} onChange={(e) => setConn({ fromEmail: e.target.value })} data-testid="field-from-email" {...A("fromEmail", form.connection.fromEmail, (v) => setConn({ fromEmail: v }))} /></div>
                <div className="field"><label className="field-label">Receiver Email ID <span className="muted">(CAMS mailbox)</span></label><input className={"input" + (errors.receiverEmail ? " invalid" : "")} value={form.connection.receiverEmail} data-testid="field-receiver-email" onChange={(e) => setConn({ receiverEmail: e.target.value })} {...A("receiverEmail", form.connection.receiverEmail, (v) => setConn({ receiverEmail: v }))} />{errors.receiverEmail && <span className="field-error">{errors.receiverEmail}</span>}</div>
                <div className="field full"><label className="field-label">Email Subject <span className="muted">— % for the part that changes daily</span></label><input className="input" value={form.connection.subject} data-testid="field-email-subject" onChange={(e) => setConn({ subject: e.target.value })} {...A("subject", form.connection.subject, (v) => setConn({ subject: v + "%" }))} />
                  <PatternTester pattern={form.connection.subject} kind="like" names={[`${(form.connection.subject || "Daily Collection MIS").replace(/%/g, "")} 20-10-2026`, `${(form.connection.subject || "Daily Collection MIS").replace(/%/g, "")} 21-10-2026`, "RE: Settlement query"]} label="Recent subjects" /></div>
                <div className="field"><label className="field-label">File Name Pattern</label><input className="input" value={form.connection.fileNamePattern} data-testid="field-file-pattern" onChange={(e) => setConn({ fileNamePattern: e.target.value })} placeholder="CreditMIS_" {...A("fileNamePattern", form.connection.fileNamePattern, (v) => setConn({ fileNamePattern: v }))} /></div>
                <div className="field"><label className="field-label">Match Type</label><select className="select" value={form.connection.matchType} onChange={(e) => setConn({ matchType: e.target.value })}>{["Prefix", "Suffix", "Contains", "Exact"].map((t) => <option key={t}>{t}</option>)}</select></div>
                <div className="field full"><PatternTester pattern={form.connection.fileNamePattern} kind={form.connection.matchType} names={misNames(form)} label="Attachments seen" /></div>
                <div className="field"><label className="field-label">File Format ZIP</label><select className="select" value={form.connection.zipOption} data-testid="field-zip" onChange={(e) => setConn({ zipOption: e.target.value })}><option value="none">No ZIP</option><option value="zip">ZIP without password</option><option value="zippw">ZIP with password</option></select></div>
                {form.connection.zipOption === "zippw" && <div className="field"><label className="field-label">ZIP Password</label><PasswordInput value={form.connection._zipPassword} onChange={(v) => setConn({ _zipPassword: v })} id="field-zip-password" onFocus={() => { if (!form.connection._zipPassword) setConn({ _zipPassword: mockValue("password") }); }} />{errors.zipPassword && <span className="field-error">{errors.zipPassword}</span>}</div>}
                <div className="field full"><label className="field-label">Accepted attachment types</label><div className="chip-row">{attachmentTypesFor(form.fileConfig.fileFormat, form.connection.zipOption).map((t) => <span key={t} className="chip chip-previous tnum">{t}</span>)}</div></div>
              </div>
              <div className="email-rules"><b>What happens to each email</b><div><Check size={13} /> From, receiver, subject and file name match → file is validated and loaded.</div><div><X size={13} /> Anything else → <b>rejected and logged</b> with the reason, for review and reprocess.</div></div>
              <div style={{ marginTop: 12 }}><VaultNote /></div>
            </>)}
            {form.feedMode === "auto" && (<><div className="form-grid">
              <div className="field"><label className="field-label">URL</label><input className="input" value={form.connection.url} onChange={(e) => setConn({ url: e.target.value })} data-testid="field-credit-url" {...af("url", form.connection.url, (v) => setConn({ url: "https://dashboard.razorpay.com/app/settlements/export" }), {})} /></div>
              <div className="field"><label className="field-label">User ID</label><input className="input" value={form.connection.userId} data-testid="field-credit-userid" onChange={(e) => setConn({ userId: e.target.value })} {...A("userId", form.connection.userId, (v) => setConn({ userId: v }))} /></div>
              <div className="field full"><label className="field-label">Password</label><PasswordInput value={form.connection._password} onChange={(v) => setConn({ _password: v })} id="field-credit-password" onFocus={() => { if (!form.connection._password) setConn({ _password: mockValue("password") }); }} /></div>
              <ScheduleField value={form.connection.schedule} onChange={(v) => setConn({ schedule: v })} />
            </div><div style={{ marginTop: 12 }}><VaultNote /></div>
            <TestConnection conn={{ url: form.connection.url, loginId: form.connection.userId }} mode="auto" /></>)}
            {form.feedMode === "manual" && <div className="form-grid">
              <div className="field"><label className="field-label">File Name Pattern</label><input className="input" value={form.connection.fileNamePattern} data-testid="field-manual-pattern" onChange={(e) => setConn({ fileNamePattern: e.target.value })} placeholder="CreditMIS_" {...A("fileNamePattern", form.connection.fileNamePattern, (v) => setConn({ fileNamePattern: v }))} /></div>
              <div className="field"><label className="field-label">Match Type</label><select className="select" value={form.connection.matchType} onChange={(e) => setConn({ matchType: e.target.value })}>{["Prefix", "Suffix", "Contains", "Exact"].map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="field full"><PatternTester pattern={form.connection.fileNamePattern} kind={form.connection.matchType} names={misNames(form)} label="Files uploaded recently" /></div>
            </div>}
          </>)}

          {STEPS[step].key === "proc" && (<>
            <div className="step-title">Processing Controls</div><p className="step-desc">Reconciliation behaviour for this feed.</p>
            <div className="toggle-list">
              <div className="toggle-row"><div className="tr-txt"><b>Date &amp; Time Update</b><span>Update credit date &amp; time from the MIS file.</span></div><div className="sw-wrap"><Toggle checked={form.processing.dateTimeUpdate} onChange={(v) => setProc({ dateTimeUpdate: v })} id="toggle-datetime" /></div></div>
              <div className="toggle-row"><div className="tr-txt"><b>Is Active</b><span>Feed becomes Active on approval.</span></div><div className="sw-wrap"><Toggle checked={form.processing.isActive} onChange={(v) => setProc({ isActive: v })} id="toggle-credit-active" /></div></div>
              <div className="toggle-row"><div className="tr-txt"><b>Reconciliation Type</b><span>Subscription collection, or liability payments.</span></div><div className="sw-wrap segmented" data-testid="credit-recon-type">{RECON_TYPES.map((t) => <button key={t} className={form.processing.reconciliationType === t ? "on" : ""} onClick={() => setProc({ reconciliationType: t, liabilityCategory: t === "Liability" ? form.processing.liabilityCategory : "" })}>{t}</button>)}</div></div>
              {form.processing.reconciliationType === "Liability" && <div className="toggle-sub"><label className="field-label">Liability category</label><select className={"select" + (errors.liabilityCategory ? " invalid" : "")} style={{ maxWidth: 240 }} value={form.processing.liabilityCategory} onChange={(e) => setProc({ liabilityCategory: e.target.value })} data-testid="field-liability-cat"><option value="">Select…</option>{LIABILITY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>{errors.liabilityCategory && <span className="field-error">{errors.liabilityCategory}</span>}</div>}
            </div>
          </>)}

          {STEPS[step].key === "feed" && (<>
            <div className="step-title">Feed Option</div><p className="step-desc">What gets inserted for this account once the file is read.</p>
            <div className="feed-list" data-testid="feed-options">
              {FEED_OPTIONS.map((o) => (
                <label key={o.code} className={"feed-opt" + (form.feedOption === o.code ? " on" : "")}>
                  <input type="radio" name="feed" checked={form.feedOption === o.code} onChange={() => set({ feedOption: o.code })} data-testid={"feed-" + o.code} />
                  <div><b>{o.label.split(" — ")[0]}</b><span>{o.label.split(" — ")[1]}</span>{o.code === "NO_FEED" && <span className="muted">For banking-channel online credits that come with no MIS: each credit in the bank statement for this account is copied as its feed row. To be confirmed against how today's screen does it.</span>}</div>
                </label>
              ))}
            </div>
            {errors.feedOption && <span className="field-error">{errors.feedOption}</span>}
            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Options come from the Feed Option master (placeholder values until the master is loaded).</div>
          </>)}

          {STEPS[step].key === "review" && (<div data-testid="credit-review">
            <div className="step-title">Review &amp; Submit</div><p className="step-desc">Verify all details before submitting.</p>
            <ChangesCard base={form.baseline} cur={form} />
            <div className="review-grid">
              <div className="rev-card"><div className="rc-head"><h4>Mode &amp; Feed</h4><button className="link" onClick={() => gotoStep(0)}>Edit</button></div><div className="rc-body"><div className="rev-row"><span className="k">Feed Mode</span><span className="v">{CREDIT_MODES[form.feedMode].label}</span></div></div></div>
              <div className="rev-card"><div className="rc-head"><h4>Aggregator &amp; Account</h4><button className="link" onClick={() => gotoStep(1)}>Edit</button></div><div className="rc-body"><div className="rev-row"><span className="k">Bank</span><span className="v">{form.bankName || "—"}</span></div><div className="rev-row"><span className="k">Account</span><span className="v tnum">{form.accountNumber ? maskAccount(form.accountNumber) : "—"}</span></div><div className="rev-row"><span className="k">Payment aggregator</span><span className="v">{form.paCode ? paLabel(form.paCode) : "—"}</span></div><div className="rev-row"><span className="k">Feed option</span><span className="v">{feedOptionLabel(form.feedOption)}</span></div><div className="rev-row"><span className="k">Category</span><span className="v">{form.accountCategory}</span></div></div></div>
              <div className="rev-card"><div className="rc-head"><h4>File Configuration</h4><button className="link" onClick={() => gotoStep(2)}>Edit</button></div><div className="rc-body"><div className="rev-row"><span className="k">Sample File</span><span className="v">{form.fileConfig.sampleFileName || "—"}</span></div><div className="rev-row"><span className="k">Format</span><span className="v">{form.fileConfig.fileFormat || "—"}</span></div><div className="rev-row"><span className="k">Header</span><span className="v tnum">{form.fileConfig.startRow},{form.fileConfig.startColumn}</span></div><div className="rev-row"><span className="k">Instrument Status</span><span className="v">{form.fileConfig.instrumentStatus || "Not selected"}</span></div><div className="rev-row"><span className="k">Reversal code</span><span className="v">{form.fileConfig.reversalCode || "—"} (file first)</span></div><div className="rev-row"><span className="k">Failure Reason</span><span className="v">{form.fileConfig.failureReasonCode || "—"}</span></div></div></div>
              <div className="rev-card"><div className="rc-head"><h4>Processing Controls</h4><button className="link" onClick={() => gotoStep(4)}>Edit</button></div><div className="rc-body"><div className="rev-row"><span className="k">Recon Type</span><span className="v">{form.processing.reconciliationType}{form.processing.liabilityCategory ? " · " + form.processing.liabilityCategory : ""}</span></div><div className="rev-row"><span className="k">Is Active</span><span className="v">{form.processing.isActive ? "Yes" : "No"}</span></div></div></div>
            </div>
          </div>)}
        </fieldset>

        <div className="wiz-foot">
          <button className="btn btn-outline" onClick={back} disabled={step === 0} data-testid="credit-btn-back"><ArrowLeft size={15} /> Back</button>
          {STEPS[step].key !== "review" ? <button className="btn btn-primary" onClick={next} data-testid="credit-btn-next">Next <ArrowRight size={15} /></button> : !isView && <button className="btn btn-success" onClick={doSubmit} data-testid="credit-btn-submit"><Send size={15} /> Submit for Approval</button>}
          {isView && <span className="muted" style={{ marginLeft: 8 }}>View only{(form.remarks || []).length ? ` · ${form.remarks.length} authoriser remark(s)` : ""}</span>}
          <div className="spacer" />
          {!isView && <><button className="btn btn-fill" onClick={fillStep} data-testid="credit-btn-fill-step"><Wand2 size={15} /> {STEPS[step].key === "review" ? "Fill all steps" : "Fill this step"}</button>
          <button className="btn btn-outline" onClick={doSaveDraft} data-testid="credit-btn-draft"><Save size={15} /> Save as Draft</button>
          <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset</button>
          <button className="btn btn-ghost" onClick={() => setConfirmCancel(true)} data-testid="credit-btn-cancel"><X size={15} /> Cancel</button></>}
        </div>
      </div>

      {confirmReset && <ConfirmModal id="credit-reset-modal" title="Reset configuration?" danger confirmLabel="Reset" message="Are you sure you want to reset? All unsaved changes will be discarded." onConfirm={doReset} onClose={() => setConfirmReset(false)} />}
      {confirmCancel && <ConfirmModal id="credit-cancel-modal" title="Discard changes?" danger confirmLabel="Discard & leave" message="You have unsaved changes. Leaving now will discard them. Continue?" onConfirm={() => nav("/credit-mis")} onClose={() => setConfirmCancel(false)} />}
    </div>
  );
}

const misNames = (form) => { const pa = (form.paCode || "RZP_ONLINE").toUpperCase(); const ext = (form.fileConfig.fileFormat || "CSV").toLowerCase(); return [`CreditMIS_${pa}_20261021.${ext}`, `SETTLE_${pa}_20261021_MIS.${ext}`, `PA_CREDIT_${pa}_20261021.${ext}`, `${pa}_refunds_20261021.${ext}`]; };
