import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, AlertTriangle, Loader2, Landmark, Plug, FileText, Columns3, CalendarDays, Scale, ArrowLeftRight, SlidersHorizontal, CopyPlus, Send, Sparkles, Info } from "lucide-react";
import { useStore } from "@/state/store";
import { BANK_MODES, RECON_TYPES } from "@/lib/constants";
import { BANKS, accountsFor, accountMeta } from "@/mock/bankMaster";
import { LIABILITY_CATEGORIES, sepLabel, extFor, defaultSchedule, scheduleText, EFFECTIVE_NOTE } from "@/lib/setupSchema";
import { maskAccount, uid } from "@/lib/format";
import FileDropZone from "@/components/FileDropZone";
import PreviewTable from "@/components/PreviewTable";
import { Toggle } from "@/components/bits";
import { analyseSample } from "./analyseSample";
import { toast } from "sonner";

const CHECKS = ["Reading the file", "Finding the bank and account", "Finding the header row and columns", "Mapping columns by name", "Reading the date format", "Checking for a closing balance", "Reading how credit / debit is marked", "Comparing with this bank's existing layouts"];
const SHORT = { auto: "Portal bot", manual: "SFTP", email: "Email", api: "API" };

/**
 * New account in three steps: drop a sample → confirm what we found → submit.
 * Every PRD field is still filled and stored; most come from the sample or the bank's connection, set up once.
 */
