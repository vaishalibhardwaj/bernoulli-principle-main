import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pencil, Eye, GitCompareArrows, Landmark, Search, X } from "lucide-react";
import { useStore } from "@/state/store";
import { EmptyState } from "@/components/bits";
import Pagination from "@/components/Pagination";
import { formatDate } from "@/lib/format";
import { hasCap } from "@/lib/access";
import { inScope, userAmcs, amcOfAccount } from "@/lib/org";
import { STATUS_FILTERS, statusBucket } from "@/lib/constants";
import { paLabel } from "@/lib/setupSchema";
import { Avatar, SegmentRing, HatchBar } from "@/components/au";

const STATUS_COLOR = { active: "#16a34a", pending: "#f27a12", draft: "#8b8f99", rejected: "#e5262f", inactive: "#c4c7ce" };
const STATUS_WORD = { active: "Active", pending: "Pending approval", draft: "Draft", rejected: "Sent back", inactive: "Inactive" };

/**
 * Column mapping is per bank name (~15–18 banks), not per account. Each row says how many accounts it drives,
 * so people see the impact of a change before they make it.
 */
export default function MappingSummary({ embedded = false, type }) {
  const { collections, perms, amcUser } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = type || (sp.get("tab") === "credit" ? "credit" : "bank");
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const canEdit = hasCap(perms, "mapping", "edit");

  // Mappings are per bank and shared by every AMC that banks there; show the banks the picked AMC uses, and count its accounts only.
  const configs = tab === "credit" ? collections.credit_config : collections.bank_config;
  const accountsOf = (m, mine) => new Set(configs.filter((c) => c.bankName === m.bankName && (c.formatName || "") === (m.formatName || "") && (!mine || inScope(amcUser, amcOfAccount(c.accountNumber)))).map((c) => c.accountNumber)).size;
  const accountsFor = (m) => accountsOf(m, true);
  const oneAmc = userAmcs(amcUser).length === 1 ? userAmcs(amcUser)[0] : null;
  const all = collections.bank_mapping.filter((m) => (tab === "credit" ? m.type === "credit" : m.type === "bank") && (!oneAmc || accountsOf(m, true) > 0 || accountsOf(m, false) === 0));

  React.useEffect(() => { setPage(1); }, [status, tab, q]);

  const needle = q.trim().toLowerCase();
  const filtered = all.filter((m) => (status === "all" || statusBucket(m.status) === status) && (!needle || m.bankName.toLowerCase().includes(needle)))
    // What needs someone first: sent back, then waiting, then drafts, then the rest.
    .sort((a, b) => ["rejected", "pending", "draft", "active", "inactive"].indexOf(statusBucket(a.status)) - ["rejected", "pending", "draft", "active", "inactive"].indexOf(statusBucket(b.status)) || a.bankName.localeCompare(b.bankName));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const counts = Object.fromEntries(STATUS_FILTERS.map((f) => [f.key, f.key === "all" ? all.length : all.filter((m) => statusBucket(m.status) === f.key).length]));
  const order = ["active", "pending", "draft", "rejected", "inactive"];

  return (
    <div data-testid="mapping-summary">
      {!embedded && (
      <div className="page-head">
        <div><h1>Column Mapping</h1><p>One mapping per bank (and per layout, when a bank sends more than one). {oneAmc ? <>Showing the banks {oneAmc} uses. A mapping is shared by every AMC at that bank, so a change applies to all of them.</> : "Every account at that bank uses it."}</p></div>
        <div className="au-tabs" role="tablist" aria-label="Mapping type">
          <button role="tab" aria-selected={tab === "bank"} className={tab === "bank" ? "on" : ""} data-testid="tab-bank" onClick={() => setSp({ tab: "bank" })}>Bank statement</button>
          <button role="tab" aria-selected={tab === "credit"} className={tab === "credit" ? "on" : ""} data-testid="tab-credit" onClick={() => setSp({ tab: "credit" })}>Credit MIS</button>
        </div>
      </div>
      )}

      {/* Where the mappings stand: ring + bars, click to filter the list */}
      {all.length > 0 && (
        <div className="card mp2-health" data-testid="mapping-health">
          <div className="card-head"><h3>Where the mappings stand</h3><span className="muted">Click a status to filter the list</span>
            {status !== "all" && <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setStatus("all")}><X size={13} /> Clear filter</button>}</div>
          <div className="mp2-body">
            <SegmentRing size={190} thickness={16} total={all.length} sub={`${tab === "credit" ? "Credit MIS" : "bank"} mappings`}
              segments={order.map((k) => ({ key: k, label: STATUS_WORD[k], value: counts[k], color: STATUS_COLOR[k] }))} active={status === "all" ? null : status} onPick={(k) => setStatus(status === k ? "all" : k)} />
            <div className="mp2-bars">
              {order.filter((k) => counts[k]).map((k) => (
                <HatchBar key={k} label={STATUS_WORD[k]} value={counts[k]} total={all.length} color={STATUS_COLOR[k]} onClick={() => setStatus(status === k ? "all" : k)} active={status === k} testid={"map-status-bar-" + k} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="au-list mp2-list">
        <div className="au-list-h">
          <h3>{tab === "credit" ? "Credit MIS mappings" : "Bank statement mappings"}</h3>
          <span className="au-list-sub">{filtered.length} of {all.length}{status !== "all" ? ` · ${STATUS_WORD[status]}` : ""}</span>
          <span className="au-list-act">
            <label className="au-search mp2-search"><Search size={16} /><input placeholder="Search bank" value={q} onChange={(e) => setQ(e.target.value)} data-testid="mapping-filter-bank" /></label>
            <select className="select mp2-status" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="mapping-filter-status" aria-label="Status">
              {STATUS_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label} ({counts[f.key]})</option>)}
            </select>
          </span>
        </div>
        {pageRows.map((m) => {
          const st = statusBucket(m.status); const view = m.status === "pending" || !canEdit; const n = accountsFor(m);
          return (
            <div key={m.id} className="au-row mp2-row" role="button" tabIndex={0} onClick={() => nav(`/mapping/${tab}/${m.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/mapping/${tab}/${m.id}`)} data-testid={"mapping-row-" + m.id}>
              <span className="au-who"><Avatar name={m.bankName} /><span><b>{m.bankName}</b><em>{tab === "credit" ? `${paLabel(m.paCode || (m.paCodes || [])[0])} · ` : ""}{m.formatName || "Standard layout"} · {m.fileType}{m.standard ? " (standard)" : ""}</em></span></span>
              <span className="au-meta" title={oneAmc ? `${oneAmc} accounts that use this mapping` : "Accounts that use this mapping"}><Landmark size={14} /> {n} account{n !== 1 ? "s" : ""}</span>
              <span className={"au-st " + st} id={"map-status-" + m.id}>{m.status === "not_started" ? "Not started" : STATUS_WORD[st]}</span>
              <span className="au-when">Updated {formatDate(m.lastUpdated)}</span>
              <button type="button" className="au-round" title={view ? "View" : "Edit mapping"} aria-label={view ? `View ${m.bankName} mapping` : `Edit ${m.bankName} mapping`} data-testid={"map-edit-" + m.id} onClick={(e) => { e.stopPropagation(); nav(`/mapping/${tab}/${m.id}`); }}>
                {view ? <Eye size={16} /> : <Pencil size={16} />}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && <EmptyState icon={GitCompareArrows} title={needle || status !== "all" ? "Nothing matches" : "No mappings here yet"} subtitle={needle || status !== "all" ? "Try another bank or clear the filter." : tab === "credit" ? "Credit MIS mappings appear once a Credit MIS setup is approved." : "Mappings appear once a bank's first setup is approved."} />}
        {filtered.length > pageSize && <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} idPrefix="map-pager" />}
      </div>
    </div>
  );
}
