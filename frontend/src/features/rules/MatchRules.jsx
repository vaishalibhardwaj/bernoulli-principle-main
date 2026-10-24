import React from "react";
import { useStore } from "@/state/store";
import { simulateRule } from "@/mock/opsSeed";
import { hasCap } from "@/lib/access";
import { uid, timeAgo } from "@/lib/format";
import { num, PhaseBadge, ReadOnlyNote, inr } from "@/features/ops/ui";
import { ListOrdered, FlaskConical, Send, Check, X, Lightbulb, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";

const RULE_SUGGESTIONS = [
  { id: "rs1", title: "ICICI: UTR sits in narration characters 14–30", evidence: "Operators manually matched 312 ICICI credits this month by copying the UTR out of the narration.", draft: { name: "ICICI narration UTR (pos 14–30)", strategy: "1:1", mode: "auto", conditions: [{ field: "substr(credit.narration,14,16)", op: "equals", value: "purchase.utr" }], tolerance: { amount: 0, days: 2, nameSim: 0 } }, gain: 312 },
  { id: "rs2", title: "Razorpay: settlement credits net of 2% MDR", evidence: "41 PA settlements were matched manually where credit = Σ MIS × 0.98 (±₹1).", draft: { name: "Razorpay net-of-MDR settlement", strategy: "N:M", mode: "suggest", conditions: [{ field: "credit.amount", op: "≈", value: "Σ mis.amount × 0.98" }], tolerance: { amount: 1, days: 1, nameSim: 0 } }, gain: 41 },
];

export default function MatchRules() {
  const { collections, perms, act, upsert, currentUser, addAudit } = useStore();
  const rules = (collections.rules || []).slice().sort((a, b) => a.priority - b.priority);
  const drafts = collections.rule_drafts || [];
  const canEdit = hasCap(perms, "rules", "edit");
  const canApprove = hasCap(perms, "rules", "approve");
  const [selId, setSelId] = React.useState(rules[5]?.id || rules[0]?.id);
  const base = rules.find((r) => r.id === selId) || drafts.find((d) => d.id === selId)?.base;
  const [draft, setDraft] = React.useState(null);
  const [sim, setSim] = React.useState(null);

  React.useEffect(() => {
    if (base) { setDraft(JSON.parse(JSON.stringify(base))); setSim(null); }
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = draft && base && JSON.stringify({ t: draft.tolerance, m: draft.mode }) !== JSON.stringify({ t: base.tolerance, m: base.mode });
  const setTol = (k, v) => { setDraft((d) => ({ ...d, tolerance: { ...d.tolerance, [k]: v } })); setSim(null); };

  const runSim = () => { setSim(simulateRule(base, draft)); };
  const submit = () => {
    if (!sim) { toast.error("Run the simulation first — the checker approves the impact, not the form"); return; }
    const item = { id: uid("rd"), ruleId: base.id, base, draft, sim, status: "pending", owner: currentUser, submittedAt: new Date().toISOString() };
    const res = act({ screen: "rules", cap: "edit", audit: { entityLabel: draft.name, action: "Submit rule change", from: `v${base.version}`, to: "Pending Approval", comment: `Simulated: +${sim.newMatches} / −${sim.lostMatches}, FP risk ${sim.fpRisk}%` } });
    if (!res.ok) { toast.error(res.error); return; }
    upsert("rule_drafts", item);
    toast.success("Rule change submitted with its 30-day simulation attached");
  };
  const decide = (d, yes) => {
    const res = act({ screen: "rules", cap: "approve", target: d, kind: "rule_drafts", id: d.id, patch: { status: yes ? "approved" : "rejected", decidedBy: currentUser }, audit: { entityLabel: d.draft.name, action: yes ? "Approve rule change" : "Reject rule change", from: "Pending Approval", to: yes ? `v${d.base.version + 1}` : "Rejected" } });
    if (!res.ok) { toast.error(res.error); return; }
    if (yes) {
      const existing = rules.find((r) => r.id === d.ruleId);
      upsert("rules", existing
        ? { ...existing, ...d.draft, version: existing.version + 1, owner: d.owner, approvedBy: currentUser, updatedAt: new Date().toISOString() }
        : { ...d.draft, id: d.ruleId, priority: rules.length + 1, version: 1, status: "active", stats: { matches: d.sim.newMatches, share: 0, fp: d.sim.fpRisk }, owner: d.owner, approvedBy: currentUser, scope: "All banks", updatedAt: new Date().toISOString() });
    }
    toast.success(yes ? "Rule change approved and live" : "Rule change rejected");
  };
  const fromSuggestion = (s) => {
    const ruleId = uid("rule");
    const draftRule = { ...s.draft, id: ruleId, priority: rules.length + 1, version: 0, status: "draft", stats: { matches: 0, share: 0, fp: 0 }, scope: "All banks" };
    const zero = { ...draftRule, tolerance: { amount: 0, days: 0, nameSim: 1 }, mode: "suggest" };
    const simRes = { ...simulateRule(zero, draftRule), newMatches: s.gain * 3, lostMatches: 0 };
    upsert("rule_drafts", { id: uid("rd"), ruleId, base: { ...zero, version: 0 }, draft: draftRule, sim: simRes, status: "pending", owner: currentUser, submittedAt: new Date().toISOString(), fromSuggestion: s.title });
    addAudit({ entityType: "rules", entityId: ruleId, entityLabel: draftRule.name, action: "Submit new rule (from suggestion)", from: null, to: "Pending Approval" });
    toast.success("New rule drafted from the suggestion and sent for approval");
  };

  const pending = drafts.filter((d) => d.status === "pending");

  return (
    <div data-testid="match-rules">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><ListOrdered size={24} /> Match Rules</h1>
          <p>Rules are data: conditions, tolerances and strategy (1:1, 1:N, N:1, N:M). Every change is back-tested on 30 days of history before a checker sees it.</p>
        </div>
        <div className="actions"><PhaseBadge phase="P2">rules engine · simulation · rule suggestions</PhaseBadge></div>
      </div>
      {!canEdit && !canApprove && <ReadOnlyNote what="Maker" />}

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }} data-testid="rule-approvals">
          <div className="card-head"><h3>Rule changes awaiting approval</h3><span className="muted">{canApprove ? "Approve the impact shown, not just the form" : "A checker will review these"}</span></div>
          {pending.map((d) => (
            <div key={d.id} className="acr-row">
              <div className="acr-main">
                <div className="acr-title">{d.draft.name} <span className="muted">v{d.base.version} → v{d.base.version + 1}</span></div>
                {d.fromSuggestion && <div className="muted"><Lightbulb size={11} /> From rule suggestion: {d.fromSuggestion}</div>}
                <div className="muted">Submitted by {d.owner} · {timeAgo(d.submittedAt)} · tolerance ₹{d.draft.tolerance.amount}, ±{d.draft.tolerance.days}d{d.draft.tolerance.nameSim ? `, name ≥ ${d.draft.tolerance.nameSim}` : ""} · mode {d.draft.mode}</div>
                <div className="sim-mini">
                  <span className="add"><ArrowUpRight size={12} /> {num(d.sim.newMatches)} new</span>
                  <span className="rem"><ArrowDownRight size={12} /> {num(d.sim.lostMatches)} lost</span>
                  <span className={d.sim.fpRisk > 2 ? "rem" : ""}>FP risk {d.sim.fpRisk}%</span>
                </div>
              </div>
              {canApprove && d.owner !== currentUser ? (
                <div className="acr-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => decide(d, false)}><X size={13} /> Reject</button>
                  <button className="btn btn-success btn-sm" onClick={() => decide(d, true)} data-testid={"approve-rule-" + d.id}><Check size={13} /> Approve</button>
                </div>
              ) : <span className="pill pill-pending"><span className="dot" />Pending checker</span>}
            </div>
          ))}
        </div>
      )}

      <div className="rules-layout">
        <div className="card">
          <div className="card-head"><h3>Priority cascade</h3><span className="muted">Deterministic rules auto-match; "suggest" rules only propose</span></div>
          {rules.map((r) => (
            <button key={r.id} className={"rule-item" + (r.id === selId ? " on" : "")} onClick={() => setSelId(r.id)} data-testid={"rule-" + r.id}>
              <span className="ri-pri">{r.priority}</span>
              <div className="ri-main">
                <b>{r.name}</b>
                <div className="ri-meta"><span className="strat">{r.strategy}</span><span className={"mode " + r.mode}>{r.mode}</span><span className="muted">v{r.version}</span></div>
              </div>
              <div className="ri-stats tnum"><b>{r.stats.share}%</b><span className="muted">{num(r.stats.matches)} / 30d</span></div>
            </button>
          ))}
          <div className="card-pad suggestions">
            <h4><Lightbulb size={14} /> Rule suggestions <span className="muted">mined from manual matches</span></h4>
            {RULE_SUGGESTIONS.map((s) => (
              <div key={s.id} className="sugg">
                <b>{s.title}</b><div className="muted">{s.evidence}</div>
                {canEdit && <button className="btn btn-fill btn-sm" onClick={() => fromSuggestion(s)} data-testid={"use-" + s.id}>Draft rule from this</button>}
              </div>
            ))}
          </div>
        </div>

        {draft && (
          <div className="card" data-testid="rule-editor">
            <div className="card-head"><h3>{draft.name}</h3><span className="muted">{draft.strategy} · scope {draft.scope} · approved by {base.approvedBy}</span></div>
            <div className="card-pad">
              <h4 className="mini-h">Conditions (AND)</h4>
              {draft.conditions.map((c, i) => <div key={i} className="cond"><code>{c.field}</code><em>{c.op}</em><code>{c.value}</code></div>)}

              <h4 className="mini-h">Tolerances</h4>
              <div className="tol-grid">
                <label>Amount tolerance (₹)<input className="input tnum" type="number" min="0" value={draft.tolerance.amount} disabled={!canEdit} onChange={(e) => setTol("amount", Number(e.target.value))} data-testid="tol-amount" /></label>
                <label>Date window (± business days)<input className="input tnum" type="number" min="0" max="7" value={draft.tolerance.days} disabled={!canEdit} onChange={(e) => setTol("days", Number(e.target.value))} data-testid="tol-days" /></label>
                <label>Name similarity ≥ {draft.tolerance.nameSim.toFixed(2)}<input type="range" min="0.6" max="1" step="0.01" value={draft.tolerance.nameSim || 1} disabled={!canEdit || !base.tolerance.nameSim} onChange={(e) => setTol("nameSim", Number(e.target.value))} data-testid="tol-sim" /></label>
                <label>Mode
                  <select className="select" value={draft.mode} disabled={!canEdit} onChange={(e) => { setDraft({ ...draft, mode: e.target.value }); setSim(null); }}>
                    <option value="auto">auto — match without a human</option><option value="suggest">suggest — propose to Match Workbench</option>
                  </select></label>
              </div>

              {canEdit && (
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button className="btn btn-outline" disabled={!changed} onClick={runSim} data-testid="run-sim"><FlaskConical size={14} /> Simulate on last 30 days</button>
                  <button className="btn btn-primary" disabled={!changed || !sim} onClick={submit} data-testid="submit-rule"><Send size={14} /> Submit with simulation</button>
                  {!changed && <span className="muted" style={{ alignSelf: "center" }}>Change a tolerance or the mode to simulate.</span>}
                </div>
              )}

              {sim && (
                <div className="sim-box" data-testid="sim-result">
                  <div className="muted">{sim.period}</div>
                  <div className="sim-stats">
                    <div className="add"><b>+{num(sim.newMatches)}</b><span>new matches</span></div>
                    <div className="rem"><b>−{num(sim.lostMatches)}</b><span>lost matches (likely regressions)</span></div>
                    <div className={sim.fpRisk > 2 ? "rem" : ""}><b>{sim.fpRisk}%</b><span>false-positive risk</span></div>
                    <div><b>{sim.net >= 0 ? "+" : ""}{num(sim.net)}</b><span>net</span></div>
                  </div>
                  {sim.fpRisk > 2 && <div className="note warn"><AlertTriangle size={14} /><div>False-positive risk above 2% — consider keeping this rule in <b>suggest</b> mode so a human confirms each match.</div></div>}
                  {sim.sample.length > 0 && (
                    <table className="grid compact"><thead><tr><th>Credit</th><th>Purchase</th><th style={{ textAlign: "right" }}>Amount</th><th>Why it now matches</th></tr></thead>
                      <tbody>{sim.sample.map((s) => <tr key={s.credit} className={s.risky ? "risky" : ""}><td className="tnum">{s.credit}</td><td className="tnum">{s.purchase}</td><td className="tnum" style={{ textAlign: "right" }}>{inr(s.amount)}</td><td>{s.note}{s.risky && " · ⚠ different investor"}</td></tr>)}</tbody></table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