export default function QuickSetup() {
  const nav = useNavigate();
  const { collections, submit, upsert, currentUser } = useStore();
  const [step, setStep] = React.useState(0);
  const [file, setFile] = React.useState(null);
  const [checking, setChecking] = React.useState(-1);
  const [a, setA] = React.useState(null); // analysis
  const [f, setF] = React.useState(null); // the user's confirmed choices
  const set = (p) => setF((x) => ({ ...x, ...p }));

  const pick = (name) => {
    setFile(name); setChecking(0);
    let i = 0;
    const t = setInterval(() => { i++; setChecking(i); if (i >= CHECKS.length) { clearInterval(t); finish(name); } }, 190);
  };
  const finish = (name) => {
    const r = analyseSample(name, collections);
    if (!r) { toast.error("Couldn't read that file. Try one of the demo files, or set up by hand."); setChecking(-1); setFile(null); return; }
    const acc = r.account;
    const meta = acc ? accountMeta(acc.bankName, acc.accountNumber) : null;
    setA(r);
    setF({
      bankName: acc?.bankName || "", bankCode: acc?.bankCode || "", accountNumber: acc?.accountNumber || "", schemeCode: meta?.schemeCode || "", schemeName: meta?.schemeName || "", assetClass: meta?.assetClass || "",
      schemeOrCollection: "", priority: "low", reconciliationType: "Subscription", liabilityCategory: "",
      useConnection: Boolean(r.connection), channel: r.connection?.channel || "", conn: { sender: "", receiver: "recon.ops@camsonline.com", subjectPattern: "", url: "", loginId: "", _pw: "" }, schedule: defaultSchedule(),
      dateOrder: r.date.ambiguous ? null : "DMY", proc: { bulkUpload: false, directMatch: false, descendingOrder: false, runningBalanceCleanup: false, cleanupChars: "", computeRunningBalance: !r.balance.present, isActive: true },
      showProc: false, more: "", fileType: r.fileType, startRow: r.startRow,
    });
    setChecking(-1); setStep(1);
  };

  // ── Step 2: what still needs a person ──
  const needs = f && a ? [
    !f.bankName || !f.accountNumber ? "bank" : null,
    !f.schemeOrCollection ? "type" : null,
    !f.useConnection && !f.channel ? "channel" : null,
    !f.useConnection && f.channel === "email" && (!f.conn.sender || !f.conn.subjectPattern) ? "channel" : null,
    !f.useConnection && ["auto", "api"].includes(f.channel) && (!f.conn.url || !f.conn.loginId || !f.conn._pw) ? "channel" : null,
    !a.standard && !f.dateOrder ? "date" : null,
    f.reconciliationType === "Liability" && !f.liabilityCategory ? "type" : null,
    f.proc.runningBalanceCleanup && !f.proc.cleanupChars.trim() ? "proc" : null,
  ].filter(Boolean) : [];
  const needSet = new Set(needs);
  const bankConn = f && (collections.bank_connections || []).find((b) => b.bankName === f.bankName && b.status !== "rejected");
  const configured = new Set((collections.bank_config || []).map((c) => c.accountNumber));
  const extra = f ? f.more.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean) : [];
  const extraOk = extra.map((n) => { const hit = accountsFor(f.bankName).find((x) => x.accountNumber === n || x.accountNumber.endsWith(n)); return { n, hit, dup: hit && configured.has(hit.accountNumber) }; });
  const accounts = f ? [f.accountNumber, ...extraOk.filter((x) => x.hit && !x.dup).map((x) => x.hit.accountNumber)].filter((v, i, s) => v && s.indexOf(v) === i) : [];

  const buildConfig = (acct) => {
    const m = accountMeta(f.bankName, acct) || {};
    const conn = f.useConnection && bankConn ? { ...bankConn.connection } : f.channel === "email" ? { sender: f.conn.sender, receiver: f.conn.receiver, subjectPattern: f.conn.subjectPattern, attachmentPattern: "", zipOption: "none" } : f.channel === "manual" ? {} : { url: f.conn.url, path: "", corporateId: "", loginId: f.conn.loginId, passwordSet: true, schedule: f.schedule };
    return {
      id: uid("bc"), kind: "bank_config", sno: (collections.bank_config || []).length + 1, downloadMode: f.useConnection && bankConn ? bankConn.channel : f.channel,
      bankName: f.bankName, bankCode: f.bankCode, accountNumber: acct, schemeOrCollection: f.schemeOrCollection, schemeCode: m.schemeCode || "", schemeName: m.schemeName || "", assetClass: m.assetClass || "",
      maskedPattern: "", priority: f.priority, formatName: a.layoutMatch?.formatName || "", rejection: null, owner: currentUser,
      connection: conn,
      fileConfig: { fileType: f.fileType, separator: a.separator, startRow: a.standard ? "" : f.startRow, startColumn: a.startColumn, uploadPath: bankConn?.sftpFolder || "", uploadUser: "", uploadPasswordSet: true,
        fileNamePattern: `${f.bankCode}_${acct.slice(-4)}_\\d{8}\\.${extFor(f.fileType)}`, sampleFileName: a.fileName, detected: { fileType: true, separator: true, startRow: true, startColumn: true }, edited: {} },
      processing: { ...f.proc, validateRunningBalance: true, reconciliationType: f.reconciliationType, liabilityCategory: f.reconciliationType === "Liability" ? f.liabilityCategory : "" },
      createdFrom: "sample",
    };
  };

  const doSubmit = () => {
    accounts.forEach((acct) => submit("bank_config", buildConfig(acct), `${f.bankName} · ${maskAccount(acct)}`));
    if (!f.useConnection && !bankConn) {
      upsert("bank_connections", { id: uid("bconn"), bankName: f.bankName, bankCode: f.bankCode, channel: f.channel, connection: buildConfig(f.accountNumber).connection, schedule: f.schedule, sftpFolder: `/inbound/${f.bankName.split(" ")[0].toLowerCase()}/`, status: "pending", owner: currentUser, updatedAt: new Date().toISOString() });
    }
    if (!a.standard && !a.mappingExists) {
      const fields = a.mapping.fields.concat([]);
      submit("bank_mapping", { id: uid("bm"), kind: "bank_mapping", type: "bank", sno: (collections.bank_mapping || []).length + 1, bankName: f.bankName, formatName: "", accountNumber: f.accountNumber, fileType: f.fileType, owner: currentUser, sampleFileName: a.fileName, headerRow: Number(f.startRow) || 1, headerConfirmed: true, dateFormat: f.dateOrder === "MDY" ? "MM/DD/YYYY" : "DD/MM/YYYY", createdAt: new Date().toISOString(), rejection: null, fields, narrationSplit: false, overrides: 0 }, `${f.bankName} mapping (from sample)`);
    }
    toast.success(`${accounts.length} account${accounts.length > 1 ? "s" : ""} sent to a checker${!a.standard && !a.mappingExists ? " with the column mapping" : ""}. Live from the next file after approval.`);
    nav("/bank-setup?status=pending");
  };

  return (
    <div className="qs" data-testid="quick-setup">
      <button className="link" onClick={() => nav("/bank-setup")}><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Bank statement setup</button>
      <h1>Add a bank account</h1>
      <ol className="qs-steps">{["Drop a sample", "Confirm what we found", "Submit"].map((l, i) => <li key={l} className={i === step ? "on" : i < step ? "done" : ""}><span>{i < step ? <Check size={13} /> : i + 1}</span>{l}</li>)}</ol>

      {step === 0 && (
        <div className="card qs-card">
          {checking < 0 ? (<>
            <h2>Start with one real statement from this account</h2>
            <p className="muted">We read it and fill in the bank, account, layout, column mapping, date format and balance checks. You only confirm.</p>
            <FileDropZone fileName={file} onPick={pick} onClear={() => setFile(null)} hint="Drop a statement (CSV, Excel, TXT, or a bank standard format like MT940)" />
            <div className="qs-alt"><span className="muted">No sample to hand?</span> <button className="link" onClick={() => nav("/bank-setup/new/manual")} data-testid="qs-manual">Set up by hand instead</button></div>
          </>) : (
            <div className="qs-reading" data-testid="qs-reading">
              <h2><Sparkles size={18} /> Reading {file}</h2>
              <ul>{CHECKS.map((c, i) => <li key={c} className={i < checking ? "done" : i === checking ? "now" : ""}>{i < checking ? <CheckCircle2 size={15} /> : i === checking ? <Loader2 size={15} className="spin" /> : <span className="qs-dot" />}{c}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {step === 1 && f && a && (<>
        <div className="qs-summary" data-testid="qs-summary">
          <span><CheckCircle2 size={16} /> <b>{["bank", "channel", "layout", ...(a.standard ? [] : ["mapping", "date"]), "balance", "status", "proc"].filter((k) => !needSet.has(k)).length}</b> found automatically</span>
          {needs.length > 0 ? <span className="need"><AlertTriangle size={16} /> <b>{new Set(needs).size}</b> need{new Set(needs).size === 1 ? "s" : ""} you — highlighted below</span> : <span className="ok">Everything is answered</span>}
        </div>

        <Finding icon={Landmark} title="Bank and account" need={needSet.has("bank")} conf={a.account && f.accountNumber === a.account.accountNumber ? a.account.score : null}
          value={f.accountNumber ? `${f.bankName} · ${maskAccount(f.accountNumber)} — ${f.schemeName}` : "Couldn't read the account from the file"}
          detail={a.account ? `The file says “${a.account.printedBank}”, account ${a.account.printedAcct}` : "Pick the bank and account below"}>
          <div className="qs-row">
            <select className="select" value={f.bankName} onChange={(e) => { const b = BANKS.find((x) => x.name === e.target.value); set({ bankName: e.target.value, bankCode: b?.code || "", accountNumber: "", useConnection: Boolean((collections.bank_connections || []).find((x) => x.bankName === e.target.value)), channel: (collections.bank_connections || []).find((x) => x.bankName === e.target.value)?.channel || "" }); }} data-testid="qs-bank"><option value="">Bank…</option>{BANKS.map((b) => <option key={b.code}>{b.name}</option>)}</select>
            <select className="select tnum" value={f.accountNumber} disabled={!f.bankName} onChange={(e) => { const m = accountMeta(f.bankName, e.target.value); set({ accountNumber: e.target.value, schemeCode: m?.schemeCode || "", schemeName: m?.schemeName || "", assetClass: m?.assetClass || "" }); }} data-testid="qs-account"><option value="">Account…</option>{accountsFor(f.bankName).map((x) => <option key={x.accountNumber} value={x.accountNumber}>{maskAccount(x.accountNumber)} — {x.schemeName}{configured.has(x.accountNumber) ? " (already set up)" : ""}</option>)}</select>
          </div>
          {f.accountNumber && configured.has(f.accountNumber) && <div className="qs-warn"><AlertTriangle size={13} /> This account already has a setup. Submitting adds another layout for it (e.g. an emailed or end-of-day file).</div>}
        </Finding>

        <Finding icon={Landmark} title="About this account" need={needSet.has("type")} value={f.schemeOrCollection ? `${f.schemeOrCollection} account · ${f.reconciliationType}${f.liabilityCategory ? " · " + f.liabilityCategory : ""} · ${f.priority === "high" ? "high" : "normal"} priority` : "Tell us what kind of account this is"} detail="Only you know these">
          <div className="qs-row">
            <div className="segmented">{["Scheme", "Collection"].map((t) => <button key={t} className={f.schemeOrCollection === t ? "on" : ""} onClick={() => set({ schemeOrCollection: t })} data-testid={"qs-type-" + t}>{t}</button>)}</div>
            <div className="segmented">{RECON_TYPES.map((t) => <button key={t} className={f.reconciliationType === t ? "on" : ""} onClick={() => set({ reconciliationType: t, liabilityCategory: t === "Liability" ? f.liabilityCategory : "" })}>{t}</button>)}</div>
            {f.reconciliationType === "Liability" && <select className="select" style={{ maxWidth: 180 }} value={f.liabilityCategory} onChange={(e) => set({ liabilityCategory: e.target.value })}><option value="">Liability type…</option>{LIABILITY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>}
            <div className="segmented" title="High-priority accounts are fetched first in each download window">{[["low", "Normal priority"], ["high", "High priority"]].map(([v, l]) => <button key={v} className={f.priority === v ? "on" : ""} onClick={() => set({ priority: v })}>{l}</button>)}</div>
          </div>
        </Finding>

        <Finding icon={Plug} title="How statements arrive" need={needSet.has("channel")} inherited={Boolean(f.useConnection && bankConn)}
          value={f.useConnection && bankConn ? `${BANK_MODES[bankConn.channel].label} — ${f.bankName}'s connection, already set up` : f.channel ? `${BANK_MODES[f.channel].label} — new connection for ${f.bankName || "this bank"}` : "This bank has no connection yet — how do its statements come in?"}
          detail={f.useConnection && bankConn ? `${bankConn.channel === "manual" ? `SFTP folder ${bankConn.sftpFolder}` : bankConn.channel === "email" ? `From ${bankConn.connection?.sender || "the bank"}` : scheduleText(bankConn.schedule)} · set once for the bank, every account uses it` : "Set once for the bank. Later accounts reuse it."}>
          {bankConn && <label className="qs-check"><input type="checkbox" className="cb" checked={!f.useConnection} onChange={(e) => set({ useConnection: !e.target.checked, channel: e.target.checked ? "" : bankConn.channel })} data-testid="qs-own-channel" /> This account's statements arrive differently (e.g. by email instead)</label>}
          {!f.useConnection && <>
            <div className="qs-chan">{Object.entries(BANK_MODES).map(([k, m]) => <button key={k} className={f.channel === k ? "on" : ""} onClick={() => set({ channel: k })} data-testid={"qs-ch-" + k}><m.icon size={16} /><b>{SHORT[k]}</b><span>{m.desc}</span></button>)}</div>
            {f.channel === "email" && <div className="qs-row"><input className="input" placeholder="Sender, e.g. statements@bank.com" value={f.conn.sender} onChange={(e) => set({ conn: { ...f.conn, sender: e.target.value } })} data-testid="qs-sender" /><input className="input" placeholder="Subject, % for the changing part" value={f.conn.subjectPattern} onChange={(e) => set({ conn: { ...f.conn, subjectPattern: e.target.value } })} data-testid="qs-subject" /></div>}
            {["auto", "api"].includes(f.channel) && <div className="qs-row"><input className="input" placeholder="Portal / API URL" value={f.conn.url} onChange={(e) => set({ conn: { ...f.conn, url: e.target.value } })} /><input className="input" placeholder="Login ID" value={f.conn.loginId} onChange={(e) => set({ conn: { ...f.conn, loginId: e.target.value } })} /><input className="input" type="password" placeholder="Password (goes to the vault)" value={f.conn._pw} onChange={(e) => set({ conn: { ...f.conn, _pw: e.target.value } })} /></div>}
            {f.channel === "manual" && <div className="qs-note"><Info size={13} /> Files are picked up from the AMC's SFTP folder automatically; nothing else to enter.</div>}
          </>}
        </Finding>

        <Finding icon={FileText} title="File layout" conf={0.97}
          value={a.standard ? `${a.fileType} — bank standard format, read by a built-in reader` : `${a.fileType}${a.separator ? " · " + sepLabel(a.separator).split(" ")[0].toLowerCase() + "-separated" : ""} · header on row ${f.startRow} · starts at column ${a.startColumn}`}
          detail={a.standard ? "No column mapping needed" : a.layoutMatch ? `Same layout as ${f.bankName}'s existing ${a.layoutMatch.formatName || "setup"} — nothing new to approve` : `New layout for ${f.bankName || "this bank"}`}>
          {!a.standard && <details className="qs-details"><summary>See the sample and change the header row</summary><PreviewTable {...a.preview} maxRows={40} headerIdx={(Number(f.startRow) || 1) - 1} onPickRow={(i) => set({ startRow: String(i + 1) })} caption="Click the row that holds the column names" /></details>}
        </Finding>

        {!a.standard && (
          <Finding icon={Columns3} title="Column mapping" conf={a.mapping.lowConf ? 0.88 : 0.97}
            value={a.mappingExists ? `${f.bankName} already has an approved mapping — this account uses it` : `${a.mapping.mappedCount} fields mapped by column name${a.mapping.lowConf ? ` · ${a.mapping.lowConf} to glance at` : ""}`}
            detail={a.mappingExists ? "No mapping work" : `Duplicate check on ${a.mapping.keys.keys.length} columns · submitted with this setup for the checker`}>
            {!a.mappingExists && <div className="qs-maps">{a.mapping.fields.filter((x) => x.status === "mapped").map((x) => <span key={x.systemField} className={x.conf < 0.9 ? "low" : ""}><b>{x.mappedColumn}</b> → {x.systemField}<em>{Math.round(x.conf * 100)}%</em></span>)}</div>}
          </Finding>
        )}

        {!a.standard && (
          <Finding icon={CalendarDays} title="Date format" need={needSet.has("date")} value={f.dateOrder ? `${f.dateOrder === "DMY" ? "Day first" : "Month first"} — e.g. ${a.date.sample}` : `“${a.date.sample}” could be 3 April or 4 March`} detail={a.date.ambiguous ? "Please confirm once" : "Read from the file"}>
            {a.date.ambiguous && <div className="qs-row"><button className={"btn btn-sm " + (f.dateOrder === "DMY" ? "btn-primary" : "btn-outline")} onClick={() => set({ dateOrder: "DMY" })} data-testid="qs-dmy">Day first (3 April)</button><button className={"btn btn-sm " + (f.dateOrder === "MDY" ? "btn-primary" : "btn-outline")} onClick={() => set({ dateOrder: "MDY" })}>Month first (4 March)</button></div>}
          </Finding>
        )}

        <Finding icon={Scale} title="Closing balance" conf={0.99} value={a.balance.present ? "The bank gives a closing balance — every file is checked against it" : "The bank gives no closing balance — we compute it from our data"} detail={a.balance.present ? "Validation is always on" : "Marked “computed, not bank-verified”"} />

        <Finding icon={ArrowLeftRight} title="Credit and debit" conf={a.status.unknown.length ? 0.7 : 0.98} need={false}
          value={a.status.note || "Separate credit and debit columns"} detail={a.status.unknown.length ? `“${a.status.unknown.join(", ")}” isn't in the status table yet — rows with it are held until an admin adds it` : a.status.values.length ? `Values seen: ${a.status.values.join(", ")} — all known` : "Nothing to convert"} warn={a.status.unknown.length > 0} />

        <Finding icon={SlidersHorizontal} title="Processing" need={needSet.has("proc")} value={`Standard: ${f.proc.computeRunningBalance ? "balance computed" : "balance validated"} · direct match ${f.proc.directMatch ? "on" : "off"} · ${f.proc.descendingOrder ? "newest first" : "oldest first"} · active on approval`} detail={f.showProc ? "" : "Most accounts keep these"}>
          <button className="link" onClick={() => set({ showProc: !f.showProc })} data-testid="qs-proc-toggle">{f.showProc ? "Hide" : "Change"}</button>
          {f.showProc && <div className="qs-proc">
            {[["bulkUpload", "Bulk upload — several accounts in one file"], ["directMatch", "Direct match — only for UPI collection accounts"], ["descendingOrder", "File is newest-first"], ["runningBalanceCleanup", "Strip characters from the balance (e.g. Cr)"], ["isActive", "Active once approved"]].map(([k, l]) => (
              <label key={k} className="qs-tog"><Toggle checked={f.proc[k]} onChange={(v) => set({ proc: { ...f.proc, [k]: v } })} id={"qs-" + k} /><span>{l}</span></label>
            ))}
            {f.proc.runningBalanceCleanup && <input className="input" style={{ maxWidth: 200 }} placeholder="Characters, e.g. Cr" value={f.proc.cleanupChars} onChange={(e) => set({ proc: { ...f.proc, cleanupChars: e.target.value } })} />}
          </div>}
        </Finding>

        <Finding icon={CopyPlus} title="Add more accounts like this (optional)" value={extraOk.length ? `${extraOk.filter((x) => x.hit && !x.dup).length} more ${f.bankName} account(s) will get the same setup` : `Same bank, same layout? Paste their account numbers or last 4 digits`} detail="Each one is still approved by a checker">
          <textarea className="textarea" rows={2} placeholder="e.g. 4489, 4511" value={f.more} onChange={(e) => set({ more: e.target.value })} data-testid="qs-more" />
          {extraOk.length > 0 && <div className="qs-maps">{extraOk.map((x) => <span key={x.n} className={!x.hit || x.dup ? "low" : ""}>{x.hit ? maskAccount(x.hit.accountNumber) : x.n}<em>{!x.hit ? "not found" : x.dup ? "already set up" : "added"}</em></span>)}</div>}
        </Finding>

        <div className="qs-foot">
          <button className="btn btn-outline" onClick={() => { setStep(0); setFile(null); }}><ArrowLeft size={15} /> Use another file</button>
          <button className="btn btn-primary" disabled={needs.length > 0} onClick={() => setStep(2)} data-testid="qs-next">{needs.length ? `Answer ${new Set(needs).size} more to continue` : <>Review <ArrowRight size={15} /></>}</button>
        </div>
      </>)}

      {step === 2 && f && a && (
        <div className="card qs-card" data-testid="qs-review">
          <h2>Ready to send to a checker</h2>
          <ul className="qs-review">
            <li><b>{accounts.length} account{accounts.length > 1 ? "s" : ""}</b>: {accounts.map((x) => `${f.bankName} ${maskAccount(x)}`).join(", ")}</li>
            <li>Arrives by <b>{BANK_MODES[f.useConnection && bankConn ? bankConn.channel : f.channel].label}</b>{f.useConnection && bankConn ? " — the bank's existing connection" : " — new connection for the bank (approved with this)"}</li>
            <li>Layout <b>{a.standard ? a.fileType + " (standard)" : `${a.fileType}, header row ${f.startRow}`}</b>{a.layoutMatch ? " — same as an approved layout" : ""}</li>
            <li>{a.standard || a.mappingExists ? "No column mapping work" : <>Column mapping with <b>{a.mapping.mappedCount}</b> fields goes to the checker too</>}</li>
            <li>{f.schemeOrCollection} account · {f.reconciliationType}{f.liabilityCategory ? ` · ${f.liabilityCategory}` : ""} · {f.priority === "high" ? "high" : "normal"} priority · balance {f.proc.computeRunningBalance ? "computed" : "validated"}</li>
          </ul>
          <div className="qs-note"><Info size={13} /> {EFFECTIVE_NOTE} Every field is stored in the setup and can be opened in full later.</div>
          <div className="qs-foot">
            <button className="btn btn-outline" onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</button>
            <button className="btn btn-success" onClick={doSubmit} data-testid="qs-submit"><Send size={15} /> Send for approval</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One finding: what the system decided (with how sure it is), or what it needs from you. */
function Finding({ icon: Icon, title, value, detail, conf, need, warn, inherited, children }) {
  return (
    <div className={"card qs-find" + (need ? " need" : warn ? " warn" : "")} data-testid={"find-" + title.split(" ")[0].toLowerCase()}>
      <span className="qs-ico"><Icon size={17} /></span>
      <div className="qs-body">
        <div className="qs-top"><span className="qs-title">{title}</span>{need ? <span className="qs-badge need">Needs you</span> : inherited ? <span className="qs-badge">From the bank's connection</span> : conf != null ? <span className={"qs-badge" + (conf < 0.9 ? " mid" : "")}>{`${Math.round(conf * 100)}% sure`}</span> : null}</div>
        <b className="qs-value">{value}</b>
        {detail && <span className="qs-detail">{detail}</span>}
        {children && <div className="qs-edit">{children}</div>}
      </div>
    </div>
  );
}
