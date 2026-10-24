import React from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { TODAY, AMC_BREAKDOWN, RELEASE_CUTOFF } from "@/mock/opsSeed";
import { inr, inrShort, num, ReadOnlyNote } from "@/features/ops/ui";
import { JourneyBar } from "@/features/today/Cycle";
import { downloadCsv } from "@/features/reports/csv";
import { Banknote, Send, Check, Clock, ArrowRight, Download, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";

/** Stage 5 — release realised money to Transaction Posting so units can be allotted (SEBI). */
export default function FundRelease() {
  const { collections, perms, act, currentUser, simple } = useStore();
  const nav = useNavigate();
  const canEdit = hasCap(perms, "release", "edit");
  const canApprove = hasCap(perms, "release", "approve");
  const rel = (collections.releases || [])[0];
  const extra = (collections.matches || []).filter((m) => m.status === "confirmed").reduce((s, m) => s + m.amount, 0);
  const ready = TODAY.realisedForAllotment + extra;
  const readyCount = TODAY.auto + TODAY.aiAccepted + TODAY.manual + (collections.matches || []).filter((m) => m.status === "confirmed").length;
  const held = TODAY.heldForAllotment - extra;
  const openCases = (collections.exceptions || []).filter((e) => e.status !== "closed" && e.amount > 0).length;
  const pendingMatches = (collections.matches || []).filter((m) => m.status === "pending");
  const mins = Math.round((new Date(RELEASE_CUTOFF) - Date.now()) / 60000);

  const prepare = () => {
    const res = act({ screen: "release", cap: "edit", kind: "releases", id: rel.id, patch: { status: "pending", amount: ready, count: readyCount, preparedBy: currentUser, preparedAt: new Date().toISOString() }, audit: { entityLabel: rel.ref, action: "Prepare fund release", from: "Not prepared", to: "Pending", comment: inr(ready) } });
    if (res.ok) toast.success(simple ? "Prepared. Your checker will release it." : "Release batch prepared and sent to checker"); else toast.error(res.error);
  };
  const release = () => {
    const res = act({ screen: "release", cap: "approve", kind: "releases", id: rel.id, target: { owner: rel.preparedBy }, patch: { status: "released", approvedBy: currentUser, releasedAt: new Date().toISOString() }, audit: { entityLabel: rel.ref, action: "Release funds to Posting", from: "Pending", to: "Released", comment: inr(rel.amount) } });
    if (res.ok) toast.success("Released to Transaction Posting. Units can now be allotted."); else toast.error(res.error);
  };
  const report = () => downloadCsv(`fund_utilisation_${new Date().toISOString().slice(0, 10)}.csv`, ["AMC", "Schemes", "Payments", "Amount (INR)"], AMC_BREAKDOWN.map((a) => [a.amc, a.schemes, a.count, Math.round(ready * a.share)]));

  const steps = [
    { k: "prepare", label: "Maker prepares the batch", done: rel.status !== "not_started", who: rel.preparedBy },
    { k: "approve", label: "Checker releases it", done: rel.status === "released", who: rel.approvedBy },
    { k: "posting", label: "Transaction Posting allots units", done: rel.status === "released", who: "Posting team" },
  ];

  return (
    <div data-testid="fund-release">
      <JourneyBar current="release" />
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Banknote size={22} /> {simple ? "Release money" : "Fund release"}</h1>
          <p>{simple ? "Send the money that has arrived to the team that allots units. Must be done by 3:00 PM." : "SEBI requires units to be allotted only after funds are realised. Release matched, realised money to Transaction Posting before the 3:00 PM cut-off; unmatched money stays held."}</p>
        </div>
        <div className="actions"><span className={"cutoff-chip" + (mins < 60 ? " hot" : "")}><Clock size={13} /> Cut-off {mins > 0 ? `in ${Math.floor(mins / 60)}h ${mins % 60}m` : "passed"}</span></div>
      </div>
      {!canEdit && !canApprove && <ReadOnlyNote what="Maker" />}

      <div className="release-hero card">
        <div className="rh-amounts">
          <div><span>{simple ? "Ready to release" : "Realised & matched"}</span><b>{inrShort(ready)}</b><small>{num(readyCount)} payments</small></div>
          <div className="held"><span>{simple ? "Held back (not matched yet)" : "Held — not yet matched"}</span><b>{inrShort(held)}</b><small><button className="link" onClick={() => nav("/exceptions")}>{openCases} problem cases</button> · <button className="link" onClick={() => nav("/match")}>{pendingMatches.length} matches awaiting checker</button></small></div>
        </div>
        <ol className="rh-steps">
          {steps.map((s, i) => <li key={s.k} className={s.done ? "done" : ""}><span>{s.done ? <Check size={13} /> : i + 1}</span><div><b>{s.label}</b>{s.who && s.done && <small>{s.who}</small>}</div></li>)}
        </ol>
        <div className="rh-action">
          {rel.status === "not_started" && (canEdit ? <button className="btn btn-primary btn-lg" onClick={prepare} data-testid="prepare-release"><Send size={15} /> Prepare release of {inrShort(ready)}</button> : <span className="muted">Waiting for a maker to prepare the batch.</span>)}
          {rel.status === "pending" && (canApprove && rel.preparedBy !== currentUser ? <button className="btn btn-success btn-lg" onClick={release} data-testid="approve-release"><ShieldCheck size={15} /> Release {inrShort(rel.amount)} to Posting</button> : <span className="pill pill-pending"><span className="dot" />Prepared by {rel.preparedBy} — waiting for checker</span>)}
          {rel.status === "released" && <span className="pill pill-active"><span className="dot" />Released at {new Date(rel.releasedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {rel.ref}</span>}
          <button className="btn btn-outline btn-sm" onClick={report}><Download size={13} /> Fund utilisation report</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>By AMC</h3><span className="muted">Each AMC receives its fund utilisation report when the batch is released</span></div>
        <table className="grid">
          <thead><tr><th>AMC</th><th style={{ textAlign: "right" }}>Schemes</th><th style={{ textAlign: "right" }}>Payments</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ width: 200 }}>Share</th><th>Status</th></tr></thead>
          <tbody>{AMC_BREAKDOWN.map((a) => (
            <tr key={a.amc}><td><b>{a.amc}</b></td><td className="tnum r">{a.schemes}</td><td className="tnum r">{num(a.count)}</td><td className="tnum r">{inrShort(ready * a.share)}</td>
              <td><span className="share-bar"><i style={{ width: `${a.share * 100 / 0.3}%` }} /></span></td>
              <td>{rel.status === "released" ? <span className="pill pill-active"><span className="dot" />Released</span> : <span className="pill pill-draft"><Lock size={10} /> Held until release</span>}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {rel.status === "released" && <div className="next-strip"><span>Fund release done.</span><button className="btn btn-primary btn-sm" onClick={() => nav("/refunds")}>Next: Send refunds <ArrowRight size={13} /></button></div>}
    </div>
  );
}
