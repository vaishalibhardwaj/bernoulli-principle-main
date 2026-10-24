// The daily reconciliation cycle (PRD v4 §4.1 "a day in the life" + §2.4 stages 2–6),
// computed live from the data so every screen can say where the day stands and what to do next.
import { hasCap } from "./access";
import { inScope } from "./org";
import { RELEASE_CUTOFF } from "../mock/opsSeed";

const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };

/**
 * Returns the six steps of today's cycle. Each step:
 *  key, n, title, plain, why, by (deadline label), state: done | active | waiting | todo,
 *  count (items left), summary, cta { label, path }, screen (for permission), approver (true if a checker acts)
 */
export function dailyCycle(c) {
  const files = c.files || [];
  const fileIssues = files.filter((f) => ["late", "missing", "drift", "unknown", "check_failed", "duplicate"].includes(f.status));
  const filePending = files.filter((f) => f.status === "drift_pending");
  const loaded = new Set(files.filter((f) => ["loaded", "nil"].includes(f.status)).map((f) => f.id));
  const emailRejected = (c.emails || []).filter((e) => e.status === "rejected" && !e.dismissed && !e.waiting && e.reason !== "duplicate" && !(e.suggestFileId && loaded.has(e.suggestFileId))).length;
  const connFailing = (c.connections || []).filter((x) => x.status === "failing" && !x.dismissed).length;
  const sugg = (c.suggestions || []).filter((s) => !s.decided).length;
  const docs = (c.documents || []).filter((d) => d.status === "needs_review").length;
  const matchPending = (c.matches || []).filter((m) => m.status === "pending").length;
  const urgent = (c.exceptions || []).filter((e) => ["open", "in_progress"].includes(e.status) && e.amount > 0 && e.interestHoursLeft < 24).length;
  const casesPending = (c.exceptions || []).filter((e) => e.status === "pending_approval").length;
  const release = (c.releases || [])[0] || { status: "not_started" };
  const refundsOpen = (c.refunds || []).filter((r) => ["draft"].includes(r.status)).length;
  const refundsPending = (c.refunds || []).filter((r) => r.status === "pending").length;
  const close = (c.dayclose || [])[0] || { status: "open" };

  const steps = [
    {
      key: "files", screen: "ingestion", title: "Check today's bank files", by: "10:30 AM", deadline: at(10, 30),
      why: "Nothing can be matched until every bank statement has arrived and loaded cleanly.",
      count: fileIssues.length + emailRejected + connFailing, waitingOn: filePending.length,
      summary: fileIssues.length + emailRejected + connFailing ? `${fileIssues.length} file${fileIssues.length !== 1 ? "s" : ""} need attention · ${emailRejected} rejected email${emailRejected !== 1 ? "s" : ""} · ${connFailing} connection${connFailing !== 1 ? "s" : ""} failing` : filePending.length ? `${filePending.length} layout change waiting for approval` : `All ${files.length} files received and clean`,
      cta: { label: "Check bank files", path: "/ingestion" },
    },
    {
      key: "match", screen: "match", title: "Match payments", by: "1:00 PM", deadline: at(13),
      why: "Rules matched most payments overnight. Confirm the likely matches the system found, and read PDFs it was unsure about.",
      count: sugg + docs, waitingOn: matchPending,
      summary: sugg + docs ? `${sugg} likely match${sugg !== 1 ? "es" : ""} to confirm · ${docs} document${docs !== 1 ? "s" : ""} to check` : "All suggested matches handled",
      cta: { label: sugg ? "Confirm matches" : "Check documents", path: sugg ? "/match" : "/extraction" },
    },
    {
      key: "cases", screen: "exceptions", title: "Sort out urgent problem cases", by: "2:00 PM", deadline: at(14),
      why: "Cases close to 5 days old start costing CAMS penalty interest. Clear the red ones first.",
      count: urgent, waitingOn: casesPending,
      summary: urgent ? `${urgent} urgent case${urgent > 1 ? "s" : ""} (penalty clock under 24 hours)` : "No urgent cases left",
      cta: { label: "Open problem cases", path: "/exceptions" },
    },
    {
      key: "release", screen: "release", title: "Release money for unit allotment", by: "3:00 PM", deadline: new Date(RELEASE_CUTOFF),
      why: "SEBI: units are allotted only after money is realised. Release the matched money to Transaction Posting before the cut-off.",
      count: release.status === "released" ? 0 : 1, waitingOn: release.status === "pending" ? 1 : 0,
      summary: { not_started: "Release batch not prepared yet", pending: "Prepared — waiting for checker to release", released: `Released to Posting${release.releasedAt ? " at " + new Date(release.releasedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}` }[release.status],
      cta: { label: release.status === "pending" ? "Review release" : "Prepare release", path: "/release" },
      done: release.status === "released",
    },
    {
      key: "refunds", screen: "refunds", title: "Send refunds", by: "3:30 PM", deadline: at(15, 30),
      why: "Duplicate, excess and rejected-application money must go back within 5 days, or delayed interest applies.",
      count: refundsOpen, waitingOn: refundsPending,
      summary: refundsOpen ? `${refundsOpen} refund${refundsOpen > 1 ? "s" : ""} to prepare` : refundsPending ? `${refundsPending} waiting for approval` : "All refunds sent",
      cta: { label: "Open refunds", path: "/refunds" },
    },
    {
      key: "close", screen: "today", title: "Close the day", by: "4:30 PM", deadline: at(16, 30),
      why: "Sign off what was done and what carries forward. Produces the day summary for the AMCs and audit.",
      count: close.status === "closed" ? 0 : 1, waitingOn: close.status === "pending" ? 1 : 0,
      summary: { open: "Day not closed yet", pending: `Submitted by ${close.submittedBy} — waiting for sign-off`, closed: `Closed by ${close.closedBy}` }[close.status],
      cta: { label: close.status === "pending" ? "Sign off the day" : "Close the day", path: "/today#close" },
      done: close.status === "closed",
    },
  ];

  let activeSet = false;
  steps.forEach((s, i) => {
    s.n = i + 1;
    const done = s.done !== undefined ? s.done : s.count === 0 && !s.waitingOn;
    s.state = done ? "done" : s.count === 0 && s.waitingOn ? "waiting" : !activeSet ? "active" : "todo";
    if (s.state === "active") activeSet = true;
    s.late = !done && Date.now() > s.deadline.getTime();
  });
  return steps;
}

