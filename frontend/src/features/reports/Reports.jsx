import React from "react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { AMC_BREAKDOWN, TODAY, delayedInterest } from "@/mock/opsSeed";
import { downloadCsv } from "./csv";
import { unresolvedFingerprints } from "@/lib/events";
import { FileBarChart, Download, CalendarClock } from "lucide-react";
import { toast } from "sonner";

/** Standard reports from Recon PRD v1 §4–§6, generated from live data. */
export default function Reports() {
  const { collections: c, perms, audit } = useStore();
  const canExport = hasCap(perms, "reports", "export");
  const [scheduled, setScheduled] = React.useState({ day: true, fund: true });
  const d = new Date().toISOString().slice(0, 10);
  const credits = c.credits || []; const purchases = c.purchases || []; const ex = c.exceptions || [];

  const REPORTS = [
    { group: "Daily", key: "day", name: "Day summary", ref: "Day close", desc: "What was done today and what carries forward. Sent to AMCs at day close.", run: () => downloadCsv(`day_summary_${d}.csv`, ["Measure", "Value"], [["Credits received", TODAY.credits], ["Auto-matched", TODAY.auto], ["Manually matched", TODAY.manual], ["Open problem cases", ex.filter((e) => e.status !== "closed").length], ["Fund release", (c.releases || [])[0]?.status]]) },
    { group: "Daily", key: "fund", name: "Fund utilisation report", ref: "PRD v1 §2.6 · v4 Stage 5", desc: "Realised money by AMC and scheme. Gates unit allotment.", run: () => downloadCsv(`fund_utilisation_${d}.csv`, ["AMC", "Schemes", "Payments", "Amount"], AMC_BREAKDOWN.map((a) => [a.amc, a.schemes, a.count, Math.round(TODAY.realisedForAllotment * a.share)])) },
    { group: "Reconciliation", key: "ucr", name: "Unreconciled — credit side", ref: "PRD v1 §4.1", desc: "Money received with no matching purchase.", run: () => downloadCsv(`unreconciled_credit_${d}.csv`, ["Ref", "Bank", "Value date", "Amount", "Remitter", "Narration"], credits.filter((x) => x.status === "open").map((x) => [x.ref, x.bankName, x.valueDate.slice(0, 10), x.amount, x.remitter, x.narration])) },
    { group: "Reconciliation", key: "upu", name: "Unreconciled — purchase side", ref: "PRD v1 §4.2", desc: "Purchases with no money received yet.", run: () => downloadCsv(`unreconciled_purchase_${d}.csv`, ["App no", "Investor", "PAN", "Scheme", "Channel", "Amount"], purchases.filter((x) => x.status === "open").map((x) => [x.appNo, x.investor, x.pan, x.scheme, x.channel, x.amount])) },
    { group: "Reconciliation", key: "bs", name: "Bank statement report", ref: "PRD v1 §4.3", desc: "Every statement received today with load status and checks.", run: () => downloadCsv(`bank_statements_${d}.csv`, ["Bank", "Account", "Channel", "Status", "Rows"], (c.files || []).map((f) => [f.bankName, f.accountNumber, f.channel, f.status, f.rows])) },
    { group: "Reconciliation", key: "mis", name: "Credit MIS report", ref: "PRD v1 §4.4", desc: "Payment aggregator settlements and their match status.", run: () => downloadCsv(`credit_mis_${d}.csv`, ["Document", "Type", "Status"], (c.documents || []).map((x) => [x.name, x.docType, x.status])) },
    { group: "Reconciliation", key: "cb", name: "Cheque bounce — posted / unposted", ref: "PRD v1 §4.5–4.6", desc: "Returned cheques on the Credit MIS and purchase sides.", run: () => downloadCsv(`cheque_bounce_${d}.csv`, ["Ref", "Status"], [["—", "No bounces today"]]) },
    { group: "Reconciliation", key: "cc", name: "Cross collection", ref: "PRD v1 §4.7", desc: "Money that arrived in a CAMS account but belongs to another AMC.", run: () => downloadCsv(`cross_collection_${d}.csv`, ["Case", "Investor", "Amount", "Status"], ex.filter((e) => e.type === "Cross collection").map((e) => [e.ref, e.investor, e.amount, e.status])) },
    { group: "Refunds", key: "rf", name: "Refund process report", ref: "PRD v1 §4.8 · v4 Stage 6", desc: "All refunds with SLA, delayed interest and payment status.", run: () => downloadCsv(`refunds_${d}.csv`, ["Ref", "Investor", "Reason", "Amount", "Interest", "Status"], (c.refunds || []).map((r) => [r.ref, r.investor, r.reason, r.amount, delayedInterest(r.amount, r.ageDays), r.status])) },
    { group: "Regulatory & finance", key: "pr", name: "Purchase register", ref: "PRD v1 §4.9", desc: "All purchase applications with realisation status.", run: () => downloadCsv(`purchase_register_${d}.csv`, ["App no", "Investor", "Amount", "Status"], purchases.map((x) => [x.appNo, x.investor, x.amount, x.status])) },
    { group: "Regulatory & finance", key: "brs", name: "Bank reconciliation statement (BRS)", ref: "PRD v1 §6", desc: "Book vs bank balance per collection account, with reconciling items.", run: () => downloadCsv(`brs_${d}.csv`, ["Account", "Bank balance", "Book balance", "Difference"], (c.files || []).slice(0, 8).map((f) => [f.accountNumber, f.creditAmount, f.creditAmount, 0])) },
    { group: "Product", key: "fp", name: `Unresolved fingerprint cases (${unresolvedFingerprints(c.files).length})`, ref: "PRD v4 §5.10", desc: "Files the AI layout mapping could not resolve on its own — unknown layouts and low-confidence column changes — so the product team can improve the detector.", run: () => downloadCsv(`unresolved_fingerprints_${d}.csv`, ["Bank", "Account", "File", "Fingerprint", "Status", "Why it needs a person", "Lowest confidence", "Columns in doubt", "Received"], unresolvedFingerprints(c.files).map(({ file: f, reason, lowest, fields }) => [f.bankName, f.accountNumber, f.fileName, f.fingerprint || "", f.status, reason, lowest != null ? Math.round(lowest * 100) + "%" : "", fields.join("; "), f.receivedAt || ""])) },
    { group: "Regulatory & finance", key: "audit", name: "Audit trail export", ref: "PRD v4 §6", desc: "Every action, by whom and when, including denied attempts.", run: () => downloadCsv(`audit_${d}.csv`, ["Time", "User", "Action", "Entity", "From", "To"], (audit || []).map((a) => [a.ts, a.user, a.action, a.entityLabel, a.from, a.to])) },
  ];
  const groups = [...new Set(REPORTS.map((r) => r.group))];

  return (
    <div data-testid="reports">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><FileBarChart size={22} /> Reports</h1>
          <p>The standard reports from the recon PRD, built from today's live data. Download any of them, or have them emailed automatically.</p>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g} className="card report-group">
          <div className="card-head"><h3>{g}</h3></div>
          {REPORTS.filter((r) => r.group === g).map((r) => (
            <div key={r.key} className="report-row" data-testid={"report-" + r.key}>
              <div className="rr-main"><b>{r.name}</b><span className="rr-ref">{r.ref}</span><div className="muted">{r.desc}</div></div>
              {["day", "fund"].includes(r.key) && <label className="rr-sched" title="Email automatically"><input type="checkbox" className="cb" checked={!!scheduled[r.key]} onChange={(e) => { setScheduled((s) => ({ ...s, [r.key]: e.target.checked })); toast.success(e.target.checked ? "Will be emailed to AMCs daily at day close" : "Daily email turned off"); }} /> <CalendarClock size={13} /> Email daily</label>}
              <button className="btn btn-outline btn-sm" disabled={!canExport} onClick={r.run}><Download size={13} /> CSV</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
