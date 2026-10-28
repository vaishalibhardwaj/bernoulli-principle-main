// Seed data for the re-phased operational screens:
// File Inbox & Drift (P1), Match Rules + Match Workbench + Exceptions (P2), Document Extraction (P3).
// Deterministic (seeded RNG) so demos look the same after every reset.
import { BANKS, ACCOUNTS } from "./bankMaster";

const now = Date.now();
const hour = 3600000;
const day = 86400000;

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20261021);
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const amt = (min, max) => Math.round((min + R() * (max - min)) / 10) * 10;
const todayAt = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };

const INVESTORS = [
  { name: "RAJESH KUMAR SHARMA", short: "R K SHARMA", pan: "ABKPS4821L", bank: "HDFC0001234", acct: "50100234887123" },
  { name: "ANITA DESAI", short: "ANITA D", pan: "AQZPD9012K", bank: "ICIC0000456", acct: "004501678912" },
  { name: "MOHAMMED IRFAN", short: "MD IRFAN", pan: "BXJPI3321M", bank: "SBIN0004567", acct: "30987766541" },
  { name: "LAKSHMI VENKATESAN", short: "LAKSHMI V", pan: "AHVPV7765C", bank: "UTIB0000789", acct: "917010045566781" },
  { name: "SURESH BABU NAIDU", short: "SURESH BABU", pan: "CBNPN1209D", bank: "KKBK0000890", acct: "4412987654" },
  { name: "PRIYANKA CHATTERJEE", short: "PRIYANKA C", pan: "AKCPC5543H", bank: "HDFC0000981", acct: "50100998877665" },
  { name: "GURPREET SINGH BEDI", short: "G S BEDI", pan: "BBSPB8890Q", bank: "ICIC0001122", acct: "112201334455" },
  { name: "MEENAKSHI IYER", short: "MEENAKSHI I", pan: "AAIPI4410R", bank: "SBIN0001290", acct: "31223344556" },
  { name: "ARJUN MALHOTRA", short: "ARJUN M", pan: "AJMPM6621P", bank: "YESB0000321", acct: "002190100045671" },
  { name: "FATIMA SHAIKH", short: "FATIMA S", pan: "CFSPS2234B", bank: "INDB0000654", acct: "159876543210" },
  { name: "VENKATA RAO P", short: "P VENKATA RAO", pan: "ADPPR9981F", bank: "SIBL0000123", acct: "0123053000098765" },
  { name: "NEHA AGARWAL", short: "NEHA AGARWAL", pan: "AGNPA7712E", bank: "HDFC0000222", acct: "50100445566778" },
];
const SCHEMES = ["Liquid Fund – DG", "Bluechip Equity – RG", "Midcap Opp – DG", "Gilt Fund – RG", "Balanced Adv – DG", "Short Term Bond – RG"];
const CHANNELS = ["Direct", "BSE StAR", "NSE NMF", "MFU", "Razorpay", "CAMSPay"];

// AMC that a record belongs to (drives each user's AMC scope).
const AMC_OF = ["HDFC Mutual Fund", "ICICI Prudential MF", "Aditya Birla Sun Life MF", "Kotak Mahindra MF", "Nippon India MF", "DSP Mutual Fund"];
const amcFor = (i) => AMC_OF[i % AMC_OF.length];
const amcOfInvestor = (inv) => amcFor(INVESTORS.indexOf(inv));

const utr = (code) => `${code}R5${Math.floor(1e10 + R() * 9e10)}`;

// ---------------------------------------------------------------------------
// P1 — File Inbox, expected-file calendar, fingerprints & format drift
// ---------------------------------------------------------------------------
export function seedFiles() {
  const list = [];
  const plan = [
    // SFTP is the primary bulk channel; email, API and portal bot cover specific banks; manual upload is the exception.
    ["HDFC Bank", 0, "sftp", "09:00", "drift"], ["HDFC Bank", 1, "auto", "09:30", "ok"], ["HDFC Bank", 2, "api", "08:30", "ok"],
    ["ICICI Bank", 0, "sftp", "09:30", "drift"], ["ICICI Bank", 1, "sftp", "10:00", "ok"],
    ["Axis Bank", 0, "email", "09:15", "ok"], ["Axis Bank", 1, "auto", "09:30", "completeness"],
    ["State Bank of India", 0, "manual", "10:30", "late"], ["State Bank of India", 1, "sftp", "10:30", "ok"],
    ["Kotak Mahindra Bank", 0, "api", "08:45", "ok"], ["Kotak Mahindra Bank", 1, "email", "09:00", "redump"],
    ["South Indian Bank", 0, "sftp", "11:00", "missing"], ["Yes Bank", 0, "sftp", "09:30", "ok"],
    ["IndusInd Bank", 0, "email", "09:45", "ok"], ["IndusInd Bank", 1, "sftp", "09:45", "unknown"], ["Yes Bank", 1, "api", "08:30", "late"],
  ];
  plan.forEach(([bankName, ai, channel, expected, kind], i) => {
    const bank = BANKS.find((b) => b.name === bankName);
    const acc = ACCOUNTS[bankName][ai];
    const [eh, em] = expected.split(":").map(Number);
    const rows = 400 + Math.floor(R() * 2600);
    const received = !["late", "missing"].includes(kind);
    const fp = (bank.code + (kind === "drift" ? "9F2C" : "4A1E") + (1000 + i * 37)).toLowerCase();
    const f = {
      id: "file_" + (101 + i),
      amc: amcFor(i),
      bankName, bankCode: bank.code, accountNumber: acc.accountNumber, channel,
      expectedBy: todayAt(eh, em),
      receivedAt: received ? new Date(new Date(todayAt(eh, em)).getTime() - (20 - i) * 60000).toISOString() : null,
      fileName: `${bank.code}_${acc.accountNumber.slice(-4)}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.${channel === "api" ? "json" : i % 3 ? "csv" : "xlsx"}`,
      rows: received ? rows : 0,
      credits: received ? Math.floor(rows * 0.82) : 0,
      creditAmount: received ? amt(rows * 9000, rows * 42000) : 0,
      fingerprint: received ? fp : null,
      kind,
      // Closing balance: validated when the bank supplies one, computed when it doesn't (API JSON feeds here).
      balanceMode: channel === "api" ? "computed" : "validated",
      // Duplicates are stopped per transaction at insert (unique key in the database), not per file:
      // the same file name is re-sent through the day as a growing full-day dump.
      txnDup: received ? (kind === "redump" ? { rowsRead: 30, overlap: 20, dumps: [["10:00", 10, 0], ["11:00", 20, 10], ["12:00", 30, 20]] } : { rowsRead: rows, overlap: i === 5 ? 12 : 0 }) : null,
      // Closing balance break: the exact pair of rows where opening ± amount stops agreeing with the bank's balance.
      balanceBreak: kind === "completeness" ? { rows: [[11, "20-10-2026", "NEFT/CAMSPAY/SUB/77120", "", "1,50,000.00", "4,12,88,310.55"], [12, "20-10-2026", "UPI/RAZORPAY/SIP/88213", "", "25,000.00", "4,12,98,710.55"]], expected: "4,13,13,310.55", diff: "14,600.00" } : null,
      status: { ok: "loaded", redump: "loaded", drift: "drift", completeness: "check_failed", late: "late", missing: "missing", unknown: "unknown" }[kind],
      checks: [
        { key: "fingerprint", label: "Structure matches approved fingerprint", ok: kind !== "drift" && kind !== "unknown" },
        { key: "balance", label: "Opening balance = previous day's closing balance", ok: true },
        channel === "api"
          ? { key: "running", label: "Closing balance computed from opening balance + transactions (the bank's file has no closing balance)", ok: true, info: true, detail: "Not independently verified against a bank-supplied balance." }
          : { key: "running", label: "Closing balance in the file = opening balance ± each credit and debit, in file order", ok: kind !== "completeness", detail: kind === "completeness" ? "Breaks between row 11 and row 12: expected ₹4,13,13,310.55, the bank's file says ₹4,12,98,710.55 (₹14,600.00 short)." : null },
      ],
    };
    if (kind === "drift") f.drift = driftFor(bankName);
    list.push(f);
  });
  // yesterday's history (for the calendar strip)
  return list;
}

