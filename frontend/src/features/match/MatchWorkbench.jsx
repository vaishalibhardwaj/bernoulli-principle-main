import React from "react";
import { useStore } from "@/state/store";
import { Modal } from "@/components/Modal";
import { hasCap } from "@/lib/access";
import { formatDate, timeAgo } from "@/lib/format";
import { inr, Conf, PhaseBadge, ReadOnlyNote } from "@/features/ops/ui";
import { stripNumbers } from "@/lib/plain";
import { ArrowRight, Combine, Sparkles, Check, X, HelpCircle, CheckCircle2, XCircle, Zap, Search } from "lucide-react";
import { toast } from "sonner";
import { JourneyBar } from "@/features/today/Cycle";
import { useMatchActions, FAST_TRACK, isAmbiguous } from "./matchActions";
import LiabilityMatch from "./LiabilityMatch";
import { bizGap, calGap, SIP_ALLOWANCE } from "@/lib/bizdays";


const tokens = (s) => new Set(String(s).toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter((t) => t.length > 1));
function nameSim(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0; A.forEach((t) => { if ([...B].some((x) => x.startsWith(t) || t.startsWith(x))) hit++; });
  return hit / Math.max(A.size, B.size);
}

export default function MatchWorkbench() {
  const { collections, perms, act, currentUser, simple } = useStore();
  const [selSug, setSelSug] = React.useState(null);
  const [side, setSide] = React.useState("subscription");
  const liveSugg = (collections.suggestions || []).filter((x) => !x.decided);
  const curSug = liveSugg.some((x) => x.id === selSug) ? selSug : liveSugg[0]?.id;
  const txt = (t) => (simple ? stripNumbers(t) : t);
  const canEdit = hasCap(perms, "match", "edit");
  const canApprove = hasCap(perms, "match", "approve");
  const credits = collections.credits || [];
  const purchases = collections.purchases || [];
  const suggestions = (collections.suggestions || []).filter((s) => !s.decided);
  const matches = collections.matches || [];
  const [selC, setSelC] = React.useState([]);
  const [selP, setSelP] = React.useState([]);
  const [q, setQ] = React.useState("");
  const [why, setWhy] = React.useState(null);

  const openC = credits.filter((c) => c.status === "open" && (!q || (c.remitter + c.narration + c.amount).toLowerCase().includes(q.toLowerCase())));
  const openP = purchases.filter((p) => p.status === "open" && (!q || (p.investor + p.appNo + p.amount).toLowerCase().includes(q.toLowerCase())));
  const sumC = credits.filter((c) => selC.includes(c.id)).reduce((s, c) => s + c.amount, 0);
  const sumP = purchases.filter((p) => selP.includes(p.id)).reduce((s, p) => s + p.amount, 0);
  const delta = sumC - sumP;
  const { propose, acceptSuggestion, dismissSuggestion, setStatus, byId } = useMatchActions();

  const proposeManual = () => { if (propose(selC, selP, "manual", 1)) { setSelC([]); setSelP([]); } };

  const decide = (m, yes) => {
    const res = act({ screen: "match", cap: "approve", kind: "matches", id: m.id, target: m, patch: { status: yes ? "confirmed" : "rejected", decidedBy: currentUser }, audit: { entityLabel: `${m.type} match ${inr(m.amount)}`, action: yes ? "Approve match" : "Reject match", from: "Pending checker", to: yes ? "Matched" : "Rejected" } });
    if (!res.ok) { toast.error(res.error); return; }
    setStatus(m.credits, "credits", yes ? "matched" : "open");
    setStatus(m.purchases, "purchases", yes ? "matched" : "open");
    toast.success(yes ? "Match approved" : "Match rejected — items returned to the open pool");
  };

  const explain = (c) => {
    const cands = purchases.filter((p) => p.status === "open").map((p) => {
      const sim = nameSim(c.remitter, p.investor);
      const days = bizGap(c.valueDate, p.txnDate); const cal = calGap(c.valueDate, p.txnDate);
      const window = /SIP/i.test(p.scheme + p.channel + c.narration) ? 2 + SIP_ALLOWANCE : 2;
      return { p, sim, checks: [
        { ok: p.amount === c.amount, text: p.amount === c.amount ? "Amount equal" : `Amount differs by ${inr(Math.abs(p.amount - c.amount))}` },
        { ok: Boolean(p.utr) && c.narration.includes(p.utr), text: p.utr ? (c.narration.includes(p.utr) ? "UTR found in narration" : `UTR ${p.utr} not in narration`) : "Purchase has no UTR" },
        { ok: days <= window, text: simple ? (days <= window ? "Dates are close (weekends and holidays don't count)" : `Dates are ${days} working days apart`) : `Date gap ${days} business day(s)${cal !== days ? ` (${cal} calendar — weekend/holiday)` : ""} · window ±${window}${window > 2 ? " incl. SIP settlement delay" : ""}` },
        ...(c.chequeNo ? [{ ok: p.chequeNo === c.chequeNo && p.drawee === c.drawee && p.drawerAcct === c.drawerAcct, text: p.chequeNo !== c.chequeNo ? "Different cheque number" : p.drawee === c.drawee && p.drawerAcct === c.drawerAcct ? `Cheque ${c.chequeNo}, drawn on ${c.drawee} ${c.drawerAcct} — same cheque` : `Same cheque number ${c.chequeNo}, but drawn on ${p.drawee} ${p.drawerAcct}, not ${c.drawee} ${c.drawerAcct} — cheque numbers repeat across banks` }] : []),
        { ok: sim >= 0.85, text: simple ? (sim >= 0.85 ? "Names match" : "Names don't match") : `Name similarity ${sim.toFixed(2)} (needs ≥ 0.85)` },
        { ok: p.regBank === c.remitterIfsc, text: p.regBank === c.remitterIfsc ? "Remitter IFSC = registered bank" : "Remitter IFSC ≠ registered bank" },
      ] };
    }).sort((a, b) => b.checks.filter((x) => x.ok).length - a.checks.filter((x) => x.ok).length || Math.abs(a.p.amount - c.amount) - Math.abs(b.p.amount - c.amount)).slice(0, 4);
    setWhy({ c, cands });
  };

  const pendingMatches = matches.filter((m) => m.status === "pending");

  return (
    <div data-testid="match-workbench">
      <JourneyBar current="match" />
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Combine size={24} /> {simple ? "Match payments" : "Match Workbench"}</h1>
          <p>{simple ? "The system found these likely matches. Check each one and say yes or no." : "What rules couldn't match with certainty: AI suggestions with reasons, N:M selection with a live difference, and an explainer for anything left over."}</p>
        </div>
        {!simple && <div className="actions"><PhaseBadge phase="P2">split-pane matching · P3: AI suggestions</PhaseBadge></div>}
      </div>
      {!canEdit && !canApprove && <ReadOnlyNote what="Maker" />}
      <div className="segmented side-tabs" data-testid="match-side">
        <button className={side === "subscription" ? "on" : ""} onClick={() => setSide("subscription")}>Subscription — money in</button>
        <button className={side === "liability" ? "on" : ""} onClick={() => setSide("liability")} data-testid="side-liability">Liability — payouts out</button>
      </div>
      {side === "liability" ? <LiabilityMatch /> : <>

      {pendingMatches.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }} data-testid="pending-matches">
          <div className="card-head"><h3>{simple ? "Waiting for approval" : "Matches awaiting checker"}</h3><span className="muted">{simple ? "Your team lead will approve these. Nothing to do here." : `AI matches above ${FAST_TRACK.conf * 100}% and up to ${inr(FAST_TRACK.amount)} are fast-tracked; everything else needs a second person`}</span></div>
          {pendingMatches.map((m) => (
            <div key={m.id} className="acr-row">
              <div className="acr-main">
                <div className="acr-title">{m.type} · {inr(m.amount)} · {m.source === "ai" ? `AI ${(m.confidence * 100).toFixed(0)}%` : "manual"}</div>
                <div className="muted">{m.credits.map((id) => byId(credits, id)?.ref).join(", ")} ↔ {m.purchases.map((id) => byId(purchases, id)?.appNo).join(", ")} · by {m.owner} {timeAgo(m.createdAt)}</div>
              </div>
              {canApprove && m.owner !== currentUser ? (
                <div className="acr-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => decide(m, false)}><X size={13} /> Reject</button>
                  <button className="btn btn-success btn-sm" onClick={() => decide(m, true)} data-testid={"approve-match-" + m.id}><Check size={13} /> Approve</button>
                </div>
              ) : <span className="pill pill-pending"><span className="dot" />Pending checker</span>}
            </div>
          ))}
        </div>
      )}

      <div className="mw-section-head" data-testid="manual-first"><h3>Match by hand</h3><span className="muted">The main way to match. Tick money received on the left and purchases on the right — any number on each side — until the amounts agree.</span></div>
      <div className="split-pane">
        <div className="card">
          <div className="card-head"><h3>{simple ? "Money received (not matched yet)" : "Open bank credits"}</h3><span className="muted">{openC.length}</span>
            <div className="search" style={{ marginLeft: "auto", maxWidth: 220 }}><Search /><input className="input" placeholder="Filter both sides…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          <div className="pane-list">
            {openC.map((c) => (
              <label key={c.id} className={"pane-row" + (selC.includes(c.id) ? " on" : "")} data-testid={"credit-" + c.id}>
                <input type="checkbox" className="cb" disabled={!canEdit} checked={selC.includes(c.id)} onChange={() => setSelC((s) => s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id])} />
                <div className="pr-main"><b className="tnum">{inr(c.amount)}</b><span className="muted">{c.bankName} · {formatDate(c.valueDate)}</span><div className="pr-narr tnum">{c.narration}</div></div>
                <button className="row-icon-btn" title={simple ? "Why no match?" : "Why not matched?"} onClick={(e) => { e.preventDefault(); explain(c); }} data-testid={"why-" + c.id}><HelpCircle size={15} /></button>
              </label>
            ))}
            {openC.length === 0 && <div className="muted card-pad">No open credits.</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>{simple ? "Purchases waiting for money" : "Open purchases"}</h3><span className="muted">{openP.length}</span></div>
          <div className="pane-list">
            {openP.map((p) => (
              <label key={p.id} className={"pane-row" + (selP.includes(p.id) ? " on" : "")} data-testid={"purchase-" + p.id}>
                <input type="checkbox" className="cb" disabled={!canEdit} checked={selP.includes(p.id)} onChange={() => setSelP((s) => s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id])} />
                <div className="pr-main"><b className="tnum">{inr(p.amount)}</b><span className="muted">{p.appNo} · {p.channel} · {formatDate(p.txnDate)}</span><div className="pr-narr">{p.investor} · {p.pan} · {p.scheme}</div></div>
              </label>
            ))}
            {openP.length === 0 && <div className="muted card-pad">No open purchases.</div>}
          </div>
        </div>
      </div>

      {suggestions.length > 0 && <div className="mw-section-head" style={{ marginTop: 20 }}><h3>System suggestions — review each one</h3><span className="muted">Found by the system, not confirmed. Anything based only on amount and name always goes to a checker.</span></div>}
      {suggestions.length > 0 && (
        <div className="sugg-focus" data-testid="ai-suggestions">
          {suggestions.filter((s) => s.id === curSug).map((s) => {
            const cs = s.credits.map((id) => byId(credits, id)).filter(Boolean);
            const ps = s.purchases.map((id) => byId(purchases, id)).filter(Boolean);
            return (
              <div key={s.id} className="card sugg-card focus" data-testid={"sugg-" + s.id}>
                <div className="sf-pos">{suggestions.findIndex((x) => x.id === s.id) + 1} <em>of {suggestions.length}</em></div>
                <div className="sc-head"><Sparkles size={14} />{simple ? <b className="sc-q">Is this a match?</b> : <span className="strat">{s.type}</span>}<Conf value={s.confidence} auto={FAST_TRACK.conf} />
                  {!isAmbiguous(s) && s.confidence >= FAST_TRACK.conf && cs.reduce((a, c) => a + c.amount, 0) <= FAST_TRACK.amount && <span className="fast"><Zap size={11} /> {simple ? "no approval needed" : "fast-track"}</span>}</div>
                {simple && <div className="sc-labels"><span>Money received</span><span>Purchase</span></div>}
                <div className="sc-sides">
                  <div>{cs.map((c) => <div key={c.id}><b>{inr(c.amount)}</b> <span className="muted">{c.ref} · {c.remitter}</span></div>)}</div>
                  <div>{ps.map((p) => <div key={p.id}><b>{inr(p.amount)}</b> <span className="muted">{p.appNo} · {p.investor}</span></div>)}</div>
                </div>
                <ul className="reasons">{s.reasons.map((r, i) => <li key={i} className={r.ok ? "ok" : "bad"}>{r.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{txt(r.text)}</li>)}</ul>
                {isAmbiguous(s) && <div className="amb-note" data-testid={"ambiguous-" + s.id}>Based on amount and name only — nothing like a UTR or PAN ties them together. Even if you say yes, a checker must confirm it.</div>}
                <Similar cs={cs} ps={ps} purchases={purchases} />
                {canEdit && <div className="sc-actions">
                  <button className={"btn btn-sm " + (simple ? "btn-outline" : "btn-ghost")} onClick={() => dismissSuggestion(s)}>{simple ? "Not a match" : "Dismiss"}</button>
                  <button className="btn btn-primary btn-sm" onClick={() => acceptSuggestion(s)} data-testid={"accept-" + s.id}><Check size={13} /> {simple ? "Yes, match" : "Accept"}</button>
                </div>}
              </div>
            );
          })}
          <div className="sugg-rest card">
            <div className="card-head"><h3>Also waiting</h3><span className="muted">{suggestions.length - 1} more</span></div>
            {suggestions.filter((s) => s.id !== curSug).slice(0, 6).map((s) => {
              const c0 = byId(credits, s.credits[0]); const p0 = byId(purchases, s.purchases[0]);
              return (
                <button key={s.id} className="un-row" onClick={() => setSelSug(s.id)}>
                  <i style={{ background: s.confidence >= 0.9 ? "#4ff0b4" : "#ffc56b", color: s.confidence >= 0.9 ? "#4ff0b4" : "#ffc56b" }} />
                  <span className="un-title">{inr(s.credits.reduce((a, id) => a + (byId(credits, id)?.amount || 0), 0))}<small>{c0?.remitter} → {p0?.investor}</small></span><ArrowRight size={13} />
                </button>
              );
            })}
            {suggestions.length > 7 && <div className="card-pad muted">+{suggestions.length - 7} more after these</div>}
          </div>
        </div>
      )}

      {simple && suggestions.length === 0 && <div className="card card-pad mw-empty" style={{ marginBottom: 16 }}><h2>No suggested matches right now</h2><p className="muted">New ones appear here automatically.</p></div>}
      {(selC.length > 0 || selP.length > 0) && (
        <div className="match-bar" data-testid="match-bar">
          {selC.length > 0 && selP.length > 0 && <Compare cs={credits.filter((c) => selC.includes(c.id))} ps={purchases.filter((p) => selP.includes(p.id))} />}
          <span>{selC.length} {simple ? "payment" : "credit"}{selC.length !== 1 ? "s" : ""} <b className="tnum">{inr(sumC)}</b></span>
          <span>↔</span>
          <span>{selP.length} purchase{selP.length !== 1 ? "s" : ""} <b className="tnum">{inr(sumP)}</b></span>
          <span className={"delta " + (Math.abs(delta) < 1 ? "ok" : "bad")}>{simple ? (Math.abs(delta) < 1 ? "Amounts are equal ✓" : `Difference ${inr(Math.abs(delta))}`) : <>Δ {inr(delta)} {Math.abs(delta) < 1 ? "✓" : ""}</>}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelC([]); setSelP([]); }}>Clear</button>
          <button className="btn btn-primary" disabled={!selC.length || !selP.length || Math.abs(delta) >= 1} onClick={proposeManual} data-testid="propose-match">{simple ? "Match these" : `Propose ${selC.length}:${selP.length} match`}</button>
        </div>
      )}

      {why && (
        <Modal id="why-modal" size="lg" title={simple ? `Why didn't ${inr(why.c.amount)} from ${why.c.remitter} match?` : `Why isn't ${why.c.ref} (${inr(why.c.amount)}) matched?`} onClose={() => setWhy(null)}>
          <p className="muted" style={{ marginTop: 0 }}>Narration: <code>{why.c.narration}</code></p>
          {why.cands.map(({ p, checks }) => (
            <div key={p.id} className="why-cand">
              <div><b>{p.appNo}</b> · {p.investor} · <b className="tnum">{inr(p.amount)}</b></div>
              <ul className="reasons">{checks.map((x, i) => <li key={i} className={x.ok ? "ok" : "bad"}>{x.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{txt(x.text)}</li>)}</ul>
            </div>
          ))}
          {why.cands.length === 0 && <div className="muted">No open purchases to compare against.</div>}
        </Modal>
      )}
      </>}
    </div>
  );
}

