import { BANKS, ACCOUNTS } from "./bankMaster";
// Simulated sample files + believable auto-detection.
// CSV is parsed "for real" with a tiny parser; XLS/XLSX/PDF use canned previews.

export const DEMO_FILES = {
  "hdfc_statement_sep.csv": {
    kind: "csv",
    label: "hdfc_statement_sep.csv",
    size: "48 KB",
    detect: { fileType: "CSV", separator: ",", startRow: 12, startColumn: 1 },
    dateSample: "03/04/2026",
    ambiguousDate: true,
    status: { style: "separate", note: "Separate Debit and Credit columns — no status column needed" },
    raw:
      "HDFC BANK LTD\n" +
      "Regd. Office: HDFC House, Churchgate, Mumbai 400020\n" +
      "Account Statement\n" +
      "Statement for period: 01/09/2026 to 30/09/2026\n" +
      "Account No: XXXXXX3337\n" +
      "Scheme: Liquid Fund — Direct Growth\n" +
      "IFSC: HDFC0000010\n" +
      "Branch: Fort, Mumbai\n" +
      "Currency: INR\n" +
      "This is a system generated statement.\n" +
      "---------------------------------------------\n" +
      "Txn Date,Value Date,Narration,Cheque No,Debit,Credit,Running Balance\n" +
      "03/04/2026,03/04/2026,UPI-RAZORPAY-SIP-COLLECTION,,,25000.00,1425000.00\n" +
      "04/04/2026,04/04/2026,NEFT-CAMSPAY-SUBSCRIPTION,,,150000.00,1575000.00\n" +
      "05/04/2026,05/04/2026,RTGS-REDEMPTION-PAYOUT,,80000.00,,1495000.00\n" +
      "06/04/2026,06/04/2026,UPI-BILLDESK-SIP,,,12500.00,1507500.00\n" +
      "07/04/2026,07/04/2026,BANK CHARGES GST,,118.00,,1507382.00",
  },
  "south_indian_bank.xlsx": {
    kind: "xlsx",
    label: "south_indian_bank.xlsx",
    size: "22 KB",
    detect: { fileType: "XLSX", separator: null, startRow: 8, startColumn: 2 },
    dateSample: "15-09-2026",
    ambiguousDate: false,
    status: { style: "sign", note: "One Amount column — positive = credit, negative = debit", values: ["Positive Amount", "Negative Amount"] },
    preview: [
      ["", "SOUTH INDIAN BANK", "", "", "", ""],
      ["", "T.B Road, Thrissur, Kerala 680001", "", "", "", ""],
      ["", "Collection Account Statement", "", "", "", ""],
      ["", "Period: 01-09-2026 - 30-09-2026", "", "", "", ""],
      ["", "A/C: XXXXXX8855", "", "", "", ""],
      ["", "Scheme: Short Term Bond", "", "", "", ""],
      ["", "", "", "", "", ""],
      ["", "Date", "Particulars", "UTR", "Amount", "Balance"],
      ["", "15-09-2026", "UPI/RAZORPAY/SUBSCRIPTION", "SIBLR8821", "+45000.00", "890000.00"],
      ["", "16-09-2026", "NEFT/PAYU/SIP", "UTIBR2211", "+18000.00", "908000.00"],
      ["", "17-09-2026", "RTGS/REDEMPTION", "SBINR5567", "-120000.00", "788000.00"],
      ["", "18-09-2026", "UPI/CASHFREE/SUB", "ICICR9090", "+7500.00", "795500.00"],
    ],
  },
  "idbi_statement_oct.csv": {
    kind: "csv",
    label: "idbi_statement_oct.csv",
    size: "31 KB",
    detect: { fileType: "CSV", separator: ",", startRow: 4, startColumn: 1 },
    dateSample: "20/10/2026",
    ambiguousDate: false,
    status: { style: "column", column: "Dr/Cr", note: "A Dr/Cr column says whether each row is a credit or a debit" },
    raw:
      "IDBI BANK LTD - CURRENT ACCOUNT STATEMENT\n" +
      "A/C XXXXXXXX3313 | 01/10/2026 - 20/10/2026\n" +
      "\n" +
      "Tran Date,Value Date,Description,Ref No,Amount,Dr/Cr,Balance\n" +
      "20/10/2026,20/10/2026,UPI/RAZORPAY/SIP/88213,IDBR88213,25000.00,CR,925000.00\n" +
      "20/10/2026,20/10/2026,NEFT/CAMSPAY/SUB/77120,IDBN77120,150000.00,CR,1075000.00\n" +
      "20/10/2026,20/10/2026,RTGS/REDEMPTION/PAYOUT,IDBR55671,80000.00,DR,995000.00\n" +
      "20/10/2026,20/10/2026,UPI/RAZORPAY/SIP/88213 RETURN,IDBR88213,25000.00,REV,970000.00\n" +
      "21/10/2026,21/10/2026,UPI/BILLDESK/SIP/66001,IDBR66001,12500.00,CR,982500.00",
  },
  "sbin_3313_20261020.sta": {
    kind: "mt940",
    label: "sbin_3313_20261020.sta",
    size: "6 KB",
    standard: true,
    detect: { fileType: "MT940", separator: null, startRow: 0, startColumn: 1 },
    dateSample: "261020",
    ambiguousDate: false,
    raw:
      ":20:SBIN3313201026\n" +
      ":25:SBIN0000300/38103313\n" +
      ":28C:00291/001\n" +
      ":60F:C261019INR895000,00\n" +
      ":61:2610201020C25000,00NTRFIDBR88213//UTR88213\n" +
      ":86:UPI/RAZORPAY/SIP/88213\n" +
      ":61:2610201020C150000,00NTRFNONREF//UTR77120\n" +
      ":86:NEFT/CAMSPAY/SUB/77120\n" +
      ":61:2610201020D80000,00NTRFNONREF//UTR55671\n" +
      ":86:RTGS/REDEMPTION/PAYOUT\n" +
      ":62F:C261020INR990000,00",
    parsed: [
      ["Value date", "C/D", "Amount", "Reference", "Narration (:86:)"],
      ["20-10-2026", "C", "25,000.00", "UTR88213", "UPI/RAZORPAY/SIP/88213"],
      ["20-10-2026", "C", "1,50,000.00", "UTR77120", "NEFT/CAMSPAY/SUB/77120"],
      ["20-10-2026", "D", "80,000.00", "UTR55671", "RTGS/REDEMPTION/PAYOUT"],
    ],
  },
  "fake_xls_actually_html.xls": {
    kind: "xls",
    label: "fake_xls_actually_html.xls",
    size: "61 KB",
    mismatch: true,
    detect: { fileType: "CSV", separator: ",", startRow: 3, startColumn: 1 },
    dateSample: "2026-09-10",
    ambiguousDate: false,
    preview: [
      ["<html><body>", "", "", ""],
      ["Kotak Portal Export", "", "", ""],
      ["Date", "Description", "Credit", "Balance"],
      ["2026-09-10", "IMPS CAMSPAY SUBSCRIPTION", "33000.00", "733000.00"],
      ["2026-09-11", "UPI RAZORPAY SIP", "9000.00", "742000.00"],
      ["2026-09-12", "NEFT PAYU REDEMPTION", "-21000.00", "721000.00"],
    ],
  },
};

