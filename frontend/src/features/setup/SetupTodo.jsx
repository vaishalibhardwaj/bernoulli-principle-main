// Central Setup › Recon › To do: what is waiting on the team, for the AMC picked at the top.
// A short header with the two counts that matter (to approve, sent back), then one list at a time.
// The three figures in the header are also the switch between the lists: To approve, Sent back to you, Requests from Ops.
// Drafts stay on each setup screen. The type filter, search and dates sit on one line above the list.
// Every list starts on today: all work still pending today. Changing a date filters by it. Long lists are grouped by type and load in steps; an item opens in a review window.
import React from "react";
import { Art } from "@/components/Art";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, FileText } from "lucide-react";
import { useStore } from "@/state/store";
import { inScope, amcOfAccount } from "@/lib/org";
import { maskAccount, timeAgo } from "@/lib/format";
import { normPa, PA_OPTIONS } from "@/lib/setupSchema";
import { greeting, longDate } from "@/features/home/NowStrip";
import ReviewQueue from "@/features/approvals/ReviewQueue";
import { useApprovals } from "@/features/approvals/useApprovals";
import Picker from "@/components/Picker";
import DateRange, { todayRange, inRange } from "@/components/DateRange";
import SetupTasks from "./SetupTasks";

const paName = (code) => PA_OPTIONS.find((o) => o.code === normPa(code))?.label || code || "Aggregator";
const STEP = 12;

export default function SetupTodo() {
  const { collections, amcUser, personaUser, activeAmc } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const approvals = useApprovals();
  const [range, setRange] = React.useState(() => todayRange(false));

  // Setups of every kind, as one list of things a person can open and finish.
  const mine = (c) => inScope(amcUser, amcOfAccount(c.accountNumber));
  const items = [
    ...(collections.bank_config || []).filter(mine).map((c) => ({ c, kind: "Bank setup", who: c.bankName, what: maskAccount(c.accountNumber), path: `/bank-setup/edit/${c.id}` })),
    ...(collections.credit_config || []).filter(mine).map((c) => ({ c, kind: "Credit MIS setup", who: paName(c.paCode || (c.paCodes || [])[0]), what: `${c.bankName} · ${maskAccount(c.accountNumber)}`, path: `/credit-mis/edit/${c.id}` })),
    ...(collections.bank_mapping || []).map((c) => ({ c, kind: "Column mapping", who: c.type === "credit" ? paName(c.paCode || (c.paCodes || [])[0]) : c.bankName, what: c.formatName || "Standard layout", path: `/mapping/${c.type}/${c.id}` })),
  ];
  const when = (x) => (x.c.status === "rejected" ? x.c.rejection?.date : x.c.lastUpdated);
  const sentBack = items.filter((x) => x.c.status === "rejected" && inRange(when(x), range));
  const requests = (collections.setup_requests || []).filter((t) => t.status === "open" && inScope(amcUser, t.amc));
  const toApprove = approvals.filter((a) => !a.own && inRange(a.when, range));

  const counts = { approve: toApprove.length, fix: sentBack.length, requests: requests.length };
  const first = ["approve", "fix"].find((k) => counts[k]) || "approve";
  const tab = sp.get("tab") || first;
  const setTab = (t) => setSp({ tab: t }, { replace: true });
  const dates = <span className="rq-dates"><DateRange value={range} onChange={setRange} testid="todo-dates" /></span>;

  return (
    <div className="bs todo" data-testid="setup-todo">
      <header className="todo-head">
        <div className="todo-hello">
          <h1>{greeting()}, {personaUser.name.split(" ")[0]}</h1>
          <p>{longDate()}{activeAmc ? <> · <b>{activeAmc}</b></> : null}</p>
        </div>
        <div className="todo-stats" role="tablist" aria-label="What needs you">
          {[["approve", "To approve", counts.approve, ""], ["fix", "Sent back to you", counts.fix, counts.fix ? " warn" : ""], ["requests", "Requests from Ops", counts.requests, ""]].map(([k, label, n, tone]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={"todo-stat" + (tab === k ? " on" : "") + tone} onClick={() => setTab(k)} data-testid={k === "approve" ? "todo-approve" : k === "fix" ? "todo-fix" : "todo-requests"}>
              <span>{label}</span><b className="tnum">{n}</b>
            </button>
          ))}
        </div>
      </header>

      <div className="todo-body" key={tab}>
        {tab === "approve" && <ReviewQueue items={approvals.filter((a) => !a.own)} range={range} testid="todo-queue" extra={dates} />}
        {tab === "requests" && <SetupTasks embedded />}
        {tab === "fix" && <WorkList extra={dates} list={sentBack} fix when={when} onOpen={(x) => nav(x.path)} />}
      </div>
    </div>
  );
}

/** Sent back or drafts: grouped by type, a few rows per type, more on request. */
function WorkList({ list, fix, when, onOpen, extra }) {
  const [kind, setKind] = React.useState("all");
  const [shown, setShown] = React.useState({});
  const kinds = [...new Set(list.map((x) => x.kind))];
  const groups = (kind === "all" ? kinds : [kind]).map((k) => [k, list.filter((x) => x.kind === k)]).filter(([, l]) => l.length);
  if (!list.length) return <div className="rq">{extra && <div className="rq-bar">{extra}</div>}<div className="empty rq-empty" data-testid={"todo-list-" + (fix ? "fix" : "drafts")}><Art name="badges" size={64} /><h3>{fix ? "Nothing sent back" : "No drafts"}</h3><p>{fix ? "Every change you sent was approved or is still with a teammate." : "Anything you save without sending shows here."}</p></div></div>;
  return (
    <div className="rq" data-testid={"todo-list-" + (fix ? "fix" : "drafts")}>
      <div className="rq-bar"><Picker value={kind} onChange={setKind} label="Show" testid="fix-kind" width={260} options={[{ value: "all", label: "All types", count: list.length }, ...kinds.map((k) => ({ value: k, label: k, count: list.filter((x) => x.kind === k).length }))]} />{extra}</div>
      <div className="rq-panel">{groups.map(([k, l]) => {
        const lim = shown[k] ?? Math.min(kind === "all" ? 4 : STEP, l.length);
        return (
          <section key={k} className="rq-group">
            {kind === "all" && <header className="rq-gh"><h3>{k}</h3><em className="tnum">{l.length}</em></header>}
            <ul className="rq-list">
              {l.slice(0, lim).map((x) => (
                <li key={x.c.id}>
                  <button type="button" className="rq-row" onClick={() => onOpen(x)} data-testid={"todo-row-" + x.c.id}>
                    <span className={"rq-ic" + (fix ? " warn" : "")} aria-hidden="true"><FileText size={17} /></span>
                    <span className="rq-main"><b>{x.who} · {x.what}</b><small>{fix ? `“${x.c.rejection?.comment || "Sent back"}” · ${x.c.rejection?.by || ""}` : `Last saved by ${x.c.owner || "—"}`}{when(x) ? ` · ${timeAgo(when(x))}` : ""}</small></span>
                    <span className="rq-go">{fix ? "Fix" : "Continue"} <ArrowRight size={14} /></span>
                  </button>
                </li>
              ))}
            </ul>
            {l.length > lim && <button type="button" className="rq-more" onClick={() => setShown({ ...shown, [k]: lim + STEP })}>Show {Math.min(STEP, l.length - lim)} more <span className="tnum">· {l.length - lim} left</span></button>}
          </section>
        );
      })}</div>
    </div>
  );
}