function driftFor(bankName) {
  if (bankName === "HDFC Bank") {
    return {
      detectedAt: todayAt(9, 2),
      summary: "1 column renamed, 1 column added, date format unchanged",
      oldColumns: ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
      newColumns: ["Date", "Narration", "Ref No./Cheque No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance", "Remitter IFSC"],
      changes: [
        { field: "INSTRM_NO", old: "Chq./Ref.No.", proposed: "Ref No./Cheque No.", confidence: 0.97, reason: "Renamed header; 50/50 sample values have the same pattern as last 30 days of Chq./Ref.No." },
        { field: "EXTRACT_INVESTOR_IFSC", old: null, proposed: "Remitter IFSC", confidence: 0.94, reason: "New column; 48/50 values are valid IFSC codes (IFSC master lookup)." },
        { field: "CLOSING_BALANCE", old: "Closing Balance (number)", proposed: "Closing Balance (text, ends in 'Cr')", confidence: 0.9, reason: "Data type changed: values now look like 4,12,330.00Cr. Running Balance Cleanup with 'Cr' is needed." },
      ],
      rowsHeld: 2184,
    };
  }
  return {
    detectedAt: todayAt(9, 34),
    summary: "Column order changed; header moved from row 12 to row 14",
    oldColumns: ["Tran Date", "Value Date", "Description", "Cheque No", "Debit", "Credit", "Balance"],
    newColumns: ["S No", "Value Date", "Tran Date", "Description", "Cheque No", "Debit", "Credit", "Balance"],
    changes: [
      { field: "HEADER_ROW", old: "Row 12", proposed: "Row 14", confidence: 0.99, reason: "Two new disclaimer lines above the table; header scoring 0.96 on row 14." },
      { field: "VALUE_DATE", old: "Value Date (col 2)", proposed: "Value Date (col 2)", confidence: 0.99, reason: "Same header name; position unchanged after new S No column shifts others." },
      { field: "BANK_STMT_DATE", old: "Tran Date (col 1)", proposed: "Tran Date (col 3)", confidence: 0.96, reason: "Header name identical; moved from column 1 to column 3." },
    ],
    rowsHeld: 1630,
  };
}

