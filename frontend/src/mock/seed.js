import { BANKS, ACCOUNTS } from "./bankMaster";
import { uid } from "../lib/format";
import { PAY_MECHANISMS } from "../lib/constants";
import { MAPPING_FIELDS, NARRATION_FIELDS, isStandard, defaultSchedule } from "../lib/setupSchema";

const MODES = ["auto", "manual", "email", "api"];
const now = Date.now();
const day = 86400000;

function pickStatus(i) {
  const r = i % 100;
  if (r < 70) return "active";
  if (r < 80) return "inactive";
  if (r < 88) return "draft";
  return "pending";
}

function mkConnection(mode) {
  if (mode === "manual") return {};
  if (mode === "email") return { subjectPattern: "%Account Statement%", sender: "statements@bank.com", receiver: "recon.ops@camsonline.com", attachmentPattern: "", zipOption: "none" };
  return {
    url: "https://portal.bank.com/corp/statements",
    path: "/export/daily",
    corporateId: "CAMS" + (1000 + Math.floor(Math.random() * 8999)),
    loginId: "cams_ops_" + Math.floor(Math.random() * 99),
    passwordSet: true,
    credentialUpdatedAt: new Date(now - 30 * day).toISOString(),
    credentialUpdatedBy: "Priya",
    schedule: defaultSchedule(),
  };
}

function mkFileConfig(bankName, bankCode = "BANK", acct = "0000") {
  return {
    fileNamePattern: `${bankCode}_${String(acct).slice(-4)}_\\d{8}\\.csv`,
    fileType: "CSV", separator: ",", startRow: 1, startColumn: 1,
    uploadPath: "/inbound/" + bankName.split(" ")[0].toLowerCase(),
    uploadUser: "sftp_cams", uploadPasswordSet: true,
    sampleFileName: null, detected: {}, edited: {},
  };
}

function mkProcessing(status, i = 1) {
  const liability = i % 7 === 3;
  return {
    liabilityCategory: liability ? ["Redemption", "Dividend", "Refund", "Brokerage"][i % 4] : "",
    isActive: status !== "inactive",
    bulkUpload: false, computeRunningBalance: true, validateRunningBalance: true,
    runningBalanceCleanup: false, cleanupChars: "", directMatch: i % 20 === 0, // only the ~12 UPI accounts
    reconciliationType: liability ? "Liability" : "Subscription", descendingOrder: false,
  };
}