// Tiny CSV parser
export function parseCSV(raw, sep = ",") {
  return raw.split("\n").map((line) => line.split(sep));
}

// Return 10-row preview matrix + detected header row index (0-based within preview)
export function buildPreview(fileName) {
  const f = DEMO_FILES[fileName];
  if (!f) return null;
  let rows;
  if (f.kind === "mt940") {
    rows = f.raw.split("\n").map((l) => [l]);
  } else if (f.kind === "csv" && f.raw) {
    rows = parseCSV(f.raw).slice(0, 40);
  } else {
    rows = f.preview.slice(0, 40);
  }
  const headerIdx = f.detect.startRow - 1;
  return { rows, headerIdx, detect: f.detect, meta: f };
}

export function detectFor(fileName) {
  return DEMO_FILES[fileName] || null;
}

/** Header + data rows of a sample (for the duplicate-key test and status values). */
export function sampleTable(fileName) {
  const p = buildPreview(fileName);
  if (!p || p.headerIdx < 0) return null;
  const header = p.rows[p.headerIdx];
  const data = (DEMO_FILES[fileName].kind === "csv" ? parseCSV(DEMO_FILES[fileName].raw) : DEMO_FILES[fileName].preview).slice(p.headerIdx + 1).filter((r) => r.some((c) => c && c.trim()));
  return { header, data };
}

// Bank-name fuzzy match: "HDFC BANK LTD" / "HDFC Bank Limited" → "HDFC Bank".
const norm = (x) => String(x).toUpperCase().replace(/\b(LTD|LIMITED|BANK|THE|CORPORATE|ACCOUNT|STATEMENT|CURRENT|-)\b/g, " ").replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
function nameScore(a, b) { const A = norm(a).split(" ").filter(Boolean), B = norm(b).split(" ").filter(Boolean); if (!A.length || !B.length) return 0; const hit = A.filter((t) => B.includes(t)).length; return hit / Math.max(A.length, B.length); }

/** Finds the printed bank name and account number in a sample and matches them to the Bank Master. */
export function detectAccountInSample(fileName) {
  const f = DEMO_FILES[fileName];
  if (!f) return null;
  const text = f.raw ? f.raw.split("\n").slice(0, 12) : (f.preview || []).slice(0, 8).map((r) => r.join(" "));
  const acctLine = text.find((l) => /(A\/?C|Account No)[^0-9X]*[X*]*\d{4,}/i.test(l) || /^:25:/.test(l));
  if (!acctLine) return null;
  const printedAcct = (acctLine.match(/[X*]*\d{4,}/i) || [""])[0];
  const tail = printedAcct.replace(/\D/g, "").slice(-4);
  const printedBank = (text.find((l) => /BANK/i.test(l)) || "").split(/[-|,]/)[0].trim();
  let best = null;
  BANKS.forEach((b) => {
    const sc = printedBank ? nameScore(printedBank, b.name) : 0;
    (ACCOUNTS[b.name] || []).forEach((a) => {
      const ok = a.accountNumber.endsWith(tail) || a.accountNumber.endsWith(String(tail).slice(-4));
      const score = sc + (ok ? 1 : 0);
      if (!best || score > best.total) best = { total: score, score: sc, bankName: b.name, bankCode: b.code, accountNumber: a.accountNumber, printedAcct, printedBank: printedBank || "(no bank name printed)" };
    });
  });
  return best && best.total >= 1 && (!/BANK/i.test(best.printedBank) || best.score > 0) ? best : null;
}
