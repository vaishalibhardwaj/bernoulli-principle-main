import React from "react";
import { useStore } from "@/state/store";
import { KIND_LABELS } from "@/lib/constants";
import { EmptyState } from "@/components/bits";
import Pagination from "@/components/Pagination";
import { formatDateTime } from "@/lib/format";
import { X } from "lucide-react";

// Display only: the colour of an action says what kind of event it was. Nothing here changes what is recorded.
const toneOf = (a) => (a.denied ? "pill-rejected" : /^(Approve|Sign off|Release|Task reviewed|Balance mismatch resolved)/i.test(a.action) ? "pill-active" : /(Reject|Return|sent back|Deactivate|failed)/i.test(a.action) ? "pill-rejected" : /(Submit|Upload|marked done)/i.test(a.action) ? "pill-pending" : "pill-draft");
// Record types without a friendly name are shown in plain words ("task_done" becomes "Task done").
const plainKind = (k) => KIND_LABELS[k] || (k ? k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "—");

export default function AuditHistory() {
  const { audit, collections } = useStore();
  const [entity, setEntity] = React.useState("all");
  const [action, setAction] = React.useState("all");
  const [user, setUser] = React.useState("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  React.useEffect(() => { setPage(1); }, [entity, action, user, from, to]);

  const filtered = React.useMemo(() => {
    return audit.filter((a) => {
      if (entity !== "all" && a.entityType !== entity) return false;
      if (action !== "all" && a.action !== action) return false;
      if (user !== "all" && a.user !== user) return false;
      if (from && new Date(a.ts) < new Date(from)) return false;
      if (to && new Date(a.ts) > new Date(to + "T23:59:59")) return false;
      return true;
    });
  }, [audit, entity, action, user, from, to]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const actions = Array.from(new Set(audit.map((a) => a.action))).sort();
  const people = Array.from(new Set(audit.map((a) => a.user).filter(Boolean))).sort();
  const kinds = Array.from(new Set([...Object.keys(KIND_LABELS), ...audit.map((a) => a.entityType).filter(Boolean)]));
  const filtering = entity !== "all" || action !== "all" || user !== "all" || from || to;
  const clear = () => { setEntity("all"); setAction("all"); setUser("all"); setFrom(""); setTo(""); };

  return (
    <div data-testid="audit-history">
      <div className="page-head"><div><h1>History</h1><p>Every change, who made it and when. Entries are added automatically and can never be edited or removed.</p></div></div>

      <div className="card">
        <div className="toolbar">
          <div className="filters-row">
            <div className="field"><label className="field-label" htmlFor="au-kind">What changed</label>
              <select id="au-kind" className="select" value={entity} onChange={(e) => setEntity(e.target.value)} data-testid="audit-entity"><option value="all">Everything</option>{kinds.map((k) => <option key={k} value={k}>{plainKind(k)}</option>)}</select></div>
            <div className="field"><label className="field-label" htmlFor="au-action">Action</label>
              <select id="au-action" className="select" value={action} onChange={(e) => setAction(e.target.value)} data-testid="audit-action"><option value="all">All actions</option>{actions.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="field"><label className="field-label" htmlFor="au-user">Who</label>
              <select id="au-user" className="select" value={user} onChange={(e) => setUser(e.target.value)} data-testid="audit-user"><option value="all">Everyone</option>{people.map((u) => <option key={u}>{u}</option>)}</select></div>
            <div className="field"><label className="field-label" htmlFor="au-from">From</label><input id="au-from" type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} data-testid="audit-from" /></div>
            <div className="field"><label className="field-label" htmlFor="au-to">To</label><input id="au-to" type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} data-testid="audit-to" /></div>
            {filtering && <button type="button" className="btn btn-ghost btn-sm" onClick={clear} data-testid="audit-clear"><X size={13} /> Clear filters</button>}
            <span className="hist-count" aria-live="polite">{filtered.length} of {audit.length} entries</span>
          </div>
        </div>

        <div className="grid-scroll">
          <table className="grid">
            <thead><tr><th scope="col" style={{ width: 170 }}>When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Record</th><th scope="col">Action</th><th scope="col">Change</th><th scope="col">Comment</th></tr></thead>
            <tbody>
              {pageRows.map((a) => (
                <tr key={a.id} data-testid={"audit-row-" + a.id}>
                  <td className="tnum muted hist-when">{formatDateTime(a.ts)}</td>
                  <td className="hist-who">{a.user}</td>
                  <td>{plainKind(a.entityType)}</td>
                  <td className="tnum">{a.entityLabel || "—"}</td>
                  <td><span className={"pill " + toneOf(a)}><span className="dot" />{a.action}</span></td>
                  <td>{a.from && a.to ? <span className="hist-change">{a.from}<span aria-label="changed to"> → </span><b>{a.to}</b></span> : <span className="muted">—</span>}</td>
                  <td className="hist-note">{a.comment || a.reason || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState art="search" title={audit.length ? "No entries match these filters" : "Nothing has been recorded yet"} subtitle={audit.length ? "Widen the dates or clear the filters to see more." : "Entries appear here as soon as anyone makes a change."} action={filtering ? <button type="button" className="btn btn-outline btn-sm" onClick={clear}>Clear filters</button> : null} />}
        </div>
        {filtered.length > 0 && <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} idPrefix="audit-pager" />}
      </div>
    </div>
  );
}
