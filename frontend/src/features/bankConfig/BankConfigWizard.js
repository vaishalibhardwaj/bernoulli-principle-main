import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Save, RotateCcw, Send, AlertTriangle, ShieldCheck, Pencil, Wand2, FileText, Check, Loader2, MoreHorizontal, Sparkles, Mail, X } from "lucide-react";
import { useStore } from "@/state/store";
import { BANK_MODES, RECON_TYPES } from "@/lib/constants";
import { BANKS, accountsFor, accountMeta } from "@/mock/bankMaster";
import { af, mockValue, pick } from "@/lib/autofill";
import StepIndicator from "@/components/StepIndicator";
import FileDropZone from "@/components/FileDropZone";
import PreviewTable from "@/components/PreviewTable";
import { ConfirmModal, Modal } from "@/components/Modal";
import { Toggle, PasswordInput, Note, VaultNote } from "@/components/bits";
import { detectFor, buildPreview, detectAccountInSample } from "@/mock/sampleFiles";
import { LIABILITY_CATEGORIES } from "@/lib/setupSchema";
import { FILE_TYPES, STANDARD_FORMATS, isStandard, isDelimited, SEPARATORS, sepLabel, attachmentTypesFor, CAMS_DOMAIN, exampleFileNames, exampleSubjects, extFor, defaultSchedule, scheduleText } from "@/lib/setupSchema";
import { PatternTester, ScheduleField, TestConnection, ChangesCard } from "@/features/setup/SetupBits";
import { maskAccount, formatDate, uid } from "@/lib/format";
import { toast } from "sonner";

const STEPS = [
  { key: "mode", label: "Download Mode" },
  { key: "bank", label: "Bank Information" },
  { key: "conn", label: "Connection Details" },
  { key: "file", label: "File Configuration" },
  { key: "proc", label: "Processing Options" },
  { key: "review", label: "Review & Submit" },
];

function defaults() {
  return {
    id: uid("bc"), kind: "bank_config", sno: null, downloadMode: "auto",
    bankName: "", bankCode: "", accountNumber: "", schemeOrCollection: "Scheme",
    schemeCode: "", schemeName: "", assetClass: "", status: "new", owner: "Priya",
    rejection: null, lastUpdated: null,
    maskedPattern: "", priority: "low", formatName: "",
    connection: { url: "", path: "", corporateId: "", loginId: "", passwordSet: false, _newPassword: "", _confirmPassword: "", schedule: defaultSchedule(), tested: null, subjectPattern: "", sender: "", receiver: "", attachmentPattern: "", zipOption: "none", _zipPassword: "" },
    fileConfig: { fileType: "", separator: "", startRow: "", startColumn: "", uploadPath: "", uploadUser: "", uploadPasswordSet: false, _uploadPassword: "", fileNamePattern: "", sampleFileName: null, detected: {}, edited: {} },
    processing: { isActive: true, bulkUpload: false, computeRunningBalance: false, validateRunningBalance: true, runningBalanceCleanup: false, cleanupChars: "", directMatch: false, reconciliationType: "Subscription", liabilityCategory: "", descendingOrder: false },
  };
}

