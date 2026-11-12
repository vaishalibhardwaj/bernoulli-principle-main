// Central Setup › Recon › To do: everything waiting on the team, in one place, for the AMC picked at the top.
//  To approve (a teammate made it) · Sent back (fix and resubmit) · Requests from Ops · Drafts (finish and send).
import React from "react";
import { Art } from "@/components/Art";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useStore } from "@/state/store";
import { inScope, amcOfAccount } from "@/lib/org";
import { maskAccount, timeAgo } from "@/lib/format";
import { normPa, PA_OPTIONS } from "@/lib/setupSchema";
import { Avatar } from "@/components/au";
import { NowStrip, greeting, longDate } from "@/features/home/NowStrip";
import Approvals from "@/features/approvals/Approvals";
import { useApprovals } from "@/features/approvals/useApprovals";
import SetupTasks from "./SetupTasks";

const paName = (code) => PA_OPTIONS.find((o) => o.code === normPa(code))?.label || code || "Aggregator";

export default function SetupTodo() {
  const { collections, amcUser, personaUser, activeAmc } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const approvals = useApprovals();

  // Setups of every kind, as one list of things a person can open and finish.
  const mine = (c) => inScope(amcUser, amcOfAccount(c.accountNumber));
  const items = [
    ...(collections.bank_config || []).filter(mine).map((c) => ({ c, kind: "Bank account", who: c.bankName, what: maskAccount(c.accountNumber), path: `/bank-setup/edit/${c.id}` })),
    ...(collections.credit_config || []).filter(mine).map((c) => ({ c, kind: "Credit MIS feed", who: paName(c.paCode || (c.paCodes || [])[0]), what: `${c.bankName} · ${maskAccount(c.accountNumber)}`, path: `/credit-mis/edit/${c.id}` })),
    ...(collections.bank_mapping || []).map((c) => ({ c, kind: "Columns", who: c.type === "credit" ? paName(c.paCode || (c.paCodes || [])[0]) : c.bankName, what: c.formatName || "Standard layout", path: `/mapping/${c.type}/${c.id}` })),
  ];
  const sentBack = items.filter((x) => x.c.status === "rejected");
  const drafts = items.filter((x) => x.c.status === "draft" && x.kind !== "Columns");
  const requests = (collections.setup_requests || []).filter((t) => t.status === "open" && inScope(amcUser, t.amc));

  const counts = { approve: approvals.length, fix: sentBack.length, requests: requests.length, drafts: drafts.length };
  const first = ["approve", "fix", "requests", "drafts"].find((k) => counts[k]) || "approve";
  const tab = sp.get("tab") || first;
  const [fixKind, setFixKind] = React.useState("all");
  const setTab = (t) => setSp({ tab: t }, { replace: true });

  return (
    <div className="bs" data-testid="setup-todo">
      <div className="home-head">
        <div>
          <h1>{greeting()}, {personaUser.name.split(" ")[0]}</h1>
          <p>{longDate()}{activeAmc ? <> · <b>{activeAmc}</b></> : null}</p>
        </div>
      </div>

      <NowStrip cutoff={false} tiles={[
        { kind: "approve", label: "Approvals waiting", value: counts.approve, sub: "Changes a teammate made, for you to check", clear: "Nothing to approve", onClick: () => setTab("approve"), active: tab === "approve", testid: "todo-approve" },
        { kind: "back", label: "Sent back to you", value: counts.fix, sub: "A teammate asked for a change", clear: "Nothing sent back", onClick: () => setTab("fix"), active: tab === "fix", testid: "todo-fix" },
      ]} />

      <div className="home-sec">
        <h2>{{ approve: "Check your teammates' changes", fix: "Fix and send again", requests: "Requests from Ops", drafts: "Finish your drafts" }[tab]}</h2>
        <div className="segmented todo-tabs" role="tablist" aria-label="To do lists">
          {[["approve", "To approve"], ["fix", "Sent back to me"], ["requests", "Requests from Ops"], ["drafts", "Drafts"]].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={"todo-tab-" + k}>{label}<em>{counts[k]}</em></button>
          ))}
        </div>
      </div>

      <div className="todo-body" key={tab}>
        {tab === "approve" && <Approvals embedded />}
        {tab === "requests" && <SetupTasks embedded />}
        {tab === "fix" && sentBack.length > 0 && (
          <div className="ap-filter">
            <label htmlFor="fix-kind">Show</label>
            <select id="fix-kind" className="select" value={fixKind} onChange={(e) => setFixKind(e.target.value)} data-testid="fix-kind">
              <option value="all">All types ({sentBack.length})</option>
              {[...new Set(sentBack.map((x) => x.kind))].map((k) => <option key={k} value={k}>{k} ({sentBack.filter((x) => x.kind === k).length})</option>)}
            </select>
          </div>
        )}
        {(tab === "fix" || tab === "drafts") && (
          <div className="au-list" data-testid={"todo-list-" + tab}>
            {(tab === "fix" ? sentBack : drafts).length === 0 && <div className="todo-empty"><Art name="badges" /><b>{tab === "fix" ? "Nothing sent back" : "No drafts"}</b><span>{tab === "fix" ? "Every change you sent was approved or is still with a teammate." : "Anything you save without sending shows up here."}</span></div>}
            {(tab === "fix" ? sentBack.filter((x) => fixKind === "all" || x.kind === fixKind) : drafts).map((x) => (
              <div key={x.c.id} className="au-row bs-fixrow" role="button" tabIndex={0} onClick={() => nav(x.path)} data-testid={"todo-row-" + x.c.id}>
                <span className="au-who"><Avatar name={x.who} badge={tab === "fix" ? "bad" : "info"} /><span><b>{x.who} · {x.what}</b><em>{tab === "fix" ? `“${x.c.rejection?.comment || "Sent back"}”` : `${x.kind} · last saved by ${x.c.owner || "—"}`}</em></span></span>
                <span className="au-tag">{x.kind}</span>
                <span className="au-when">{tab === "fix" ? <>{x.c.rejection?.by}<br />{timeAgo(x.c.rejection?.date)}</> : timeAgo(x.c.lastUpdated)}</span>
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); nav(x.path); }}>{tab === "fix" ? "Fix" : "Continue"} <ArrowRight size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
