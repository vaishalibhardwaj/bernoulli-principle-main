// Click-to-autofill mock data for prototype forms
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const n = (len) => String(Math.floor(Math.random() * Math.pow(10, len))).padStart(len, "0");

const slug = (bank) => (bank || "bank").split(" ")[0].toLowerCase();

export const MOCK = {
  url: (c) => `https://corp.${slug(c.bankName)}bank.com/cib/statements/export`,
  path: (c) => `/export/daily/${slug(c.bankName)}`,
  corporateId: () => "CAMS" + n(5),
  loginId: () => pick(["cams_recon_ops", "recon.priya", "cams_stmt_bot", "ops_mf_recon"]) + n(2),
  password: () => "Tr#" + n(4) + "Recon!",
  subjectPattern: (c) => `${c.bankName || "Bank"} Account Statement%`,
  sender: (c) => `statements@${slug(c.bankName)}bank.com`,
  receiver: () => pick(["recon.ops@camsonline.com", "creditmis@camsonline.com", "stmt.inbound@camsonline.com"]),
  uploadPath: (c) => `/inbound/${slug(c.bankName)}/${pick(["liquid", "equity", "pool"])}`,
  uploadUser: () => "sftp_cams_" + n(2),
  uploadPassword: () => "Sf#" + n(5) + "tp",
  startRow: () => pick(["1", "8", "12"]),
  startColumn: () => "1",
  separator: () => pick([",", "|", "~"]),
  fromEmail: () => pick(["mis@razorpay.com", "settlements@camspay.com", "reports@billdesk.com"]),
  receiverEmail: () => pick(["creditmis@camsonline.com", "collections@camsonline.com"]),
  subject: () => pick(["Daily Collection MIS", "Settlement File - Credit MIS", "HDFC Settlement File"]),
  fileNamePattern: () => pick(["CreditMIS_", "SETTLE_", "PA_CREDIT_"]),
  userId: () => "pa_cams_" + n(3),
  failureReasonCode: () => pick(["R01 — Insufficient funds", "R03 — Account closed", "R09 — Mandate expired", "NA"]),
};

export function mockValue(key, ctx = {}) {
  const fn = MOCK[key];
  return fn ? fn(ctx) : "";
}

// Spread onto an <input>: fills with mock data on focus when empty
export function af(key, value, apply, ctx) {
  return {
    onFocus: () => { if (!value) apply(mockValue(key, ctx)); },
    title: value ? undefined : "Click to auto-fill with sample data",
  };
}

export { pick };
