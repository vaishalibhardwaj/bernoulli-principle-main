import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Download, CreditCard, Copy, Eye } from "lucide-react";
import { useStore } from "@/state/store";
import { CREDIT_MODES, STATUS_FILTERS } from "@/lib/constants";
import { hasCap } from "@/lib/access";
import { feedOptionLabel, paLabel } from "@/lib/setupSchema";
import { StatusPill, SkeletonRows, EmptyState } from "@/components/bits";
import Pagination from "@/components/Pagination";
import { maskAccount, highlight } from "@/lib/format";
import { toast } from "sonner";

const CARDS = STATUS_FILTERS;

export default function CreditMisLanding() {
  const { collections, perms } = useStore();
  const canEdit = hasCap(perms, "credit_mis", "edit");
  const nav = useNavigate();
  const all = collections.credit_config;
  const [status, setStatus] = React.useState("active");
  const [rawSearch, setRawSearch] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { const t = setTimeout(() => setSearch(rawSearch), 300); return () => clearTimeout(t); }, [rawSearch]);
  React.useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, [status, search, page, pageSize]);
  React.useEffect(() => { setPage(1); }, [status, search]);

  const counts = React.useMemo(() => {
    const c = { all: all.length };
    CARDS.slice(1).forEach((x) => { c[x.key] = all.filter((r) => r.status === x.key).length; });
    return c;
  }, [all]);

  const filtered = React.useMemo(() => {
    let r = status === "all" ? all : all.filter((c) => c.status === status);
    if (search) { const q = search.toLowerCase(); r = r.filter((c) => c.bankName.toLowerCase().includes(q) || c.accountNumber.includes(q)); }
    return r;
  }, [all, status, search]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCSV = () => {
    const header = ["S.No", "Bank Name", "Account Number", "Payment aggregator", "Feed Option", "File Format", "Status"];
    const lines = [header.join(",")].concat(filtered.map((r) => [r.sno, `"${r.bankName}"`, maskAccount(r.accountNumber), `"${paLabel(r.paCode || (r.paCodes || [])[0])}"`, `"${feedOptionLabel(r.feedOption)}"`, r.fileFormat, r.status].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `credit_mis_${status}.csv`; a.click();
    toast.success(`Exported ${filtered.length} rows to CSV`);
  };

  return (
    <div data-testid="credit-mis-landing">
      <div className="page-head">
        <div><h1>Credit MIS Summary</h1><p>Configure payment-aggregator Credit MIS feeds per collection account.</p></div>
        <div className="actions">
          <button className="btn btn-outline" onClick={exportCSV} data-testid="btn-export-csv"><Download size={15} /> Export CSV</button>
          {canEdit && <button className="btn btn-primary" onClick={() => nav("/credit-mis/new")} data-testid="btn-add-credit"><Plus size={16} /> Add New</button>}
        </div>
      </div>

      <div className="stat-cards" data-testid="status-cards">
        {CARDS.map((c) => (
          <button key={c.key} className={"stat-card" + (status === c.key ? " on" : "")} onClick={() => setStatus(c.key)} data-testid={"card-" + c.key}>
            <div className="lbl">{c.label}{c.key === "rejected" && counts.rejected > 0 && <span className="count-badge pop" key={counts.rejected}>{counts.rejected}</span>}</div>
            <div className="val tnum">{counts[c.key] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search" style={{ marginLeft: "auto" }}>
            <Search /><input className="input" placeholder="Search Bank or Account…" value={rawSearch} onChange={(e) => setRawSearch(e.target.value)} data-testid="credit-search" />
          </div>
        </div>
        <div className="grid-scroll">
          <table className="grid">
            <thead><tr><th style={{ width: 54 }}>S.No</th><th>Bank Name</th><th>Account Number</th><th>Payment aggregator</th><th>Mode</th><th>Feed option</th><th>File Format</th><th>Status</th><th style={{ width: 110 }}>Actions</th></tr></thead>
            {loading ? <SkeletonRows rows={8} cols={9} /> : (
              <tbody>
                {pageRows.map((c) => (
                  <tr key={c.id} data-testid={"credit-row-" + c.id}>
                    <td className="tnum">{c.sno}</td>
                    <td>{highlight(c.bankName, search)}</td>
                    <td className="tnum">{highlight(maskAccount(c.accountNumber), search)}</td>
                    <td style={{ fontSize: 12 }}>{paLabel(c.paCode || (c.paCodes || [])[0])}</td>
                    <td><span className="mode-cell">{React.createElement(CREDIT_MODES[c.feedMode].icon, { size: 15 })} {CREDIT_MODES[c.feedMode].label}</span></td>
                    <td style={{ fontSize: 12 }}>{feedOptionLabel(c.feedOption)}</td>
                    <td className="tnum">{c.fileFormat}</td>
                    <td><StatusPill status={c.status} id={"credit-status-" + c.id} /></td>
                    <td><div className="cell-actions">
                      <button className="row-icon-btn" title="View" onClick={() => nav(`/credit-mis/view/${c.id}`)} data-testid={"credit-view-" + c.id}><Eye /></button>
                      {canEdit && c.status !== "pending" && <button className="row-icon-btn" title="Edit" onClick={() => nav(`/credit-mis/edit/${c.id}`)} data-testid={"credit-edit-" + c.id}><Pencil /></button>}
                      {canEdit && <button className="row-icon-btn" title="Copy setup (everything except the account number)" onClick={() => nav(`/credit-mis/copy/${c.id}`)} data-testid={"credit-copy-" + c.id}><Copy /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && filtered.length === 0 && <EmptyState icon={CreditCard} title="No Credit MIS configurations" subtitle="Try another filter or add a new Credit MIS feed." />}
        </div>
        {!loading && filtered.length > 0 && <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} idPrefix="credit-pager" />}
      </div>
    </div>
  );
}