/** SFTP folders: one per bank, one sub-folder per account (the agreed account-level structure). */
export function seedSftp(files) {
  const banks = [...new Set(files.filter((f) => f.channel === "sftp").map((f) => f.bankName))];
  return banks.map((b, i) => {
    const mine = files.filter((f) => f.bankName === b && f.channel === "sftp");
    return {
      id: "sftp_" + i, bankName: b, root: `/inbound/${b.split(" ")[0].toLowerCase()}/`, lastScan: new Date(now - (3 + i) * 60000).toISOString(), every: 10,
      accounts: mine.map((f) => ({
        fileId: f.id, acct: f.accountNumber.slice(-4), folder: `${f.accountNumber.slice(-4)}/`,
        state: !f.receivedAt ? "waiting" : ["loaded"].includes(f.status) ? "completed" : ["drift", "unknown", "check_failed", "duplicate"].includes(f.status) ? "error" : "in_progress",
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// P2 — Credits, purchases, AI suggestions
// ---------------------------------------------------------------------------
export function seedMatchData() {
  const credits = [];
  const purchases = [];
  const suggestions = [];
  let c = 0, p = 0;
  const mkCredit = (inv, amount, opts = {}) => {
    const bank = opts.bank || pick(BANKS.slice(0, 5));
    const acc = ACCOUNTS[bank.name][0];
    const u = opts.utr || utr(bank.code);
    const valueDate = new Date(now - (opts.ageDays || 0) * day).toISOString();
    const narr = opts.narration || `NEFT-${u}-${inv.short}-${inv.bank.slice(0, 4)}`;
    const cr = { id: `cr_${++c}`, amc: amcOfInvestor(inv), ref: `CR-${88100 + c}`, bankName: bank.name, accountNumber: acc.accountNumber, valueDate, amount, utr: u, narration: narr, remitter: inv.short, remitterIfsc: inv.bank, status: "open" };
    credits.push(cr);
    return cr;
  };
  const mkPurchase = (inv, amount, opts = {}) => {
    const pu = { id: `pu_${++p}`, amc: amcOfInvestor(inv), appNo: `APP${7720400 + p}`, investor: inv.name, pan: inv.pan, scheme: opts.scheme || pick(SCHEMES), channel: opts.channel || pick(CHANNELS), amount, utr: opts.utr || null, txnDate: new Date(now - (opts.ageDays || 0) * day).toISOString(), regBank: inv.bank, status: "open" };
    purchases.push(pu);
    return pu;
  };

  // 1) AI one-to-one suggestions (no UTR on purchase; name/IFSC/amount evidence)
  [[0, 25000, 0.94, 1], [1, 100000, 0.91, 0], [3, 5000, 0.86, 1], [6, 15000, 0.78, 2], [9, 250000, 0.72, 1]].forEach(([ii, a, conf, lag]) => {
    const inv = INVESTORS[ii];
    const cr = mkCredit(inv, a, { ageDays: lag });
    const pu = mkPurchase(inv, a, { ageDays: lag + (lag ? 1 : 0) });
    suggestions.push({
      id: `sg_${cr.id}`, type: "1:1", credits: [cr.id], purchases: [pu.id], confidence: conf,
      reasons: [
        { ok: true, text: `Amount equal (${a.toLocaleString("en-IN")})` },
        { ok: lag <= 1, text: lag ? `Value date ${lag} day(s) after application date (rule window ±1)` : "Same date" },
        { ok: conf > 0.8, text: `Remitter "${inv.short}" ≈ investor "${inv.name}" (name similarity ${(conf - 0.05).toFixed(2)})` },
        { ok: true, text: `Remitter IFSC ${inv.bank} = investor's registered bank` },
        { ok: false, text: "No UTR on purchase record — deterministic UTR rule could not fire" },
      ],
    });
  });

  // 2) One credit → many purchases (SIP bundle, same PAN)
  {
    const inv = INVESTORS[4];
    const parts = [5000, 10000, 2500];
    const cr = mkCredit(inv, parts.reduce((s, x) => s + x, 0), { narration: `IMPS-${utr("KKBK")}-${inv.short}-${inv.pan}-SIP` });
    const ps = parts.map((a) => mkPurchase(inv, a, { channel: "Direct" }));
    suggestions.push({ id: `sg_${cr.id}`, type: "1:N", credits: [cr.id], purchases: ps.map((x) => x.id), confidence: 0.93,
      reasons: [{ ok: true, text: `PAN ${inv.pan} found in narration` }, { ok: true, text: "3 open purchases for this PAN sum exactly to the credit" }, { ok: true, text: "All three are SIP instalments dated today" }] });
  }
  // 3) Many credits → one purchase (investor split the payment)
  {
    const inv = INVESTORS[7];
    const c1 = mkCredit(inv, 300000, { bank: BANKS[3] });
    const c2 = mkCredit(inv, 200000, { bank: BANKS[3] });
    const pu = mkPurchase(inv, 500000, { channel: "Direct" });
    suggestions.push({ id: `sg_${c1.id}`, type: "N:1", credits: [c1.id, c2.id], purchases: [pu.id], confidence: 0.88,
      reasons: [{ ok: true, text: "Two credits from the same remitter account on the same day" }, { ok: true, text: "Sum ₹5,00,000 = application amount" }, { ok: false, text: "Application allows a single payment — checker should confirm" }] });
  }
  // 4) Physical cheque: the same cheque number exists at two different banks, so the number alone proves nothing.
  {
    const inv = INVESTORS[6];
    const cr = mkCredit(inv, 120000, { narration: "CLG-CHQ 004512 CANARA BANK PUNE A/C XXXX0461" });
    Object.assign(cr, { chequeNo: "004512", drawee: "Canara Bank", drawerAcct: "XXXX0461" });
    const p1 = mkPurchase(inv, 120000, { channel: "Direct" });
    Object.assign(p1, { chequeNo: "004512", drawee: "Canara Bank", drawerAcct: "XXXX0461" });
    const p2 = mkPurchase(INVESTORS[9], 120000, { channel: "Direct" });
    Object.assign(p2, { chequeNo: "004512", drawee: "HDFC Bank", drawerAcct: "XXXX7781" });
  }
  // 5) Unmatched noise both sides (go to exceptions if not worked)
  [2, 5, 8, 10, 11].forEach((ii, k) => mkCredit(INVESTORS[ii], [7500, 12000, 49999, 3000, 64000][k], { ageDays: k % 3 }));
  [2, 5, 8, 10, 11, 0].forEach((ii, k) => mkPurchase(INVESTORS[ii], [7000, 12500, 50000, 3000, 20000, 9999][k], { ageDays: k % 2, utr: k === 3 ? "SBINR5000000000" : null }));

  return { credits, purchases, suggestions };
}

// ---------------------------------------------------------------------------
// P2 — Match rules (rules as data) with 30-day stats
// ---------------------------------------------------------------------------
export function seedRules() {
  const at = new Date(now - 40 * day).toISOString();
  const r = (id, priority, name, strategy, mode, conditions, tol, stats, extra = {}) => ({ id, priority, name, strategy, mode, conditions, tolerance: tol, stats, status: "active", version: 3, owner: "Priya", approvedBy: "Arun", updatedAt: at, scope: "All banks", ...extra });
  return [
    r("rule_1", 1, "UTR exact", "1:1", "auto", [{ field: "credit.utr", op: "equals", value: "purchase.utr" }], { amount: 0, days: 3, nameSim: 0 }, { matches: 412880, share: 61.2, fp: 0.0 }),
    r("rule_2", 2, "UTR extracted from narration", "1:1", "auto", [{ field: "credit.narration → UTR", op: "equals", value: "purchase.utr" }, { field: "credit.amount", op: "equals", value: "purchase.amount" }], { amount: 0, days: 3, nameSim: 0 }, { matches: 118420, share: 17.6, fp: 0.01 }),
    r("rule_3", 3, "Investor-bank fingerprint + amount", "1:1", "auto", [{ field: "credit.remitterAccount+IFSC", op: "in", value: "fingerprint(purchase.pan)" }, { field: "credit.amount", op: "equals", value: "purchase.amount" }], { amount: 0, days: 1, nameSim: 0 }, { matches: 52310, share: 7.8, fp: 0.04 }),
    r("rule_4", 4, "PAN in narration → SIP bundle", "1:N", "auto", [{ field: "credit.narration → PAN", op: "equals", value: "purchase.pan" }, { field: "credit.amount", op: "equals", value: "Σ purchase.amount" }], { amount: 0, days: 0, nameSim: 0 }, { matches: 9120, share: 1.4, fp: 0.02 }),
    r("rule_5", 5, "PA settlement = Σ MIS − fees", "N:M", "auto", [{ field: "credit.amount", op: "equals", value: "Σ mis.amount − Σ mis.fee − GST" }, { field: "credit.narration", op: "contains", value: "mis.settlementId" }], { amount: 1, days: 1, nameSim: 0 }, { matches: 30880, share: 4.6, fp: 0.0 }),
    r("rule_7", 7, "Cheque: number + drawee bank + drawer account + amount", "1:1", "auto", [{ field: "credit.chequeNo", op: "equals", value: "purchase.chequeNo" }, { field: "credit.drawee + drawerAcct", op: "equals", value: "purchase.drawee + drawerAcct" }, { field: "credit.amount", op: "equals", value: "purchase.amount" }], { amount: 0, days: 5, nameSim: 0 }, { matches: 9120, share: 1.4, fp: 0.0 }, { note: "Cheque number alone never matches — numbers repeat across banks." }),
    r("rule_6", 6, "Amount + date window + name similarity", "1:1", "suggest", [{ field: "credit.amount", op: "equals", value: "purchase.amount" }, { field: "credit.valueDate", op: "within", value: "purchase.txnDate ± days" }, { field: "sim(remitter, investor)", op: "≥", value: "nameSim" }], { amount: 0, days: 2, nameSim: 0.85 }, { matches: 21460, share: 3.2, fp: 1.8 }),
  ];
}

/** Deterministic "back-test" of a rule draft vs the approved version over the last 30 days. */
export function simulateRule(base, draft) {
  const dDays = (draft.tolerance.days - base.tolerance.days);
  const dAmt = (draft.tolerance.amount - base.tolerance.amount);
  const dSim = (base.tolerance.nameSim - draft.tolerance.nameSim);
  const modeBoost = draft.mode === "auto" && base.mode === "suggest" ? 1 : 0;
  const gain = Math.max(0, Math.round(dDays * 1840 + dAmt * 610 + dSim * 100 * 520));
  const lost = Math.max(0, Math.round(-dDays * 1600 - dAmt * 420 - dSim * 100 * 380));
  const fp = Math.max(0, +(base.stats.fp + dDays * 0.6 + dAmt * 0.15 + dSim * 100 * 0.22 + modeBoost * 1.2).toFixed(2));
  const sample = Array.from({ length: Math.min(5, Math.max(gain ? 3 : 0, 0)) }, (_, i) => ({
    credit: `CR-${77010 + i * 13}`, purchase: `APP${7700100 + i * 29}`, amount: [25000, 5000, 150000, 2500, 98000][i],
    note: dDays > 0 && i % 2 === 0 ? `value date +${base.tolerance.days + 1}d` : dSim > 0 ? `name sim ${(draft.tolerance.nameSim + 0.02).toFixed(2)}` : `amount Δ ₹${Math.max(1, draft.tolerance.amount)}`,
    risky: i === 3 && fp > 2,
  }));
  return { period: "Last 30 days · 6,74,210 credits", newMatches: gain, lostMatches: lost, fpRisk: fp, net: gain - lost, sample };
}

// ---------------------------------------------------------------------------
// P2 — Exceptions as cases
// ---------------------------------------------------------------------------
export const EXCEPTION_TYPES = ["Unmatched credit", "Unmatched purchase", "Excess credit", "Short credit", "Duplicate credit", "NIGO rejection", "Fundnet failure", "Cross collection", "Format drift", "Missing statement"];
export const ROOT_CAUSES = ["Investor paid wrong amount", "UTR missing in narration", "Bank narration format changed", "Paid to wrong AMC account", "Duplicate payment by investor", "Late statement from bank", "Channel feed delayed", "Data entry error at front office", "Other"];

export function seedExceptions() {
  const owners = ["Deepa Nair", "Priya Sharma", "Kiran Das", null, null, "Deepa Nair"];
  const list = [];
  for (let i = 0; i < 38; i++) {
    const type = EXCEPTION_TYPES[[0, 0, 0, 1, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 8, 9][i % 16]];
    const bank = BANKS[i % BANKS.length];
    const inv = INVESTORS[i % INVESTORS.length];
    // Most cases are a few days old; some unresolved credits have aged for weeks (aging buckets 6–10, 11–20, 20+ days).
    const ageHours = Math.round(2 + R() * 140) + (i % 4 === 1 ? (4 + (i * 7) % 26) * 24 : 0);
    const interestHoursLeft = 5 * 24 - ageHours; // simplified business-day clock
    const amount = type === "Missing statement" || type === "Format drift" ? 0 : amt(1500, 900000);
    const status = i % 9 === 0 ? "pending_approval" : i % 13 === 0 ? "closed" : i % 4 === 0 ? "in_progress" : "open";
    list.push({
      id: `exc_${i + 1}`, amc: amcFor(i), ref: `EXC-${24100 + i}`, type, bankName: bank.name, amount, ageHours, interestHoursLeft,
      investor: ["Format drift", "Missing statement"].includes(type) ? "—" : inv.name, owner: owners[i % owners.length],
      status, rootCause: status === "closed" || status === "pending_approval" ? ROOT_CAUSES[i % ROOT_CAUSES.length] : null,
      suggestion: suggestionFor(type, inv, amount),
      createdAt: new Date(now - ageHours * hour).toISOString(),
      notes: [],
    });
  }
  return list;
}
function suggestionFor(type, inv, amount) {
  switch (type) {
    case "Unmatched credit": return { text: `2 purchases for PAN ${inv.pan} within ±3 days; closest differs by ₹${Math.round(amount * 0.01)}`, action: "Open in Match Workbench", conf: 0.64 };
    case "Unmatched purchase": return { text: "No credit yet. Investor's bank (HDFC) statement for today has arrived — likely unpaid", action: "Mark as awaiting funds", conf: 0.71 };
    case "Excess credit": return { text: `Credit exceeds application by ₹${Math.round(amount * 0.2).toLocaleString("en-IN")} — refund the excess to remitter account`, action: "Create refund (excess)", conf: 0.88 };
    case "Short credit": return { text: "Short by less than 1% — check if bank charges deducted by remitter", action: "Request top-up / reject application", conf: 0.6 };
    case "Duplicate credit": return { text: "Same UTR, amount and remitter as a credit matched yesterday", action: "Create refund (duplicate)", conf: 0.93 };
    case "NIGO rejection": return { text: "Application rejected at posting (KYC). Funds realised — refund to source", action: "Create refund (NIGO)", conf: 0.9 };
    case "Fundnet failure": return { text: "Gateway timeout; credit present in PA settlement file", action: "Re-push to Fundnet", conf: 0.82 };
    case "Cross collection": return { text: "Narration references another AMC's scheme code", action: "Transfer to AMC", conf: 0.77 };
    case "Format drift": return { text: "Proposed mapping change ready in File Inbox", action: "Open File Inbox", conf: 0.97 };
    default: return { text: "Bank portal reachable; bot can retry at 11:30", action: "Retry download", conf: 0.7 };
  }
}

// ---------------------------------------------------------------------------
// P3 — Documents for AI extraction (PDF / email body / scans)
// ---------------------------------------------------------------------------
export function seedDocuments() {
  const f = (key, label, value, conf, extra = {}) => ({ key, label, value, conf, ...extra });
  return [
    {
      id: "doc_1", name: "BillDesk_Settlement_MIS_21Oct.pdf", kind: "Digital PDF", docType: "PA settlement MIS", source: "Email · mis@billdesk.com", receivedAt: todayAt(8, 41), status: "needs_review",
      text: ["BILLDESK PAYMENT GATEWAY — SETTLEMENT ADVICE", "Merchant: CAMS MF COLLECTIONS   Settlement ID: BDSET2610210041", "Settlement Date: 21-Oct-2026   Bank: HDFC Bank  A/c XXXX2347", "", "Sr  Txn Ref        App No        Amount      Status", "1   BD8812201991   APP7720511    25,000.00   SUCCESS", "2   BD8812201992   APP7720512    10,000.00   SUCCESS", "3   BD88122O1993   APP7720513     5,000.00   SUCCESS", "4   BD8812201994   APP7720514    50,000.00   FAILED  R07", "", "Gross: 90,000.00   Fees: 118.00   GST: 21.24   Net Settled: 39,860.76"],
      fields: [f("settlementId", "Settlement ID", "BDSET2610210041", 0.99), f("settlementDate", "Settlement date", "2026-10-21", 0.98), f("bankAccount", "Credited account", "XXXX2347 (HDFC Bank)", 0.97), f("gross", "Gross amount", "90,000.00", 0.99), f("fees", "Fees + GST", "139.24", 0.96), f("net", "Net settled", "39,860.76", 0.98, { validator: { ok: true, msg: "Σ SUCCESS lines (40,000.00) − fees 139.24 = 39,860.76 ✓" } })],
      lines: [
        { utr: ["BD8812201991", 0.99], app: ["APP7720511", 0.99], amount: ["25,000.00", 0.99], status: ["SUCCESS", 0.99] },
        { utr: ["BD8812201992", 0.99], app: ["APP7720512", 0.99], amount: ["10,000.00", 0.99], status: ["SUCCESS", 0.99] },
        { utr: ["BD88122O1993", 0.62, "Letter 'O' where a digit is expected; corrected candidate BD8812201993"], app: ["APP7720513", 0.98], amount: ["5,000.00", 0.99], status: ["SUCCESS", 0.99] },
        { utr: ["BD8812201994", 0.99], app: ["APP7720514", 0.97], amount: ["50,000.00", 0.99], status: ["FAILED", 0.95], reason: ["R07", 0.9] },
      ],
    },
    {
      id: "doc_2", name: "Email body — NEFT remittance advice", kind: "Email body", docType: "Remittance advice", source: "Email · treasury@zenithcorp.in", receivedAt: todayAt(10, 5), status: "needs_review",
      text: ["From: treasury@zenithcorp.in", "Subject: Investment in Liquid Fund – NEFT details", "", "Dear Team,", "We have transferred Rs. 2,50,00,000/- (Rupees Two Crore Fifty Lakh only) via NEFT", "UTR No: ICICN52610211887 dated 21/10/2026 towards application APP7720588.", "Investor: ZENITH CORPORATION PVT LTD, PAN AAACZ4l21K", "Kindly process at today's NAV.", "Regards, Treasury"],
      fields: [f("utr", "UTR", "ICICN52610211887", 0.98), f("amount", "Amount", "2,50,00,000.00", 0.97, { validator: { ok: true, msg: "Figures match amount in words ✓" } }), f("date", "Transfer date", "2026-10-21", 0.96), f("app", "Application no.", "APP7720588", 0.95), f("investor", "Investor", "ZENITH CORPORATION PVT LTD", 0.93), f("pan", "PAN", "AAACZ4l21K", 0.58, { validator: { ok: false, msg: "Invalid PAN format: 'l' (letter L) in a digit position. Candidate: AAACZ4121K" } })],
      lines: [],
    },
    {
      id: "doc_3", name: "Cheque_deposit_slip_scan_0042.jpg", kind: "Scanned image", docType: "Cheque deposit slip", source: "SFTP · /inbound/branch-scans", receivedAt: todayAt(9, 12), status: "needs_review",
      text: ["STATE BANK OF INDIA — PAY-IN-SLIP", "A/c: CAMS MF COLLECTION XXXX5516", "Cheque No: 004512   Drawn on: Canara Bank, Pune", "Amount (figures): 1,20,000.00", "Amount (words): One Lakh Two Thousand only", "Depositor: S. KULKARNI"],
      fields: [f("chequeNo", "Cheque no.", "004512", 0.95), f("drawee", "Drawn on", "Canara Bank, Pune", 0.88), f("amountFig", "Amount (figures)", "1,20,000.00", 0.9), f("amountWords", "Amount (words)", "One Lakh Two Thousand", 0.86, { validator: { ok: false, msg: "Words = ₹1,02,000 but figures = ₹1,20,000 — mismatch, needs a human" } }), f("depositor", "Depositor", "S. KULKARNI", 0.74)],
      lines: [],
    },
    {
      id: "doc_4", name: "Cashfree_MIS_21Oct.pdf", kind: "Digital PDF", docType: "PA settlement MIS", source: "Email · reports@cashfree.com", receivedAt: todayAt(8, 15), status: "auto_loaded",
      text: ["CASHFREE PAYMENTS — DAILY SETTLEMENT REPORT", "Settlement UTR: CFSETL5526102101  Amount: 4,12,330.00", "312 transactions · all SUCCESS"],
      fields: [f("settlementId", "Settlement UTR", "CFSETL5526102101", 0.99), f("net", "Net settled", "4,12,330.00", 0.99, { validator: { ok: true, msg: "Σ 312 lines − fees = net ✓" } }), f("count", "Line count", "312", 0.99)],
      lines: [],
    },
    {
      id: "doc_5", name: "Email — 'Exclusive offer on corporate cards'", kind: "Email body", docType: "Not a recon document", source: "Email · offers@somebank.com", receivedAt: todayAt(7, 58), status: "ignored",
      text: ["Upgrade to our Platinum Corporate Card today!"], fields: [], lines: [],
    },
  ];
}

export const EXTRACTION_THRESHOLDS = { auto: 0.95, review: 0.6 };

// ---------------------------------------------------------------------------
// Command Centre — day-level aggregates (the live screens add their own counts)
// ---------------------------------------------------------------------------
export const TODAY = {
  credits: 18432, creditValue: 21487655210, auto: 16201, aiAccepted: 742, manual: 388,
  realisedForAllotment: 19874410000, heldForAllotment: 1613245210, cutoff: todayAt(15, 0),
  matchTrend: BANKS.map((b, i) => ({ bank: b.name, code: b.code, series: Array.from({ length: 14 }, (_, d) => Math.min(99.4, 82 + (i % 4) * 3 + d * 0.5 + ((d * (i + 3)) % 5) * 0.6 - (b.code === "ICIC" && d === 13 ? 9 : 0))) })),
};

// ---------------------------------------------------------------------------
// Stage 5 — Fund release for unit allotment (SEBI: allot only after realisation)
// ---------------------------------------------------------------------------
export const RELEASE_CUTOFF = todayAt(15, 0);
export const AMC_BREAKDOWN = [
  { amc: "Aditya Birla Sun Life MF", schemes: 38, count: 3412, share: 0.2076 },
  { amc: "HDFC Mutual Fund", schemes: 44, count: 4120, share: 0.2708 },
  { amc: "ICICI Prudential MF", schemes: 41, count: 3985, share: 0.2505 },
  { amc: "Kotak Mahindra MF", schemes: 29, count: 2104, share: 0.1238 },
  { amc: "Nippon India MF", schemes: 33, count: 1918, share: 0.1014 },
  { amc: "DSP Mutual Fund", schemes: 22, count: 762, share: 0.046 },
];
export function seedReleases() {
  return [{ id: "rel_today", ref: "REL-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-01", status: "not_started", createdAt: null }];
}

// ---------------------------------------------------------------------------
// Stage 6 — Refunds (duplicate / excess / application rejected), 5-day SLA + delayed interest
// ---------------------------------------------------------------------------
export const REFUND_SLA_DAYS = 5;
export const DELAYED_INTEREST_PA = 0.15;
export function seedRefunds() {
  const mk = (i, inv, amount, reason, ageDays, verified, status, owner) => ({
    id: `rf_${i}`, amc: amcOfInvestor(inv), ref: `RF-${55200 + i}`, investor: inv.name, pan: inv.pan, amount, reason, ageDays,
    bankAcct: "XXXX" + inv.acct.slice(-4), ifsc: inv.bank, verified, status, owner, createdAt: new Date(now - ageDays * day).toISOString(),
  });
  return [
    mk(1, INVESTORS[2], 49999, "Investor paid twice", 2, null, "draft", "Deepa Nair"),
    mk(2, INVESTORS[5], 12000, "Investor paid too much", 6, true, "draft", "Deepa Nair"),
    mk(3, INVESTORS[8], 250000, "Application rejected — refund needed", 4, true, "pending", "Deepa"),
    mk(4, INVESTORS[10], 3000, "Investor paid too much", 1, false, "draft", null),
    mk(5, INVESTORS[1], 75000, "Application rejected — refund needed", 7, true, "approved", "Kiran"),
    mk(6, INVESTORS[11], 18500, "Investor paid twice", 3, true, "paid", "Deepa"),
  ];
}
export const delayedInterest = (amount, ageDays) => (ageDays > REFUND_SLA_DAYS ? Math.round(amount * DELAYED_INTEREST_PA * (ageDays - REFUND_SLA_DAYS) / 365) : 0);

// ---------------------------------------------------------------------------
// Channels — processing history per file, email intake log, bank connections
// ---------------------------------------------------------------------------
const CHANNEL_LABEL = { auto: "Portal bot", manual: "Manual upload", email: "Email", api: "API", sftp: "SFTP" };
export { CHANNEL_LABEL };

/** Scheduler runs that failed before today's successful run (API timeouts, bot blocks, a missed slot). Voided once the later run succeeds. */
export function earlierFailures(f) {
  if (!f.receivedAt || !["api", "auto", "sftp"].includes(f.channel) || Number(f.id.slice(-1)) % 3 !== 0) return [];
  const at = (min) => new Date(new Date(f.receivedAt).getTime() - min * 60000).toISOString();
  if (f.channel === "api") return [{ at: at(60), by: "Scheduler", step: "Pull failed", text: "Bank API timed out after 8 s", bad: true }, { at: at(30), by: "Scheduler", step: "Pull failed", text: "Bank API timed out after 8 s", bad: true }];
  if (f.channel === "auto") return [{ at: at(60), by: "Scheduler", step: "Bot run failed", text: "Portal login page did not load", bad: true }];
  return [{ at: at(30), by: "Scheduler", step: "Scheduler missed slot", text: "Worker restarted; the folder was not scanned at this slot", bad: true }];
}

/** Adds a step-by-step processing history to each seeded file. */
export function withHistory(files) {
  return files.map((f) => {
    const h = [];
    const t = (min) => new Date(new Date(f.receivedAt || f.expectedBy).getTime() + min * 60000).toISOString();
    if (f.receivedAt) {
      h.push(...earlierFailures(f));
      h.push({ at: t(0), by: "System", step: "Received", text: { email: "Attachment taken from recon.ops@camsonline.com", auto: "Downloaded by portal bot", api: "Pulled from bank API", manual: "Uploaded by operator", sftp: `Discovered in SFTP folder /inbound/${f.bankName.split(" ")[0].toLowerCase()}/${f.accountNumber.slice(-4)}/` }[f.channel] });
      h.push({ at: t(1), by: "System", step: "Parsed", text: `${f.rows} rows read` });
      const bad = f.checks.filter((c) => !c.ok);
      if (bad.length) h.push({ at: t(2), by: "System", step: "Checks failed", text: bad.map((c) => c.label).join("; "), bad: true });
      else h.push({ at: t(2), by: "System", step: "Checks passed", text: "All checks passed" });
      if (f.kind === "redump") { f.txnDup.dumps.forEach(([tm, n, skip]) => h.push({ at: todayAt(...tm.split(":").map(Number)), by: "System", step: `Full-day file received ${tm}`, text: `${n} rows in file · ${n - skip} new rows loaded · ${skip} already loaded earlier — skipped` })); }
      else if (f.status === "loaded") h.push({ at: t(3), by: "System", step: "Loaded", text: `${f.credits} credits loaded for matching` });
    } else {
      h.push({ at: f.expectedBy, by: "System", step: "Not received yet", text: f.channel === "manual" ? "Waiting for the operator to upload it" : "Nothing arrived by the expected time. The bank may not have published it yet, or there were no transactions." });
      h.push({ at: new Date(new Date(f.expectedBy).getTime() + 15 * 60000).toISOString(), by: "System", step: "Reminder sent", text: "Daily reminder to the file owner and the bank's relationship manager" });
    }
    return { ...f, history: h, attempts: f.receivedAt ? 1 : 0 };
  });
}

export function seedEmails(files) {
  const at = (h, m) => todayAt(h, m);
  const ac = (i) => files[i].accountNumber.slice(-4);
  const e = (id, h, m, from, subject, attach, status, extra = {}) => ({ id, receivedAt: at(h, m), from, to: "recon.ops@camsonline.com", subject, attachment: attach, status, ...extra });
  return [
    e("em_1", 8, 52, "statements@hdfcbank.com", `Account Statement ${new Date().toISOString().slice(0, 10)} A/c XXXX${ac(0)}`, { name: files[0].fileName, type: "csv", size: "412 KB" }, "matched", { fileId: files[0].id, setup: `HDFC Bank ·${ac(0)} (email)` }),
    e("em_2", 8, 55, "estatement@axisbank.com", "Daily MIS statement", { name: files[5].fileName, type: "csv", size: "288 KB" }, "matched", { fileId: files[5].id, setup: `Axis Bank ·${ac(5)} (email)` }),
    e("em_3", 9, 2, "noreply@kotak.com", `Statement KKBK ${ac(10)}`, { name: files[10].fileName, type: "csv", size: "390 KB" }, "matched", { fileId: files[10].id, setup: `Kotak Mahindra Bank ·${ac(10)} (email)`, reasonText: "Same file name as 11:00 — a full-day dump. 10 new rows loaded; 20 already loaded earlier were skipped." }),
    e("em_4", 9, 14, "corporate.statements@icicibank.com", `ICICI corporate statement ·${ac(3)}`, { name: "statement.zip", type: "zip", size: "120 KB", passwordProtected: true }, "rejected", { reason: "zip_password", reasonText: "The ZIP password stored in the vault didn't open the file. The bank may have changed it.", setup: `ICICI Bank ·${ac(3)} (email backup)` }),
    e("em_5", 9, 21, "alerts@sbi.co.in", `SBI e-statement A/c ${ac(7)}`, { name: `SBI_${ac(7)}_statement.xlsx`, type: "xlsx", size: "88 KB" }, "rejected", { reason: "no_setup", reasonText: `No email setup matches this sender and subject. SBI ·${ac(7)} is set up for Manual upload — and that statement is still missing today.`, suggestFileId: files[7].id }),
    e("em_6", 9, 33, "statements@yesbank.in", "Statement for your account", { name: "", type: "", size: "" }, "rejected", { reason: "no_attachment", reasonText: "Looks like a Yes Bank statement email, but it had no attachment." }),
    e("em_7", 9, 40, "statements@indusind.com", "IndusInd statement 21 Oct", { name: `INDB_${ac(13)}.docx`, type: "docx", size: "40 KB" }, "rejected", { reason: "bad_type", reasonText: "Attachment type .docx isn't allowed. The setup expects CSV or XLSX." }),
    e("em_8", 9, 44, "statements@indusind.com", "IndusInd statement 21 Oct (resent)", { name: files[13].fileName, type: "csv", size: "201 KB" }, "matched", { fileId: files[13].id, setup: `IndusInd Bank ·${ac(13)} (email)` }),
    e("em_9", 7, 58, "offers@somebank.com", "Exclusive offer on corporate cards", { name: "", type: "", size: "" }, "ignored", { reasonText: "Not a statement email (no setup, marketing sender)" }),
    e("em_10", 8, 41, "mis@billdesk.com", "BillDesk settlement MIS 21 Oct", { name: "BillDesk_Settlement_MIS_21Oct.pdf", type: "pdf", size: "64 KB" }, "matched", { setup: "BillDesk Credit MIS → Document reading", doc: true }),
  ];
}

export function seedConnections(files) {
  const ago = (min) => new Date(now - min * 60000).toISOString();
  const inn = (min) => new Date(now + min * 60000).toISOString();
  const ac = (i) => files[i].accountNumber.slice(-4);
  const c = (id, i, type, status, extra) => ({ id, fileId: files[i].id, bankName: files[i].bankName, acct: ac(i), type, status, ...extra });
  return [
    c("cn_1", 2, "api", "healthy", { endpoint: "api.hdfcbank.com/corp/v2/statements", every: 30, lastPull: ago(12), nextPull: inn(18), latencyMs: 640, recordsToday: 1882, successRate: [100, 100, 100, 98, 100, 100, 100], tokenExpires: inn(60 * 24 * 21) }),
    c("cn_2", 9, "api", "degraded", { userTrigger: false, endpoint: "openapi.kotak.com/v1/acct/stmt", every: 30, lastPull: ago(48), nextPull: inn(2), latencyMs: 8900, recordsToday: 744, successRate: [100, 96, 88, 72, 80, 66, 70], error: "3 of the last 6 pulls timed out (over 8 s). Data is arriving, but late.", tokenExpires: inn(60 * 24 * 9) }),
    c("cn_3", 15, "api", "failing", { endpoint: "api.yesbank.in/corporate/statement", every: 30, lastPull: ago(185), nextPull: inn(5), latencyMs: 0, recordsToday: 0, successRate: [100, 100, 100, 0, 0, 0, 0], error: "401 Unauthorized — the API token expired at 06:40 today.", tokenExpires: ago(60 * 3), authIssue: true }),
    c("cn_4", 1, "auto", "healthy", { endpoint: "Portal bot · netbanking.hdfcbank.com", every: 60, lastPull: ago(31), nextPull: inn(29), latencyMs: 41000, recordsToday: 1204, successRate: [100, 100, 100, 100, 100, 100, 100] }),
    c("cn_5", 6, "auto", "failing", { endpoint: "Portal bot · corporate.axisbank.co.in", every: 60, lastPull: ago(95), nextPull: inn(25), latencyMs: 0, recordsToday: 0, successRate: [100, 100, 100, 100, 50, 0, 0], error: "The portal now shows a CAPTCHA at login. The bot can't get past it, so someone has to download this statement by hand and upload it.", captcha: true }),
  ];
}

// ---------------------------------------------------------------------------
// Closing balances per account (bank statement) — last upload time and last closing balance
// ---------------------------------------------------------------------------
export function seedBalances() {
  // One row per bank account. Times are minutes since midnight today.
  // Statements are downloaded after 3 PM; the check uses the last transaction before 3 PM and compares its
  // closing balance with the system's closing balance. Matched accounts are then swept (fund utilisation).
  const R2 = rng(4242);
  const rows = [];
  let n = 0;
  BANKS.forEach((b) => (ACCOUNTS[b.name] || []).forEach((a) => {
    n++;
    R2();
    const stmt = n % 13 === 5 ? "not_received" : n % 7 === 3 ? "no_txn" : "txn"; // spread across AMCs
    const closing = Math.round((2e6 + R2() * 4e8) * 100) / 100;
    const mismatch = stmt !== "not_received" && R2() < (stmt === "no_txn" ? 0.05 : 0.12);
    const diff = mismatch ? Math.round((5000 + R2() * 900000) * 100) / 100 * (R2() < 0.5 ? -1 : 1) : 0;
    const sweepRoll = R2();
    const sweep = stmt === "not_received" || mismatch ? null : sweepRoll < 0.72 ? "full" : sweepRoll < 0.86 ? "partial" : "pending";
    rows.push({
      id: "bal_" + n, amc: amcFor(n), bankName: b.name, accountNumber: a.accountNumber, schemeCode: a.schemeCode, schemeName: a.schemeName, assetClass: a.assetClass,
      accountType: a.category === "Pool" ? "common" : "scheme",
      stmt,
      downloadedAt: stmt === "not_received" ? null : 15 * 60 + 2 + Math.floor(R2() * 80),
      lastTxnAt: stmt === "txn" ? 9 * 60 + Math.floor(R2() * 359) : null,
      closing, // bank closing balance as at the last transaction before 3 PM (or the opening balance when nothing moved)
      systemClosing: Math.round((closing + diff) * 100) / 100,
      prevClosing: Math.round(closing * (0.92 + R2() * 0.14) * 100) / 100,
      source: b.code === "SCBL" ? "computed" : "bank", // Standard Chartered gives none; computed from our data
      sweep, sweepAt: sweep === "full" ? 11 * 60 + Math.floor(R2() * 330) : sweep === "partial" ? 12 * 60 + Math.floor(R2() * 270) : null, // sweeps run through the day
      sweptPct: sweep === "partial" ? 40 + Math.floor(R2() * 50) : sweep === "full" ? 100 : 0,
    });
  }));
  return rows;
}

// ---------------------------------------------------------------------------
// Scheduler monitor — one row per job, per topic and channel
// ---------------------------------------------------------------------------
export function seedJobs() {
  // Times are stored as minutes relative to "now" so the monitor always reads live (never stale after a day).
  // source: where files land — SFTP (GCS bucket), API, or UI upload. Portal bots drop into the same SFTP/GCS landing area.
  // amcs: AMCs whose files the job carries (null = every AMC).
  const j = (id, topic, channel, name, every, everyMin, lastAgo, recvAgo, status, remarks, extra = {}) => ({ id, topic, channel, source: channel === "api" ? "api" : channel === "ui" ? "ui" : "sftp", name, every, everyMin, lastAgo, recvAgo, status, remarks, amcs: null, ...extra });
  return [
    j("job_1", "bank", "sftp", "SFTP pickup — priority accounts (14)", "every 15 min, all day", 15, 6, 6, "success", "14 accounts scanned · 9 files picked up"),
    j("job_2", "bank", "sftp", "SFTP pickup — other accounts (186)", "every 30 min after priority run", 30, 14, 22, "success", "186 accounts scanned · 41 files picked up"),
    j("job_3", "bank", "sftp", "SFTP pickup — HDFC Bank folder", "every 15 min", 15, 9, 9, "failure", "Format mismatch: 11 columns vs approved 10 — rows held", { amcs: ["HDFC Mutual Fund", "DSP Mutual Fund"] }),
    j("job_4", "bank", "api", "HDFC Bank statement API", "every 30 min", 30, 12, 12, "success", "1,882 records", { amcs: ["HDFC Mutual Fund", "ICICI Prudential MF", "Nippon India MF"] }),
    j("job_5", "bank", "api", "Kotak statement API", "every 30 min (run by IT)", 30, 18, 48, "failure", "3 of the last 6 pulls timed out", { amcs: ["Kotak Mahindra MF", "Aditya Birla Sun Life MF"] }),
    j("job_6", "bank", "api", "Yes Bank statement API", "every 30 min", 30, 25, 185, "failure", "Login refused — access token expired", { amcs: ["ICICI Prudential MF", "Nippon India MF"] }),
    j("job_7", "bank", "auto", "Portal bot — HDFC net banking", "every 60 min", 60, 31, 31, "success", "1,204 records", { amcs: ["HDFC Mutual Fund"] }),
    j("job_8", "bank", "auto", "Portal bot — Axis corporate", "every 60 min", 60, 35, 155, "failure", "Website asked for a human check (CAPTCHA)", { amcs: ["Aditya Birla Sun Life MF", "Kotak Mahindra MF"] }),
    j("job_9", "bank", "sftp", "Direct-match scheduler (12 UPI accounts)", "every 10 min", 10, 4, null, "success", "312 credits matched directly by UTR"),
    j("job_10", "credit", "sftp", "Credit MIS SFTP — Razorpay CMS", "every 30 min", 30, 9, 9, "success", "2 files · 4,410 rows"),
    j("job_11", "credit", "api", "Credit MIS API — Razorpay Online", "every 15 min", 15, 7, 7, "success", "1,120 rows"),
    j("job_12", "credit", "auto", "Credit MIS portal bot — BillDesk", "daily 09:00", 1440, 160, 160, "success", "1 file · 640 rows", { amcs: ["HDFC Mutual Fund", "Aditya Birla Sun Life MF", "DSP Mutual Fund"] }),
    j("job_13", "credit", "sftp", "Credit MIS SFTP — CAMSPay", "every 30 min", 30, 64, 64, "failure", "Scheduler missed its last slot (worker restarted)", { missed: true }),
    j("job_17", "remitter", "sftp", "Remitter file pickup — SFTP", "every 30 min", 30, 17, 17, "success", "3 files · 212 remitters"),
    j("job_18", "remitter", "ui", "GCS pickup — remitter files uploaded on screen", "every 5 min", 5, 2, 41, "success", "1 file · 48 remitters"),
    j("job_19", "bank", "ui", "GCS pickup — statements uploaded on screen", "every 5 min", 5, 3, 26, "success", "2 files picked up"),
    j("job_20", "credit", "ui", "GCS pickup — Credit MIS uploaded on screen", "every 5 min", 5, 1, 95, "success", "1 file picked up"),
    j("job_14", "other", "sftp", "Reverse feed pickup — Fundnet", "every 20 min", 20, 11, 11, "success", "18 files"),
    j("job_15", "other", "sftp", "Cheque scan pickup — branch scans", "every 60 min", 60, 40, 40, "success", "36 images"),
    j("job_16", "other", "api", "NAV & scheme master sync", "daily 07:00", 1440, 280, 280, "success", "All schemes updated"),
  ];
}

/** Real-time file tracking: landed (SFTP or UI upload, both into GCS) → picked up → processed, including files removed before pickup. */
export function seedFileTrack() {
  // Minutes ago for each stage (null = not reached), so the live view stays current.
  const f = (id, name, folder, placed, picked, processed, outcome, note, amc, extra = {}) => ({ id, name, folder, placed, picked, processed, outcome, note, amc, source: "sftp", fileType: "bank", ...extra });
  return [
    f("ft_1", "HDFC_3337.csv", "/inbound/hdfc/3337/", 190, 186, 185, "failed", "Format mismatch (11 vs 10 columns)", "HDFC Mutual Fund"),
    f("ft_2", "ICIC_1108.csv", "/inbound/icici/1108/", 170, 162, 161, "success", "1,880 new rows", "ICICI Prudential MF"),
    f("ft_3", "SBIN_3313.xlsx", "/inbound/sbi/3313/", 130, 117, 116, "success", "740 new rows", "Aditya Birla Sun Life MF"),
    f("ft_4", "YESB_2216.csv", "/inbound/yes/2216/", 12, 8, null, "pending", "Reading — 60% of rows checked", "Nippon India MF"),
    f("ft_5", "SIBL_8855.xlsx", "/inbound/south/8855/", 5, null, null, "pending", "Waiting for the next pickup", "Kotak Mahindra MF"),
    f("ft_6", "INDB_5541.csv", "/inbound/indusind/5541/", 150, null, null, "removed", "File removed from the folder before pickup", "DSP Mutual Fund"),
    f("ft_7", "KKBK_0461.csv", "/inbound/kotak/0461/", 70, null, null, "missed", "Scheduler missed its slot — still not picked up", "Kotak Mahindra MF"),
    f("ft_8", "UTIB_9177.csv", "/inbound/axis/9177/", 215, 210, 208, "success", "2,104 new rows", "Aditya Birla Sun Life MF"),
    f("ft_9", "SCBL_2168.csv", "/inbound/scb/2168/", 95, 90, 89, "success", "612 new rows", "HDFC Mutual Fund"),
    f("ft_10", "CITI_6613.csv", "/inbound/citi/6613/", 60, 53, 52, "success", "388 new rows", "ICICI Prudential MF"),
    f("ft_11", "RZP_CMS_HDFCMF_20261027.csv", "/inbound/creditmis/razorpay/", 120, 111, 110, "success", "2,210 rows", "HDFC Mutual Fund", { fileType: "credit" }),
    f("ft_12", "CAMSPAY_ICICI_1027.xlsx", "/inbound/creditmis/camspay/", 66, null, null, "missed", "Scheduler missed its slot — still not picked up", "ICICI Prudential MF", { fileType: "credit" }),
    f("ft_13", "REMITTER_HDFCMF_1027_01.csv", "/inbound/remitter/", 80, 66, 65, "success", "124 remitters", "HDFC Mutual Fund", { fileType: "remitter" }),
    f("ft_14", "HDFC_0042_manual_1027.xlsx", "Uploaded on screen by Deepa Nair", 26, 23, 22, "success", "512 new rows", "HDFC Mutual Fund", { source: "ui", uploadedBy: "Deepa Nair" }),
    f("ft_15", "KKBK_0461_portal_1027.csv", "Uploaded on screen by Deepa Nair", 31, 28, 27, "success", "Covers the slot the scheduler missed", "Kotak Mahindra MF", { source: "ui", uploadedBy: "Deepa Nair" }),
    f("ft_16", "BILLDESK_ABSL_1027.csv", "Uploaded on screen by Priya Sharma", 95, 91, 90, "success", "640 rows", "Aditya Birla Sun Life MF", { source: "ui", fileType: "credit", uploadedBy: "Priya Sharma" }),
    f("ft_17", "REMITTER_ICICI_1027.xlsx", "Uploaded on screen by Deepa Nair", 41, 38, null, "pending", "Reading — 48 remitters", "ICICI Prudential MF", { source: "ui", fileType: "remitter", uploadedBy: "Deepa Nair" }),
    f("ft_18", "NIPPON_ICICI_4410.csv", "/inbound/icici/4410/", 44, 40, 39, "success", "906 new rows", "Nippon India MF"),
    f("ft_19", "DSP_HDFC_7781.csv", "/inbound/hdfc/7781/", 101, 97, 96, "success", "310 new rows", "DSP Mutual Fund"),
  ];
}

// ---------------------------------------------------------------------------
// Liability side: payout debits in the bank statement vs payout instructions (redemption, dividend, switch, brokerage)
// ---------------------------------------------------------------------------
export function seedLiability() {
  const d = (i, type, payee, amount, ageDays, utrNo, extra = {}) => ({ type, payee, amount, valueDate: new Date(now - ageDays * day).toISOString(), utr: utrNo, ...extra, i });
  const rows = [
    d(1, "Redemption", "RAJESH KUMAR SHARMA", 250000, 0, "HDFCN52610221001"), d(2, "Redemption", "ANITA DESAI", 75000, 0, "HDFCN52610221002"),
    d(3, "Dividend", "LAKSHMI VENKATESAN", 4120, 1, "HDFCN52610211877"), d(4, "Switch", "ARJUN MALHOTRA", 100000, 0, "ICICN52610221010"),
    d(5, "Brokerage", "NJ INDIA INVEST PVT LTD", 182340, 1, "ICICN52610211990"), d(6, "Redemption", "FATIMA SHAIKH", 50000, 0, null),
    d(7, "Dividend", "MOHAMMED IRFAN", 980, 0, "HDFCN52610221030"),
  ];
  const debits = rows.map((r) => ({ id: "ld_" + r.i, amc: amcFor(r.i), ref: "DR-" + (61000 + r.i), bankName: r.i % 2 ? "HDFC Bank" : "ICICI Bank", valueDate: r.valueDate, amount: r.amount,
    narration: r.utr ? `NEFT-${r.utr}-${r.payee.split(" ")[0]}-${r.type.toUpperCase()}` : `IMPS-${r.payee.split(" ")[0]}-PAYOUT`, status: "open" }));
  const payouts = rows.map((r) => ({ id: "lp_" + r.i, amc: amcFor(r.i), ref: { Redemption: "RED", Dividend: "IDCW", Switch: "SWT", Brokerage: "BRK" }[r.type] + "-" + (88200 + r.i), type: r.type, payee: r.payee, amount: r.amount, payDate: r.valueDate, utr: r.utr, status: "open" }));
  payouts.push({ id: "lp_9", amc: amcFor(9), ref: "RED-88209", type: "Redemption", payee: "FATIMA SHAIKH", amount: 50000, payDate: new Date(now - day).toISOString(), utr: null, status: "open" });
  return { debits, payouts };
}
