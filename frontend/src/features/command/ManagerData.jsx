import React from "react";
import { toast } from "sonner";
import { Download, Users, Database, MessageSquarePlus } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { scopeToUser } from "@/lib/journey";
import { maskAccount, uid } from "@/lib/format";
import { downloadCsv } from "@/features/reports/csv";
import { schemeAttrs } from "@/mock/bankMaster";
import { inScope } from "@/lib/org";
import { Modal } from "@/components/Modal";

const d = () => new Date().toISOString().slice(0, 10);
const hhmm = (m) => (m == null ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const SCREENS = ["Recon dashboard", "Today", "Match payments", "Exceptions", "Bank files", "Closing balances", "Fund release", "Refunds", "Scheduler monitor"];

/**
 * What a recon manager would otherwise ask IT to query: who is carrying the work, and every raw and
 * matched dataset as a download. Users can say where else they want an export; requests are logged.
 */
export default function ManagerData() {
  const { collections: raw, amcUser, perms, act, personaUser } = useStore();
  const c = scopeToUser(raw, amcUser);
  const balances = (raw.balances || []).filter((b) => inScope(amcUser, b.amc));
  const canExport = hasCap(perms, "command", "export");
  const [ask, setAsk] = React.useState(null);

  // ---- Team workload: open cases per person, how old, and what is stuck with the checker ----
  const team = Object.values((c.exceptions || []).filter((e) => e.status !== "closed").reduce((m, e) => {
    const k = e.owner || "Unassigned";
    const r = m[k] || (m[k] = { who: k, open: 0, over5: 0, waiting: 0, amount: 0, oldest: 0 });
    r.open += 1; r.amount += e.amount; r.oldest = Math.max(r.oldest, e.ageHours);
    if (e.ageHours >= 120) r.over5 += 1;
    if (e.status === "pending_approval") r.waiting += 1;
    return m;
  }, {})).sort((a, b) => (a.who === "Unassigned") - (b.who === "Unassigned") || b.open - a.open);
  const maxOpen = Math.max(1, ...team.map((t) => t.open));

  // ---- Raw and matched datasets ----
  const byId = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));
  const cr = byId(c.credits); const pu = byId(c.purchases);
  const matchedPairs = (c.matches || []).filter((m) => m.status !== "rejected").flatMap((m) => m.credits.flatMap((ci) => m.purchases.map((pi) => [m.id, m.type, m.status === "confirmed" ? "Matched" : "Waiting for checker", cr[ci]?.ref, cr[ci]?.utr, cr[ci]?.bankName, cr[ci]?.amount, pu[pi]?.appNo, pu[pi]?.investor, pu[pi]?.amount, m.owner || "", m.decidedBy || ""])));
  const autoMatched = (c.credits || []).filter((x) => x.status === "matched" && !(c.matches || []).some((m) => m.credits.includes(x.id)));
  const sets = [
    { group: "Raw data", key: "raw_credits", name: "Bank statement transactions (credits)", n: (c.credits || []).length, run: () => downloadCsv(`raw_bank_credits_${d()}.csv`, ["Ref", "AMC", "Bank", "Account", "Value date", "Amount", "UTR", "Narration", "Remitter", "Remitter IFSC", "Status"], (c.credits || []).map((x) => [x.ref, x.amc, x.bankName, maskAccount(x.accountNumber), x.valueDate, x.amount, x.utr, x.narration, x.remitter, x.remitterIfsc, x.status])) },
    { group: "Raw data", key: "raw_purchases", name: "Purchase applications (reverse feed)", n: (c.purchases || []).length, run: () => downloadCsv(`raw_purchases_${d()}.csv`, ["Application", "AMC", "Investor", "PAN", "Scheme", "Channel", "Amount", "UTR", "Txn date", "Status"], (c.purchases || []).map((x) => [x.appNo, x.amc, x.investor, x.pan, x.scheme, x.channel, x.amount, x.utr, x.txnDate, x.status])) },
    { group: "Raw data", key: "raw_files", name: "Statement files received", n: (c.files || []).length, run: () => downloadCsv(`raw_statement_files_${d()}.csv`, ["File", "AMC", "Bank", "Account", "Channel", "Expected by", "Received", "Rows", "Credits", "Status"], (c.files || []).map((x) => [x.fileName, x.amc, x.bankName, maskAccount(x.accountNumber), x.channel, x.expectedBy, x.receivedAt || "", x.rows, x.credits, x.status])) },
    { group: "Raw data", key: "raw_balances", name: "Closing balances, 3 PM check and sweep", n: balances.length, run: () => downloadCsv(`closing_balances_${d()}.csv`, ["AMC", "Bank", "Account", "Scheme", "Asset class", "Statement", "Last txn before 3 PM", "Bank closing", "System closing", "Matches", "Sweep", "Swept at"], balances.map((b) => [b.amc, b.bankName, maskAccount(b.accountNumber), b.schemeName, schemeAttrs(b.schemeCode).assetClass, b.stmt, hhmm(b.lastTxnAt), b.closing, b.systemClosing, Math.abs(b.closing - b.systemClosing) < 0.005 ? "Yes" : "No", b.sweep || "", hhmm(b.sweepAt)])) },
    { group: "Matched data", key: "matched_pairs", name: "Matched pairs (credit ↔ application)", n: matchedPairs.length + autoMatched.length, run: () => downloadCsv(`matched_pairs_${d()}.csv`, ["Match", "Type", "Status", "Credit ref", "UTR", "Bank", "Credit amount", "Application", "Investor", "Application amount", "Matched by", "Approved by"], [...matchedPairs, ...autoMatched.map((x) => ["auto", "rule", "Matched", x.ref, x.utr, x.bankName, x.amount, "", "", "", "Rules engine", ""])]) },
    { group: "Matched data", key: "suggestions", name: "Suggested matches and decisions", n: (c.suggestions || []).length, run: () => downloadCsv(`suggested_matches_${d()}.csv`, ["Suggestion", "Type", "Confidence", "Credits", "Applications", "Decision"], (c.suggestions || []).map((s) => [s.id, s.type, Math.round(s.confidence * 100) + "%", s.credits.map((i) => cr[i]?.ref).join(" "), s.purchases.map((i) => pu[i]?.appNo).join(" "), s.decided || "open"])) },
    { group: "Unmatched & cases", key: "unmatched", name: "Unmatched credits", n: (c.credits || []).filter((x) => x.status === "open").length, run: () => downloadCsv(`unmatched_credits_${d()}.csv`, ["Ref", "AMC", "Bank", "Value date", "Amount", "UTR", "Remitter"], (c.credits || []).filter((x) => x.status === "open").map((x) => [x.ref, x.amc, x.bankName, x.valueDate, x.amount, x.utr, x.remitter])) },
    { group: "Unmatched & cases", key: "cases", name: "Problem cases (all open)", n: (c.exceptions || []).filter((e) => e.status !== "closed").length, run: () => downloadCsv(`problem_cases_${d()}.csv`, ["Ref", "AMC", "Type", "Bank", "Investor", "Amount", "Age (hours)", "Hours before interest", "Owner", "Status"], (c.exceptions || []).filter((e) => e.status !== "closed").map((e) => [e.ref, e.amc, e.type, e.bankName, e.investor, e.amount, e.ageHours, e.interestHoursLeft, e.owner || "", e.status])) },
    { group: "Unmatched & cases", key: "refunds", name: "Refunds", n: (c.refunds || []).length, run: () => downloadCsv(`refunds_${d()}.csv`, ["Ref", "AMC", "Investor", "Amount", "Reason", "Account", "Age (days)", "Status"], (c.refunds || []).map((r) => [r.ref || r.id, r.amc, r.investor, r.amount, r.reason, r.bankAcct, r.ageDays, r.status])) },
  ];
  const groups = [...new Set(sets.map((s) => s.group))];

  const exportTeam = () => downloadCsv(`team_workload_${d()}.csv`, ["Person", "Open cases", "Past 5 days", "Waiting for checker", "Amount", "Oldest (days)"], team.map((t) => [t.who, t.open, t.over5, t.waiting, t.amount, (t.oldest / 24).toFixed(1)]));

  const sendAsk = (dataset, screen, note) => {
    act({ screen: "command", cap: "view", kind: "export_requests", patch: { id: uid("exr"), dataset, screen, note, by: personaUser.name, at: new Date().toISOString() }, audit: { entityLabel: dataset, action: "Request export placement", to: screen, comment: note } });
    toast.success(`Thanks — logged: “${dataset}” wanted on ${screen}.`);
    setAsk(null);
  };

  return (
    <div className="md-grid">
      <div className="card" data-testid="team-workload">
        <div className="card-head"><h3><Users size={15} /> Team workload</h3>
          <span className="muted">Open problem cases per person · who is overloaded, what is ageing</span>
          {canExport && <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={exportTeam} data-testid="export-team"><Download size={13} /> Export</button>}</div>
        <div className="tw-h"><span>Person</span><span>Open</span><span>Past 5 days</span><span>With checker</span><span>Oldest</span></div>
        {team.map((t) => (
          <div key={t.who} className={"tw-row" + (t.who === "Unassigned" ? " un" : "")}>
            <span className="tw-who"><b>{t.who}</b><i style={{ width: `${(t.open / maxOpen) * 100}%` }} /></span>
            <span className="tnum">{t.open}</span>
            <span className={"tnum" + (t.over5 ? " neg" : "")}>{t.over5 || "—"}</span>
            <span className="tnum">{t.waiting || "—"}</span>
            <span className="tnum">{(t.oldest / 24).toFixed(1)}d</span>
          </div>
        ))}
      </div>

      <div className="card" data-testid="data-exports">
        <div className="card-head"><h3><Database size={15} /> Data &amp; exports</h3>
          <span className="muted">Raw and matched data for {amcUser.amcs?.length === 1 ? amcUser.amcs[0] : "your AMCs"} — no back-end queries needed</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setAsk({ dataset: "", screen: "" })} data-testid="ask-export"><MessageSquarePlus size={13} /> Want an export elsewhere?</button></div>
        {groups.map((g) => (
          <div key={g} className="dx-group">
            <div className="dx-g">{g}</div>
            {sets.filter((s) => s.group === g).map((s) => (
              <div key={s.key} className="dx-row" data-testid={"dx-" + s.key}>
                <span>{s.name}</span>
                <span className="tnum muted">{s.n.toLocaleString("en-IN")} rows</span>
                <button className="btn btn-outline btn-sm" disabled={!canExport} title={canExport ? "Download CSV" : "Needs export access"} onClick={() => { s.run(); toast.success(`${s.name}: ${s.n} rows exported`); }} data-testid={"dx-export-" + s.key}><Download size={13} /> CSV</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {ask && <AskModal sets={sets} onClose={() => setAsk(null)} onSend={sendAsk} />}
    </div>
  );
}

function AskModal({ sets, onClose, onSend }) {
  const [dataset, setDataset] = React.useState("");
  const [screen, setScreen] = React.useState("");
  const [note, setNote] = React.useState("");
  return (
    <Modal id="ask-export" title="Where do you want this export?" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!dataset || !screen} onClick={() => onSend(dataset, screen, note.trim())} data-testid="ask-send">Send</button></>}>
      <p className="muted" style={{ marginTop: 0 }}>Tell us which data you download and on which screen you would like the button, so we put exports where people actually need them.</p>
      <div className="field"><label className="field-label">Data</label>
        <select className="select" value={dataset} onChange={(e) => setDataset(e.target.value)} data-testid="ask-dataset"><option value="">Pick…</option>{sets.map((s) => <option key={s.key}>{s.name}</option>)}<option>Something else</option></select></div>
      <div className="field" style={{ marginTop: 10 }}><label className="field-label">Screen</label>
        <select className="select" value={screen} onChange={(e) => setScreen(e.target.value)} data-testid="ask-screen"><option value="">Pick…</option>{SCREENS.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="field" style={{ marginTop: 10 }}><label className="field-label">What do you use it for? (optional)</label>
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Daily MIS to the AMC at 6 PM" /></div>
    </Modal>
  );
}