export default function BankConfigWizard() {
  const { mode, id } = useParams();
  const nav = useNavigate();
  const { get, saveDraft, submit, collections, perms } = useStore();
  const highCount = (collections.bank_config || []).filter((c) => c.priority === "high" && c.status === "active").length;
  const isView = mode === "view";

  const initial = React.useMemo(() => {
    const base = defaults();
    if (id) {
      const rec = get("bank_config", id);
      if (rec) {
        const clone = JSON.parse(JSON.stringify(rec));
        // R7 — editing a live setup: keep the live version so the review shows what changes.
        if (mode === "edit" && ["active", "inactive"].includes(rec.status)) clone.baseline = JSON.parse(JSON.stringify(rec));
        if (mode === "copy") { clone.id = uid("bc"); clone.status = "new"; clone.rejection = null; clone.accountNumber = ""; clone.schemeCode = ""; clone.assetClass = ""; clone.schemeName = ""; clone.maskedPattern = ""; clone.baseline = null; clone.approved = false; clone.sno = null; clone.remarks = []; }
        return { ...base, ...clone, connection: { ...base.connection, ...clone.connection }, fileConfig: { ...base.fileConfig, ...clone.fileConfig }, processing: { ...base.processing, ...clone.processing } };
      }
    }
    return base;
  }, [id, mode, get]);

  const [form, setForm] = React.useState(initial);
  const savedRef = React.useRef(initial);
  const [step, setStep] = React.useState(0);
  const [maxReached, setMaxReached] = React.useState(id ? STEPS.length - 1 : 0);
  const [errors, setErrors] = React.useState({});
  const [errorSteps, setErrorSteps] = React.useState({});
  const [analysing, setAnalysing] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(!!initial.fileConfig.sampleFileName);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [submitShow, setSubmitShow] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [replacingCred, setReplacingCred] = React.useState(!id);

  const isManual = form.downloadMode === "manual";
  const label = `${form.bankName || "New Bank"} · ${form.accountNumber ? maskAccount(form.accountNumber) : "—"}`;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setConn = (patch) => setForm((f) => ({ ...f, connection: { ...f.connection, ...patch } }));
  const setFile = (patch) => setForm((f) => ({ ...f, fileConfig: { ...f.fileConfig, ...patch } }));
  const setProc = (patch) => setForm((f) => ({ ...f, processing: { ...f.processing, ...patch } }));

  const markEdited = (key) => setForm((f) => ({ ...f, fileConfig: { ...f.fileConfig, edited: { ...f.fileConfig.edited, [key]: true } } }));

  // step status map for indicator
  const statusMap = {};
  STEPS.forEach((s, i) => {
    if (s.key === "conn" && isManual) statusMap[s.key] = "na";
    else if (errorSteps[i]) statusMap[s.key] = "error";
    else if (i === step) statusMap[s.key] = "current";
    else if (i < step) statusMap[s.key] = "complete";
    else statusMap[s.key] = "upcoming";
  });

  const gotoStep = (i) => { setStep(i); setMaxReached((m) => Math.max(m, i)); window.scrollTo(0, 0); };
  const next = () => {
    let n = step + 1;
    if (STEPS[n]?.key === "conn" && isManual) n += 1;
    gotoStep(Math.min(n, STEPS.length - 1));
  };
  const back = () => {
    let p = step - 1;
    if (STEPS[p]?.key === "conn" && isManual) p -= 1;
    gotoStep(Math.max(p, 0));
  };

  // file analysis simulation
  const onPickFile = (name) => {
    setFile({ sampleFileName: name });
    setAnalysing(true); setShowPreview(false);
    setTimeout(() => {
      const d = detectFor(name);
      if (!d) { setAnalysing(false); setShowPreview(false); toast.error("Could not analyse this file — please use one of the demo files"); return; }
      setFile({
        fileType: d.detect.fileType, separator: d.detect.separator || "",
        startRow: d.standard ? "" : String(d.detect.startRow), startColumn: d.standard ? "" : String(d.detect.startColumn),
        detected: d.standard ? { fileType: true } : { fileType: true, separator: !!d.detect.separator, startRow: true, startColumn: true }, edited: {},
      });
      setAnalysing(false); setShowPreview(true);
      toast.success(d.standard ? `Recognised as ${d.detect.fileType} — the pre-built parser reads it, no column mapping needed` : "Sample analysed — file type, separator, start row and column filled in");
    }, 850);
  };

  const validate = () => {
    const e = {}; const es = {};
    if (!form.bankName) { e.bankName = "Select a bank"; es[1] = true; }
    if (!form.processing.bulkUpload && !form.accountNumber) { e.accountNumber = "Select an account"; es[1] = true; }
    const c = form.connection, fc = form.fileConfig, p = form.processing;
    if (form.maskedPattern && !/^[X*]+\d{2,}$/i.test(form.maskedPattern.trim())) { e.maskedPattern = "Masked pattern must look like XXXXXX1234 (X or * then the visible digits)"; es[1] = true; }
    if (!isManual) {
      if (form.downloadMode === "email") {
        if (!c.sender) { e.sender = "Sender required"; es[2] = true; }
        if (!c.receiver) { e.receiver = "Receiver required"; es[2] = true; }
        else if (!c.receiver.toLowerCase().endsWith(CAMS_DOMAIN)) { e.receiver = `Receiver must be a CAMS mailbox (${CAMS_DOMAIN})`; es[2] = true; }
        if (!c.subjectPattern) { e.subjectPattern = "Subject pattern required"; es[2] = true; }
        if (c.zipOption === "zippw" && !c._zipPassword && !c.zipPasswordSet) { e.zipPassword = "ZIP password required"; es[2] = true; }
      } else {
        if (!c.url) { e.url = "URL required"; es[2] = true; }
        if (!c.corporateId) { e.corporateId = "Corporate ID required"; es[2] = true; }
        if (!c.loginId) { e.loginId = "Login ID required"; es[2] = true; }
        if (!c.passwordSet && !c._newPassword) { e.password = "Password required"; es[2] = true; }
        else if (c._newPassword && c._newPassword !== c._confirmPassword) { e.password = "The Password and Re-enter Password fields do not match. Please enter matching values and try again."; es[2] = true; }
      }
    }
    if (!fc.fileType) { e.fileType = "File type required"; es[3] = true; }
    if (!isStandard(fc.fileType)) {
      if (isDelimited(fc.fileType) && !fc.separator) { e.separator = "File separator required for delimited files"; es[3] = true; }
      if (!(Number(fc.startRow) >= 1 && Number.isInteger(Number(fc.startRow)))) { e.startRow = "Start row must be a whole number ≥ 1"; es[3] = true; }
      if (!(Number(fc.startColumn) >= 1 && Number.isInteger(Number(fc.startColumn)))) { e.startColumn = "Start column must be a whole number ≥ 1"; es[3] = true; }
    }
    // SFTP path / user / password are parked: SFTP is one per AMC and will move to a central table.
    if (fc.fileNamePattern && testRegex(fc.fileNamePattern) === false) { e.fileNamePattern = "File name pattern is not a valid pattern"; es[3] = true; }
    if (p.reconciliationType === "Liability" && !p.liabilityCategory) { e.liabilityCategory = "Pick the liability type"; es[4] = true; }
    if (p.runningBalanceCleanup && !p.cleanupChars.trim()) { e.cleanupChars = "Enter the character(s) to remove, or switch cleanup off"; es[4] = true; }
    return { e, es };
  };

  const persist = (data) => {
    const toStore = { ...data };
    if (toStore.connection._newPassword) { toStore.connection = { ...toStore.connection, passwordSet: true, _newPassword: "", credentialUpdatedAt: new Date().toISOString(), credentialUpdatedBy: "Priya" }; }
    if (toStore.connection._zipPassword) toStore.connection = { ...toStore.connection, zipPasswordSet: true };
    if (toStore.fileConfig._uploadPassword) toStore.fileConfig = { ...toStore.fileConfig, uploadPasswordSet: true, _uploadPassword: "" };
    toStore.connection = { ...toStore.connection, _confirmPassword: "", _zipPassword: "" };
    delete toStore.connection._newPassword;
    return toStore;
  };

  const doSaveDraft = () => {
    const saved = saveDraft("bank_config", persist(form), label);
    savedRef.current = saved;
    toast.success("Saved as Draft");
    nav("/bank-setup?status=draft");
  };

  const doSubmitConfirmed = () => {
    submit("bank_config", persist(form), label);
    toast.success("Submitted for Approval");
    nav("/bank-setup?status=pending");
  };

  const doReset = () => {
    setForm(JSON.parse(JSON.stringify(savedRef.current)));
    setErrors({}); setErrorSteps({});
    toast("Changes reset to last saved state");
  };

  const accounts = accountsFor(form.bankName);
  const ctx = { bankName: form.bankName };
  const A = (key, value, apply) => af(key, value, apply, ctx);

  const fillBank = () => { const b = pick(BANKS); const a = pick(accountsFor(b.name)); set({ bankName: b.name, bankCode: b.code, accountNumber: a.accountNumber, schemeCode: a.schemeCode, assetClass: a.assetClass, schemeName: a.schemeName }); return b.name; };
  const fillConn = (bn, dm) => { const c = { bankName: bn }; const pw = mockValue("password"); setConn(dm === "email"
    ? { subjectPattern: mockValue("subjectPattern", c), sender: mockValue("sender", c), receiver: mockValue("receiver", c) }
    : { url: mockValue("url", c), path: mockValue("path", c), corporateId: mockValue("corporateId"), loginId: mockValue("loginId"), _newPassword: pw, _confirmPassword: pw }); setReplacingCred(true); };
  const fillFile = (bn) => { if (!form.fileConfig.sampleFileName) onPickFile("idbi_statement_oct.csv"); const b = BANKS.find((x) => x.name === bn); setFile({ uploadPath: mockValue("uploadPath", { bankName: bn }), uploadUser: mockValue("uploadUser"), _uploadPassword: mockValue("uploadPassword"), fileNamePattern: `${b?.code || "BANK"}_${(form.accountNumber || "0000").slice(-4)}_\\d{8}\\.csv` }); };
  const fillStep = () => {
    const k = STEPS[step].key;
    if (k === "mode") set({ downloadMode: pick(Object.keys(BANK_MODES)) });
    else if (k === "bank") fillBank();
    else if (k === "conn") fillConn(form.bankName, form.downloadMode);
    else if (k === "file") fillFile(form.bankName);
    else if (k === "proc") setProc({ reconciliationType: pick(RECON_TYPES), runningBalanceCleanup: true, cleanupChars: "Cr" });
    else { const dm = form.downloadMode === "manual" ? "auto" : form.downloadMode; const bn = form.bankName || fillBank(); set({ downloadMode: dm }); if (dm !== "manual") fillConn(bn, dm); fillFile(bn); }
    toast.success(k === "review" ? "All steps filled with sample data" : "Step filled with sample data");
  };

  const reviewVal = STEPS[step].key === "review" ? validate() : { e: {}, es: {} };
  const hasIssues = Object.keys(reviewVal.es).length > 0;

  return (
    <div data-testid="bank-config-wizard">
      <div className="page-head">
        <div>
          <button className="link" onClick={() => nav("/bank-setup")} data-testid="wizard-back-list"><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Back to list</button>
          <h1 style={{ marginTop: 6 }}>{isView ? "View" : mode === "copy" ? "Copy" : mode === "edit" ? "Edit" : "New"} Bank Statement Configuration</h1>
        </div>
      </div>

      <div className="card wizard">
        {form.rejection && (
          <div className="reject-banner" data-testid="rejection-banner">
            <AlertTriangle className="rb-ico" size={20} />
            <div>
              <h4>Rejected by {form.rejection.by}</h4>
              <div className="meta">on {formatDate(form.rejection.date)}</div>
              <p>{form.rejection.comment}</p>
            </div>
          </div>
        )}

        <StepIndicator steps={STEPS.map((s) => ({ ...s }))} current={step} status={statusMap}
          onJump={isView ? null : gotoStep} maxReachable={Math.max(maxReached, step)} />

        <div className="wiz-body">
          {/* STEP 1 */}
          {STEPS[step].key === "mode" && (
            <>
              <div className="step-title">Choose Download Mode</div>
              <p className="step-desc">How should statements for this account be collected?</p>
              <div className="mode-cards">
                {Object.entries(BANK_MODES).map(([k, m]) => (
                  <button key={k} className={"mode-card" + (form.downloadMode === k ? " on" : "")} disabled={isView}
                    data-testid={"mode-" + k} onClick={() => set({ downloadMode: k })}>
                    <div className="mc-ico"><m.icon size={20} /></div>
                    <div><h4>{m.label}</h4><p>{m.desc}</p><div className="req">{m.req}</div></div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* STEP 2 */}
          {STEPS[step].key === "bank" && (
            <>
              <div className="step-title">Bank Information</div>
              <p className="step-desc">Select the bank and collection account from the Bank Master.</p>
              <div className="form-grid">
                <div className="field">
                  <label className="field-label">Bank Name</label>
                  <select className={"select" + (errors.bankName ? " invalid" : "")} value={form.bankName} disabled={isView} data-testid="field-bank-name"
                    onFocus={() => { if (!form.bankName) fillBank(); }}
                    onChange={(e) => { const b = BANKS.find((x) => x.name === e.target.value); set({ bankName: e.target.value, bankCode: b?.code || "", accountNumber: "", schemeCode: "", assetClass: "", schemeName: "" }); }}>
                    <option value="">Search &amp; select bank…</option>
                    {BANKS.map((b) => <option key={b.code} value={b.name}>{b.name}</option>)}
                  </select>
                  {errors.bankName && <span className="field-error">{errors.bankName}</span>}
                </div>
                <div className="field">
                  <label className="field-label">Account Number {form.processing.bulkUpload && <span style={{ color: "hsl(var(--muted))" }}>(optional)</span>}</label>
                  <select className={"select tnum" + (errors.accountNumber ? " invalid" : "")} value={form.accountNumber} disabled={isView || !form.bankName} data-testid="field-account"
                    onFocus={() => { if (!form.accountNumber && accounts.length) { const a = pick(accounts); set({ accountNumber: a.accountNumber, schemeCode: a.schemeCode, assetClass: a.assetClass, schemeName: a.schemeName }); } }}
                    onChange={(e) => { const a = accountMeta(form.bankName, e.target.value); set({ accountNumber: e.target.value, schemeCode: a?.schemeCode || "", assetClass: a?.assetClass || "", schemeName: a?.schemeName || "" }); }}>
                    <option value="">{form.processing.bulkUpload ? "Derived from file" : form.bankName ? "Select account…" : "Select a bank first"}</option>
                    {accounts.map((a) => <option key={a.accountNumber} value={a.accountNumber}>{maskAccount(a.accountNumber)} — {a.schemeName}</option>)}
                  </select>
                  {errors.accountNumber && <span className="field-error">{errors.accountNumber}</span>}
                </div>
                <div className="field full">
                  <label className="field-label">Account Type</label>
                  <div style={{ display: "flex", gap: 18 }}>
                    {["Scheme", "Collection"].map((t) => (
                      <label key={t} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13 }}>
                        <input type="radio" disabled={isView} checked={form.schemeOrCollection === t} onChange={() => set({ schemeOrCollection: t })} data-testid={"radio-" + t.toLowerCase()} /> {t}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field"><label className="field-label">Scheme Code</label><input className="input tnum" readOnly value={form.schemeCode} placeholder="Auto-filled" data-testid="field-scheme-code" /></div>
                <div className="field"><label className="field-label">Asset Class</label><input className="input" readOnly value={form.assetClass} placeholder="Auto-filled" data-testid="field-asset-class" /></div>
                <div className="field full">
                  <label className="field-label">Masked Account Number <span className="muted">(optional)</span></label>
                  <input className={"input tnum" + (errors.maskedPattern ? " invalid" : "")} value={form.maskedPattern} disabled={isView} placeholder="Type it exactly as the bank prints it, e.g. XXXXXX4512" data-testid="field-masked"
                    onChange={(e) => set({ maskedPattern: e.target.value.toUpperCase() })} />
                  <MaskedCheck pattern={form.maskedPattern} account={form.accountNumber} />
                  {errors.maskedPattern && <span className="field-error">{errors.maskedPattern}</span>}
                </div>
              </div>
              {form.processing.bulkUpload && <div style={{ marginTop: 16 }}><Note kind="info">Bulk Upload is ON — Account Number is optional and will be <b>derived from file</b>.</Note></div>}
            </>
          )}

          {/* STEP 3 */}
          {STEPS[step].key === "conn" && (
            <>
              <div className="step-title">Connection Details</div>
              <p className="step-desc">{BANK_MODES[form.downloadMode].label} — {form.downloadMode === "email" ? "which emails to pick up and what to do with the rest." : "how to reach the bank, and when to pull."}</p>
              {form.downloadMode === "email" ? (
                <EmailRules form={form} setConn={setConn} errors={errors} isView={isView} A={A} />
              ) : (
                <>
                  <div className="form-grid">
                    <div className="field"><label className="field-label">URL</label><input className={"input" + (errors.url ? " invalid" : "")} value={form.connection.url} disabled={isView} onChange={(e) => setConn({ url: e.target.value })} placeholder="https://portal.bank.com/…" data-testid="field-url" {...A("url", form.connection.url, (v) => setConn({ url: v }))} />{errors.url && <span className="field-error">{errors.url}</span>}</div>
                    <div className="field"><label className="field-label">File Download Path</label><input className="input" value={form.connection.path} disabled={isView} onChange={(e) => setConn({ path: e.target.value })} data-testid="field-path" {...A("path", form.connection.path, (v) => setConn({ path: v }))} /></div>
                    <div className="field"><label className="field-label">Corporate ID</label><input className={"input tnum" + (errors.corporateId ? " invalid" : "")} value={form.connection.corporateId} disabled={isView} onChange={(e) => setConn({ corporateId: e.target.value })} data-testid="field-corp-id" {...A("corporateId", form.connection.corporateId, (v) => setConn({ corporateId: v }))} />{errors.corporateId && <span className="field-error">{errors.corporateId}</span>}</div>
                    <div className="field"><label className="field-label">Login ID</label><input className={"input" + (errors.loginId ? " invalid" : "")} value={form.connection.loginId} disabled={isView} onChange={(e) => setConn({ loginId: e.target.value })} data-testid="field-login" {...A("loginId", form.connection.loginId, (v) => setConn({ loginId: v }))} />{errors.loginId && <span className="field-error">{errors.loginId}</span>}</div>
                    {form.connection.passwordSet && !replacingCred ? (
                      <div className="field full">
                        <Note kind="vault" icon={ShieldCheck}>
                          Password set ✓ — last updated {formatDate(form.connection.credentialUpdatedAt || Date.now())} by {form.connection.credentialUpdatedBy || "Priya"}.
                          {!isView && <> <button className="link" style={{ marginLeft: 8 }} onClick={() => setReplacingCred(true)} data-testid="btn-replace-cred">Replace</button></>}
                        </Note>
                      </div>
                    ) : (
                      <>
                        <div className="field"><label className="field-label">Password</label><PasswordInput value={form.connection._newPassword} onChange={(v) => setConn({ _newPassword: v })} id="field-password" onFocus={() => { if (!form.connection._newPassword) { const pw = mockValue("password"); setConn({ _newPassword: pw, _confirmPassword: pw }); } }} /></div>
                        <div className="field"><label className="field-label">Re-enter Password</label><PasswordInput value={form.connection._confirmPassword} onChange={(v) => setConn({ _confirmPassword: v })} id="field-password-confirm" />
                          {form.connection._confirmPassword && form.connection._confirmPassword === form.connection._newPassword && <span className="field-ok"><Check size={12} /> Passwords match</span>}</div>
                        {errors.password && <span className="field-error full">{errors.password}</span>}
                        <div className="field full"><VaultNote /></div>
                      </>
                    )}
                    {!isView && <ScheduleField value={form.connection.schedule} onChange={(v) => setConn({ schedule: v })} />}
                    {isView && <div className="field full"><label className="field-label">Pull schedule</label><span>{scheduleText(form.connection.schedule)}</span></div>}
                  </div>
                  {!isView && <TestConnection conn={form.connection} mode={form.downloadMode} onResult={(r) => setConn({ tested: { ok: r.ok, at: new Date().toISOString() } })} />}
                </>
              )}
            </>
          )}

          {/* STEP 4 */}
          {STEPS[step].key === "file" && (
            <FileStep form={form} setFile={setFile} markEdited={markEdited} errors={errors} isView={isView} A={A}
              onFormatName={(v) => set({ formatName: v })} sameBank={(collections.bank_config || []).filter((c) => c.bankName === form.bankName && c.id !== form.id && c.accountNumber === form.accountNumber).length}
              onUseDetected={(d) => { const a = accountMeta(d.bankName, d.accountNumber); set({ bankName: d.bankName, bankCode: d.bankCode, accountNumber: d.accountNumber, schemeCode: a?.schemeCode || "", assetClass: a?.assetClass || "", schemeName: a?.schemeName || "" }); toast.success(`Bank and account filled from the sample: ${d.bankName} ·${d.accountNumber.slice(-4)}`); }}
              analysing={analysing} showPreview={showPreview} onPickFile={onPickFile} onClear={() => { setFile({ sampleFileName: null, detected: {}, edited: {} }); setShowPreview(false); }} />
          )}

          {/* STEP 5 */}
          {STEPS[step].key === "proc" && (
            <>
              <div className="step-title">Processing Options</div>
              <p className="step-desc">Control how the statement is processed during reconciliation.</p>
              <div className="toggle-list">
                {[
                  ["isActive", "Is Active", "Configuration becomes Active on approval (otherwise Inactive)."],
                  ["bulkUpload", "Bulk Upload", "Allow multiple accounts in one file; account derived from file."],
                  ["computeRunningBalance", "Compute Running Balance", "Only for banks whose file has NO closing balance (e.g. Standard Chartered): the system works it out from our data. Shown as \"computed, not bank-verified\"."],
                  ["runningBalanceCleanup", "Running Balance Cleanup", "Remove set characters (prefix or suffix) from the closing balance before processing."],
                  ["directMatch", "Direct Match", "Turn on only for the ~10–15 UPI collection accounts. The direct-match scheduler then runs on these accounts alone instead of all ~200, which keeps it fast."],
                  ["descendingOrder", "Descending Order", "File is newest-first; process and validate balances bottom-to-top."],
                ].map(([k, t, h]) => (
                  <React.Fragment key={k}>
                    <div className="toggle-row">
                      <div className="tr-txt"><b>{t}</b><span>{h}</span></div>
                      <div className="sw-wrap"><Toggle checked={form.processing[k]} disabled={isView} onChange={(v) => setProc({ [k]: v })} id={"toggle-" + k} /></div>
                    </div>
                    {k === "runningBalanceCleanup" && form.processing.runningBalanceCleanup && (
                      <div className="toggle-sub" data-testid="cleanup-chars">
                        <label className="field-label">Character(s) to remove from the start or end of the balance</label>
                        <input className={"input tnum" + (errors.cleanupChars ? " invalid" : "")} style={{ maxWidth: 220 }} value={form.processing.cleanupChars} disabled={isView} placeholder="e.g. C, Cr, Dr" onChange={(e) => setProc({ cleanupChars: e.target.value })} data-testid="field-cleanup-chars" />
                        <span className="muted">{form.processing.cleanupChars ? <>Example: <span className="tnum">{form.processing.cleanupChars.split(",")[0].trim()}12345</span> is read as <span className="tnum">12345</span></> : "Example: C12345 with “C” is read as 12345"}</span>
                        {errors.cleanupChars && <span className="field-error">{errors.cleanupChars}</span>}
                      </div>
                    )}
                  </React.Fragment>
                ))}
                <div className="toggle-row" data-testid="balance-always-on">
                  <div className="tr-txt"><b>Closing balance validation — always on</b><span>Every row is checked: opening balance ± each credit/debit must equal the bank's closing balance, and today's opening must equal yesterday's closing. If the bank's balance is wrong, ask the bank for a corrected statement; manual fixes only per the AMC's protocol.</span></div>
                  <div className="sw-wrap"><span className="chip chip-previous"><ShieldCheck size={11} /> Always on</span></div>
                </div>
                <div className="toggle-row recon-row">
                  <div className="tr-txt"><b>Reconciliation Type</b><span>Subscription collection or liability payments — decides the downstream tables.</span></div>
                  <div className="sw-wrap segmented" data-testid="recon-type">
                    {RECON_TYPES.map((t) => <button key={t} disabled={isView} className={form.processing.reconciliationType === t ? "on" : ""} onClick={() => setProc({ reconciliationType: t, liabilityCategory: t === "Liability" ? form.processing.liabilityCategory : "" })}>{t}</button>)}
                  </div>
                </div>
                {form.processing.reconciliationType === "Liability" && (
                  <div className="toggle-sub" data-testid="liability-subtype">
                    <label className="field-label">Liability type (one)</label>
                    <select className={"select" + (errors.liabilityCategory ? " invalid" : "")} style={{ maxWidth: 240 }} disabled={isView} value={form.processing.liabilityCategory} onChange={(e) => setProc({ liabilityCategory: e.target.value })} data-testid="field-bank-liability"><option value="">Select…</option>{LIABILITY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                    <span className="muted">Payouts from this account are matched against existing {form.processing.liabilityCategory ? form.processing.liabilityCategory.toLowerCase() : "redemption / dividend / switch"} data in Match payments → Liability.</span>
                    {errors.liabilityCategory && <span className="field-error">{errors.liabilityCategory}</span>}
                  </div>
                )}
                <div className="toggle-row" data-testid="priority-row">
                  <div className="tr-txt"><b>Download priority</b><span>Pick High for the 10–15 accounts that matter most. Within the download window (e.g. every 15 min from 7:00 AM to 9:00 PM) high-priority accounts are fetched first, the rest after. {highCount} account{highCount !== 1 ? "s are" : " is"} High today.</span></div>
                  <div className="sw-wrap segmented">{["high", "low"].map((v) => <button key={v} disabled={isView} className={form.priority === v ? "on" : ""} onClick={() => set({ priority: v })} data-testid={"priority-" + v}>{v === "high" ? "High" : "Low"}</button>)}</div>
                </div>
              </div>
            </>
          )}

          {/* STEP 6 */}
          {STEPS[step].key === "review" && (
            <ReviewSummary form={form} onEdit={gotoStep} isManual={isManual} val={reviewVal} />
          )}
        </div>

        {!isView && (
          <div className="wiz-foot" data-testid="wizard-footer">
            <button className="btn btn-outline" onClick={back} disabled={step === 0} data-testid="btn-back"><ArrowLeft size={15} /> Back</button>
            <div className="spacer" />
            <button className="btn btn-ghost" onClick={() => setConfirmReset(true)} data-testid="btn-reset"><RotateCcw size={15} /> Reset</button>
            <button className="btn btn-outline" onClick={doSaveDraft} data-testid="btn-save-draft"><Save size={15} /> Save as Draft</button>
            {STEPS[step].key !== "review"
              ? <button className="btn btn-primary" onClick={next} data-testid="btn-next">Next <ArrowRight size={15} /></button>
              : <button className="btn btn-success" onClick={() => setSubmitShow(true)} disabled={hasIssues} data-testid="btn-submit-approval"><Send size={15} /> Submit for Approval</button>}
          </div>
        )}
        {isView && (
          <div className="wiz-foot"><button className="btn btn-outline" onClick={() => nav("/bank-setup")}><ArrowLeft size={15} /> Back to list</button></div>
        )}
      </div>

      {confirmReset && (
        <ConfirmModal id="reset-modal" title="Reset configuration?" danger confirmLabel="Reset"
          message="Are you sure you want to reset? All unsaved changes will be discarded and the last saved state restored."
          onConfirm={doReset} onClose={() => setConfirmReset(false)} />
      )}
      {submitShow && <SubmitDialog onCancel={() => setSubmitShow(false)} onConfirm={doSubmitConfirmed} />}
    </div>
  );
}

function SubmitDialog({ onCancel, onConfirm }) {
  const [phase, setPhase] = React.useState("confirm");
  const start = () => {
    setPhase("loading");
    setTimeout(() => { setPhase("success"); setTimeout(onConfirm, 850); }, 900);
  };
  return (
    <Modal id="submit-modal" title={phase === "success" ? "Submitted" : "Submit for approval?"}
      onClose={phase === "confirm" ? onCancel : undefined}
      footer={phase === "confirm" ? (
        <>
          <button className="btn btn-ghost" onClick={onCancel} data-testid="submit-modal-cancel">Cancel</button>
          <button className="btn btn-success" onClick={start} data-testid="submit-modal-ok" autoFocus><Send size={15} /> Submit</button>
        </>
      ) : null}>
      {phase === "confirm" && <p>This configuration becomes <b>Active</b> on approval. It applies from the next file received; files already loaded are not re-processed. Submit?</p>}
      {phase === "loading" && <div className="submit-state" data-testid="submit-loading"><Loader2 className="spin" size={28} /><p>Submitting for approval…</p></div>}
      {phase === "success" && <div className="submit-state" data-testid="submit-success"><div className="success-ring"><Check size={26} /></div><p>Submitted for approval</p></div>}
    </Modal>
  );
}

function Section({ title, editStep, onEdit, invalid, warnMsgs, children }) {
  return (
    <div className={"rev-section" + (invalid ? " invalid" : "")} data-testid={"rev-section-" + editStep}>
      <div className="rs-head">
        {invalid && <AlertTriangle size={14} style={{ color: "hsl(38 92% 45%)" }} />}
        <h4>{title}</h4>
        <button className="link" onClick={() => onEdit(editStep)} data-testid={"edit-step-" + editStep}><Pencil size={12} style={{ verticalAlign: -1 }} /> Edit</button>
      </div>
      <div className="rs-body">
        <div className="kv-grid">{children}</div>
        {invalid && (warnMsgs || []).map((m, i) => <div className="rev-inline-warn" key={i}><AlertTriangle size={13} /> {m}</div>)}
      </div>
    </div>
  );
}

function KV({ k, v, testid }) {
  return (
    <div className="kv" data-testid={testid || ("kv-" + k.toLowerCase().replace(/\s+/g, "-"))}>
      <span className="kv-k">{k}</span>
      <span className="kv-v">{v || v === 0 ? v : "—"}</span>
    </div>
  );
}

function Stat({ on }) {
  return <span className={"chip-stat " + (on ? "on" : "off")}>{on ? <><Check size={11} /> On</> : "Off"}</span>;
}

function ReviewSummary({ form, onEdit, isManual, val }) {
  const fc = form.fileConfig;
  const p = form.processing;
  const c = form.connection;
  const fieldStep = { bankName: 1, accountNumber: 1, maskedPattern: 1, subjectPattern: 2, sender: 2, receiver: 2, zipPassword: 2, url: 2, corporateId: 2, loginId: 2, password: 2, fileType: 3, separator: 3, startRow: 3, startColumn: 3, uploadPath: 3, fileNamePattern: 3, cleanupChars: 4 };
  const issues = Object.entries(val.e).map(([field, msg]) => ({ field, msg, step: fieldStep[field] ?? 1 }));
  const hasIssues = issues.length > 0;
  const msgsFor = (step) => issues.filter((i) => i.step === step).map((i) => i.msg);
  const acct = form.accountNumber ? maskAccount(form.accountNumber) : "—";
  const std = isStandard(fc.fileType);
  return (
    <div data-testid="review-summary">
      <div className="step-title">Review &amp; Submit</div>
      <p className="step-desc">Setup summary. Use Edit to jump back to a step.</p>
      <div className="review-single">
        <div className="rev-strip" data-testid="review-strip">
          <div className="rs-item"><span className="rs-k">Bank</span><span className="rs-v">{form.bankName || "—"}</span></div>
          <div className="rs-item"><span className="rs-k">Account</span><span className="rs-v tnum">{form.processing.bulkUpload && !form.accountNumber ? "From file (bulk)" : acct}</span></div>
          <div className="rs-item"><span className="rs-k">File type</span><span className="rs-v">{fc.fileType || "—"}{std && " · no mapping needed"}</span></div>
          <span className={"chip-stat rs-badge " + (hasIssues ? "missing" : "ready")} data-testid="review-status-badge">
            {hasIssues ? <><AlertTriangle size={12} /> Missing fields</> : <><ShieldCheck size={12} /> Ready to Submit</>}
          </span>
        </div>

        {hasIssues && (
          <div className="rev-issues" data-testid="review-issues">
            <div className="ri-title"><AlertTriangle size={15} /> Resolve {issues.length} issue{issues.length > 1 ? "s" : ""} before submitting</div>
            <ul>
              {issues.map((i) => (
                <li key={i.field}><AlertTriangle size={12} /> {i.msg} <button className="link" onClick={() => onEdit(i.step)} data-testid={"issue-edit-" + i.field}>Edit step</button></li>
              ))}
            </ul>
          </div>
        )}

        <ChangesCard base={form.baseline} cur={form} />
        {(form.remarks || []).length > 0 && <div className="rev-issues" style={{ borderColor: "rgba(57,208,255,.35)" }}><div className="ri-title">Authoriser remarks</div><ul>{form.remarks.map((r, i) => <li key={i}><b>{r.by}</b>: {r.text}</li>)}</ul></div>}

        <Section title="Processing mode & connection" editStep={isManual ? 0 : 2} onEdit={onEdit} invalid={!!val.es[2]} warnMsgs={msgsFor(2)}>
          <KV k="Mode" v={BANK_MODES[form.downloadMode].label} />
          {form.downloadMode === "email" && (<><KV k="Sender" v={c.sender} /><KV k="Receiver" v={c.receiver} /><KV k="Subject pattern" v={c.subjectPattern} /><KV k="Attachment name" v={c.attachmentPattern || "Any name"} /><KV k="Accepted attachments" v={attachmentTypesFor(fc.fileType, c.zipOption).join(" ") || "—"} /><KV k="Not matching" v="Rejected and logged for review" /></>)}
          {["auto", "api"].includes(form.downloadMode) && (<><KV k="URL" v={c.url} /><KV k="Corporate ID" v={c.corporateId} /><KV k="Login ID" v={c.loginId} /><KV k="Credential" v={c.passwordSet || c._newPassword ? "Set ✓ (vault)" : "Not set"} /><KV k="Schedule" v={scheduleText(c.schedule)} /><KV k="Connection test" v={c.tested ? (c.tested.ok ? "Passed ✓" : "Failed") : "Not run"} /></>)}
        </Section>

        <Section title="Bank Information" editStep={1} onEdit={onEdit} invalid={!!val.es[1]} warnMsgs={msgsFor(1)}>
          <KV k="Bank Name" v={form.bankName} />
          <KV k="Account Number" v={form.accountNumber ? acct : null} />
          <KV k="Scheme / Collection" v={form.schemeOrCollection} />
          <KV k="Scheme Code" v={form.schemeCode} />
          <KV k="Asset Class" v={form.assetClass} />
          <KV k="Masked pattern" v={form.maskedPattern} />
        </Section>

        <Section title="File Configuration" editStep={3} onEdit={onEdit} invalid={!!val.es[3]} warnMsgs={msgsFor(3)}>
          <KV k="Sample File" v={<><FileText size={14} style={{ color: "hsl(var(--muted))" }} /> {fc.sampleFileName || "—"}</>} />
          <KV k="File Type" v={fc.fileType} />
          {!std && <KV k="Separator" v={isDelimited(fc.fileType) ? sepLabel(fc.separator) : "n/a"} />}
          {!std && <KV k="Start Row" v={fc.startRow} />}
          {!std && <KV k="Start Column" v={fc.startColumn} />}
          <KV k="File Upload Path" v={fc.uploadPath} />
          <KV k="File name pattern" v={fc.fileNamePattern} />
        </Section>

        <Section title="Processing Options" editStep={4} onEdit={onEdit} invalid={!!val.es[4]} warnMsgs={msgsFor(4)}>
          <KV k="Is Active" v={<Stat on={p.isActive} />} />
          <KV k="Bulk Upload" v={<Stat on={p.bulkUpload} />} />
          <KV k="Compute Running Balance" v={<Stat on={p.computeRunningBalance} />} />
          <KV k="Validate Running Balance" v={<Stat on={p.validateRunningBalance} />} />
          <KV k="Running Balance Cleanup" v={p.runningBalanceCleanup ? <span className="chip-stat on"><Check size={11} /> Remove “{p.cleanupChars}”</span> : <Stat on={false} />} />
          <KV k="Direct Match" v={<Stat on={p.directMatch} />} />
          <KV k="Descending Order" v={<Stat on={p.descendingOrder} />} />
          <KV k="Reconciliation Type" v={<span className="chip-stat text">{p.reconciliationType}</span>} />
        </Section>
      </div>
    </div>
  );
}

const testRegex = (pat) => { try { new RegExp(pat); return true; } catch (e) { return false; } };

/** PRD — masked account number pattern; shows whether it lines up with the selected account. */
function MaskedCheck({ pattern, account }) {
  if (!pattern) return <span className="muted" style={{ fontSize: 12 }}>Use when the statement prints the account partly hidden. Files carrying this value are linked to this account.</span>;
  const digits = (pattern.match(/\d+$/) || [""])[0];
  if (!account || !digits) return null;
  const ok = account.endsWith(digits) && pattern.length === account.length;
  return <span className={ok ? "field-ok" : "field-warn"} data-testid="masked-check">{ok ? <><Check size={12} /> Matches account ending {digits}</> : <><AlertTriangle size={12} /> Does not line up with the selected account ({maskAccount(account)}, {account.length} digits)</>}</span>;
}

/** R6 — email as a governed backup channel: which mails are picked up, what is accepted, what happens to the rest. */
function EmailRules({ form, setConn, errors, isView, A }) {
  const c = form.connection;
  const types = attachmentTypesFor(form.fileConfig.fileType, c.zipOption);
  return (
    <>
      <Note kind="info" icon={Mail}>Email is a backup channel. The file a bank emails is often laid out differently from its portal/API file, so the same account can have a separate email setup with its own file settings.</Note>
      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field"><label className="field-label">Sender Email</label><input className={"input" + (errors.sender ? " invalid" : "")} value={c.sender} disabled={isView} onChange={(e) => setConn({ sender: e.target.value })} placeholder="statements@bank.com" data-testid="field-sender" {...A("sender", c.sender, (v) => setConn({ sender: v }))} />{errors.sender && <span className="field-error">{errors.sender}</span>}</div>
        <div className="field"><label className="field-label">Receiver Email <span className="muted">(CAMS mailbox)</span></label><input className={"input" + (errors.receiver ? " invalid" : "")} value={c.receiver} disabled={isView} onChange={(e) => setConn({ receiver: e.target.value })} placeholder={"recon.ops" + CAMS_DOMAIN} data-testid="field-receiver" {...A("receiver", c.receiver, (v) => setConn({ receiver: v }))} />{errors.receiver && <span className="field-error">{errors.receiver}</span>}</div>
        <div className="field full">
          <label className="field-label">Email Subject Pattern <span className="muted">— use % for the part that changes daily (date, serial no.)</span></label>
          <input className={"input" + (errors.subjectPattern ? " invalid" : "")} value={c.subjectPattern} disabled={isView} onChange={(e) => setConn({ subjectPattern: e.target.value })} placeholder="HDFC Bank Account Statement 4512%" data-testid="field-subject" {...A("subjectPattern", c.subjectPattern, (v) => setConn({ subjectPattern: v }))} />
          {errors.subjectPattern && <span className="field-error">{errors.subjectPattern}</span>}
          <PatternTester pattern={c.subjectPattern} kind="like" names={exampleSubjects(form.bankName || "Bank", form.accountNumber || "0000")} label="Recent subjects from this sender" />
        </div>
        <div className="field"><label className="field-label">Attachment file name pattern <span className="muted">(optional)</span></label><input className="input tnum" value={c.attachmentPattern} disabled={isView} onChange={(e) => setConn({ attachmentPattern: e.target.value })} placeholder="Leave blank to accept any name" data-testid="field-attach-pattern" /></div>
        <div className="field"><label className="field-label">Attachment is ZIP?</label><select className="select" value={c.zipOption} disabled={isView} onChange={(e) => setConn({ zipOption: e.target.value })} data-testid="field-bank-zip"><option value="none">No ZIP</option><option value="zip">ZIP without password</option><option value="zippw">ZIP with password</option></select></div>
        {c.zipOption === "zippw" && <div className="field"><label className="field-label">ZIP Password</label>{c.zipPasswordSet && !c._zipPassword ? <span className="field-ok"><ShieldCheck size={12} /> Set in vault</span> : <PasswordInput value={c._zipPassword} onChange={(v) => setConn({ _zipPassword: v })} id="field-bank-zip-password" onFocus={() => { if (!c._zipPassword) setConn({ _zipPassword: mockValue("password") }); }} />}{errors.zipPassword && <span className="field-error">{errors.zipPassword}</span>}</div>}
        <div className="field full">
          <label className="field-label">Accepted attachment types <span className="muted">— from the File Type in the next step</span></label>
          <div className="chip-row">{types.length ? types.map((t) => <span key={t} className="chip chip-previous tnum">{t}</span>) : <span className="muted">Pick a File Type in File Configuration</span>}</div>
        </div>
      </div>
      <div className="email-rules" data-testid="email-rules">
        <b>What happens to each email</b>
        <div><Check size={13} /> Sender, receiver and subject match, attachment type allowed → file is validated and loaded.</div>
        <div><X size={13} /> Anything else → <b>rejected and logged</b> with the reason in Bank files → Email intake, where it can be assigned or reprocessed.</div>
      </div>
      {!isView && <div style={{ marginTop: 12 }}><VaultNote /></div>}
    </>
  );
}

/** R2 + R4 — file layout (standard format or sample-detected custom file) and the SFTP drop folder. */
function FileStep({ form, setFile, markEdited, errors, isView, A, analysing, showPreview, onPickFile, onClear, onUseDetected, onFormatName, sameBank }) {
  const fc = form.fileConfig;
  const std = isStandard(fc.fileType);
  const sample = detectFor(fc.sampleFileName);
  const preview = buildPreview(fc.sampleFileName);
  const bank = BANKS.find((b) => b.name === form.bankName);
  const auto = (k) => fc.detected?.[k] && !fc.edited?.[k] ? <span className="chip chip-auto"><Sparkles size={10} /> Auto-detected</span> : null;
  return (
    <>
      <div className="step-title">File Configuration</div>
      <p className="step-desc">Drop one real statement. The system works out the layout; you check it. Standard bank formats need no mapping at all.</p>
      <FileDropZone fileName={fc.sampleFileName} onPick={onPickFile} onClear={onClear} hint="Drop a sample statement — file type, separator, start row and column are filled in for you" />
      {!analysing && sample && <DetectedAccount sample={fc.sampleFileName} form={form} onUse={onUseDetected} isView={isView} />}
      {sample?.mismatch && showPreview && <div style={{ marginTop: 14 }}><Note kind="warn">File extension says <b>XLS</b> but content looks like <b>HTML/CSV</b> — settings pre-filled from content.</Note></div>}
      {analysing && <div className="analysing" data-testid="analysing"><div className="spinner" /><div><b>Analysing file…</b><div style={{ fontSize: 12, color: "hsl(var(--muted))" }}>Checking for a standard format, then header row, separator and column layout</div></div></div>}

      {!analysing && (
        <div className="form-grid" style={{ marginTop: 18 }}>
          <div className="field full">
            <label className="field-label">Format name <span className="muted">(optional — when a bank sends more than one layout)</span></label>
            <input className="input" value={form.formatName} disabled={isView} onChange={(e) => onFormatName(e.target.value)} placeholder="e.g. Morning (10 columns) or EOD (12 columns)" data-testid="field-format-name" />
            {sameBank > 0 && <span className="muted" style={{ fontSize: 12 }}>{form.bankName} already has {sameBank} other setup{sameBank > 1 ? "s" : ""}. Each incoming file is checked against every one and loaded with the setup whose layout matches; it errors only if none match.</span>}
          </div>
          <div className="field">
            <label className="field-label">File Type {auto("fileType")}</label>
            <select className={"select" + (errors.fileType ? " invalid" : "")} value={fc.fileType} disabled={isView} data-testid="field-file-type" onChange={(e) => { setFile({ fileType: e.target.value }); markEdited("fileType"); }}>
              <option value="">Select format…</option>
              <optgroup label="Bank standard formats — no column mapping needed">{Object.entries(STANDARD_FORMATS).map(([k, d]) => <option key={k} value={k}>{k} — {d.split(" — ")[1]}</option>)}</optgroup>
              <optgroup label="Custom file — needs column mapping">{FILE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
            </select>
            {errors.fileType && <span className="field-error">{errors.fileType}</span>}
          </div>
          {!std && isDelimited(fc.fileType) && (
            <div className="field">
              <label className="field-label">File Separator {auto("separator")}</label>
              <select className={"select" + (errors.separator ? " invalid" : "")} value={fc.separator} disabled={isView} data-testid="field-separator" onChange={(e) => { setFile({ separator: e.target.value }); markEdited("separator"); }}>
                <option value="">Select…</option>{SEPARATORS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
              </select>
              {errors.separator && <span className="field-error">{errors.separator}</span>}
            </div>
          )}
          {!std && <>
            <div className="field"><label className="field-label">File Start Row {auto("startRow")}</label><input className={"input tnum" + (errors.startRow ? " invalid" : "")} value={fc.startRow} disabled={isView} data-testid="field-startrow" onChange={(e) => { setFile({ startRow: e.target.value }); markEdited("startRow"); }} />{errors.startRow && <span className="field-error">{errors.startRow}</span>}</div>
            <div className="field"><label className="field-label">File Start Column {auto("startColumn")}</label><input className={"input tnum" + (errors.startColumn ? " invalid" : "")} value={fc.startColumn} disabled={isView} data-testid="field-startcol" onChange={(e) => { setFile({ startColumn: e.target.value }); markEdited("startColumn"); }} />{errors.startColumn && <span className="field-error">{errors.startColumn}</span>}</div>
          </>}
        </div>
      )}

      {std && !analysing && (
        <div className="std-box" data-testid="standard-format">
          <Note kind="info" icon={ShieldCheck}><b>{fc.fileType}</b> is a bank standard format. A pre-built parser reads the transaction tags (date, credit/debit mark, amount, reference, narration), so start row, start column and column mapping are not needed.</Note>
          {sample?.parsed && <table className="tc-rows" style={{ marginTop: 10 }}><thead><tr>{sample.parsed[0].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{sample.parsed.slice(1).map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} className="tnum">{x}</td>)}</tr>)}</tbody></table>}
        </div>
      )}
      {!std && showPreview && !analysing && preview && (
        <PreviewTable {...preview} maxRows={40} caption="Whole sample — the highlighted row is the header" startColumn={parseInt(fc.startColumn, 10) || 1} headerIdx={(parseInt(fc.startRow, 10) || preview.headerIdx + 1) - 1}
          onPickRow={isView ? undefined : (i) => { setFile({ startRow: String(i + 1) }); markEdited("startRow"); }} />
      )}

      <div className="section-title">Upload Destination (SFTP)</div>
      <div className="form-grid">
        <div className="field full"><Note kind="info">SFTP is set up once per AMC, so path, user name and password are parked here (display only) and will move to a central table once the client's SFTP / GCS approach is known.</Note></div>
        <div className="field"><label className="field-label">File Upload Path <span className="muted">(per AMC)</span></label><input className="input" value={fc.uploadPath || "/sftp/<amc>/inbound/"} readOnly disabled data-testid="field-upload-path" /></div>
        <div className="field"><label className="field-label">File Upload Username</label><input className="input" value={fc.uploadUser || "held centrally"} readOnly disabled data-testid="field-upload-user" /></div>
        <div className="field"><label className="field-label">File Upload Password</label><input className="input" value="••••••••" readOnly disabled /></div>
        <div className="field">
          <label className="field-label">File name pattern <span className="muted">(which files in this folder belong to this setup)</span></label>
          <input className={"input tnum" + (errors.fileNamePattern ? " invalid" : "")} value={fc.fileNamePattern} disabled={isView} placeholder={`${bank?.code || "SBIN"}_${(form.accountNumber || "3313").slice(-4)}_\\d{8}\\.${extFor(fc.fileType)}`} onChange={(e) => setFile({ fileNamePattern: e.target.value })} data-testid="field-file-name-pattern" />
          {errors.fileNamePattern && <span className="field-error">{errors.fileNamePattern}</span>}
        </div>
        <div className="field full">
          <PatternTester pattern={fc.fileNamePattern} names={exampleFileNames(bank?.code || "BANK", form.accountNumber || "0000", extFor(fc.fileType))} label="Files seen in this folder" />
          <span className="muted" style={{ fontSize: 12 }}>\d{8} = the 8-digit date. Files that match no setup are not loaded; they are logged for review.</span>
        </div>
      </div>
    </>
  );
}

/** Reads the bank name and account number printed in the sample and fuzzy-matches them to the Bank Master. */
function DetectedAccount({ sample, form, onUse, isView }) {
  const d = detectAccountInSample(sample);
  if (!d) return null;
  const same = form.bankName === d.bankName && form.accountNumber === d.accountNumber;
  return (
    <div className={"detect-acct" + (same ? " ok" : "")} data-testid="detected-account">
      <Sparkles size={14} />
      <span>The sample says <b>“{d.printedBank}”</b>, account <b className="tnum">{d.printedAcct}</b> → Bank Master: <b>{d.bankName} ·{d.accountNumber.slice(-4)}</b> <span className="muted">(name match {Math.round(d.score * 100)}%)</span></span>
      {same ? <span className="field-ok"><Check size={12} /> Matches this setup</span> : !isView && <button className="btn btn-outline btn-sm" onClick={() => onUse(d)} data-testid="use-detected">Use these</button>}
    </div>
  );
}