export function seedBankConfigs() {
  const list = [];
  // One setup per collection account (round-robin across banks so every bank has a spread of statuses).
  const flat = [];
  const maxN = Math.max(...BANKS.map((b) => ACCOUNTS[b.name].length));
  for (let k = 0; k < maxN; k++) BANKS.forEach((b) => { const a = ACCOUNTS[b.name][k]; if (a) flat.push([b, a]); });
  // About 1 in 9 accounts has no setup yet (and the demo sample accounts ·3337 and ·3313), so "Add account" has real work.
  const todo = flat.filter(([, a], k) => k > 1 && (k % 9 === 8 || /(3337|3313)$/.test(a.accountNumber)));
  const ready = flat.filter((x) => !todo.includes(x));
  flat.length = 0; flat.push(...ready);
  const total = flat.length;
  for (let i = 0; i < total; i++) {
    const [bank, acc] = flat[i];
    const mode = MODES[i % MODES.length];
    const status = pickStatus(i);
    list.push({
      id: uid("bc"),
      kind: "bank_config",
      sno: i + 1,
      downloadMode: mode,
      bankName: bank.name,
      bankCode: bank.code,
      accountNumber: acc.accountNumber,
      schemeOrCollection: i % 3 === 0 ? "Collection" : "Scheme",
      schemeCode: acc.schemeCode,
      schemeName: acc.schemeName,
      assetClass: acc.assetClass,
      status,
      owner: "Priya",
      createdAt: new Date(now - (total - i) * day * 0.6).toISOString(),
      lastUpdated: new Date(now - i * day * 0.3).toISOString(),
      rejection: null,
      connection: mkConnection(mode),
      fileConfig: mkFileConfig(bank.name, bank.code, acc.accountNumber),
      processing: mkProcessing(status, i),
      priority: i % 20 === 0 || i === 7 ? "high" : "low",
      formatName: "",
    });
  }
  // Two rejected records owned by Priya with realistic comments (pin to HDFC/SIB)
  list[0] = {
    ...list[0], status: "rejected", downloadMode: "manual", bankName: "HDFC Bank", bankCode: "HDFC",
    accountNumber: ACCOUNTS["HDFC Bank"][0].accountNumber, schemeName: "Liquid Fund",
    fileConfig: { ...mkFileConfig("HDFC Bank"), fileType: "CSV", separator: ",", startRow: 1, startColumn: 1, sampleFileName: "hdfc_statement_sep.csv" },
    rejection: { by: "Arun", date: new Date(now - 2 * day).toISOString(), comment: "File Start Row should be 12 — rows 1–11 are bank header text. Please re-detect from the sample and resubmit." },
  };
  list[1] = {
    ...list[1], status: "rejected", downloadMode: "manual", bankName: "South Indian Bank", bankCode: "SIBL",
    accountNumber: ACCOUNTS["South Indian Bank"][0].accountNumber, schemeName: "Short Term Bond",
    rejection: { by: "Arun", date: new Date(now - 3 * day).toISOString(), comment: "Wrong account selected for Liquid scheme. The Scheme Code does not match the chosen collection account." },
  };
  // The two pinned rejected records reuse accounts that also appear further down — keep one setup per account.
  const seen = new Set();
  for (let k = 0; k < list.length; k++) { if (seen.has(list[k].accountNumber)) { list.splice(k, 1); k--; } else seen.add(list[k].accountNumber); }
  list.forEach((x, k) => { x.sno = k + 1; });
  // HDFC sends two layouts for the same account (morning 10 columns, end-of-day 12): two setups, the matching one is used.
  const h = list.find((x) => x.bankName === "HDFC Bank" && x.status === "active");
  if (h) {
    h.formatName = "Morning (10 columns)";
    list.push({ ...h, id: uid("bc"), sno: list.length + 1, formatName: "EOD (12 columns)", downloadMode: "email", connection: mkConnection("email"), fileConfig: { ...h.fileConfig, startRow: 14 }, lastUpdated: new Date(now - 5 * day).toISOString() });
  }
  // One live setup with an edit waiting for the checker — shows the R7 "what changes" diff in Approvals.
  const pi = list.findIndex((x) => x.status === "pending" && x.downloadMode === "auto");
  if (pi !== -1) {
    const live = { ...list[pi], status: "active", fileConfig: { ...list[pi].fileConfig, startRow: 1 }, processing: { ...list[pi].processing, validateRunningBalance: false, directMatch: false }, connection: { ...list[pi].connection, schedule: { ...defaultSchedule(), every: 60 } } };
    list[pi] = { ...list[pi], baseline: live, fileConfig: { ...list[pi].fileConfig, startRow: 3 }, processing: { ...list[pi].processing, runningBalanceCleanup: true, cleanupChars: "Cr" } };
  }
  return list;
}

/** PRD v1 / v4 §5.3 — admin-maintained transaction status standardisation (source value → system value). */
export function seedStatusMap() {
  const at = new Date(now - 90 * day).toISOString();
  return [["C", "CREDIT", "HDFC Bank"], ["CR", "CREDIT", "IDBI Bank"], ["SUCCESS", "CREDIT", "IndusInd Bank"], ["Positive Amount", "CREDIT", "South Indian Bank"],
    ["D", "DEBIT", "HDFC Bank"], ["DR", "DEBIT", "IDBI Bank"], ["FAILURE", "DEBIT", "IndusInd Bank"], ["Negative Amount", "DEBIT", "South Indian Bank"]]
    .map(([source, system, seenAt], i) => ({ id: "sm_" + i, source, system, seenAt, table: "RECON_BANK_TXN", column: "INSTRM_STATUS", status: "active", owner: "Meera", createdAt: at }));
}

/** Mapping record created when a bank setup is approved. */
export function newMappingFor(cfg, sno) {
  const std = isStandard(cfg.fileConfig?.fileType);
  return {
    id: uid("bm"), kind: "bank_mapping", type: "bank", sno, bankName: cfg.bankName, formatName: cfg.formatName || "", accountNumber: cfg.accountNumber || "", fileType: cfg.fileConfig?.fileType || "CSV",
    status: std ? "active" : "not_started", standard: std, owner: cfg.owner, configId: cfg.id, sampleFileName: cfg.fileConfig?.sampleFileName || null,
    headerRow: Number(cfg.fileConfig?.startRow) || 1, headerConfirmed: false, dateFormat: "DD/MM/YYYY", bulkUpload: !!cfg.processing?.bulkUpload,
    createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(), rejection: null, fields: mkBankMappingFields(false), narrationSplit: false, overrides: 0, approved: std,
  };
}

