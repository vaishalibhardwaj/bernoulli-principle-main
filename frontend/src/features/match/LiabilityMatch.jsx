import React from "react";
import { Check, X, Sparkles } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { inScope } from "@/lib/org";
import { formatDate, uid } from "@/lib/format";
import { inr } from "@/features/ops/ui";
import { bizGap } from "@/lib/bizdays";
import { toast } from "sonner";

/**
 * Liability matching: payout debits in the bank statement against existing redemption, dividend (IDCW), switch and
 * brokerage payout data. Same flow as subscriptions: suggestions by UTR, manual N:M matching, checker approval.
 */
export default function LiabilityMatch() {
  const { collections, perms, act, upsert, currentUser, amcUser } = useStore();
  const canEdit = hasCap(perms, "match", "edit");
  const canApprove = hasCap(perms, "match", "approve");
  const debits = (collections.liab_debits || []).filter((x) => inScope(amcUser, x.amc));
  const payouts = (collections.liab_payouts || []).filter((x) => inScope(amcUser, x.amc));
  const matches = collections.liab_matches || [];
  const [type, setType] = React.useState("all");
  const [selD, setSelD] = React.useState([]);
  const [selP, setSelP] = React.useState([]);
  const openD = debits.filter((d) => d.status === "open");
  const openP = payouts.filter((p) => p.status === "open" && (type === "all" || p.type === type));
  // Deterministic suggestions: the payout's UTR appears in the debit narration and amounts agree.
  const sugg = openD.map((d) => ({ d, p: openP.find((p) => p.utr && d.narration.includes(p.utr) && p.amount === d.amount) })).filter((x) => x.p);
  const sum = (ids, list) => list.filter((x) => ids.includes(x.id)).reduce((s, x) => s + x.amount, 0);
  const delta = sum(selD, debits) - sum(selP, payouts);

  const setStatus = (ids, kind, status) => ids.forEach((id) => { const x = (collections[kind] || []).find((y) => y.id === id); if (x) upsert(kind, { ...x, status }); });
  const propose = (dIds, pIds, source) => {
    const m = { id: uid("lm"), debits: dIds, payouts: pIds, amount: sum(dIds, debits), source, status: "pending", owner: currentUser, createdAt: new Date().toISOString() };
    const r = act({ screen: "match", cap: "edit", audit: { entityLabel: `Liability match ${inr(m.amount)}`, action: "Propose liability match", to: "Pending checker", comment: source } });
    if (!r.ok) { toast.error(r.error); return; }
    upsert("liab_matches", m); setStatus(dIds, "liab_debits", "proposed"); setStatus(pIds, "liab_payouts", "proposed");
    setSelD([]); setSelP([]); toast.success("Sent to a checker");
  };
  const decide = (m, yes) => {
    const r = act({ screen: "match", cap: "approve", kind: "liab_matches", id: m.id, target: m, patch: { status: yes ? "confirmed" : "rejected", decidedBy: currentUser }, audit: { entityLabel: `Liability match ${inr(m.amount)}`, action: yes ? "Approve liability match" : "Reject liability match" } });
    if (!r.ok) { toast.error(r.error); return; }
    setStatus(m.debits, "liab_debits", yes ? "matched" : "open"); setStatus(m.payouts, "liab_payouts", yes ? "matched" : "open");
    toast.success(yes ? "Payout confirmed" : "Returned to the open pool");
  };

  return (
    <div data-testid="liability-match">
      {matches.filter((m) => m.status === "pending").length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head"><h3>Waiting for a checker</h3></div>
          {matches.filter((m) => m.status === "pending").map((m) => (
            <div key={m.id} className="acr-row">
              <div className="acr-main"><div className="acr-title">{inr(m.amount)} · {m.debits.map((id) => debits.find((d) => d.id === id)?.ref).join(", ")} ↔ {m.payouts.map((id) => payouts.find((p) => p.id === id)?.ref).join(", ")}</div><div className="muted">{m.source} · by {m.owner}</div></div>
              {canApprove && m.owner !== currentUser ? <div className="acr-actions"><button className="btn btn-outline btn-sm" onClick={() => decide(m, false)}><X size={13} /> Reject</button><button className="btn btn-success btn-sm" onClick={() => decide(m, true)} data-testid={"lm-approve-" + m.id}><Check size={13} /> Approve</button></div> : <span className="pill pill-pending"><span className="dot" />Pending checker</span>}
            </div>
          ))}
        </div>
      )}

      {sugg.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }} data-testid="liab-sugg">
          <div className="card-head"><h3><Sparkles size={14} /> Suggested — UTR and amount agree</h3><span className="muted">Review, then confirm</span></div>
          {sugg.map(({ d, p }) => (
            <div key={d.id} className="acr-row">
              <div className="acr-main"><div className="acr-title">{inr(d.amount)} · {d.ref} ↔ {p.ref} ({p.type})</div><div className="muted">{p.payee} · UTR {p.utr} in narration · {bizGap(d.valueDate, p.payDate)} business day gap</div></div>
              {canEdit && <button className="btn btn-primary btn-sm" onClick={() => propose([d.id], [p.id], "UTR + amount")} data-testid={"liab-accept-" + d.id}><Check size={13} /> Match</button>}
            </div>
          ))}
        </div>
      )}

      <div className="segmented" style={{ marginBottom: 10 }}>{["all", "Redemption", "Dividend", "Switch", "Brokerage"].map((t) => <button key={t} className={type === t ? "on" : ""} onClick={() => setType(t)}>{t === "all" ? "All payouts" : t === "Dividend" ? "Dividend / IDCW" : t}</button>)}</div>
      <div className="split-pane">
        <div className="card">
          <div className="card-head"><h3>Payout debits in the bank statement</h3><span className="muted">{openD.length}</span></div>
          <div className="pane-list">{openD.map((d) => (
            <label key={d.id} className={"pane-row" + (selD.includes(d.id) ? " on" : "")}>
              <input type="checkbox" className="cb" disabled={!canEdit} checked={selD.includes(d.id)} onChange={() => setSelD((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]))} data-testid={"ld-" + d.id} />
              <div className="pr-main"><b className="tnum">{inr(d.amount)}</b><span className="muted">{d.bankName} · {formatDate(d.valueDate)}</span><div className="pr-narr tnum">{d.narration}</div></div>
            </label>
          ))}{openD.length === 0 && <div className="muted card-pad">No open payout debits.</div>}</div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Payout instructions (redemption, dividend, switch, brokerage)</h3><span className="muted">{openP.length}</span></div>
          <div className="pane-list">{openP.map((p) => (
            <label key={p.id} className={"pane-row" + (selP.includes(p.id) ? " on" : "")}>
              <input type="checkbox" className="cb" disabled={!canEdit} checked={selP.includes(p.id)} onChange={() => setSelP((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} data-testid={"lp-" + p.id} />
              <div className="pr-main"><b className="tnum">{inr(p.amount)}</b><span className="muted">{p.ref} · {p.type} · {formatDate(p.payDate)}</span><div className="pr-narr">{p.payee}{p.utr ? ` · UTR ${p.utr}` : " · no UTR"}</div></div>
            </label>
          ))}{openP.length === 0 && <div className="muted card-pad">No open payouts.</div>}</div>
        </div>
      </div>
      {(selD.length > 0 || selP.length > 0) && (
        <div className="match-bar" data-testid="liab-bar">
          <span>{selD.length} debit{selD.length !== 1 ? "s" : ""} <b className="tnum">{inr(sum(selD, debits))}</b></span><span>↔</span>
          <span>{selP.length} payout{selP.length !== 1 ? "s" : ""} <b className="tnum">{inr(sum(selP, payouts))}</b></span>
          <span className={"delta " + (Math.abs(delta) < 1 ? "ok" : "bad")}>{Math.abs(delta) < 1 ? "Amounts agree ✓" : `Difference ${inr(Math.abs(delta))}`}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelD([]); setSelP([]); }}>Clear</button>
          <button className="btn btn-primary" disabled={!selD.length || !selP.length || Math.abs(delta) >= 1} onClick={() => propose(selD, selP, "manual")} data-testid="liab-propose">Match these</button>
        </div>
      )}
    </div>
  );
}
