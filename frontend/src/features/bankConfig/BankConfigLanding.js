import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, AlertTriangle, Eye, Pencil, Copy, History, Landmark, GitCompareArrows, ChevronDown, ArrowLeftRight, Tags } from "lucide-react";
import VersionsDrawer from "./VersionsDrawer";
import { useStore } from "@/state/store";
import { BANK_MODES } from "@/lib/constants";
import { hasCap } from "@/lib/access";
import { inScope, amcOfAccount, userAmcs } from "@/lib/org";
import { StatusPill } from "@/components/bits";
import { Drawer } from "@/components/Drawer";
import { maskAccount, timeAgo, formatDate } from "@/lib/format";
import { summarizeSetup } from "@/lib/setupSchema";
import { Avatar } from "@/components/au";
import { sourceHealth } from "@/features/setup/sourceParts";
import StatusStandardisation from "@/features/admin/StatusStandardisation";
import NarrationTags from "@/features/narration/NarrationTags";
import MappingSummary from "@/features/mapping/MappingSummary";

const SHORT_MODE = { auto: "Portal bot", manual: "SFTP / manual", email: "Email", api: "API" };
const TABS = [["all", "All"], ["active", "Active"], ["rejected", "Needs fix"], ["pending", "Pending"], ["draft", "Drafts"], ["inactive", "Inactive"]];
const TAB_KEY = "cams_bank_setup_tab";

/**
 * Bank statement setup, built for daily use over many years:
 *  1. What needs me (fix / waiting / drafts) comes first.
 *  2. Banks, not 200 flat rows — each bank is one line; problems open by themselves.
 *  3. Rows show only what differs from the default; everything else is one click away in a side panel.
 */
