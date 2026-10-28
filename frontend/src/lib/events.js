// Event definitions behind the Today list. "dedupe" events repeat on every scheduler run until fixed
// (a file layout error, a failing API or bot): they show once, dated to the first occurrence, with a repeat count.
// Events that are distinct each time (a rejected email, a problem case, a refund) are never merged.
// Keep this table in step with the PRD section "Today — event definitions and de-duplication".

export const EVENT_TYPES = {
  file_format: { label: "File format error", dedupe: true, key: "bank account + error", why: "Same layout problem is re-detected on every pickup until the setup or file is fixed" },
  file_layout_changed: { label: "Bank changed its file layout", dedupe: true, key: "bank account", why: "Every new file from the account fails the fingerprint until the new layout is approved" },
  file_unknown: { label: "Unrecognised file", dedupe: true, key: "file fingerprint", why: "The same unknown file lands again on every run" },
  api_failure: { label: "API failure", dedupe: true, key: "connection", why: "Each scheduled pull fails the same way until the token or endpoint is fixed" },
  bot_failure: { label: "Portal bot failure", dedupe: true, key: "connection", why: "Each bot run hits the same block (e.g. CAPTCHA) until someone steps in" },
  manual_upload_late: { label: "Manual SFTP upload late", dedupe: false, why: "Each day's upload is a separate expectation" },
  statement_missing: { label: "Statement late or missing", dedupe: false, why: "Each day's statement is a separate expectation" },
  rejected_email: { label: "Rejected email", dedupe: false, why: "Every email is its own message and may carry a different attachment" },
  problem_case: { label: "Problem case", dedupe: false, why: "Each case is a separate payment or purchase" },
  match_suggestion: { label: "Suggested match", dedupe: false, why: "Each suggestion pairs different payments" },
  document_review: { label: "Document to check", dedupe: false, why: "Each document is separate" },
  refund: { label: "Refund", dedupe: false, why: "Each refund is separate" },
  rejected_setup: { label: "Setup sent back", dedupe: false, why: "Each rejection carries its own checker comment" },
  release: { label: "Fund release", dedupe: false, why: "Once per day" },
  day_close: { label: "Day close", dedupe: false, why: "Once per day" },
};

/**
 * Auto-void: when a later scheduler run for the same file succeeds, earlier error rows from runs it supersedes
 * are voided automatically (kept for audit, struck through). Only for errors a later success genuinely fixes —
 * a rejected email, a discarded duplicate or a user's rejected upload of a *different* file are never voided.
 */
export const VOIDABLE_STEPS = [/^Pull failed/, /^Bot run failed/, /^Scheduler missed/, /^Not received yet/, /^Checks failed/, /^Reprocess failed/, /^Upload rejected/];
export const SUCCESS_STEPS = [/^Loaded$/, /^Full-day file received/];
/** Returns history rows with { voided, voidedAt } set on errors that a later success superseded. */
export function withAutoVoid(history = []) {
  const okAt = history.map((h, i) => (SUCCESS_STEPS.some((r) => r.test(h.step)) ? i : -1)).filter((i) => i >= 0);
  const lastOk = okAt.length ? okAt[okAt.length - 1] : -1;
  return history.map((h, i) => (i < lastOk && (h.bad || /^Not received yet/.test(h.step)) && VOIDABLE_STEPS.some((r) => r.test(h.step)) ? { ...h, voided: true, voidedAt: history[lastOk].at } : h));
}

/** Reasons a maker can give for taking no action. Each goes to their supervisor and feeds the event-definition review. */
export const NO_ACTION_REASONS = [
  "Already handled outside the system",
  "Not a real issue (false alarm)",
  "Expected — known bank or partner behaviour",
  "Duplicate of another item",
  "Not my AMC or team",
  "Other",
];

/** Supervisor who reviews a maker's No-action calls. Prototype mapping; production reads it from the IDM reporting line. */
export const SUPERVISOR_OF = { usr_deepa: "Kavita Menon", usr_priya: "Kavita Menon", usr_kiran: "Kavita Menon", usr_farhan: "Kavita Menon", usr_arun: "Kavita Menon" };
export const supervisorOf = (u) => SUPERVISOR_OF[u?.id] || "Kavita Menon";

const DAY = 86400000;
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * When a repeating event first happened and how often it has repeated since.
 * Prototype: derived from the record id so it is stable across reloads; production reads the event log.
 */