export function seedCreditConfigs() {
  const list = [];
  for (let i = 0; i < 60; i++) {
    const bank = BANKS[i % BANKS.length];
    const accs = ACCOUNTS[bank.name];
    const acc = accs[i % accs.length];
    const mode = MODES[i % MODES.length];
    const status = pickStatus(i * 2);
    list.push({
      id: uid("cm"),
      kind: "credit_config",
      sno: i + 1,
      feedMode: mode,
      bankName: bank.name,
      bankCode: bank.code,
      accountNumber: acc.accountNumber,
      paCode: ["RZP_ONLINE", "RZP_CMS", "BILLDESK", "SAP", "CAMSPAY", "PAYU", "CCAVENUE", "CASHFREE"][i % 8],
      feedOption: i % 9 === 4 ? "NO_FEED" : i % 3 === 1 ? "CREDIT_REVERSAL_FEED" : "CREDIT_FEED",
      payMechanism: PAY_MECHANISMS[i % PAY_MECHANISMS.length],
      accountCategory: acc.category,
      schemeCode: acc.schemeCode,
      assetClass: acc.assetClass,
      fileFormat: i % 2 === 0 ? "CSV" : "XLSX",
      status,
      owner: "Priya",
      createdAt: new Date(now - (60 - i) * day).toISOString(),
      lastUpdated: new Date(now - i * day * 0.5).toISOString(),
      rejection: null,
      connection: mkConnection(mode),
      fileConfig: { fileFormat: i % 2 === 0 ? "CSV" : "XLSX", separator: ",", startRow: 1, startColumn: 1, instrumentStatus: i % 3 === 0 ? "D" : "C", failureReasonCode: i % 3 === 0 ? "R01" : "", sampleFileName: null, detected: {}, edited: {} },
      processing: { dateTimeUpdate: true, reconciliationType: i % 4 === 3 ? "Liability" : "Subscription", liabilityCategory: i % 4 === 3 ? "Refund" : "", isActive: status !== "inactive" },
    });
  }
  list[0] = { ...list[0], status: "rejected", rejection: { by: "Arun", date: new Date(now - 2 * day).toISOString(), comment: "Payment Aggregator code mismatch — Razorpay MIS mapped to a CAMSPay pool account. Please correct the aggregator selection." } };
  list[3] = { ...list[3], status: "rejected", rejection: { by: "Arun", date: new Date(now - 4 * day).toISOString(), comment: "Header position should be row 8, column 2 for this feed. Re-detect from the sample file and resubmit." } };
  return list;
}

// PRD v1 field list only. `reuse` = HDFC's approved mapping (separate Debit / Credit columns).
const HDFC_MAP = { INSTRM_AMOUNT_CREDIT: "Credit", INSTRM_AMOUNT_DEBIT: "Debit", VALUE_DATE: "Value Date", BANK_STMT_DATE: "Txn Date", BANK_NARRATION: "Narration", INSTRM_NO: "Cheque No", CLOSING_BALANCE: "Running Balance" };
// Value date, amount and narration are enforced by the save rules (amount and narration each have two valid fields), so only VALUE_DATE starts as Required.
const MANDATORY = ["VALUE_DATE"];
const INCREMENTAL = ["VALUE_DATE", "INSTRM_AMOUNT_CREDIT", "BANK_NARRATION"];
function mkBankMappingFields(reuse) {
  const inputs = MAPPING_FIELDS.map(([sysField, attr]) => {
    const col = reuse ? HDFC_MAP[sysField] || "" : "";
    return { group: "input", systemField: sysField, attribute: attr, mappedColumn: col, source: col ? "previous" : "manual", mandatory: MANDATORY.includes(sysField), incremental: reuse && INCREMENTAL.includes(sysField), status: col ? "mapped" : "pending" };
  });
  const narration = NARRATION_FIELDS.map(([sysField, attr]) => ({ group: "narration", systemField: sysField, attribute: attr, mappedColumn: "", source: "manual", mandatory: false, incremental: false, status: "pending" }));
  return [...inputs, ...narration];
}