export default function BankConfigLanding() {
  const { collections, perms, amcUser } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const canEdit = hasCap(perms, "bank_setup", "edit");
  const searchRef = React.useRef(null);

  const [tab, setTabRaw] = React.useState(() => sp.get("status") || (() => { try { return localStorage.getItem(TAB_KEY); } catch (e) { return null; } })() || "all");
  const setTab = (t) => { setTabRaw(t); try { localStorage.setItem(TAB_KEY, t); } catch (e) { /* ignore */ } };
  const [q, setQ] = React.useState(sp.get("q") || "");

  React.useEffect(() => { if (sp.get("status") || sp.get("q")) { sp.delete("status"); setSp(sp, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Keyboard: "/" search, "n" new setup.
  React.useEffect(() => {
    const h = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" && canEdit) nav("/bank-setup/new");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [canEdit, nav]);

  // Only the AMC(s) this person is working on.
  const scoped = collections.bank_config.filter((c) => inScope(amcUser, amcOfAccount(c.accountNumber)));
  const count = (st) => (st === "all" ? scoped.length : scoped.filter((c) => c.status === st).length);

  const focusBank = sp.get("open");
  const [openBanks, setOpenBanks] = React.useState(() => (focusBank ? [focusBank] : []));
  const view = ["columns", "codes", "tags"].includes(sp.get("view")) ? sp.get("view") : "setups";
  const setView = (v) => setSp(v === "setups" ? {} : { view: v }, { replace: true });
  const needle = q.trim().toLowerCase();
  const matches = (c) => !needle || c.bankName.toLowerCase().includes(needle) || c.accountNumber.includes(needle.replace(/\D/g, "") || "~") || (c.formatName || "").toLowerCase().includes(needle);
  const rows = scoped.filter((c) => (tab === "all" || c.status === tab) && matches(c));
  const banks = Object.entries(rows.reduce((m, c) => ({ ...m, [c.bankName]: [...(m[c.bankName] || []), c] }), {}))
    .map(([bank, list]) => {
      const health = sourceHealth(collections, "bank", bank, scoped.filter((c) => c.bankName === bank));
      const todo = health.accounts.todo + health.columns.todo + health.codes.todo + (health.columns.state === "empty" ? 1 : 0);
      const waiting = health.accounts.waiting + health.columns.waiting + health.codes.waiting + health.tags.waiting;
      return { bank, list, health, accounts: new Set(list.map((c) => c.accountNumber)).size, weight: todo * 100 + waiting };
    })
    .sort((a, b) => b.weight - a.weight || a.bank.localeCompare(b.bank));
  const scopeLabel = userAmcs(amcUser).length === 1 ? userAmcs(amcUser)[0] : "all your AMCs";

  return (
    <div className="bs" data-testid="bank-config-landing">
      <div className="bs-head">
        <div><h1>Bank statements</h1></div>
        <div className="actions">
          {canEdit && <button className="btn btn-primary" onClick={() => nav("/bank-setup/new")} data-testid="btn-add-new"><Plus size={16} /> Add account <kbd>N</kbd></button>}
        </div>
      </div>

      <div className="src-views" role="tablist" aria-label="View">
        {[["setups", "Bank setups", Landmark], ["columns", "Column mapping", GitCompareArrows], ["codes", "Transaction type mapping", ArrowLeftRight], ["tags", "Narration tags", Tags]].map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => setView(k)} data-testid={"view-" + k}><I size={15} /> {l}</button>
        ))}
      </div>

      {view === "columns" && <MappingSummary embedded type="bank" />}
      {view === "codes" && <StatusStandardisation embedded source="bank" />}
      {view === "tags" && <NarrationTags embedded />}
      {view === "setups" && <>
      {/* Find */}
      <div className="au-bar">
        <label className="au-search"><Search size={17} /><input ref={searchRef} placeholder="Search bank, account or last 4 digits" value={q} onChange={(e) => setQ(e.target.value)} data-testid="search-input" /><kbd>/</kbd></label>
        <div className="au-tabs" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={"tab-" + k}>{l} <em>{count(k)}</em></button>)}
        </div>
      </div>
      <div className="bs-scope">Showing <b>{scopeLabel}</b> · {new Set(rows.map((c) => c.accountNumber)).size} accounts at {banks.length} bank{banks.length !== 1 ? "s" : ""}</div>

      {/* Banks: one card each, with what is done and what is left */}
      <div className="bs-banks" data-testid="bank-groups">
        {banks.length === 0 && <div className="au-list bs-empty">{needle ? `No account matches “${q}”.` : tab === "rejected" ? "Nothing sent back — nice work." : "Nothing here yet."}{canEdit && !needle && <button className="link" onClick={() => nav("/bank-setup/new")}>Add an account</button>}</div>}
        {banks.map((b, i) => {
          const modes = [...new Set(b.list.map((c) => SHORT_MODE[c.downloadMode]))];
          const h = b.health;
          const isOpen = openBanks.includes(b.bank);
          const toggle = () => setOpenBanks((o) => (o.includes(b.bank) ? o.filter((x) => x !== b.bank) : [...o, b.bank]));
          return (
            <div key={b.bank} className={"au-list src-card2" + (isOpen ? " open" : "")} style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }} data-testid={"bank-" + b.bank}>
              <button type="button" className="src-card2-h" onClick={toggle} aria-expanded={isOpen}>
                <Avatar name={b.bank} size={44} badge={h.accounts.todo || h.columns.todo || h.codes.todo || h.columns.state === "empty" ? "bad" : h.accounts.waiting || h.columns.waiting || h.codes.waiting || h.tags.waiting ? "warn" : undefined} />
                <span className="src-card-name"><b>{b.bank}</b><em>{b.accounts} account{b.accounts !== 1 ? "s" : ""} · {modes.join(", ")}</em></span>
                <span className="au-round src-chev"><ChevronDown size={16} /></span>
              </button>
              {isOpen && <div className="src-detail"><BankAccountRows list={b.list} /></div>}
            </div>
          );
        })}
      </div>
      </>}
    </div>
  );
}