/** Other open purchases that look alike, with what tells them apart — so a person can pick the right one. */
function Similar({ cs, ps, purchases }) {
  const amount = cs.reduce((a, c) => a + c.amount, 0);
  const c0 = cs[0];
  const alike = purchases.filter((p) => p.status === "open" && !ps.some((x) => x.id === p.id) && Math.abs(p.amount - amount) <= amount * 0.01).slice(0, 3);
  if (!alike.length) return null;
  const row = (p, chosen) => (
    <tr key={p.id} className={chosen ? "chosen" : ""}><td>{chosen ? "Suggested" : "Also possible"}</td><td className="tnum">{p.appNo}</td><td>{p.investor}</td><td className="tnum">{inr(p.amount)}</td>
      <td className="tnum">{bizGap(c0.valueDate, p.txnDate)} bd</td><td>{p.regBank === c0.remitterIfsc ? "✓ same bank" : "different bank"}</td><td>{p.utr && c0.narration.includes(p.utr) ? "✓ UTR" : "—"}</td></tr>
  );
  return (
    <div className="similar" data-testid="similar">
      <div className="muted" style={{ marginBottom: 4 }}>{alike.length} other open purchase{alike.length > 1 ? "s have" : " has"} the same amount. Compare before you decide:</div>
      <table className="grid compact"><thead><tr><th /><th>Application</th><th>Investor</th><th>Amount</th><th>Date gap</th><th>Remitter bank</th><th>Reference</th></tr></thead>
        <tbody>{ps.map((p) => row(p, true))}{alike.map((p) => row(p, false))}</tbody></table>
    </div>
  );
}

