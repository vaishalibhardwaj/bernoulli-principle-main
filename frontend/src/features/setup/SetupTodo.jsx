// Central Setup › Recon › To do: everything waiting on the team, in one place, for the AMC picked at the top.
//  To approve (a teammate made it) · Sent back (fix and resubmit) · Requests from Ops · Drafts (finish and send).
import React from "react";
import { HeroArt } from "@/components/Art";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckSquare, AlertTriangle, ClipboardList, FilePen, ArrowRight, CheckCircle2 } from "lucide-react";
import { useStore } from "@/state/store";
import { inScope, amcOfAccount } from "@/lib/org";
import { maskAccount, timeAgo } from "@/lib/format";
import { normPa, PA_OPTIONS } from "@/lib/setupSchema";
import { StatCard, Avatar } from "@/components/au";
import Approvals from "@/features/approvals/Approvals";
import { useApprovals } from "@/features/approvals/useApprovals";
import SetupTasks from "./SetupTasks";

const paName = (code) => PA_OPTIONS.find((o) => o.code === normPa(code))?.label || code || "Aggregator";

export default function SetupTodo() {
  const { collections, amcUser } = useStore();
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
  const setTab = (t) => setSp({ tab: t }, { replace: true });

  return (
    <div className="bs" data-testid="setup-todo">
      <div className="bs-head">
        <div>
          <h1>To do</h1>
        </div>
        <HeroArt name="clipboard" />
      </div>

      <div className="au-stats todo-stats">
        {[
          ["approve", "To approve", CheckSquare, "amber"],
          ["fix", "Sent back", AlertTriangle, "red"],
          ["requests", "Requests from Ops", ClipboardList, "blue"],
          ["drafts", "Drafts", FilePen, "grey"],
        ].map(([k, label, Icon, tone]) => (
          <StatCard key={k} icon={Icon} tone={tone} label={label} value={counts[k]} footAction={tab === k ? "Showing" : "Show"} onClick={() => setTab(k)} active={tab === k} testid={"todo-" + k} />
        ))}
      </div>

      <div className="todo-body" key={tab}>
        {tab === "approve" && <Approvals embedded />}
        {tab === "requests" && <SetupTasks embedded />}
        {(tab === "fix" || tab === "drafts") && (
          <div className="au-list" data-testid={"todo-list-" + tab}>
            <div className="au-list-h"><h3>{tab === "fix" ? "Sent back — fix and resubmit" : "Drafts — finish and send for approval"}</h3></div>
            {(tab === "fix" ? sentBack : drafts).length === 0 && <div className="bs-empty"><CheckCircle2 size={16} /> {tab === "fix" ? "Nothing sent back." : "No drafts."}</div>}
            {(tab === "fix" ? sentBack : drafts).map((x) => (
              <div key={x.c.id} className="au-row bs-fixrow" role="button" tabIndex={0} onClick={() => nav(x.path)} onKeyDown={(e) => e.key === "Enter" && nav(x.path)} data-testid={"todo-row-" + x.c.id}>
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
