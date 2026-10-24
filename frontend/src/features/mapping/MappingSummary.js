import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pencil, Eye, GitCompareArrows, Landmark } from "lucide-react";
import { useStore } from "@/state/store";
import { StatusPill, SkeletonRows, EmptyState } from "@/components/bits";
import Pagination from "@/components/Pagination";
import { formatDate } from "@/lib/format";
import { hasCap } from "@/lib/access";
import { STATUS_FILTERS, statusBucket } from "@/lib/constants";
import { paLabel } from "@/lib/setupSchema";

/**
 * Column mapping is per bank name (~15–18 banks), not per account. Each row says how many accounts it drives,
 * so people see the impact of a change before they make it.
 */
export default function MappingSummary() {
  const { collections, perms } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") === "credit" ? "credit" : "bank";
  const [status, setStatus] = React.useState("all");
  const [bank, setBank] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [loading, setLoading] = React.useState(true);
  const canEdit = hasCap(perms, "mapping", "edit");

  const all = collections.bank_mapping.filter((m) => (tab === "credit" ? m.type === "credit" : m.type === "bank"));
  const accountsFor = (m) => new Set((tab === "credit" ? collections.credit_config : collections.bank_config).filter((c) => c.bankName === m.bankName && (c.formatName || "") === (m.formatName || "")).map((c) => c.accountNumber)).size;
  const banks = [...new Set(all.map((m) => m.bankName))].sort();

  React.useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 300); return () => clearTimeout(t); }, [status, tab, page, pageSize, bank]);
  React.useEffect(() => { setPage(1); }, [status, tab, bank]);

  const filtered = all.filter((m) => (status === "all" || statusBucket(m.status) === status) && (bank === "all" || m.bankName === bank));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const counts = Object.fromEntries(STATUS_FILTERS.map((f) => [f.key, f.key === "all" ? all.length : all.filter((m) => statusBucket(m.status) === f.key).length]));

  return (
    <div data-testid="mapping-summary">
      <div className="page-head"><div><h1>Column Mapping</h1><p>One mapping per bank (and per layout, when a bank sends more than one). Every account at that bank uses it.</p></div></div>

      <div className="card">
        <div className="toolbar" style={{ gap: 4, paddingBottom: 0, borderBottom: "none" }}>
          <button className={"btn " + (tab === "bank" ? "btn-primary" : "btn-ghost")} data-testid="tab-bank" onClick={() => setSp({ tab: "bank" })}>Bank Statement Mapping</button>
          <button className={"btn " + (tab === "credit" ? "btn-primary" : "btn-ghost")} data-testid="tab-credit" onClick={() => setSp({ tab: "credit" })}>Credit MIS Mapping</button>
        </div>
        <div className="toolbar">
          <select className="select" style={{ maxWidth: 220 }} value={status} onChange={(e) => setStatus(e.target.value)} data-testid="mapping-filter-status">
            {STATUS_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label} ({counts[f.key]})</option>)}
          </select>
          <select className="select" style={{ maxWidth: 240 }} value={bank} onChange={(e) => setBank(e.target.value)} data-testid="mapping-filter-bank">
            <option value="all">All banks ({banks.length})</option>
            {banks.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="grid-scroll">
          <table className="grid">
            <thead><tr><th style={{ width: 54 }}>S.No</th><th>Bank</th>{tab === "credit" && <th>Payment aggregator</th>}<th>Layout</th><th>File Type</th><th className="r">Accounts using it</th><th>Status</th><th>Last updated</th><th style={{ width: 90 }}>Action</th></tr></thead>
            {loading ? <SkeletonRows rows={7} cols={tab === "credit" ? 9 : 8} /> : (
              <tbody>
                {pageRows.map((m, i) => (
                  <tr key={m.id} data-testid={"mapping-row-" + m.id}>
                    <td className="tnum">{(page - 1) * pageSize + i + 1}</td>
                    <td><b>{m.bankName}</b></td>
                    {tab === "credit" && <td style={{ fontSize: 12 }}>{paLabel(m.paCode || (m.paCodes || [])[0])}</td>}
                    <td style={{ fontSize: 12 }}>{m.formatName || <span className="muted">Standard</span>}</td>
                    <td className="tnum">{m.standard ? `${m.fileType} (standard)` : m.fileType}</td>
                    <td className="tnum r"><span className="acct-count"><Landmark size={12} /> {accountsFor(m)}</span></td>
                    <td><StatusPill status={m.status === "not_started" ? "draft" : m.status} id={"map-status-" + m.id} />{m.status === "not_started" && <div className="muted" style={{ fontSize: 11 }}>not started</div>}</td>
                    <td className="tnum muted">{formatDate(m.lastUpdated)}</td>
                    <td>
                      <button className="row-icon-btn" title={m.status === "pending" || !canEdit ? "View" : "Edit mapping"} data-testid={"map-edit-" + m.id} onClick={() => nav(`/mapping/${tab}/${m.id}`)}>
                        {m.status === "pending" || !canEdit ? <Eye /> : <Pencil />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && filtered.length === 0 && <EmptyState icon={GitCompareArrows} title="No mappings here yet" subtitle={tab === "credit" ? "Credit MIS mappings appear once a Credit MIS setup is approved." : "Mappings appear once a bank's first setup is approved."} />}
        </div>
        {!loading && filtered.length > 0 && <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} idPrefix="map-pager" />}
      </div>
    </div>
  );
}