/** Column mapping is per bank name (and format, when a bank sends more than one layout) — not per account. */
export function seedMappings(bankConfigs) {
  const groups = {};
  bankConfigs.forEach((c) => { const k = c.bankName + "|" + (c.formatName || ""); (groups[k] = groups[k] || []).push(c); });
  const statusMix = ["active", "draft", "active", "pending", "rejected", "not_started", "active", "inactive", "active"];
  return Object.entries(groups).map(([k, cs], i) => {
    const c = cs.find((x) => x.status === "active") || cs[0];
    const isHdfc = c.bankName === "HDFC Bank";
    const st = isHdfc ? "active" : statusMix[i % statusMix.length];
    return {
      id: uid("bm"), kind: "bank_mapping", type: "bank", sno: i + 1, bankName: c.bankName, formatName: c.formatName || "", accountNumber: c.accountNumber,
      fileType: c.fileConfig.fileType, status: st, owner: "Priya", configId: c.id, sampleFileName: isHdfc ? "hdfc_statement_sep.csv" : c.bankName === "South Indian Bank" ? "south_indian_bank.xlsx" : null,
      headerRow: isHdfc ? 12 : c.fileConfig.startRow, headerConfirmed: st !== "not_started", dateFormat: "DD/MM/YYYY",
      createdAt: new Date(now - (40 - i) * day).toISOString(), lastUpdated: new Date(now - i * day).toISOString(),
      rejection: st === "rejected" ? { by: "Arun", date: new Date(now - day).toISOString(), comment: "INSTRM_AMOUNT mapped to a text column. Please re-map to a numeric amount column." } : null,
      fields: mkBankMappingFields(isHdfc), narrationSplit: false, overrides: 0, approved: st === "active",
    };
  });
}

/** Same-day NAV cutoffs. Liquid / overnight times come from the scheme master; asset classes are recon-side. */
export function seedCutoffs() {
  const at = new Date(now - 30 * day).toISOString();
  return [
    { id: "co_liq", level: "scheme", key: "LIQ-DIR-G", label: "Liquid Fund (LIQ-DIR-G)", time: "13:30", source: "Scheme master", status: "active", updatedAt: at },
    { id: "co_ovn", level: "scheme", key: "OVN-DIR-G", label: "Overnight Fund (OVN-DIR-G)", time: "13:30", source: "Scheme master", status: "active", updatedAt: at },
    { id: "co_eq", level: "asset", key: "Equity", label: "Equity", time: "15:00", source: "Recon setup", status: "active", owner: "Priya" },
    { id: "co_debt", level: "asset", key: "Debt", label: "Debt (non-liquid)", time: "15:00", source: "Recon setup", status: "active", owner: "Priya" },
    { id: "co_hyb", level: "asset", key: "Hybrid", label: "Hybrid", time: "15:00", source: "Recon setup", status: "active", owner: "Priya" },
  ];
}

/** Narration tags (bank charges, interest…). */
export function seedNarrationTags() {
  const at = new Date(now - 20 * day).toISOString();
  return [["contains", "BANK CHARGES", "Bank charges"], ["contains", "GST", "GST on charges"], ["regex", "INT\\.?\\s?PD|INTEREST", "Interest credit"], ["starts", "RTN", "Return / reversal"]]
    .map(([match, pattern, tag], i) => ({ id: "nt_" + i, match, pattern, tag, bank: "All banks", status: "active", owner: "Priya", approvedBy: "Arun", createdAt: at }))
    .concat([{ id: "nt_p1", match: "contains", pattern: "SWEEP", tag: "Internal transfer", bank: "HDFC Bank", status: "pending", owner: "Priya", createdAt: new Date(now - 3600000).toISOString() }]);
}

/**
 * One connection per bank: how its statements arrive (channel, portal / API details, schedule, SFTP folder).
 * Set once and inherited by every account at the bank, instead of being re-typed per account.
 */
export function seedBankConnections(configs) {
  const byBank = {};
  configs.filter((c) => c.status === "active").forEach((c) => { (byBank[c.bankName] = byBank[c.bankName] || []).push(c); });
  return Object.entries(byBank).map(([bankName, list], i) => {
    const counts = list.reduce((m, c) => ({ ...m, [c.downloadMode]: (m[c.downloadMode] || 0) + 1 }), {});
    const channel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const src = list.find((c) => c.downloadMode === channel);
    return {
      id: "bconn_" + i, bankName, bankCode: src.bankCode, channel, connection: { ...src.connection }, schedule: src.connection?.schedule || null,
      sftpFolder: `/inbound/${bankName.split(" ")[0].toLowerCase()}/`, status: "active", owner: "Priya", approvedBy: "Arun", updatedAt: new Date(now - (30 + i) * day).toISOString(),
    };
  });
}
