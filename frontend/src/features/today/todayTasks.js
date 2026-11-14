// Today's to-do for an Operations user, generated from task templates.
// A template is one piece of KRA work with the times it is due each day (bank statement upload at 9:00, 3:00 and 6:00)
// and the person it is assigned to (none = the whole Ops team). The functional manager creates and manages templates on the
// Team tasks screen, and Level 1 and Level 2 users assign them; the to-do list is rebuilt from them every day. All data is synthetic.
// `screen` is the access key that must be viewable for the "Open" link; `phase` marks work that lands later.

const at = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };

/** The seven areas of Ops work, in the order the day runs. */
export const AREAS = [
  { key: "upload", label: "Upload bank statements and operational files" },
  { key: "monitor", label: "Monitor bank statement and Credit MIS processing" },
  { key: "balances", label: "Track account-level closing balances" },
  { key: "missing", label: "Identify missing files and pending operational activities" },
  { key: "funds", label: "Monitor fund utilisation and non-utilisation" },
  { key: "recon", label: "Perform reconciliation across different source files" },
  { key: "exceptions", label: "Identify and resolve reconciliation exceptions" },
];

/** Sample KRAs for a Reconciliation Senior Executive. */
export const SAMPLE_KRAS = ["Bank statement download", "Bank statement upload", "Channel feed upload", "Transaction matching", "Excess credit monitoring", "Refund processing"];

const SLOT = (hhmm) => { const h = Number(hhmm.split(":")[0]); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };

/** Default templates. Times are 24-hour "HH:MM"; an empty list means no fixed time (`when` says when). */
export const DEFAULT_TEMPLATES = [
  { id: "tpl_bs_upload", area: "upload", kra: "Bank statement upload", title: "Upload bank statements", detail: "Statements for banks that block automated download (OTP or device login). Download from the bank portal, then upload.", times: ["09:00", "15:00", "18:00"], screen: "file_upload", path: "/upload", assignee: null, active: true },
  { id: "tpl_cmis_upload", area: "upload", kra: "Channel feed upload", title: "Upload Credit MIS files", detail: "Aggregator files received this morning.", times: ["10:30"], screen: "file_upload", path: "/upload", assignee: null, active: true },
  { id: "tpl_rem_upload", area: "upload", kra: "Bank statement upload", title: "Upload remitter file (HDFC Bank)", detail: "Sent hourly by this bank; upload the latest file.", times: ["11:00"], screen: "file_upload", path: "/upload", assignee: null, active: true },
  { id: "tpl_util_upload", area: "upload", kra: null, title: "Upload AMC utilisation file", detail: "When the AMC emails it. Download the attachment and upload it.", times: [], when: "When received", screen: "file_upload", path: "/upload", phase: "To confirm", assignee: null, active: true },
  { id: "tpl_checkpoint", area: "monitor", kra: "Bank statement download", title: "Check the statement checkpoint", detail: "Every bank should be green. Open any amber bank to see the accounts still pending, and download the list.", times: ["09:30", "15:30", "18:30"], screen: "ingestion", path: "/ingestion", assignee: null, active: true },
  { id: "tpl_cmis_proc", area: "monitor", kra: "Channel feed upload", title: "Check Credit MIS processing status", detail: "Files loaded, failed or still processing.", times: ["12:00"], screen: "ingestion", path: "/ingestion", assignee: null, active: true },
  { id: "tpl_cb", area: "balances", kra: null, title: "Review closing balances that don't match", detail: "Bank by bank, for today's business date. Resolve each mismatch with a note.", times: ["16:00"], screen: "balances", path: "/closing-balances", assignee: null, active: true },
  { id: "tpl_missing", area: "missing", kra: "Bank statement download", title: "Chase statements not uploaded", detail: "\"Not uploaded\" is different from \"No transactions\": chase only the ones not uploaded.", times: ["14:00"], screen: "ingestion", path: "/ingestion", assignee: null, active: true },
  { id: "tpl_remlate", area: "missing", kra: null, title: "Follow up late remitter feeds", detail: "Feeds that arrived after their expected time, or not at all.", times: ["16:30"], screen: "scheduler", path: "/scheduler", assignee: null, active: true },
  { id: "tpl_fnu", area: "funds", kra: null, title: "Review funds not utilised", detail: "Only the funds that still need action; utilised funds are not listed.", times: ["14:30"], screen: "balances", path: "/closing-balances", phase: "Later phase", assignee: null, active: true },
  { id: "tpl_match", area: "recon", kra: "Transaction matching", title: "Match transactions", detail: "After the afternoon statements and Credit MIS files are processed.", times: [], when: "After files are processed", screen: "match", path: "/match", phase: "Phase 2", assignee: null, active: true },
  { id: "tpl_excess", area: "exceptions", kra: "Excess credit monitoring", title: "Resolve excess credits", detail: "Credits with no matching application.", times: ["17:00"], screen: "exceptions", path: "/exceptions", phase: "Phase 2", assignee: null, active: true },
  { id: "tpl_refund", area: "exceptions", kra: "Refund processing", title: "Process refunds", detail: "Refunds approved today.", times: ["17:30"], screen: "refunds", path: "/refunds", phase: "Phase 2", assignee: null, active: true },
];