/** One bank's account setups as rows; click a row for its side panel. */
export function BankAccountRows({ list }) {
  const { perms } = useStore();
  const nav = useNavigate();
  const canEdit = hasCap(perms, "bank_setup", "edit");
  const [sel, setSel] = React.useState(null);
  const [versionsOf, setVersionsOf] = React.useState(null);
  const order = ["rejected", "pending", "draft", "active", "inactive"];
  return (
    <>
      <div className="au-list bs-rows2">
        <div className="au-row bs-row2 bs-row2-h" aria-hidden="true"><span>Account</span><span>How it comes in</span><span>Details</span><span>Status</span><span>Last changed</span></div>
        {list.length === 0 && <div className="bs-empty">No accounts for this AMC at this bank yet.</div>}
        {[...list].sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status)).map((c) => {
          const Mode = BANK_MODES[c.downloadMode];
          return (
            <button key={c.id} className="au-row bs-row2" onClick={() => setSel(c)} data-testid={"row-" + c.id}>
              <span className="au-who"><Avatar name={c.bankName} icon={Mode.icon} size={38} color="#5b606b" /><span><b className="tnum">{maskAccount(c.accountNumber)}</b><em>{c.schemeName || c.assetClass || ""}</em></span></span>
              <span className="au-meta">{SHORT_MODE[c.downloadMode]}</span>
              <span className="au-pills">
                {c.priority === "high" && <span className="au-tag hi">High priority</span>}
                {c.formatName && <span className="au-tag">{c.formatName}</span>}
                {c.processing?.reconciliationType === "Liability" && <span className="au-tag">Liability · {c.processing.liabilityCategory}</span>}
              </span>
              <span className={"au-st " + c.status}>{{ active: "Active", pending: "Pending approval", rejected: "Sent back", draft: "Draft", inactive: "Inactive" }[c.status] || c.status}</span>
              <span className="au-when">{timeAgo(c.lastUpdated)}</span>
            </button>
          );
        })}
      </div>
      {sel && <SetupPanel c={sel} canEdit={canEdit} onClose={() => setSel(null)} nav={nav} onVersions={() => { setVersionsOf(sel); setSel(null); }} />}
      {versionsOf && <VersionsDrawer cfg={versionsOf} onClose={() => setVersionsOf(null)} />}
    </>
  );
}

/** Everything about one setup, one click away: the key settings and every action, labelled. */
function SetupPanel({ c, canEdit, onClose, nav, onVersions }) {
  const facts = summarizeSetup({ ...c, kind: "bank_config" }).filter(([k]) => !["Bank", "Account"].includes(k));
  const keyFacts = facts.filter(([k]) => ["Download mode", "File type", "Schedule", "Subject pattern", "File name pattern", "Reconciliation type", "Direct match", "Compute running balance", "Is active"].includes(k));
  const [all, setAll] = React.useState(false);
  return (
    <Drawer id="setup-panel" title={`${c.bankName} · ${maskAccount(c.accountNumber)}`} subtitle={`${c.schemeName || ""}${c.formatName ? ` · ${c.formatName}` : ""} · last changed ${formatDate(c.lastUpdated)} by ${c.owner}`} onClose={onClose}
      footer={<div className="bs-panel-actions">
        <button className="btn btn-outline" onClick={() => nav(`/bank-setup/view/${c.id}`)}><Eye size={14} /> Open full setup</button>
        {canEdit && c.status !== "pending" && <button className="btn btn-primary" onClick={() => nav(`/bank-setup/edit/${c.id}`)} data-testid="panel-edit"><Pencil size={14} /> Edit</button>}
      </div>}>
      <div className="kv-line"><span>Status</span><StatusPill status={c.status} /></div>
      {c.rejection && c.status === "rejected" && <div className="note warn" style={{ marginTop: 10 }}><AlertTriangle size={14} /><div><b>Sent back by {c.rejection.by}:</b> {c.rejection.comment}</div></div>}
      <div className="bs-facts">{(all ? facts : keyFacts).map(([k, v]) => <div key={k}><span>{k}</span><b>{k === "Download mode" ? BANK_MODES[v]?.label || v : String(v)}</b></div>)}</div>
      <button className="link" onClick={() => setAll((a) => !a)}>{all ? "Show key settings only" : `Show all ${facts.length} settings`}</button>
      <div className="bs-more">
        {canEdit && <button className="bs-more-btn" onClick={() => nav(`/bank-setup/copy/${c.id}`)} data-testid="panel-copy"><Copy size={15} /><span><b>Start a new account from this setup</b><em>Copies everything except the account number</em></span></button>}
        {["active", "inactive"].includes(c.status) && <button className="bs-more-btn" onClick={onVersions}><History size={15} /><span><b>Version history</b><em>See past versions, compare, roll back</em></span></button>}
      </div>
    </Drawer>
  );
}
