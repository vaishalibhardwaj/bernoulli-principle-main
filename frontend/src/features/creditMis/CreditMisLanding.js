import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, AlertTriangle, Hourglass, FilePen, CheckCircle2, Eye, Pencil, Copy, ArrowRight, Download, FileSpreadsheet } from "lucide-react";
import { useStore } from "@/state/store";
import MappingSummary from "@/features/mapping/MappingSummary";
import StatusStandardisation from "@/features/admin/StatusStandardisation";
import { CREDIT_MODES } from "@/lib/constants";
import { hasCap } from "@/lib/access";
import { inScope, amcOfAccount, userAmcs } from "@/lib/org";
import { StatusPill } from "@/components/bits";
import Picker from "@/components/Picker";
import { Drawer } from "@/components/Drawer";
import { maskAccount, timeAgo, formatDate } from "@/lib/format";
import { summarizeSetup, paLabel, normPa, feedOptionLabel, PA_OPTIONS } from "@/lib/setupSchema";
import { toast } from "sonner";

const SHORT_MODE = { email: "Email", auto: "Portal bot", manual: "SFTP / manual", api: "API" };
const TABS = [["all", "All"], ["active", "Active"], ["rejected", "Fix required"], ["pending", "Pending for approval"], ["draft", "Drafts"], ["inactive", "Inactive"]];
const paOf = (c) => normPa(c.paCode || (c.paCodes || [])[0]);
const paName = (code) => PA_OPTIONS.find((o) => o.code === code)?.label || code || "Unknown aggregator";

/** One sentence, in plain words, of what a setup does every day. */
function describe(c) {
  const pa = paName(paOf(c));
  if (c.feedOption === "NO_FEED") return `${pa} sends no MIS file for ${c.bankName} ·${String(c.accountNumber).slice(-4)}. Each online credit in that account's bank statement is copied as its feed row, so it can still be matched.`;
  const how = { email: "emails", auto: "has the portal bot fetch", manual: "drops on SFTP", api: "sends through the API" }[c.feedMode] || "sends";
  return `${pa} ${how} a ${(c.fileConfig?.fileFormat || c.fileFormat || "CSV").toUpperCase()} file for ${c.bankName} ·${String(c.accountNumber).slice(-4)}; each row is inserted as ${feedOptionLabel(c.feedOption).toLowerCase()}.`;
}

/**
 * Credit MIS setup — same layout as Bank statement setup so the two read as one product:
 *  1. What needs me (fix / waiting / drafts) comes first.
 *  2. Payment aggregators, each one line (one aggregator = one file layout); problems open by themselves.
 *  3. Rows show only what differs from the default; everything else is one click away in a side panel.
 */
