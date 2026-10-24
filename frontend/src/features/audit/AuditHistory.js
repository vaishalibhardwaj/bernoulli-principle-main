import React from "react";
import { useStore } from "@/state/store";
import { KIND_LABELS } from "@/lib/constants";
import { EmptyState } from "@/components/bits";
import Pagination from "@/components/Pagination";
import { formatDateTime } from "@/lib/format";
import { History, ShieldCheck } from "lucide-react";

const ACTION_CLS = {
  "Approve": "chip-previous", "Reject": "chip-manual", "Submit for Approval": "chip-auto",
  "Save as Draft": "chip-edited", "Credential Set": "chip-pattern",
};

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
  const actions = Array.from(new Set(audit.map((a) => a.action)));

  return (
    <div data-testid="audit-history">
      <div className="page-head"><div><h1>Audit History</h1><p>Every status transition, credential event and detection override — immutable and attributable.</p></div></div>

      <div className="card">
        <div className="toolbar">
          <div className="filters-row">
            <div className="field"><label className="field-label">Entity</label>
              <select className="select" value={entity} onChange={(e) => setEntity(e.target.value)} data-testid="audit-entity"><option value="all">All entities</option>{Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field"><label className="field-label">Action</label>
              <select className="select" value={action} onChange={(e) => setAction(e.target.value)} data-testid="audit-action"><option value="all">All actions</option>{actions.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="field"><label className="field-label">User</label>
              <select className="select" value={user} onChange={(e) => setUser(e.target.value)} data-testid="audit-user"><option value="all">All users</option><option>Priya</option><option>Arun</option></select></div>
            <div className="field"><label className="field-label">From</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="audit-from" /></div>
            <div className="field"><label className="field-label">To</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} data-testid="audit-to" /></div>
          </div>
        </div>

        <div className="grid-scroll">
          <table className="grid">
            <thead><tr><th style={{ width: 170 }}>Timestamp</th><th>User</th><th>Entity</th><th>Record</th><th>Action</th><th>Transition</th><th>Comment</th></tr></thead>
            <tbody>
              {pageRows.map((a) => (
                <tr key={a.id} data-testid={"audit-row-" + a.id}>
                  <td className="tnum" style={{ color: "hsl(var(--muted))" }}>{formatDateTime(a.ts)}</td>
                  <td style={{ fontWeight: 600 }}>{a.user}</td>
                  <td>{KIND_LABELS[a.entityType] || a.entityType}</td>
                  <td className="tnum" style={{ fontSize: 12 }}>{a.entityLabel}</td>
                  <td><span className={"chip " + (ACTION_CLS[a.action] || "chip-manual")}>{a.action === "Approve" && <ShieldCheck size={11} />}{a.action}</span></td>
                  <td style={{ fontSize: 12 }}>{a.from && a.to ? <>{a.from} <span className="arrow">→</span> <b>{a.to}</b></> : "—"}</td>
                  <td style={{ fontSize: 12, color: "hsl(var(--muted))", maxWidth: 280 }}>{a.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={History} title="No audit entries match" subtitle="Adjust the filters or date range to see more history." />}
        </div>
        {filtered.length > 0 && <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} idPrefix="audit-pager" />}
      </div>
    </div>
  );
}