/** Field-to-field comparison of whatever is ticked on each side (sums, business-day gap, references, names, cheques). */
function Compare({ cs, ps }) {
  const gap = Math.max(...cs.flatMap((c) => ps.map((p) => bizGap(c.valueDate, p.txnDate))));
  const utr = ps.some((p) => p.utr && cs.some((c) => c.narration.includes(p.utr)));
  const pan = ps.some((p) => cs.some((c) => c.narration.includes(p.pan)));
  const cheque = cs.find((c) => c.chequeNo);
  const chequeOk = cheque && ps.some((p) => p.chequeNo === cheque.chequeNo && p.drawee === cheque.drawee && p.drawerAcct === cheque.drawerAcct);
  const items = [
    [gap <= 2, `Dates ${gap} business day${gap !== 1 ? "s" : ""} apart`],
    [utr || pan, utr ? "UTR found in narration" : pan ? "PAN found in narration" : "No UTR / PAN link"],
    ...(cheque ? [[chequeOk, chequeOk ? "Cheque no. + bank + account all agree" : "Cheque no. matches only part — check drawee bank and account"]] : []),
  ];
  return <div className="cmp-row" data-testid="compare">{items.map(([ok, t]) => <span key={t} className={ok ? "ok" : "bad"}>{ok ? "✓" : "✗"} {t}</span>)}</div>;
}
