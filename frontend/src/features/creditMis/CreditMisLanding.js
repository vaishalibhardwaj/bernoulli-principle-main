import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, AlertTriangle, Eye, Pencil, Copy, Download, FileSpreadsheet, CreditCard, GitCompareArrows, ChevronDown, ArrowLeftRight } from "lucide-react";
import { useStore } from "@/state/store";
import { CREDIT_MODES } from "@/lib/constants";
import { hasCap } from "@/lib/access";
import { inScope, amcOfAccount, userAmcs } from "@/lib/org";
import { StatusPill } from "@/components/bits";
import { Drawer } from "@/components/Drawer";
import { maskAccount, timeAgo, formatDate } from "@/lib/format";
import { summarizeSetup, paLabel, normPa, feedOptionLabel, PA_OPTIONS } from "@/lib/setupSchema";
import { toast } from "sonner";
import { Avatar } from "@/components/au";
import { sourceHealth } from "@/features/setup/sourceParts";
import StatusStandardisation from "@/features/admin/StatusStandardisation";
import MappingSummary from "@/features/mapping/MappingSummary";

const SHORT_MODE = { email: "Email", auto: "Portal bot", manual: "SFTP / manual", api: "API" };
const TABS = [["all", "All"], ["active", "Active"], ["rejected", "Needs fix"], ["pending", "Pending"], ["draft", "Drafts"], ["inactive", "Inactive"]];
const TAB_KEY = "cams_cmis_tab";
export const paOf = (c) => normPa(c.paCode || (c.paCodes || [])[0]);
export const paName = (code) => PA_OPTIONS.find((o) => o.code === code)?.label || code || "Unknown aggregator";

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
  const { collections, perms, amcUser } = useStore();
  const nav = useNavigate();
  const canEdit = hasCap(perms, "credit_mis", "edit");
  const searchRef = React.useRef(null);

  const [tab, setTabRaw] = React.useState(() => { try { return localStorage.getItem(TAB_KEY) || "all"; } catch (e) { return "all"; } });
  const setTab = (t) => { setTabRaw(t); try { localStorage.setItem(TAB_KEY, t); } catch (e) { /* ignore */ } };
  const [q, setQ] = React.useState("");

  // Keyboard: "/" search, "n" new setup.
  React.useEffect(() => {
    const h = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" && canEdit) nav("/credit-mis/new");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [canEdit, nav]);

  // Only the AMC(s) this person is working on.
  const scoped = (collections.credit_config || []).filter((c) => inScope(amcUser, amcOfAccount(c.accountNumber)));
  const count = (st) => (st === "all" ? scoped.length : scoped.filter((c) => c.status === st).length);

  const [sp, setSp] = useSearchParams();
  const focusPa = sp.get("open");
  const [openPas, setOpenPas] = React.useState(() => (focusPa ? [focusPa] : []));
  const view = ["columns", "codes"].includes(sp.get("view")) ? sp.get("view") : "setups";
  const setView = (v) => setSp(v === "setups" ? {} : { view: v }, { replace: true });
  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const matches = (c) => !needle || c.bankName.toLowerCase().includes(needle) || paName(paOf(c)).toLowerCase().includes(needle) || paOf(c).toLowerCase().includes(needle) || (digits && c.accountNumber.includes(digits));
  const rows = scoped.filter((c) => (tab === "all" || c.status === tab) && matches(c));
  const groups = Object.entries(rows.reduce((m, c) => ({ ...m, [paOf(c)]: [...(m[paOf(c)] || []), c] }), {}))
    .map(([pa, list]) => {
      const health = sourceHealth(collections, "credit", pa, scoped.filter((c) => paOf(c) === pa));
      const todo = health.accounts.todo + health.columns.todo + health.codes.todo + (health.columns.state === "empty" ? 1 : 0);
      const waiting = health.accounts.waiting + health.columns.waiting + health.codes.waiting;
      return { pa, list, health, weight: todo * 100 + waiting };
    })
    .sort((a, b) => b.weight - a.weight || paName(a.pa).localeCompare(paName(b.pa)));
  const scopeLabel = userAmcs(amcUser).length === 1 ? userAmcs(amcUser)[0] : "all your AMCs";

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
          <h1>Credit MIS</h1>
        </div>
        <div className="actions">
          <button className="btn btn-outline" onClick={exportCsv} data-testid="btn-export-credit"><Download size={15} /> Export</button>
          {canEdit && <button className="btn btn-primary" onClick={() => nav("/credit-mis/new")} data-testid="btn-add-credit"><Plus size={16} /> Add feed <kbd>N</kbd></button>}
        </div>
      </div>


      <div className="src-views" role="tablist" aria-label="View">
        {[["setups", "Credit MIS setups", CreditCard], ["columns", "Column mapping", GitCompareArrows], ["codes", "Transaction type mapping", ArrowLeftRight]].map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => setView(k)} data-testid={"view-" + k}><I size={15} /> {l}</button>
        ))}
      </div>

      {view === "columns" && <MappingSummary embedded type="credit" />}
      {view === "codes" && <StatusStandardisation embedded source="credit" />}
      {view === "setups" && <>
      {/* Find */}
      <div className="au-bar">
        <label className="au-search"><Search size={17} /><input ref={searchRef} placeholder="Search aggregator, bank or last 4 digits" value={q} onChange={(e) => setQ(e.target.value)} data-testid="credit-search" /><kbd>/</kbd></label>
        <div className="au-tabs" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={"tab-" + k}>{l} <em>{count(k)}</em></button>)}
        </div>
      </div>
      <div className="bs-scope">Showing <b>{scopeLabel}</b> · {rows.length} feed{rows.length !== 1 ? "s" : ""} from {groups.length} aggregator{groups.length !== 1 ? "s" : ""}</div>

      {/* Aggregators: one card each, with what is done and what is left */}
      <div className="bs-banks" data-testid="pa-groups">
        {groups.length === 0 && <div className="au-list bs-empty">{needle ? `Nothing matches “${q}”.` : tab === "rejected" ? "Nothing sent back — nice work." : "Nothing here yet."}{canEdit && !needle && <button className="link" onClick={() => nav("/credit-mis/new")}>Add a feed</button>}</div>}
        {groups.map((g, i) => {
          const modes = [...new Set(g.list.map((c) => SHORT_MODE[c.feedMode]))];
          const banks = new Set(g.list.map((c) => c.bankName)).size;
          const h = g.health;
          const isOpen = openPas.includes(g.pa);
          const toggle = () => setOpenPas((o) => (o.includes(g.pa) ? o.filter((x) => x !== g.pa) : [...o, g.pa]));
          return (
            <div key={g.pa} className={"au-list src-card2" + (isOpen ? " open" : "")} style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }} data-testid={"pa-" + g.pa}>
              <button type="button" className="src-card2-h" onClick={toggle} aria-expanded={isOpen}>
                <Avatar name={paName(g.pa)} size={44} badge={h.accounts.todo || h.columns.todo || h.codes.todo ? "bad" : h.accounts.waiting || h.columns.waiting || h.codes.waiting ? "warn" : undefined} />
                <span className="src-card-name"><b>{paName(g.pa)}</b><em>{g.list.length} feed{g.list.length !== 1 ? "s" : ""} at {banks} bank{banks !== 1 ? "s" : ""} · {modes.join(", ")}</em></span>
                <span className="au-round src-chev"><ChevronDown size={16} /></span>
              </button>
              {isOpen && <div className="src-detail"><CreditFeedRows list={g.list} /></div>}
            </div>
          );
        })}
      </div>
      </>}
    </div>
  );
}

