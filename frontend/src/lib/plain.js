// Plain-language wording for the simple view (daily back-office users).
// Rule of thumb: say what happened and what to do, in everyday words. No jargon, no percentages.

export const PLAIN_EXCEPTION = {
  "Unmatched credit": "Money received, no matching purchase",
  "Unmatched purchase": "Purchase made, money not received",
  "Excess credit": "Investor paid too much",
  "Short credit": "Investor paid too little",
  "Duplicate credit": "Investor paid twice",
  "NIGO rejection": "Application rejected — refund needed",
  "Fundnet failure": "Payment system error",
  "Cross collection": "Money meant for another AMC",
  "Format drift": "Bank changed its file layout",
  "Missing statement": "Bank file not received",
};

export const PLAIN_CASE_STATUS = {
  open: ["To do", "pill-draft"],
  in_progress: ["Working on it", "pill-pending"],
  pending_approval: ["Waiting for approval", "pill-pending"],
  closed: ["Done", "pill-active"],
};

export const PLAIN_FILE_STATUS = {
  loaded: "Received — all good",
  drift: "Bank changed its file layout",
  drift_pending: "Layout change waiting for approval",
  unknown: "File not recognised",
  check_failed: "Balances don't add up",
  duplicate: "Same file sent twice",
  discarded: "Duplicate removed",
  late: "Not received yet — late",
  missing: "Not received",
  retrying: "Trying again",
};

export const PLAIN_DOC_STATUS = {
  needs_review: ["Please check", "pill-pending"],
  auto_loaded: ["Done automatically", "pill-active"],
  ignored: ["Not needed (junk)", "pill-inactive"],
  approved: ["Done", "pill-active"],
  pending_checker: ["Waiting for approval", "pill-pending"],
};

/** Drop technical bits in brackets, e.g. "(name similarity 0.89)" or "(rule window ±1)", and swap jargon for everyday words. */
export const stripNumbers = (text) => String(text)
  .replace(/\s*\([^)]*\)/g, "")
  .replace(/Remitter IFSC \S+ = investor's registered bank/, "Paid from the investor's own bank account")
  .replace(/Remitter IFSC ≠ registered bank/, "Not paid from the investor's own bank account")
  .replace(/Remitter IFSC = registered bank/, "Paid from the investor's own bank account")
  .replace(/No UTR on purchase record.*/, "The purchase has no payment reference, so the system couldn't be 100% sure")
  .replace(/Remitter "(.+)" ≈ investor "(.+)"/, 'Name "$1" looks like "$2"')
  .replace(/PAN \S+ found in narration/, "The investor's PAN is in the bank description")
  .replace(/\bUTR\b/g, "payment reference")
  .replace(/\bnarration\b/g, "bank description")
  .replace(/\bCredit\b/g, "Payment")
  .replace(/remitter account/g, "the account the money came from")
  .replace(/PA settlement file/g, "payment company's file")
  .replace(/re-push to Fundnet|Re-push to Fundnet/g, "Send again to the payment system")
  .replace(/\bKYC\b/g, "KYC documents")
  .replace(/Value date (\d+) day after application date/, (m, n) => `Paid ${n} day${n === "1" ? "" : "s"} after the purchase`);

/** Field labels and checker messages on extracted documents. */
const FIELD_LABELS = { UTR: "Payment reference", "Settlement ID": "Settlement number", "Settlement UTR": "Settlement reference", "Net settled": "Amount received", "Gross amount": "Total before fees", "Credited account": "Paid into account" };
export const plainField = (label) => FIELD_LABELS[label] || label;
export const plainCheck = (msg) => String(msg)
  .replace("Invalid PAN format:", "PAN looks wrong —")
  .replace("in a digit position", "where a number should be")
  .replace("Candidate:", "Probably:")
  .replace(/Σ SUCCESS lines .* ✓/, "Totals add up ✓")
  .replace(/Σ \d+ lines − fees = net ✓/, "Totals add up ✓");