export default function CreditMisLanding() {
  const { collections, perms, amcUser, personaUser } = useStore();
  const nav = useNavigate();
  const canEdit = hasCap(perms, "credit_mis", "edit");
  const canApprove = hasCap(perms, "credit_mis", "approve");

  // Opens on Fix required when something was sent back; otherwise on All. The dropdown below changes it.
  const [sp] = useSearchParams();
  const [tabPick, setTab] = React.useState(() => sp.get("status") || null);
  const [q, setQ] = React.useState("");
  const [paF, setPaF] = React.useState("all");
  const [shown, setShown] = React.useState(20);
  const [sel, setSel] = React.useState(null);
  // Three sections. Column mapping and transaction type mapping keep their own permissions.
  const SECTIONS = [["list", "Feeds", "credit_mis"], ["mapping", "Column mapping", "mapping"], ["types", "Transaction type mapping", "status_std"]].filter(([, , scr]) => hasCap(perms, scr));
  const [view, setView] = React.useState(() => { const v = new URLSearchParams(window.location.search).get("view"); return ["mapping", "types"].includes(v) ? v : "list"; });

  // Only the AMC(s) this person is working on.
  const scoped = (collections.credit_config || []).filter((c) => inScope(amcUser, amcOfAccount(c.accountNumber)));
  const toFix = scoped.filter((c) => c.status === "rejected");
  const tab = tabPick || (toFix.length ? "rejected" : "all");
  const pending = scoped.filter((c) => c.status === "pending");
  const drafts = scoped.filter((c) => c.status === "draft");
  const count = (st) => (st === "all" ? scoped.length : scoped.filter((c) => c.status === st).length);

  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const matches = (c) => !needle || c.bankName.toLowerCase().includes(needle) || paName(paOf(c)).toLowerCase().includes(needle) || paOf(c).toLowerCase().includes(needle) || (digits && c.accountNumber.includes(digits));
  const rows = scoped.filter((c) => (tab === "all" || c.status === tab) && matches(c));
  const pas = [...new Set(scoped.map(paOf))].sort((x, y) => paName(x).localeCompare(paName(y)));
  const ORDER = ["rejected", "pending", "draft", "active", "inactive"];
  const list = rows.filter((c) => paF === "all" || paOf(c) === paF).sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status) || paName(paOf(x)).localeCompare(paName(paOf(y))));

  const exportCsv = () => {
    const lines = [["Payment aggregator", "Bank", "Account", "Arrives by", "Feed option", "File format", "Status"].join(",")]
      .concat(rows.map((r) => [`"${paLabel(paOf(r))}"`, `"${r.bankName}"`, maskAccount(r.accountNumber), SHORT_MODE[r.feedMode], `"${feedOptionLabel(r.feedOption)}"`, r.fileConfig?.fileFormat || r.fileFormat, r.status].join(",")));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = "credit_mis_setups.csv"; a.click();
    toast.success(`Exported ${rows.length} setups`);
  };

  return (
    <div className="bs" data-testid="credit-mis-landing">
      <div className="bs-head">
        <div>
          <h1>Credit MIS setup</h1>
        </div>
        {canEdit && view === "list" && <button className="btn btn-primary" onClick={() => nav("/credit-mis/new")} data-testid="btn-add-credit"><Plus size={16} /> Add setup</button>}
      </div>

      <nav className="src-sections" role="tablist" aria-label="Credit MIS setup sections">
        {SECTIONS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => setView(k)} data-testid={"view-" + k}>{l}</button>)}
      </nav>

      {view === "mapping" ? <MappingSummary embedded type="credit" /> : view === "types" ? <StatusStandardisation embedded /> : <>
      {/* 1 — What needs me */}
      <div className="bs-queue" data-testid="work-queue">
        {[
          ["rejected", "Fix required", toFix.length, AlertTriangle, "bad"],
          ["pending", "Pending approval", canApprove ? pending.filter((c) => c.owner !== personaUser.name.split(" ")[0]).length : pending.length, Hourglass, "warn"],
          ["draft", "Drafts", drafts.length, FilePen, "info"],
        ].map(([k, l, n, Icon, tone]) => (
          <button key={k} className={"bs-q tone-" + tone + (tab === k ? " on" : "") + (n ? "" : " zero")} onClick={() => setTab(tab === k ? "all" : k)} data-testid={"queue-" + k}>
            <Icon size={16} /><span>{l}</span><b className="fx-num">{n}</b>
          </button>
        ))}
        {toFix.length + pending.length + drafts.length === 0 && <span className="bs-calm"><CheckCircle2 size={15} /> Nothing needs you here</span>}
      </div>

      {canEdit && toFix.length > 0 && tab !== "pending" && tab !== "draft" && (
        <div className="bs-fix" data-testid="fix-list">
          {toFix.slice(0, 3).map((c) => (
            <div key={c.id} className="bs-fix-row">
              <AlertTriangle size={15} />
              <div><b>{paName(paOf(c))} · {c.bankName} ·{c.accountNumber.slice(-4)}</b><span>“{c.rejection?.comment}” — {c.rejection?.by}, {timeAgo(c.rejection?.date)}</span></div>
              <button className="btn btn-primary btn-sm" onClick={() => nav(`/credit-mis/edit/${c.id}`)} data-testid={"fix-" + c.id}>Fix <ArrowRight size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* 2 — Find */}
      <div className="bs-bar">
        <div className="search bs-search"><Search /><input className="input" placeholder="Search aggregator, bank or last 4 digits" aria-label="Search aggregator, bank or last 4 digits" value={q} onChange={(e) => setQ(e.target.value)} data-testid="credit-search" /></div>
        <Picker value={paF} onChange={(v) => { setPaF(v); setShown(20); }} label="Aggregator" testid="pa-filter" align="right" width={260} options={[{ value: "all", label: "All aggregators", count: pas.length }, ...pas.map((k) => ({ value: k, label: paName(k), count: scoped.filter((c) => paOf(c) === k).length }))]} />
        <Picker value={tab} onChange={(v) => { setTab(v); setShown(20); }} label="Status" testid="status-filter" align="right" width={250} options={TABS.map(([k, l]) => ({ value: k, label: l, count: count(k) }))} />
      </div>
      <div className="dl" data-testid="pa-groups" style={{ "--cols": "44px minmax(0, 1.4fr) 150px minmax(0, 1fr) minmax(0, 1fr) 170px 104px 64px" }}>
        <div className="dl-h" aria-hidden="true"><span /><span>Aggregator · account</span><span>Mode</span><span>Feed</span><span>Account type</span><span>Status</span><span>Updated</span><span /></div>
        {rows.length === 0 && <div className="dl-empty">{needle ? `Nothing matches “${q}”.` : tab === "rejected" ? "Nothing needs a fix." : "Nothing here yet."}{canEdit && !needle && <button className="link" onClick={() => nav("/credit-mis/new")}>Add a setup</button>}</div>}
        <ul className="rq-list">
          {list.slice(0, shown).map((c) => {
            const Mode = CREDIT_MODES[c.feedMode];
            const liab = c.processing?.reconciliationType === "Liability";
            const feed = c.feedOption === "NO_FEED" ? "No feed, uses bank credit" : c.feedOption === "CREDIT_REVERSAL_FEED" ? "Includes reversals" : c.feedOption === "SETTLEMENT_ONLY" ? "Settlement summary only" : c.fileConfig?.instrumentStatus === "D" ? "Debit-only file" : "Standard";
            return (
              <li key={c.id}>
                <button type="button" className="dl-r" onClick={() => setSel(c)} data-testid={"credit-row-" + c.id}>
                  <span className="dl-ic" aria-hidden="true">{paName(paOf(c)).slice(0, 1)}</span>
                  <span className="dl-main"><b>{paName(paOf(c))}</b><small>{c.bankName} · {maskAccount(c.accountNumber)} · {c.accountCategory}</small></span>
                  <span className="dl-c"><Mode.icon size={14} /> {SHORT_MODE[c.feedMode]}</span>
                  <span className="dl-c">{feed}</span>
                  <span className="dl-c">{liab ? `Liability · ${c.processing.liabilityCategory}` : "Subscription"}</span>
                  <StatusPill status={c.status} />
                  <span className="dl-c muted tnum">{timeAgo(c.lastUpdated)}</span>
                  <span className="rq-go">View <ArrowRight size={14} /></span>
                </button>
              </li>
            );
          })}
        </ul>
        {list.length > shown && <button type="button" className="rq-more" onClick={() => setShown(shown + 20)}>Show {Math.min(20, list.length - shown)} more <span className="tnum">· {list.length - shown} left</span></button>}
      </div>
      </>}

      {sel && <CmisPanel c={sel} canEdit={canEdit} onClose={() => setSel(null)} nav={nav} />}
    </div>
  );
}

/** Everything about one setup, one click away: what it does, the key settings and every action, labelled. */
function CmisPanel({ c, canEdit, onClose, nav }) {
  const facts = summarizeSetup({ ...c, kind: "credit_config" }).filter(([k]) => !["Bank", "Account"].includes(k));
  const keyFacts = facts.filter(([k]) => ["Feed mode", "Payment aggregator", "Feed option", "File format", "Header position", "Instrument status", "Reversal code", "Reconciliation type", "Is active"].includes(k));
  const [all, setAll] = React.useState(false);
  const pretty = (k, v) => (k === "Feed mode" ? CREDIT_MODES[v]?.label || v : k === "Instrument status" ? ({ C: "Credit only", D: "Debit only" }[v] || "From the file's status column") : String(v));
  return (
    <Drawer id="cmis-panel" title={`${paName(paOf(c))} · ${c.bankName}`} subtitle={`${maskAccount(c.accountNumber)} · last changed ${formatDate(c.lastUpdated)} by ${c.owner}`} onClose={onClose}
      footer={<div className="bs-panel-actions">
        <button className="btn btn-outline" onClick={() => nav(`/credit-mis/view/${c.id}`)}><Eye size={14} /> Open full setup</button>
        {canEdit && c.status !== "pending" && <button className="btn btn-primary" onClick={() => nav(`/credit-mis/edit/${c.id}`)} data-testid="panel-edit"><Pencil size={14} /> Edit</button>}
      </div>}>
      <div className="kv-line"><span>Status</span><StatusPill status={c.status} /></div>
      {c.rejection && c.status === "rejected" && <div className="note warn" style={{ marginTop: 10 }}><AlertTriangle size={14} /><div><b>Sent back by {c.rejection.by}:</b> {c.rejection.comment}</div></div>}
      <div className="note" style={{ marginTop: 12 }}><FileSpreadsheet size={14} /><div><b>What this setup does:</b> {describe(c)}</div></div>
      <div className="bs-facts">{(all ? facts : keyFacts).map(([k, v]) => <div key={k}><span>{k}</span><b>{pretty(k, v)}</b></div>)}</div>
      <button className="link" onClick={() => setAll((a) => !a)}>{all ? "Show key settings only" : `Show all ${facts.length} settings`}</button>
      <div className="bs-more">
        {canEdit && <button className="bs-more-btn" onClick={() => nav(`/credit-mis/copy/${c.id}`)} data-testid="panel-copy"><Copy size={15} /><span><b>Start a new account from this setup</b><em>Copies everything except the account number</em></span></button>}
        <button className="bs-more-btn" onClick={() => nav("/mapping?tab=credit")}><FileSpreadsheet size={15} /><span><b>Column mapping for this aggregator</b><em>How the file's columns become system fields</em></span></button>
      </div>
    </Drawer>
  );
}
