// Shared rules for the Phase-1 setup screens (bank statement setup, Credit MIS setup, column mapping).
// Field names and allowed values follow Recon_PRD_v1 / Credit_MIS_PRD / Phase-1 PRD v4.
// Additions from PHASE1_SETUP_RESEARCH.md ([Fits PRD] only) are marked with their R-number.

import { maskAccount } from "@/lib/format";

// PRD v1 "File Type": DBF, XLS, XLSX, PSV, CSV, PDF, TXT, XXD "and any other file formats supported".
export const FILE_TYPES = ["CSV", "PSV", "TXT", "XLS", "XLSX", "DBF", "PDF", "XXD"];
// R2 — bank-standard statement formats with pre-built parsers (no column mapping needed).
export const STANDARD_FORMATS = {
  MT940: "SWIFT MT940 — end-of-day statement",
  MT942: "SWIFT MT942 — intraday statement",
  "CAMT.053": "ISO 20022 camt.053 — end-of-day statement",
  BAI2: "BAI2 — US/International cash-management file",
};
export const isStandard = (t) => Boolean(STANDARD_FORMATS[t]);
export const isDelimited = (t) => ["CSV", "PSV", "TXT"].includes(t);
// PRD v1 "File Separator": special characters only.
export const SEPARATORS = [["|", "Pipe |"], ["-", "Hyphen -"], [",", "Comma ,"], ["/", "Slash /"], [" ", "Space"], ["\t", "Tab"], ["$", "Dollar $"], ["~", "Tilde ~"], ["^", "Caret ^"]];
export const sepLabel = (s) => (SEPARATORS.find(([v]) => v === s) || [s, s || "—"])[1];

export const LIABILITY_CATEGORIES = ["Redemption", "Dividend", "Refund", "Brokerage"];
// Credit MIS PRD — Instrument Status (optional) and Failure Reason Code (from Reversal Remarks table, active codes only).
export const INSTRUMENT_STATUS = [["C", "C (Credit)"], ["D", "D (Debit)"]];
export const REVERSAL_CODES = [
  { code: "R01", remark: "Insufficient funds", active: true },
  { code: "R02", remark: "Account closed", active: true },
  { code: "R03", remark: "No such account", active: true },
  { code: "R04", remark: "Invalid account number", active: true },
  { code: "R09", remark: "Mandate expired / not registered", active: true },
  { code: "R14", remark: "Payment stopped by investor", active: true },
  { code: "R17", remark: "Account frozen", active: true },
  { code: "R99", remark: "Legacy — unspecified", active: false },
];

// R6 — what an email-mode setup accepts as attachments, given the file type.
export const attachmentTypesFor = (fileType, zip) => {
  const ext = { CSV: [".csv"], PSV: [".psv", ".txt"], TXT: [".txt"], XLS: [".xls"], XLSX: [".xlsx"], DBF: [".dbf"], PDF: [".pdf"], XXD: [".xxd"], MT940: [".sta", ".mt940", ".txt"], MT942: [".mt942", ".txt"], "CAMT.053": [".xml"], BAI2: [".bai", ".bai2", ".txt"] }[fileType] || [];
  return zip && zip !== "none" ? [...ext, ".zip"] : ext;
};
export const CAMS_DOMAIN = "@camsonline.com";
export const extFor = (fileType) => (attachmentTypesFor(fileType)[0] || ".csv").slice(1);