/** Templates in force: saved edits over the defaults, plus any added ones. */
export function templatesFrom(saved = []) {
  const byId = new Map(saved.map((t) => [t.id, t]));
  return [...DEFAULT_TEMPLATES.map((t) => ({ ...t, ...(byId.get(t.id) || {}) })), ...saved.filter((t) => !DEFAULT_TEMPLATES.some((d) => d.id === t.id))];
}

/** Today's task instances for one user: one per scheduled time, only from active templates assigned to them or the whole team. */
export function tasksFor(templates, userId) {
  return templates.filter((t) => t.active !== false && (!t.assignee || t.assignee === userId)).flatMap((t) => {
    if (!t.times?.length) return [{ ...t, id: t.id, template: t.id, due: null }];
    const many = t.times.length > 1;
    return t.times.map((hhmm) => ({ ...t, id: `${t.id}_${hhmm.replace(":", "")}`, template: t.id, title: many ? `${t.title} (${SLOT(hhmm)})` : t.title, due: at(hhmm) }));
  });
}

/** done | overdue | soon (within an hour) | later | open (no fixed time) */
export function taskState(t, done, now = Date.now()) {
  if (done) return "done";
  if (!t.due) return "open";
  const d = new Date(t.due).getTime();
  if (d < now) return "overdue";
  if (d - now <= 60 * 60000) return "soon";
  return "later";
}

/**
 * Where each task's main button goes, and what it says. One rule per task, so Today never sends anyone somewhere vague.
 * The screen key is checked against the person's permissions before the button is shown.
 */
const CP_OF = { "0930": "am", "1530": "pm", "1830": "eve" };
export function taskRoute(t) {
  const base = t.template || t.id;
  const slot = String(t.id).split("_").pop();
  const R = {
    tpl_bs_upload: ["Upload the statement", "file_upload", "/upload?type=bank"],
    tpl_cmis_upload: ["Upload the Credit MIS file", "file_upload", "/upload?type=credit"],
    tpl_rem_upload: ["Upload the remitter file", "file_upload", `/upload?type=remitter&bank=${encodeURIComponent("HDFC Bank")}`],
    tpl_util_upload: ["Upload the file", "file_upload", "/upload"],
    tpl_checkpoint: ["Open the checkpoint", "ingestion", `/ingestion?cp=${CP_OF[slot] || "pm"}`],
    tpl_cmis_proc: ["See today's Credit MIS files", "file_upload", "/upload?type=credit&view=status"],
    tpl_cb: ["See balances that don't match", "balances", "/closing-balances?only=broken"],
    tpl_missing: ["See statements not uploaded", "ingestion", "/ingestion"],
    tpl_remlate: ["See remitter schedules", "command", "/command?focus=remitter"],
    tpl_fnu: ["See accounts where a sweep may be pending", "balances", "/closing-balances?only=red"],
  }[base];
  if (R) return { label: R[0], screen: R[1], path: R[2] };
  // Tasks added in Task templates have no screen of their own: they go where their area's work is done.
  const A = {
    upload: ["Open File upload", "file_upload", "/upload"],
    monitor: ["Open the checkpoint", "ingestion", "/ingestion"],
    missing: ["See statements not uploaded", "ingestion", "/ingestion"],
    balances: ["Open closing balances", "balances", "/closing-balances"],
    funds: ["See accounts where a sweep may be pending", "balances", "/closing-balances?only=red"],
    recon: ["Open matching", "match", "/match"],
    exceptions: ["Open problem cases", "exceptions", "/exceptions"],
  }[t.area];
  if (A && (!t.screen || t.screen === "today")) return { label: A[0], screen: A[1], path: A[2] };
  return { label: "Open it", screen: t.screen, path: t.path };
}
