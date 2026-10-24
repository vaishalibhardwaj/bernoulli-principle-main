// Bank Master mock — banks with IFSC prefixes and their accounts
export const BANKS = [
  { name: "HDFC Bank", code: "HDFC", ifsc: "HDFC0000" },
  { name: "ICICI Bank", code: "ICIC", ifsc: "ICIC0000" },
  { name: "Axis Bank", code: "UTIB", ifsc: "UTIB0000" },
  { name: "State Bank of India", code: "SBIN", ifsc: "SBIN0000" },
  { name: "Kotak Mahindra Bank", code: "KKBK", ifsc: "KKBK0000" },
  { name: "South Indian Bank", code: "SIBL", ifsc: "SIBL0000" },
  { name: "Yes Bank", code: "YESB", ifsc: "YESB0000" },
  { name: "IndusInd Bank", code: "INDB", ifsc: "INDB0000" },
  { name: "Standard Chartered Bank", code: "SCBL", ifsc: "SCBL0036" }, // statement carries no closing balance
  { name: "Citibank", code: "CITI", ifsc: "CITI0100" }, // now sends a closing balance
];

const SCHEMES = [
  { code: "LIQ-DIR-G", name: "Liquid Fund", asset: "Debt — Liquid" },
  { code: "BLU-REG-G", name: "Bluechip Equity", asset: "Equity — Large Cap" },
  { code: "MID-DIR-G", name: "Midcap Opportunities", asset: "Equity — Mid Cap" },
  { code: "GLT-REG-G", name: "Gilt Fund", asset: "Debt — Gilt" },
  { code: "BAL-DIR-G", name: "Balanced Advantage", asset: "Hybrid" },
  { code: "STB-REG-G", name: "Short Term Bond", asset: "Debt — Short Duration" },
];

// Build 3-6 accounts per bank
export const ACCOUNTS = {};
BANKS.forEach((b, bi) => {
  const n = 16 + ((bi * 7) % 9); // ~200 collection accounts across the banks
  ACCOUNTS[b.name] = Array.from({ length: n }, (_, i) => {
    const sc = SCHEMES[(bi + i) % SCHEMES.length];
    const num = `${b.code === "SBIN" ? "3" : "5"}${(100000000 + bi * 777771 + i * 13337).toString().slice(0, 10)}`;
    return {
      accountNumber: num,
      ifsc: b.ifsc + (10 + i),
      schemeCode: sc.code,
      schemeName: sc.name,
      assetClass: sc.asset,
      category: i % 2 === 0 ? "Pool" : "Scheme",
    };
  });
});

export function accountsFor(bankName) {
  return ACCOUNTS[bankName] || [];
}
export function accountMeta(bankName, accNum) {
  return accountsFor(bankName).find((a) => a.accountNumber === accNum);
}