/** The one thing this user should do next: first unfinished step they can act on. */
export function nextStepFor(steps, perms) {
  const canDo = (s) => hasCap(perms, s.screen, "edit") || (s.waitingOn && hasCap(perms, s.screen, "approve")) || (s.key === "close" && (hasCap(perms, "match", "edit") || hasCap(perms, "release", "approve")));
  return steps.find((s) => s.state !== "done" && canDo(s)) || null;
}

/** Can this person act on a step at all (as maker or checker)? */
export const canActOn = (s, perms) => hasCap(perms, s.screen, "edit") || hasCap(perms, s.screen, "approve")
  || (s.key === "close" && (hasCap(perms, "match", "edit") || hasCap(perms, "release", "edit") || hasCap(perms, "release", "approve")));

/**
 * The person's own stepper: only the steps their roles let them act on, narrowed to the steps an admin
 * assigned them (small AMCs: one person, many steps; large AMCs: steps split across teams).
 * Re-numbered 1..n, and "active" is the first unfinished step of *theirs*.
 */
export function stepsForUser(steps, perms, user) {
  const assigned = user?.workflowSteps?.length ? user.workflowSteps : null;
  const mine = steps.filter((s) => canActOn(s, perms) && (!assigned || assigned.includes(s.key))).map((s) => ({ ...s }));
  let activeSet = false;
  mine.forEach((s, i) => {
    s.n = i + 1;
    if (s.state === "done" || s.state === "waiting") return;
    s.state = activeSet ? "todo" : "active";
    activeSet = true;
  });
  return { mine, others: steps.filter((s) => !mine.some((m) => m.key === s.key)) };
}

/** Collections narrowed to the AMCs this person works on. Records without an AMC stay visible. */
export function scopeToUser(c, user) {
  const keep = (list) => (list || []).filter((x) => inScope(user, x.amc));
  const credits = keep(c.credits);
  const ids = new Set(credits.map((x) => x.id));
  return { ...c, files: keep(c.files), exceptions: keep(c.exceptions), refunds: keep(c.refunds), credits, purchases: keep(c.purchases),
    suggestions: (c.suggestions || []).filter((s) => s.credits.some((id) => ids.has(id))), matches: (c.matches || []).filter((m) => m.credits.some((id) => ids.has(id))) };
}
