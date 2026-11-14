// Column mapping: one mapping per bank (or aggregator), and per layout when one sends more than one.
// Around 10 to 12 banks, so the whole list fits on one screen: two dropdowns (status, bank) and one clean row each.
// Each row says how many accounts read their files with it, so the impact of a change is visible before it is made.
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Landmark } from "lucide-react";
import { useStore } from "@/state/store";
import { StatusPill, EmptyState } from "@/components/bits";
import Picker from "@/components/Picker";
import { formatDate } from "@/lib/format";
import { hasCap } from "@/lib/access";
import { statusBucket } from "@/lib/constants";
import { paLabel } from "@/lib/setupSchema";

const STATUSES = [["all", "All statuses"], ["active", "Active"], ["inactive", "Inactive"], ["pending", "Pending for approval"], ["rejected", "Rejected"], ["draft", "Draft"]];
const STEP = 15;

export default function MappingSummary({ embedded = false, type = null }) {
  const { collections, perms } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = type || (sp.get("tab") === "credit" ? "credit" : "bank");
  const [status, setStatus] = React.useState("all");
  const [bank, setBank] = React.useState("all");
  const [shown, setShown] = React.useState(STEP);
  const canEdit = hasCap(perms, "mapping", "edit");

  const all = collections.bank_mapping.filter((m) => (tab === "credit" ? m.type === "credit" : m.type === "bank"));
  const accountsFor = (m) => new Set((tab === "credit" ? collections.credit_config : collections.bank_config).filter((c) => c.bankName === m.bankName && (c.formatName || "") === (m.formatName || "")).map((c) => c.accountNumber)).size;
  const banks = [...new Set(all.map((m) => m.bankName))].sort();
  const st = (m) => statusBucket(m.status);
  const rows = all.filter((m) => (status === "all" || st(m) === status) && (bank === "all" || m.bankName === bank))
    .sort((a, b) => ["rejected", "pending", "draft", "active", "inactive"].indexOf(st(a)) - ["rejected", "pending", "draft", "active", "inactive"].indexOf(st(b)) || a.bankName.localeCompare(b.bankName));
  const who = tab === "credit" ? "aggregator" : "bank";

  return (
    <div className="mp" data-testid="mapping-summary">
      {!embedded && <div className="page-head"><div><h1>Column mapping</h1></div></div>}
      {!embedded && (
        <nav className="src-sections" role="tablist" aria-label="Mapping type">
          {[["bank", "Bank statements"], ["credit", "Credit MIS"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setSp({ tab: k })} data-testid={"tab-" + k}>{l}</button>)}
        </nav>
      )}

      <div className="mp-bar">
        <Picker value={status} onChange={(v) => { setStatus(v); setShown(STEP); }} label="Status" testid="mapping-filter-status" width={250}
          options={STATUSES.map(([k, l]) => ({ value: k, label: l, count: k === "all" ? all.length : all.filter((m) => st(m) === k).length }))} />
        <Picker value={bank} onChange={(v) => { setBank(v); setShown(STEP); }} label={tab === "credit" ? "Bank" : "Bank"} testid="mapping-filter-bank" width={260}
          options={[{ value: "all", label: "All banks", count: banks.length }, ...banks.map((b) => ({ value: b, label: b, count: all.filter((m) => m.bankName === b).length }))]} />
        <span className="rq-count tnum">{rows.length} mapping{rows.length === 1 ? "" : "s"}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState art="search" title={all.length ? "No mapping matches" : "No mappings yet"} subtitle={all.length ? "Change the status or the bank." : `A mapping appears once a ${who}'s first setup is approved.`} />
      ) : (
        <div className="dl" style={{ "--cols": "44px minmax(0, 1.6fr) 110px 130px 170px 110px 64px" }}>
          <div className="dl-h" aria-hidden="true"><span /><span>{tab === "credit" ? "Bank · aggregator" : "Bank"}</span><span>File type</span><span>Accounts using it</span><span>Status</span><span>Updated</span><span /></div>
          <ul className="rq-list">
            {rows.slice(0, shown).map((m) => {
              const n = accountsFor(m);
              const view = m.status === "pending" || !canEdit;
              return (
                <li key={m.id}>
                  <button type="button" className="dl-r" onClick={() => nav(`/mapping/${tab}/${m.id}`)} data-testid={"mapping-row-" + m.id}>
                    <span className="dl-ic" aria-hidden="true">{m.bankName.slice(0, 1)}</span>
                    <span className="dl-main"><b>{m.bankName}</b><small>{tab === "credit" ? `${paLabel(m.paCode || (m.paCodes || [])[0])} · ` : ""}{m.formatName || "Standard layout"}</small></span>
                    <span className="dl-c">{m.fileType}</span>
                    <span className="dl-c"><Landmark size={14} /> {n}</span>
                    <StatusPill status={st(m)} id={"map-status-" + m.id} />
                    <span className="dl-c muted tnum">{formatDate(m.lastUpdated)}</span>
                    <span className="rq-go" data-testid={"map-edit-" + m.id}>{view ? "View" : "Edit"} <ArrowRight size={14} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
          {rows.length > shown && <button type="button" className="rq-more" onClick={() => setShown(shown + STEP)}>Show {Math.min(STEP, rows.length - shown)} more <span className="tnum">· {rows.length - shown} left</span></button>}
        </div>
      )}
    </div>
  );
}