/** One aggregator's feeds as rows; click a row for its side panel. */
export function CreditFeedRows({ list }) {
  const { perms } = useStore();
  const nav = useNavigate();
  const canEdit = hasCap(perms, "credit_mis", "edit");
  const [sel, setSel] = React.useState(null);
  const order = ["rejected", "pending", "draft", "active", "inactive"];
  return (
    <>
      <div className="au-list bs-rows2">
        <div className="au-row bs-row2 bs-row2-h" aria-hidden="true"><span>Bank account</span><span>How it comes in</span><span>Details</span><span>Status</span><span>Last changed</span></div>
        {list.length === 0 && <div className="bs-empty">No feeds for this AMC from this aggregator yet.</div>}
        {[...list].sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status)).map((c) => {
          const Mode = CREDIT_MODES[c.feedMode];
          return (
            <button key={c.id} className="au-row bs-row2" onClick={() => setSel(c)} data-testid={"credit-row-" + c.id}>
              <span className="au-who"><Avatar name={c.bankName} icon={Mode?.icon} size={38} color="#5b606b" /><span><b>{c.bankName} · <span className="tnum">{maskAccount(c.accountNumber)}</span></b><em>{c.accountCategory || ""}</em></span></span>
              <span className="au-meta">{SHORT_MODE[c.feedMode]}</span>
              <span className="au-pills">
                {c.feedOption === "NO_FEED" && <span className="au-tag hi" title="No MIS file — each bank-statement credit is copied as the feed">No feed — uses bank credit</span>}
                {c.feedOption === "CREDIT_REVERSAL_FEED" && <span className="au-tag">Includes reversals</span>}
                {c.feedOption === "SETTLEMENT_ONLY" && <span className="au-tag">Settlement summary only</span>}
                {c.fileConfig?.instrumentStatus === "D" && <span className="au-tag hi" title="Every row is a failed / reversed payment">Debit-only file</span>}
                {c.processing?.reconciliationType === "Liability" && <span className="au-tag">Liability · {c.processing.liabilityCategory}</span>}
              </span>
              <span className={"au-st " + c.status}>{{ active: "Active", pending: "Pending approval", rejected: "Sent back", draft: "Draft", inactive: "Inactive" }[c.status] || c.status}</span>
              <span className="au-when">{timeAgo(c.lastUpdated)}</span>
            </button>
          );
        })}
      </div>
      {sel && <CmisPanel c={sel} canEdit={canEdit} onClose={() => setSel(null)} nav={nav} />}
    </>
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
        <button className="bs-more-btn" onClick={() => nav("/credit-mis?view=columns")}><FileSpreadsheet size={15} /><span><b>Columns for this aggregator</b><em>How the file's columns become system fields</em></span></button>
      </div>
    </Drawer>
  );
}