// ── Pattern testing (R4 file-name pattern, R6 subject %like%, CMIS match type) ──────────────────────
export function regexFor(pattern, kind = "regex") {
  if (!pattern) return null;
  try {
    if (kind === "like") return new RegExp("^" + pattern.split("%").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
    if (kind === "Prefix") return new RegExp("^" + esc(pattern), "i");
    if (kind === "Suffix") return new RegExp(esc(pattern) + "$", "i");
    if (kind === "Contains") return new RegExp(esc(pattern), "i");
    if (kind === "Exact") return new RegExp("^" + esc(pattern) + "$", "i");
    return new RegExp("^" + pattern + "$");
  } catch (e) { return "invalid"; }
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function testNames(pattern, kind, names) {
  const re = regexFor(pattern, kind);
  if (re === "invalid") return { invalid: true, results: [] };
  return { invalid: false, results: names.map((n) => ({ name: n, ok: re ? re.test(n) : false })) };
}
/** Example names the bank / aggregator actually sends — used for the live pattern preview. */
export function exampleFileNames(bankCode = "BANK", acct = "0000", ext = "csv") {
  const a = String(acct).slice(-4);
  return [`${bankCode}_${a}_20261020.${ext}`, `${bankCode}_${a}_20261021.${ext}`, `${bankCode}_${a}_20261021_rev1.${ext}`, `${bankCode}_9911_20261021.${ext}`, `statement_${a}.pdf`];
}
export function exampleSubjects(bankName = "Bank", acct = "0000") {
  const a = String(acct).slice(-4);
  return [`${bankName} Account Statement ${a} dated 20-10-2026`, `${bankName} Account Statement ${a} dated 21-10-2026`, `FW: ${bankName} Account Statement ${a} dated 21-10-2026`, `${bankName} Interest Certificate ${a}`];
}

// ── R5 schedule ─────────────────────────────────────────────────────────────────────────────────────
export const defaultSchedule = () => ({ kind: "interval", every: 30, at: "08:30", from: "07:00", to: "21:00" });
export const scheduleText = (s) => !s ? "—" : s.kind === "daily" ? `Daily at ${s.at}` : `Every ${s.every} min, ${s.from}–${s.to}`;

/** R5 — simulated "Test connection": a real build calls the bank once with the saved credentials and shows the first rows. */
export function simulateTest(conn, mode) {
  const missing = mode === "email" ? [] : ["url", "loginId"].filter((k) => !conn[k]);
  if (missing.length) return { ok: false, message: `Fill ${missing.map((m) => (m === "url" ? "URL" : "Login ID")).join(" and ")} first.` };
  if (/fail|wrong/i.test(conn.loginId || "")) return { ok: false, message: "Bank rejected the login (HTTP 401). Check Login ID / password with the bank RM." };
  return {
    ok: true, ms: 640 + Math.round(Math.random() * 400), message: "Connected. The bank returned yesterday's statement.",
    rows: [["20-10-2026", "UPI/RAZORPAY/SIP/88213", "25,000.00", "CR"], ["20-10-2026", "NEFT/CAMSPAY/SUB/77120", "1,50,000.00", "CR"], ["20-10-2026", "RTGS/REDEMPTION/PAYOUT", "80,000.00", "DR"]],
  };
}

// ── R7 — summary + diff vs the last approved version ───────────────────────────────────────────────
const onOff = (v) => (v ? "On" : "Off");
export function summarizeSetup(r) {
  if (!r) return [];
  const fc = r.fileConfig || {}, p = r.processing || {}, c = r.connection || {};
  if (r._kind === "bank_mapping" || r.kind === "bank_mapping") {
    return (r.fields || []).filter((f) => f.status === "mapped" || f.incremental || f.mandatory).map((f) => [f.systemField, `${f.mappedColumn || "—"}${f.mandatory ? " · Required" : ""}${f.incremental ? " · Incremental" : ""}`]).concat([["Date format", r.dateFormat || "—"], ["Narration split", onOff(r.narrationSplit)]]);
  }
  if (r.kind === "credit_config" || r._kind === "credit_config") {
    return [
      ["Feed mode", r.feedMode], ["Bank", r.bankName], ["Account", maskAccount(r.accountNumber)], ["Payment aggregator", paLabel(r.paCode || (r.paCodes || [])[0])], ["Feed option", feedOptionLabel(r.feedOption)], ["Reversal code", (r.fileConfig || {}).reversalCode || "—"],
      ["File format", fc.fileFormat], ["Separator", isDelimited(fc.fileFormat) ? sepLabel(fc.separator) : "—"], ["Header position", `${fc.startRow || "—"}, ${fc.startColumn || "—"}`],
      ["Instrument status", fc.instrumentStatus || "Not selected"], ["Failure reason code", fc.failureReasonCode || "—"],
      ["From email", c.fromEmail], ["Receiver email", c.receiverEmail], ["Subject", c.subject], ["File name pattern", c.fileNamePattern ? `${c.matchType || ""} ${c.fileNamePattern}` : ""],
      ["ZIP", c.zipOption], ["Schedule", r.feedMode === "auto" ? scheduleText(c.schedule) : ""],
      ["Reconciliation type", p.reconciliationType === "Liability" ? `Liability · ${p.liabilityCategory || "—"}` : p.reconciliationType], ["Date & time update", onOff(p.dateTimeUpdate)], ["Is active", onOff(p.isActive)],
    ].filter(([, v]) => v !== "" && v !== undefined);
  }
  return [
    ["Download mode", r.downloadMode], ["Bank", r.bankName], ["Account", r.accountNumber ? maskAccount(r.accountNumber) : "Derived from file"], ["Scheme / Collection", r.schemeOrCollection], ["Masked account pattern", r.maskedPattern || "—"],
    ["URL", c.url], ["File download path", c.path], ["Corporate ID", c.corporateId], ["Login ID", c.loginId], ["Schedule", ["auto", "api"].includes(r.downloadMode) ? scheduleText(c.schedule) : ""],
    ["Sender", c.sender], ["Receiver", c.receiver], ["Subject pattern", c.subjectPattern], ["Attachment name pattern", c.attachmentPattern], ["ZIP", r.downloadMode === "email" ? (c.zipOption || "none") : ""],
    ["File type", fc.fileType], ["Separator", isDelimited(fc.fileType) ? sepLabel(fc.separator) : "—"], ["Start row", isStandard(fc.fileType) ? "n/a (standard format)" : String(fc.startRow ?? "")], ["Start column", isStandard(fc.fileType) ? "n/a (standard format)" : String(fc.startColumn ?? "")],
    ["File upload path", fc.uploadPath], ["File name pattern", fc.fileNamePattern],
    ["Bulk upload", onOff(p.bulkUpload)], ["Compute running balance", onOff(p.computeRunningBalance)], ["Validate running balance", onOff(p.validateRunningBalance)],
    ["Running balance cleanup", p.runningBalanceCleanup ? `On · remove "${p.cleanupChars || ""}"` : "Off"], ["Direct match", onOff(p.directMatch)], ["Descending order", onOff(p.descendingOrder)],
    ["Reconciliation type", p.reconciliationType], ["Is active", onOff(p.isActive)],
  ].filter(([, v]) => v !== "" && v !== undefined);
}
export function diffSetup(base, cur) {
  if (!base) return null;
  const a = Object.fromEntries(summarizeSetup(base)), b = Object.fromEntries(summarizeSetup(cur));
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => (a[k] ?? "—") !== (b[k] ?? "—")).map((k) => ({ field: k, from: a[k] ?? "—", to: b[k] ?? "—" }));
}
export const EFFECTIVE_NOTE = "Takes effect from the next file received after approval. Files already loaded are not re-processed.";

// ── R3 — duplicate-key (Incremental flag) suggestion from the sample ───────────────────────────────
/** Smallest set of mapped columns (min 3, PRD) whose combined values are unique on every sample row. */
export function suggestIncremental(fields, header, dataRows) {
  const colIdx = (name) => header.indexOf(name);
  const order = ["VALUE_DATE", "INSTRM_AMOUNT", "INSTRM_AMOUNT_CREDIT", "UTR_NUMBER", "INSTRM_NO", "BANK_NARRATION", "BANK_DESCRIPTION", "CLOSING_BALANCE", "BANK_STMT_DATE"];
  const rank = (f) => { const i = order.indexOf(f.systemField); return i === -1 ? 99 : i; };
  const isUnique = (set) => new Set(dataRows.map((r) => set.map((p) => r[colIdx(p.mappedColumn)]).join("¦"))).size === dataRows.length;
  const picked = [];
  // Business keys first (date, amount, reference, narration); keep adding until every sample row is unique.
  fields.filter((f) => f.status === "mapped" && f.group === "input" && colIdx(f.mappedColumn) >= 0)
    .sort((x, y) => rank(x) - rank(y))
    .forEach((f) => { if (picked.length < 3 || !isUnique(picked)) picked.push(f); });
  return { keys: picked.map((f) => f.systemField), unique: isUnique(picked), rows: dataRows.length };
}

// ── PRD v1 column-mapping field list ("Only the list of fields mentioned above must be incorporated") ──
export const MAPPING_FIELDS = [
  ["INSTRM_AMOUNT", "Bank credit/debit amount", "amount"], ["INSTRM_AMOUNT_CREDIT", "Bank credit amount", "amount"], ["INSTRM_AMOUNT_DEBIT", "Bank debit amount", "amount"],
  ["INSTRM_STATUS", "Bank credit/debit status (C/D, CR/DR)", "status"], ["VALUE_DATE", "Bank credit/value date", "date"], ["BANK_DESCRIPTION", "Bank statement description/narration", "text"],
  ["BANK_NARRATION", "Bank statement narration", "text"], ["BANK_STMT_DATE", "Bank transaction date", "date"], ["INSTRM_NO", "Cheque/instrument number", "text"],
  ["UTR_NUMBER", "UTR/transaction reference number", "text"], ["LOCATION_CODE", "Entry received location", "text"], ["BANK_AC_NO", "MF bank account number", "text"],
  ["BANK_NAME", "MF bank name", "text"], ["CLOSING_BALANCE", "Running balance", "amount"], ["BANK_CREDIT_TIME", "Bank credit time/value date", "date"],
];
export const NARRATION_FIELDS = [
  ["EXTRACT_FOLIO_NO", "Extracted folio number"], ["EXTRACT_SCHEME_CODE", "Extracted scheme code"], ["EXTRACT_INSTRUMENT_DATE", "Extracted instrument date"],
  ["EXTRACT_INVESTOR_ACCOUNT_NUMBER", "Extracted investor account number"], ["EXTRACT_INVESTOR_BANK_NAME", "Extracted investor bank name"], ["EXTRACT_INVESTOR_NAME", "Extracted investor name"],
  ["EXTRACT_INVESTOR_IFSC", "Extracted investor IFSC"], ["EXTRACT_INVESTOR_AC_TYPE", "Extracted investor account type"], ["EXTRACT_NARRATION_UTR_NUMBER", "Extracted UTR number from narration"], ["EXTRACT_PAN", "Extracted PAN from narration"],
];
// R3 — header names banks actually use for each field (map by name first, position only as fallback).
export const HEADER_SYNONYMS = {
  INSTRM_AMOUNT: [/^amount$/i, /^txn ?amount$/i, /^transaction amount$/i],
  INSTRM_AMOUNT_CREDIT: [/^credit$/i, /^deposit/i, /^cr amount$/i, /^credit amount$/i],
  INSTRM_AMOUNT_DEBIT: [/^debit$/i, /^withdrawal/i, /^dr amount$/i, /^debit amount$/i],
  INSTRM_STATUS: [/^dr\/cr$/i, /^cr\/dr$/i, /^type$/i, /^status$/i, /^c\/d$/i],
  VALUE_DATE: [/^value ?date$/i, /^value dt$/i],
  BANK_DESCRIPTION: [/^description$/i, /^particulars$/i, /^remarks$/i],
  BANK_NARRATION: [/^narration$/i, /^details$/i],
  BANK_STMT_DATE: [/^txn ?date$/i, /^tran(saction)? ?date$/i, /^date$/i, /^posting date$/i],
  INSTRM_NO: [/^cheque ?no/i, /^chq/i, /^instrument/i],
  UTR_NUMBER: [/^utr/i, /^ref(erence)? ?no/i, /^ref$/i],
  CLOSING_BALANCE: [/balance/i],
  BANK_AC_NO: [/^a\/?c ?no/i, /^account ?(no|number)$/i],
};
export function matchHeader(systemField, header) {
  return (HEADER_SYNONYMS[systemField] || []).some((re) => re.test(String(header).trim()));
}

// ── Credit MIS masters ─────────────────────────────────────────────────────────────────────────────
// Payment aggregator codes, one per file, including sub-types. PLACEHOLDER identifiers — replace with the
// exact values from the Credit MIS document; matching depends on them.
export const PA_OPTIONS = [
  { code: "RZP_ONLINE", label: "Razorpay — Online" }, { code: "RZP_CMS", label: "Razorpay — CMS" },
  { code: "BILLDESK", label: "BillDesk" }, { code: "BILLDESK_SI", label: "BillDesk — Standing Instruction" },
  { code: "SAP", label: "SAP" }, { code: "CAMSPAY", label: "CAMSPay" }, { code: "PAYU", label: "PayU" },
  { code: "CCAVENUE", label: "CCAvenue" }, { code: "CASHFREE", label: "Cashfree" },
];
const LEGACY_PA = { Razorpay: "RZP_ONLINE", CAMSPay: "CAMSPAY", BillDesk: "BILLDESK", PayU: "PAYU", CCAvenue: "CCAVENUE", Cashfree: "CASHFREE" };
export const paLabel = (code) => { const c = LEGACY_PA[code] || code; const o = PA_OPTIONS.find((x) => x.code === c); return o ? `${o.label} (${o.code})` : code || "—"; };
export const normPa = (code) => LEGACY_PA[code] || code || "";

// Feed option master: what gets inserted. PLACEHOLDER values — the business rules sit in a separate functional spec.
export const FEED_OPTIONS = [
  { code: "CREDIT_FEED", label: "Credit feed — insert each MIS row as a credit" },
  { code: "CREDIT_REVERSAL_FEED", label: "Credit + reversal feed — also insert failed / reversed rows" },
  { code: "SETTLEMENT_ONLY", label: "Settlement summary only — one row per settlement" },
  { code: "NO_FEED", label: "No feed — copy the bank-statement credit as the feed" },
];
export const feedOptionLabel = (code) => FEED_OPTIONS.find((f) => f.code === code)?.label.split(" — ")[0] || "—";