export function repeatHistory(id, everyMin, maxDaysBack = 3) {
  const daysBack = hash(id) % (maxDaysBack + 1);
  const first = new Date(Date.now() - daysBack * DAY - ((hash(id + "h") % 300) + 30) * 60000);
  const count = Math.max(2, Math.floor((Date.now() - first.getTime()) / (everyMin * 60000)));
  return { firstAt: first.toISOString(), lastAt: new Date(Date.now() - (hash(id + "l") % everyMin) * 60000).toISOString(), count };
}

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const isoDay = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
export const fmtDay = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const ageWords = (d) => { const n = Math.floor((startOfDay(Date.now()) - startOfDay(d)) / DAY); return n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`; };

/** Sample No-action calls so the supervisor review has history (prototype only). */
export function seedNoAction() {
  const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
  const n = (id, by, eventType, title, detail, reason, comment, atH, status, firstH, count, extra = {}) => ({ id, itemId: id.replace("na_", "seed_"), by, supervisor: "Kavita Menon", eventType, kind: EVENT_TYPES[eventType].label, title, detail, reason, comment, at: ago(atH), status, firstAt: ago(firstH), count, amc: "HDFC Mutual Fund", ...extra });
  return [
    n("na_1", "Deepa Nair", "file_layout_changed", "HDFC Bank changed its file layout", "Account ·3337 · arrives by SFTP", "Expected — known bank or partner behaviour", "HDFC adds a blank 'Remarks' column on month-end files; data is fine.", 3, "pending", 52, 38),
    n("na_2", "Deepa Nair", "api_failure", "Kotak statement API is failing", "3 of the last 6 pulls timed out", "Not a real issue (false alarm)", "Pulls are slow, not failing — every file arrived by 10:40.", 5, "pending", 30, 12),
    n("na_3", "Priya Sharma", "rejected_email", "Email from alerts@icicibank.com was rejected", "Not a statement — balance alert", "Not a real issue (false alarm)", "Daily balance alert, not a statement.", 7, "pending", 8, 1, { amc: "ICICI Prudential MF" }),
    n("na_4", "Deepa Nair", "file_format", "Axis Bank statement balances don't add up", "Account ·9177 · arrives by portal bot", "Already handled outside the system", "Bank re-sent the corrected file by email; loaded by hand.", 26, "agreed", 74, 21, { reviewedAt: ago(22), reviewNote: "Fine. Raise a setup change so email is the fallback." }),
    n("na_5", "Priya Sharma", "file_layout_changed", "ICICI Bank changed its file layout", "Account ·1108 · arrives by SFTP", "Expected — known bank or partner behaviour", "Same as HDFC: month-end remarks column.", 30, "agreed", 80, 44, { amc: "ICICI Prudential MF", reviewedAt: ago(27), reviewNote: "Agreed — 2nd bank doing this. Asking rule owners to ignore empty trailing columns." }),
    n("na_6", "Deepa Nair", "statement_missing", "South Indian Bank statement hasn't arrived", "Account ·8855 · arrives by SFTP", "Not my AMC or team", "", 49, "sent_back", 50, 1, { reviewedAt: ago(45), reviewNote: "This account is HDFC MF — it is yours. Please chase the bank." }),
    n("na_7", "Priya Sharma", "bot_failure", "Axis Bank portal bot is failing", "CAPTCHA at login", "Already handled outside the system", "Downloaded by hand at 11:05 and uploaded.", 70, "agreed", 96, 9, { reviewedAt: ago(66), reviewNote: "OK. IT ticket raised for the CAPTCHA." }),
  ];
}

/**
 * Fingerprint cases the AI layout mapping could not resolve on its own: an unrecognised file, or a layout change
 * where any proposed column is below the confidence bar. Logged to the product report so the team can act on them.
 */
export const FP_CONFIDENCE_BAR = 0.85;
export function unresolvedFingerprints(files = []) {
  return files.flatMap((f) => {
    if (f.status === "unknown") return [{ file: f, reason: "File layout not recognised — no setup matches its fingerprint", lowest: null, fields: [] }];
    if (["drift", "drift_pending"].includes(f.status) && f.drift) {
      const weak = (f.drift.changes || []).filter((c) => c.confidence < FP_CONFIDENCE_BAR);
      if (weak.length) return [{ file: f, reason: `Layout changed — ${weak.length} column${weak.length > 1 ? "s" : ""} below ${Math.round(FP_CONFIDENCE_BAR * 100)}% confidence`, lowest: Math.min(...weak.map((c) => c.confidence)), fields: weak.map((c) => `${c.field}→${c.proposed}`) }];
    }
    return [];
  });
}
