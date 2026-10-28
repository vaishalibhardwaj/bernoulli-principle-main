import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { inScope } from "@/lib/org";
import { PLAIN_EXCEPTION } from "@/lib/plain";
import { inr, inrShort } from "@/features/ops/ui";
import { maskAccount } from "@/lib/format";
import { delayedInterest } from "@/mock/opsSeed";
import { useMatchActions } from "@/features/match/matchActions";

/**
 * Everything waiting for a checker, from every screen, in one list.
 * Simple items can be approved inline; ones that need a diff/impact review link to their screen.
 */
export function useApprovals() {
  const { collections: c, perms, act, approve, reject, currentUser, personaUser, amcUser } = useStore();
  const { setStatus } = useMatchActions();
  const items = [];
  const mine = (owner) => owner && (owner === currentUser || owner.split(" ")[0] === currentUser);
  // Checkers see only the AMCs they cover; items without an AMC (setups, access, day close) are shared.
  const add = (screen, it) => { if (hasCap(perms, screen, "approve") && inScope(amcUser, it.amc)) items.push({ screen, own: mine(it.owner), ...it }); };

  // Fund release first (it gates unit allotment); day close last (it signs off everything else)
  (c.dayclose || []).filter((d) => d.status === "pending").forEach((d) => add("release", {
    id: d.id, kind: "Day close", title: "Sign off today's reconciliation", detail: `${d.carried} item${d.carried !== 1 ? "s" : ""} carried forward · notes: ${d.note || "—"}`, owner: d.submittedBy, priority: 9,
    approve: () => act({ screen: "release", cap: "approve", kind: "dayclose", id: d.id, target: { owner: d.submittedBy }, patch: { status: "closed", closedBy: currentUser, closedAt: new Date().toISOString() }, audit: { entityLabel: "Day close", action: "Sign off day", from: "Pending", to: "Closed" } }),
    reject: () => act({ screen: "release", cap: "approve", kind: "dayclose", id: d.id, target: { owner: d.submittedBy }, patch: { status: "open" }, audit: { entityLabel: "Day close", action: "Return day close", from: "Pending", to: "Open" } }),
  }));
  (c.releases || []).filter((r) => r.status === "pending").forEach((r) => add("release", {
    id: r.id, kind: "Fund release", title: `Release ${inrShort(r.amount)} to Transaction Posting`, detail: `${r.count.toLocaleString("en-IN")} realised payments · ${r.ref} · cut-off 3:00 PM`, owner: r.preparedBy, priority: 1, urgent: true,
    approve: () => act({ screen: "release", cap: "approve", kind: "releases", id: r.id, target: { owner: r.preparedBy }, patch: { status: "released", approvedBy: currentUser, releasedAt: new Date().toISOString() }, audit: { entityLabel: r.ref, action: "Release funds to Posting", from: "Pending", to: "Released", comment: inr(r.amount) } }),
    reject: () => act({ screen: "release", cap: "approve", kind: "releases", id: r.id, target: { owner: r.preparedBy }, patch: { status: "not_started" }, audit: { entityLabel: r.ref, action: "Return release batch", from: "Pending", to: "Not prepared" } }),
  }));
  (c.refunds || []).filter((r) => r.status === "pending").forEach((r) => {
    const int = delayedInterest(r.amount, r.ageDays);
    add("refunds", {
      id: r.id, amc: r.amc, kind: "Refund", title: `Refund ${inr(r.amount + int)} to ${r.investor}`, detail: `${r.reason} · ${r.bankAcct} · ${r.verified ? "account verified ✓" : "account NOT verified"}${int ? ` · incl. ${inr(int)} delayed interest` : ""}`, owner: r.owner, priority: 2, urgent: r.ageDays >= 4,
      approve: () => act({ screen: "refunds", cap: "approve", kind: "refunds", id: r.id, target: r, patch: { status: "approved", approvedBy: currentUser }, audit: { entityLabel: `${r.ref} · ${r.investor}`, action: "Approve refund", from: "Pending", to: "Approved", comment: inr(r.amount + int) } }),
      reject: () => act({ screen: "refunds", cap: "approve", kind: "refunds", id: r.id, target: r, patch: { status: "draft" }, audit: { entityLabel: `${r.ref} · ${r.investor}`, action: "Return refund", from: "Pending", to: "Draft" } }),
    });
  });
  (c.matches || []).filter((m) => m.status === "pending").forEach((m) => add("match", {
    id: m.id, amc: (c.credits || []).find((x) => x.id === m.credits[0])?.amc, kind: "Manual match", title: `Confirm ${m.type} match of ${inr(m.amount)}`, detail: `${m.source === "ai" ? `Suggested by the system (${Math.round(m.confidence * 100)}%), accepted` : "Matched by hand"} by ${m.owner}`, owner: m.owner, priority: 3,
    approve: () => { const r = act({ screen: "match", cap: "approve", kind: "matches", id: m.id, target: m, patch: { status: "confirmed", decidedBy: currentUser }, audit: { entityLabel: `${m.type} match ${inr(m.amount)}`, action: "Approve match", from: "Pending checker", to: "Matched" } }); if (r.ok) { setStatus(m.credits, "credits", "matched"); setStatus(m.purchases, "purchases", "matched"); } return r; },
    reject: () => { const r = act({ screen: "match", cap: "approve", kind: "matches", id: m.id, target: m, patch: { status: "rejected", decidedBy: currentUser }, audit: { entityLabel: `${m.type} match ${inr(m.amount)}`, action: "Reject match", from: "Pending checker", to: "Rejected" } }); if (r.ok) { setStatus(m.credits, "credits", "open"); setStatus(m.purchases, "purchases", "open"); } return r; },
  }));
  (c.exceptions || []).filter((e) => e.status === "pending_approval").forEach((e) => {
    const owner = e.closedBy || e.owner;
    add("exceptions", {
      id: e.id, amc: e.amc, kind: "Case closure", title: `Close ${e.ref}: ${PLAIN_EXCEPTION[e.type] || e.type}`, detail: `${e.investor} · ${e.amount ? inr(e.amount) : e.bankName} · reason: ${e.rootCause || "—"}`, owner, priority: 4,
      approve: () => act({ screen: "exceptions", cap: "approve", kind: "exceptions", id: e.id, target: { ...e, owner }, patch: { status: "closed" }, audit: { entityLabel: `${e.ref} · ${e.type}`, action: "Approve closure", from: "Closure pending checker", to: "Closed" } }),
      reject: () => act({ screen: "exceptions", cap: "approve", kind: "exceptions", id: e.id, target: { ...e, owner }, patch: { status: "in_progress" }, audit: { entityLabel: `${e.ref} · ${e.type}`, action: "Reopen case", from: "Closure pending checker", to: "In progress" } }),
    });
  });
  (c.documents || []).filter((d) => d.status === "pending_checker").forEach((d) => add("extraction", {
    id: d.id, kind: "Document", title: `Approve values read from ${d.name}`, detail: `${d.docType} · high value (≥ ₹1 Cr) · checked by ${d.owner}`, owner: d.owner, priority: 5,
    approve: () => act({ screen: "extraction", cap: "approve", kind: "documents", id: d.id, patch: { status: "approved" }, audit: { entityLabel: d.name, action: "Approve extraction", from: "Awaiting checker", to: "Loaded" } }),
    reject: () => act({ screen: "extraction", cap: "approve", kind: "documents", id: d.id, patch: { status: "needs_review" }, audit: { entityLabel: d.name, action: "Return extraction", from: "Awaiting checker", to: "Needs review" } }),
  }));
  (c.files || []).filter((f) => f.status === "drift_pending").forEach((f) => add("ingestion", {
    id: f.id, kind: "Bank file layout", title: `Accept ${f.bankName}'s new file layout`, detail: `${f.drift?.summary} · ${(f.drift?.rowsHeld || 0).toLocaleString("en-IN")} rows held until approved`, owner: f.owner, priority: 1, urgent: true,
    approve: () => act({ screen: "ingestion", cap: "approve", kind: "files", id: f.id, patch: { status: "loaded", fingerprint: f.fingerprint + "·v2", checks: f.checks.map((x) => ({ ...x, ok: true })) }, audit: { entityLabel: `${f.bankName} ·${f.accountNumber.slice(-4)}`, action: "Approve mapping change", from: "Mapping change pending", to: "Loaded" } }),
    reject: () => act({ screen: "ingestion", cap: "approve", kind: "files", id: f.id, patch: { status: "drift" }, audit: { entityLabel: `${f.bankName} ·${f.accountNumber.slice(-4)}`, action: "Return mapping change", from: "Mapping change pending", to: "Format drift" } }),
  }));
  // Need a side-by-side review → open their own screen
  ["bank_config", "credit_config", "bank_mapping"].forEach((k) => (c[k] || []).filter((x) => x.status === "pending").forEach((x) => add(k === "bank_config" ? "bank_setup" : k === "credit_config" ? "credit_mis" : "mapping", {
    id: x.id, kind: { bank_config: "Bank setup", credit_config: "Credit MIS setup", bank_mapping: "Column mapping" }[k], title: `${x.bankName || x.paCode || "Setup"} · ${maskAccount(x.accountNumber)}`, detail: `Submitted by ${x.owner || "—"}`, owner: x.owner, priority: 7, record: { ...x, _kind: k }, needsComment: true,
    config: { kind: k, approve: () => { try { approve(k, x.id, `${x.bankName} · ${maskAccount(x.accountNumber)}`); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } } },
    reject: (comment) => { if (!comment || comment.trim().length < 10) return { ok: false, error: "A comment of at least 10 characters is required to send a setup back" }; try { reject(k, x.id, comment.trim(), `${x.bankName} · ${maskAccount(x.accountNumber)}`); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
  })));
  (c.status_map || []).filter((r) => r.status === "pending").forEach((r) => add("status_std", {
    id: r.id, kind: "Status mapping", title: `Treat “${r.source}” as ${r.system}`, detail: `${r.seenAt ? r.seenAt + " · " : ""}${r.table}.${r.column}${r.requestedBy ? ` · asked for by ${r.requestedBy}` : ""}`, owner: r.owner, priority: 8,
    approve: () => act({ screen: "status_std", cap: "approve", kind: "status_map", id: r.id, target: r, patch: { status: "active", approvedBy: currentUser }, audit: { entityLabel: `Status “${r.source}” → ${r.system}`, action: "Approve status mapping", from: "Pending", to: "Active", comment: "Applies to files loaded from now on" } }),
    reject: () => act({ screen: "status_std", cap: "approve", kind: "status_map", id: r.id, target: r, patch: { status: r.requestedBy ? "requested" : "rejected", owner: r.requestedBy || r.owner }, audit: { entityLabel: `Status “${r.source}”`, action: "Reject status mapping", from: "Pending", to: "Rejected" } }),
  }));
  (c.access_requests || []).filter((r) => r.status === "pending").forEach((r) => add("roles", {
    id: r.id, kind: "Access", title: r.kind === "assign" ? "Grant a privileged role" : `Role change: ${r.draft?.name}`, detail: r.note || "", owner: r.requestedBy, priority: 8, review: "/admin/roles",
  }));

  items.sort((a, b) => a.priority - b.priority);
  return items;
}
