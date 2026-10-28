import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Landmark, ArrowLeft, Check, AlertTriangle, RotateCcw, Save, Send, Sparkles, FileText, CheckCircle2, Clock, Ban, KeyRound, Scale, ShieldCheck } from "lucide-react";
import { useStore } from "@/state/store";
import StepIndicator from "@/components/StepIndicator";
import PreviewTable from "@/components/PreviewTable";
import FileDropZone from "@/components/FileDropZone";
import { Modal } from "@/components/Modal";
import { Chip, Toggle, Note } from "@/components/bits";
import { buildPreview, detectFor, sampleTable } from "@/mock/sampleFiles";
import { matchHeader, suggestIncremental } from "@/lib/setupSchema";
import { ChangesCard } from "@/features/setup/SetupBits";
import DateFormatBuilder, { defaultDateFmt, fmtString } from "./DateFormatBuilder";
import { formatDate, uid } from "@/lib/format";
import { toast } from "sonner";

const STEPS = [{ key: "sample", label: "Sample File" }, { key: "header", label: "Pick Header" }, { key: "map", label: "Map Columns" }];
const SPLIT_AMOUNT = ["INSTRM_AMOUNT_CREDIT", "INSTRM_AMOUNT_DEBIT"];

export default function MappingEditor() {
  const { type, id } = useParams();
  const nav = useNavigate();
  const { get, saveDraft, submit, collections, act, currentUser } = useStore();

  const rec = get("bank_mapping", id);
  const [sp] = useSearchParams();
  // A format change detected in Bank files arrives here as a proposal for review — never applied automatically.
  const proposalFile = sp.get("proposal") ? (collections.files || []).find((f) => f.id === sp.get("proposal")) : null;
  const proposal = proposalFile?.drift;
  const [mapping, setMapping] = React.useState(() => rec ? { ...JSON.parse(JSON.stringify(rec)), baseline: ["active", "inactive"].includes(rec.status) ? JSON.parse(JSON.stringify(rec)) : rec.baseline || null } : null);
  const [step, setStep] = React.useState(() => (new URLSearchParams(window.location.search).get("proposal") ? 2 : 0));
  const [headerConfirmed, setHeaderConfirmed] = React.useState(rec?.headerConfirmed || false);
  const [dateFmt, setDateFmt] = React.useState(rec?.dateFmt || defaultDateFmt());
  const [hdr, setHdr] = React.useState(null); // header row picked by the user (0-based); null = detected
  const [startCol, setStartCol] = React.useState(null); // first data column picked by the user; null = detected
  const [replacing, setReplacing] = React.useState(false);
  const [analysing, setAnalysing] = React.useState(false);
  const [dialog, setDialog] = React.useState(null);
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);
  const [overrides, setOverrides] = React.useState(0);
  const [keyHint, setKeyHint] = React.useState(null);

  if (!mapping) return <div className="card card-pad" data-testid="mapping-missing">Mapping not found. <button className="link" onClick={() => nav("/mapping")}>Back to list</button></div>;

  if (mapping.standard) return (
    <div data-testid="mapping-editor">
      <div className="page-head"><div>
        <button className="link" onClick={() => nav(`/mapping?tab=${type}`)}><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Back to mappings</button>
        <h1 style={{ marginTop: 6 }}>{mapping.bankName} — Column Mapping</h1>
      </div></div>
      <div className="card card-pad"><Note kind="info" icon={ShieldCheck}><b>{mapping.fileType}</b> is a bank standard format. The pre-built parser reads it, so there is no column mapping to maintain for this setup.</Note></div>
    </div>
  );

  const isView = mapping.status === "pending";
  const sampleFile = mapping.sampleFileName || "hdfc_statement_sep.csv";
  const meta = detectFor(sampleFile);
  const preview = buildPreview(sampleFile);
  const table = sampleTable(sampleFile);
  const headerIdx = hdr ?? (preview ? preview.headerIdx : 0);
  const firstCol = startCol ?? (meta?.detect.startColumn || 1);
  // Replace the sample, as in bank statement setup: re-detect layout, then flag fields whose column is gone.
  const pickSample = (name) => {
    if (!detectFor(name)) { toast.error("Could not read this file — use one of the demo files"); return; }
    setAnalysing(true); setReplacing(false);
    setTimeout(() => {
      const p = buildPreview(name);
      const cols = (p.rows[p.headerIdx] || []).filter((c) => c && c.trim());
      setMapping((m) => ({ ...m, sampleFileName: name, sampleReplacedAt: new Date().toISOString(),
        fields: m.fields.map((f) => (f.status === "mapped" && !cols.includes(f.mappedColumn) ? { ...f, status: "mismatch", note: `“${f.mappedColumn}” is not in the new sample` } : f)) }));
      setHdr(null); setStartCol(null); setAnalysing(false);
      toast.success("Sample read — header row and start column detected. Check them below.");
    }, 700);
  };
  const columns = proposal ? proposal.newColumns : preview?.rows[headerIdx]?.filter((c) => c && c.trim()) || [];
  const acctCount = new Set((collections.bank_config || []).filter((c) => c.bankName === mapping.bankName && (c.formatName || "") === (mapping.formatName || "")).map((c) => c.accountNumber)).size;
  const fields = mapping.fields;
  const isMapped = (sf) => fields.some((f) => f.systemField === sf && f.status === "mapped");
  const amountCombined = isMapped("INSTRM_AMOUNT");
  const fieldStatus = (f) => (amountCombined && SPLIT_AMOUNT.includes(f.systemField) ? "disabled" : f.status);

  const statusMap = { sample: step === 0 ? "current" : "complete", header: step === 1 ? "current" : step > 1 ? "complete" : "upcoming", map: step === 2 ? "current" : "upcoming" };

  const setField = (idx, patch) => setMapping((m) => ({ ...m, fields: m.fields.map((f, i) => i === idx ? { ...f, ...patch } : f) }));

  const onMapColumn = (idx, col) => {
    const f = fields[idx];
    if (col && /AMOUNT|BALANCE/.test(f.systemField) && /narration|particulars|description|cheque|date/i.test(col)) { setDialog({ type: "mismatch", idx, col }); return; }
    if (col && /DATE/.test(f.systemField) && /amount|credit|debit|balance/i.test(col)) { setDialog({ type: "mismatch", idx, col }); return; }
    const usedBy = fields.findIndex((x, i) => i !== idx && x.mappedColumn === col && col && x.group === "input");
    if (col && f.group === "input" && usedBy !== -1) { setDialog({ type: "inuse", idx, col, usedBy }); return; }
    applyMap(idx, col);
  };
  const applyMap = (idx, col) => setMapping((m) => {
    let next = m.fields.map((f, i) => i === idx ? { ...f, mappedColumn: col, source: "manual", status: col ? "mapped" : "pending" } : f);
    // PRD v1 — mapping INSTRM_AMOUNT disables (and clears) the separate credit / debit amount fields.
    if (m.fields[idx].systemField === "INSTRM_AMOUNT" && col) next = next.map((f) => SPLIT_AMOUNT.includes(f.systemField) ? { ...f, mappedColumn: "", status: "pending", incremental: false } : f);
    return { ...m, fields: next };
  });

  // R3 — map by header name; a column the previous mapping used but this file no longer has is flagged, never silently re-used by position.
  const autoMapByName = () => {
    let named = 0, missing = 0;
    setMapping((m) => ({
      ...m, fields: m.fields.map((f) => {
        if (f.group !== "input") return f;
        if (f.status === "mapped" && columns.includes(f.mappedColumn)) return f;
        if (f.status === "mapped" && !columns.includes(f.mappedColumn)) { missing++; return { ...f, status: "mismatch", note: `“${f.mappedColumn}” is not in this file` }; }
        const hit = columns.find((c) => matchHeader(f.systemField, c) && !(f.systemField === "BANK_STMT_DATE" && /value/i.test(c)));
        if (!hit) return f;
        named++;
        // Confidence: exact system-name match vs a known synonym.
        const conf = hit.replace(/[^a-z]/gi, "").toUpperCase() === f.systemField.replace(/[^A-Z]/g, "") ? 0.98 : 0.86;
        return { ...f, mappedColumn: hit, source: "header", status: "mapped", conf };
      }),
    }));
    toast.success(`${named} field${named !== 1 ? "s" : ""} mapped by header name${missing ? ` · ${missing} need re-mapping` : ""}`);
  };

  // R3 — suggest the Incremental (duplicate-key) flags from a uniqueness test on the sample rows.
  const suggestKeys = () => {
    if (!table) { toast.error("No sample rows to test"); return; }
    const res = suggestIncremental(fields.map((f) => ({ ...f, status: fieldStatus(f) })), table.header, table.data);
    setMapping((m) => ({ ...m, fields: m.fields.map((f) => ({ ...f, incremental: res.keys.includes(f.systemField) })) }));
    setKeyHint(res);
    toast.success(`Suggested ${res.keys.length} incremental flags`);
  };

  const mappedCount = fields.filter((f) => f.status === "mapped").length;
  const headerCount = fields.filter((f) => f.source === "header" && f.status === "mapped").length;
  const prevCount = fields.filter((f) => f.source === "previous" && f.status === "mapped").length;
  const pendingCount = fields.filter((f) => f.group === "input" && fieldStatus(f) === "pending").length;
  const incCount = fields.filter((f) => f.incremental && f.status === "mapped").length;

  const validateSubmit = () => {
    const mandatoryUnmapped = fields.filter((f) => f.mandatory && fieldStatus(f) !== "mapped" && fieldStatus(f) !== "disabled");
    const hasAmount = amountCombined || isMapped("INSTRM_AMOUNT_CREDIT") || isMapped("INSTRM_AMOUNT_DEBIT");
    const errs = [];
    if (mandatoryUnmapped.length) errs.push(`${mandatoryUnmapped.length} required field(s) not mapped: ${mandatoryUnmapped.map((f) => f.systemField).join(", ")}`);
    if (fields.some((f) => f.status === "mismatch")) errs.push("Some fields point to a column that is not in this file — re-map them");
    if (incCount < 3) errs.push(`Enable at least 3 incremental flags (currently ${incCount})`);
    if (!isMapped("VALUE_DATE")) errs.push("Value date must be mapped");
    if (!hasAmount) errs.push("Amount must be mapped (INSTRM_AMOUNT, or credit / debit amounts)");
    if (!isMapped("BANK_NARRATION") && !isMapped("BANK_DESCRIPTION")) errs.push("Narration must be mapped");
    if (mapping.bulkUpload && !isMapped("BANK_AC_NO")) errs.push("Bank account number must be mapped — bulk upload is on for this setup");
    return errs;
  };

  const label = `${mapping.bankName} mapping · ${(mapping.accountNumber || "").slice(-4)}`;
  const payload = () => ({ ...mapping, headerConfirmed, headerRow: headerIdx + 1, startColumn: firstCol, dateFmt, dateFormat: fmtString(dateFmt), overrides });
  const doSaveDraft = () => {
    const errs = validateSubmit().filter((e) => /required|incremental|Value date|Amount|Narration|account number/i.test(e));
    if (errs.length) { toast.error(errs[0]); return; }
    saveDraft("bank_mapping", payload(), label); toast.success("Mapping saved as Draft"); nav(`/mapping?tab=${type}`);
  };
  const openSubmit = () => { const errs = validateSubmit(); if (errs.length) { toast.error(errs[0]); return; } setConfirmSubmit(true); };
  const doSubmit = () => { submit("bank_mapping", payload(), label); toast.success("Mapping submitted for approval"); setConfirmSubmit(false); nav(`/mapping?tab=${type}`); };
  const doReset = () => { setMapping(JSON.parse(JSON.stringify(rec))); setOverrides(0); setKeyHint(null); toast("Mapping reset to last saved"); };

  // One action bar, at the bottom of the page only.
  const actionBar = !isView && (
    <div className="map-actions map-actions-foot" data-testid="map-actions">
      <button className="btn btn-ghost" onClick={doReset} data-testid="btn-map-reset"><RotateCcw size={15} /> Reset to last saved</button>
      <button className="btn btn-outline" onClick={doSaveDraft} data-testid="btn-map-draft"><Save size={15} /> Save as draft</button>
      <button className="btn btn-success" onClick={openSubmit} data-testid="btn-map-submit"><Send size={15} /> Submit for approval</button>
    </div>
  );

  const renderRow = (f, idx) => {
    const st = fieldStatus(f);
    const disabled = st === "disabled";
    return (
      <tr key={f.systemField} data-testid={"map-field-" + f.systemField} className={disabled ? "row-disabled" : ""}>
        <td className="sysfield">{f.systemField}{f.mandatory && <span className="req-star"> *</span>}</td>
        <td style={{ color: "hsl(var(--muted))" }}>{f.attribute}</td>
        <td>
          <select className="map-select" value={f.mappedColumn} disabled={isView || disabled} data-testid={"select-col-" + f.systemField} onChange={(e) => onMapColumn(idx, e.target.value)}>
            {/* An existing mapping is always shown as the selected value, never a blank "Select" */}
            {!f.mappedColumn && <option value="">{disabled ? "Not used — INSTRM_AMOUNT is mapped" : "Not mapped — pick a column"}</option>}
            {f.mappedColumn && !columns.includes(f.mappedColumn) && <option value={f.mappedColumn}>{f.mappedColumn} (current — not in this file)</option>}
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            {f.mappedColumn && <option value="">Clear mapping</option>}
          </select>
          {f.status === "mismatch" && <div className="field-warn"><AlertTriangle size={11} /> {f.note || "Re-map this field"}</div>}
          {f.systemField === "VALUE_DATE" && f.status === "mapped" && <DateFormatBuilder value={dateFmt} onChange={setDateFmt} sample={meta?.dateSample} disabled={isView} />}
          {/DATE|TIME/.test(f.systemField) && f.systemField !== "VALUE_DATE" && f.status === "mapped" && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Read with the date format set on VALUE_DATE ({fmtString(dateFmt)})</div>}
        </td>
        <td>{f.status === "mapped" ? <><Chip type={f.source} />{(f.conf || f.source === "previous") && <span className="conf-pct" title="How sure the auto-mapping is">{Math.round((f.conf || 0.99) * 100)}%</span>}</> : null}</td>
        <td><button type="button" className={"mand-star" + (f.mandatory ? " on" : "")} disabled={isView || disabled} onClick={() => setField(idx, { mandatory: !f.mandatory })} data-testid={"mand-" + f.systemField} title={f.mandatory ? "Mandatory — a blank value rejects the file. Click to make optional." : "Optional — click to make mandatory"}>{f.mandatory ? "★ Mandatory" : "☆"}</button></td>
        <td><Toggle checked={f.incremental} disabled={isView || disabled || f.status !== "mapped"} onChange={(v) => setField(idx, { incremental: v })} id={"incr-" + f.systemField} /></td>
        <td className="map-status">{st === "mapped" ? <span className="ok"><Check size={15} /> Mapped</span> : st === "disabled" ? <span className="dis"><Ban size={13} /> Disabled</span> : st === "mismatch" ? <span className="mis"><AlertTriangle size={13} /> Check</span> : <span className="pend"><Clock size={13} /> Pending</span>}</td>
      </tr>
    );
  };

  return (
    <div data-testid="mapping-editor">
      <div className="page-head"><div>
        <button className="link" onClick={() => nav(`/mapping?tab=${type}`)}><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Back to mappings</button>
        <h1 style={{ marginTop: 6 }}>{mapping.bankName}{mapping.formatName ? ` · ${mapping.formatName}` : ""} — Column Mapping</h1>
        <div className="impact-chip" data-testid="impact"><Landmark size={13} /> Used by <b>{acctCount}</b> account{acctCount !== 1 ? "s" : ""} at {mapping.bankName}. A change here applies to all of them.</div>
      </div></div>

      <div className="card wizard">
        {mapping.rejection && <div className="reject-banner"><AlertTriangle className="rb-ico" size={20} /><div><h4>Rejected by {mapping.rejection.by}</h4><div className="meta">on {formatDate(mapping.rejection.date)}</div><p>{mapping.rejection.comment}</p></div></div>}
        <StepIndicator steps={STEPS} current={step} status={statusMap} onJump={(i) => setStep(i)} maxReachable={2} />

        <div className="wiz-body">
          {step === 0 && (<>
            <div className="step-title">Sample File</div>
            <p className="step-desc">The file the mapping is built from. Replace it if the bank's layout has changed, then check what was detected.</p>
            {!replacing ? (
              <div className="summary-banner" data-testid="sample-banner"><FileText size={16} />
                <span>{mapping.sampleReplacedAt ? <>Sample replaced just now: <b>{sampleFile}</b></> : <>Using the sample uploaded on <b>&nbsp;{formatDate(mapping.createdAt)}&nbsp;</b> during setup ({sampleFile}).</>}</span>
                {!isView && <button className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }} onClick={() => setReplacing(true)} data-testid="replace-sample">Replace sample</button>}
              </div>
            ) : (
              <div data-testid="replace-zone">
                <FileDropZone fileName={null} onPick={pickSample} onClear={() => setReplacing(false)} hint="Drop a newer statement from this bank — the header row and columns are detected again" />
                <button className="link" style={{ marginTop: 8 }} onClick={() => setReplacing(false)}>Keep the current sample</button>
              </div>
            )}
            {analysing && <div className="analysing" data-testid="analysing"><div className="spinner" /><div><b>Reading the sample…</b><div style={{ fontSize: 12, color: "hsl(var(--muted))" }}>Finding the header row, separator and columns</div></div></div>}
            {!analysing && (<>
              <div className="form-grid" style={{ marginTop: 16 }} data-testid="sample-settings">
                <div className="field"><label className="field-label">File type {hdr === null && startCol === null && <span className="chip chip-auto"><Sparkles size={10} /> Auto-detected</span>}</label><input className="input" value={meta?.detect.fileType || "—"} readOnly disabled /></div>
                <div className="field"><label className="field-label">Header row {hdr === null ? <span className="chip chip-auto"><Sparkles size={10} /> Auto-detected</span> : <span className="chip chip-edited">Edited</span>}</label>
                  <input className="input tnum" disabled={isView} value={headerIdx + 1} onChange={(e) => { const n = parseInt(e.target.value, 10); if (n >= 1 && n <= preview.rows.length) setHdr(n - 1); }} data-testid="map-header-row" /></div>
                <div className="field"><label className="field-label">Start column {startCol === null ? <span className="chip chip-auto"><Sparkles size={10} /> Auto-detected</span> : <span className="chip chip-edited">Edited</span>}</label>
                  <input className="input tnum" disabled={isView} value={firstCol} onChange={(e) => { const n = parseInt(e.target.value, 10); if (n >= 1) setStartCol(n); }} data-testid="map-start-col" /></div>
              </div>
              <PreviewTable rows={preview.rows} headerIdx={headerIdx} maxRows={40} startColumn={firstCol} caption="Whole sample file — the highlighted row is the header" onPickRow={isView ? undefined : (i) => setHdr(i)} />
              {fields.some((f) => f.status === "mismatch") && <div className="note warn" style={{ marginTop: 12 }}><AlertTriangle size={14} /><div>{fields.filter((f) => f.status === "mismatch").length} mapped field(s) point to a column that isn't in this sample. You'll re-map them in step 3.</div></div>}
            </>)}
            <div style={{ marginTop: 18 }}><button className="btn btn-primary" onClick={() => setStep(1)} data-testid="map-to-header">Continue to header</button></div>
          </>)}

          {step === 1 && (<>
            <div className="step-title">Pick Header Row</div>
            <p className="step-desc">Confirm the row that contains the column names. Rows above it are skipped.</p>
            {meta && mapping.headerRow && meta.detect.startRow !== mapping.headerRow && (
              <div style={{ marginBottom: 12 }}><div className="note warn"><AlertTriangle /><div>Header scoring found the column names on <b>row {meta.detect.startRow}</b>, but the setup says <b>row {mapping.headerRow}</b>. Please confirm.</div></div></div>
            )}
            <PreviewTable rows={preview.rows} headerIdx={headerIdx} maxRows={40} startColumn={firstCol} caption={`Whole sample — header on row ${headerIdx + 1}${hdr === null ? " (detected)" : " (your pick)"}`} onPickRow={isView ? undefined : (i) => setHdr(i)} />
            <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
              <button className="btn btn-success" onClick={() => { setHeaderConfirmed(true); setStep(2); toast.success("Header confirmed"); }} data-testid="btn-confirm-header"><Check size={15} /> Confirm header</button>
              <button className="btn btn-outline" onClick={() => setStep(0)}>Back</button>
            </div>
          </>)}

          {step === 2 && (<>
            <div className="step-title">Map Columns</div>
            {proposal && <ProposalCard file={proposalFile} proposal={proposal} isView={isView} onApply={() => {
              const byField = Object.fromEntries(proposal.changes.filter((c) => proposal.newColumns.includes(c.proposed)).map((c) => [c.field, c.proposed]));
              setMapping((m) => ({ ...m, fields: m.fields.map((f) => byField[f.systemField] ? { ...f, mappedColumn: byField[f.systemField], source: "pattern", status: "mapped", note: null } : f), narrationSplit: m.narrationSplit || Object.keys(byField).some((k) => k.startsWith("EXTRACT_")) }));
              toast.success("Changes allowed in the grid. Check them, then Submit for approval at the bottom.");
            }} />}
            {/* Fields already listed in the proposal above are not repeated here */}
            {mapping.baseline && <ChangesCard base={{ ...mapping.baseline, kind: "bank_mapping" }} cur={{ ...mapping, kind: "bank_mapping" }} compact exclude={proposal ? proposal.changes.map((c) => c.field) : []} />}
            <div className="summary-banner" data-testid="map-summary-banner"><Sparkles size={16} /> {prevCount} from the last approved mapping, {headerCount} by header name, {pendingCount} pending.
              {!isView && <button className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }} onClick={autoMapByName} data-testid="btn-auto-map"><Sparkles size={13} /> Auto-map by header name</button>}</div>

            <div className="key-card" data-testid="incremental-card">
              <KeyRound size={16} />
              <div>
                <b>Incremental flags — which columns make a row unique ({incCount} on, minimum 3)</b>
                <span>The system uses these together to recognise a row it has already loaded, so the same credit is never counted twice.</span>
                {keyHint && <span className={keyHint.unique ? "field-ok" : "field-warn"}>{keyHint.unique ? <Check size={12} /> : <AlertTriangle size={12} />} {keyHint.keys.join(" + ")} {keyHint.unique ? `are unique on all ${keyHint.rows} sample rows` : `still repeat on the sample — add another column`}</span>}
              </div>
              {!isView && <button className="btn btn-outline btn-sm" onClick={suggestKeys} data-testid="btn-suggest-keys">Suggest from sample</button>}
            </div>

            <div className="map-group">
              <h4>Bank Statement Input</h4>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>★ marks a mandatory column: if a file arrives with that column blank, the whole file is rejected. Click ★ / ☆ to change it.</div>
              {amountCombined && <Note kind="info">INSTRM_AMOUNT is mapped, so INSTRM_AMOUNT_CREDIT and INSTRM_AMOUNT_DEBIT are disabled. Clear INSTRM_AMOUNT to use separate credit and debit columns.</Note>}
              <table className="map">
                <thead><tr><th>System Field</th><th>Attribute</th><th>Map to Column</th><th>Source</th><th title="★ = a blank value in this column rejects the file on upload">Mandatory</th><th>Incremental</th><th>Status</th></tr></thead>
                <tbody>{fields.map((f, idx) => f.group === "input" && renderRow(f, idx))}</tbody>
              </table>
            </div>

            <StatusValues mapping={mapping} table={table} meta={meta} collections={collections} act={act} me={currentUser} isView={isView} />

            <div className="map-group">
              <div className="split-head">
                <h4>Bank Narration / Description Split</h4>
                <label className="flag-cell"><Toggle checked={!!mapping.narrationSplit} disabled={isView} onChange={(v) => setMapping((m) => ({ ...m, narrationSplit: v }))} id="toggle-narration-split" /><span>{mapping.narrationSplit ? "Enabled" : "Disabled – enable to configure extract columns"}</span></label>
              </div>
              {mapping.narrationSplit && (
                <table className="map">
                  <thead><tr><th>System Field</th><th>Attribute</th><th>Map to Column</th><th>Source</th><th title="★ = a blank value in this column rejects the file on upload">Mandatory</th><th>Incremental</th><th>Status</th></tr></thead>
                  <tbody>{fields.map((f, idx) => f.group === "narration" && renderRow(f, idx))}</tbody>
                </table>
              )}
            </div>
            {actionBar}
          </>)}
        </div>
      </div>

      {dialog?.type === "mismatch" && (
        <Modal id="mismatch-dialog" title="Column type mismatch" onClose={() => setDialog(null)}
          footer={<><button className="btn btn-outline" onClick={() => setDialog(null)} data-testid="btn-remap">Re-map</button><button className="btn btn-danger" data-testid="btn-continue-anyway" onClick={() => { applyMap(dialog.idx, dialog.col); setOverrides((o) => o + 1); setDialog(null); toast("Override recorded"); }}>Continue anyway</button></>}>
          <p>You are mapping <b>{fields[dialog.idx].systemField}</b> ({fields[dialog.idx].attribute}) to column <b>“{dialog.col}”</b>, whose values do not look like that type. This is likely incorrect.</p>
          <p style={{ color: "hsl(var(--muted))" }}>Amount fields expect numbers such as <span className="tnum">25000.00</span>; date fields expect dates such as <span className="tnum">{meta?.dateSample || "03/04/2026"}</span>.</p>
        </Modal>
      )}
      {dialog?.type === "inuse" && (
        <Modal id="inuse-dialog" title="Column already in use" onClose={() => setDialog(null)}
          footer={<><button className="btn btn-outline" onClick={() => setDialog(null)} data-testid="btn-inuse-cancel">Cancel</button><button className="btn btn-primary" data-testid="btn-map-both" onClick={() => { applyMap(dialog.idx, dialog.col); setDialog(null); toast("Mapped to both fields"); }}>Map to both fields</button></>}>
          <p>Column <b>“{dialog.col}”</b> is already mapped to <b>{fields[dialog.usedBy].systemField}</b>. Map it to <b>{fields[dialog.idx].systemField}</b> as well?</p>
        </Modal>
      )}
      {confirmSubmit && (
        <Modal id="submit-confirm" title="Confirm mapping submission" size="lg" onClose={() => setConfirmSubmit(false)}
          footer={<><button className="btn btn-outline" onClick={() => setConfirmSubmit(false)}>Review again</button><button className="btn btn-success" data-testid="btn-final-submit" onClick={doSubmit}><Send size={15} /> Submit {mappedCount} fields</button></>}>
          <p>Review every field before submitting for approval.{overrides > 0 && <> <b style={{ color: "hsl(var(--st-rejected))" }}>{overrides} “Continue anyway” override(s)</b> were recorded.</>} The mapping applies from the next file; files already loaded are not re-processed.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {fields.filter((f) => f.group === "input" || mapping.narrationSplit).map((f) => {
              const st = fieldStatus(f);
              return <span key={f.systemField} className={"chip " + (st === "mapped" ? "chip-previous" : "chip-manual")} data-testid={"confirm-field-" + f.systemField}>{st === "mapped" ? <CheckCircle2 size={11} /> : st === "disabled" ? <Ban size={11} /> : <Clock size={11} />}{f.systemField}{f.incremental ? " · key" : ""}</span>;
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * R8 + PRD v4 §5.3 — how this file says credit vs debit, checked against the status standardisation table (setup maker maintains, checker approves).
 * Values the table does not know are flagged; the maker asks for them to be added (setup maker adds, checker approves).
 */
function StatusValues({ mapping, table, meta, collections, act, me, isView }) {
  const statusField = mapping.fields.find((f) => f.systemField === "INSTRM_STATUS");
  const style = meta?.status?.style;
  const map = (collections.status_map || []);
  const lookup = (v) => map.find((r) => r.status === "active" && r.source.toUpperCase() === String(v).toUpperCase());
  const requested = (v) => map.find((r) => r.status === "requested" && r.source.toUpperCase() === String(v).toUpperCase());
  let values = [];
  if (statusField?.status === "mapped" && table) {
    const i = table.header.indexOf(statusField.mappedColumn);
    values = [...new Set(table.data.map((r) => (r[i] || "").trim()).filter(Boolean))];
  } else if (style === "sign") values = meta.status.values;
  if (!values.length && style !== "separate") return null;
  const ask = (v) => {
    const row = { id: uid("sm"), source: v, system: "", seenAt: mapping.bankName, table: "RECON_BANK_TXN", column: "INSTRM_STATUS", status: "requested", owner: me, createdAt: new Date().toISOString(), note: `Seen in ${mapping.bankName} sample` };
    const r = act({ screen: "mapping", cap: "edit", kind: "status_map", id: row.id, target: row, patch: () => row, audit: { entityLabel: `Status value “${v}”`, action: "Request status mapping", from: null, to: "Requested" } });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`Asked for “${v}” to be added to the status standardisation table`);
  };
  return (
    <div className="map-group" data-testid="status-values">
      <h4><Scale size={14} style={{ verticalAlign: -2 }} /> Credit / debit values in this file</h4>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>{meta?.status?.note}. Each value is converted with the status standardisation table.</p>
      {style === "separate" ? <Note kind="info">Credit and debit come from which amount column is filled — no status values to convert.</Note> : (
        <table className="map status-tbl"><thead><tr><th>Value in file</th><th>Rows in sample</th><th>System value</th><th /></tr></thead>
          <tbody>{values.map((v) => {
            const hit = lookup(v), req = requested(v);
            const i = statusField?.status === "mapped" && table ? table.header.indexOf(statusField.mappedColumn) : -1;
            const n = i >= 0 ? table.data.filter((r) => (r[i] || "").trim() === v).length : "—";
            return (
              <tr key={v} data-testid={"status-val-" + v}>
                <td className="tnum"><b>{v}</b></td><td className="tnum">{n}</td>
                <td>{hit ? <span className={"chip " + (hit.system === "CREDIT" ? "chip-previous" : "chip-manual")}>{hit.system}</span> : <span className="field-warn"><AlertTriangle size={12} /> Not in the table — rows with this value will be held</span>}</td>
                <td>{!hit && (req ? <span className="muted">Requested</span> : !isView && <button className="link" onClick={() => ask(v)} data-testid={"ask-admin-" + v}>Ask to add it</button>)}</td>
              </tr>
            );
          })}</tbody></table>
      )}
    </div>
  );
}

/** Format-change proposal from Bank files: old vs proposed, why, and confidence. Pre-fills the form; approval still required. */
function ProposalCard({ file, proposal, onApply, isView }) {
  return (
    <div className="proposal-card" data-testid="proposal-card">
      <div className="pc-head"><AlertTriangle size={15} /> <b>{file.bankName} changed its file layout</b> <span className="muted">— {proposal.summary} · {proposal.rowsHeld.toLocaleString("en-IN")} rows held in Bank files</span></div>
      <table className="grid compact"><thead><tr><th>Field</th><th>Approved layout</th><th>Proposed</th><th>Confidence</th></tr></thead>
        <tbody>{proposal.changes.map((c) => <tr key={c.field}><td className="tnum">{c.field}</td><td>{c.old || <span className="muted">not mapped</span>}</td><td><b>{c.proposed}</b><div className="muted">{c.reason}</div></td><td className="tnum">{Math.round(c.confidence * 100)}%</td></tr>)}</tbody></table>
      <div className="pc-foot"><span className="muted">The system suggests; it never switches the mapping on by itself. Allow these changes, then Submit for approval at the bottom — a checker approves before held rows load.</span>{!isView && <button className="btn btn-primary btn-sm" onClick={onApply} data-testid="apply-proposal">Allow these changes</button>}</div>
    </div>
  );
}
