import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, ChevronRight, AlertTriangle, Hourglass, FilePen, CheckCircle2, Eye, Pencil, Copy, History, HelpCircle, ArrowRight } from "lucide-react";
import VersionsDrawer from "./VersionsDrawer";
import { useStore } from "@/state/store";
import { BANK_MODES } from "@/lib/constants";
import { hasCap } from "@/lib/access";
import { inScope, amcOfAccount } from "@/lib/org";
import { StatusPill } from "@/components/bits";
import { Drawer } from "@/components/Drawer";
import { maskAccount, timeAgo, formatDate } from "@/lib/format";
import { summarizeSetup } from "@/lib/setupSchema";

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
  const { collections, perms, amcUser, activeAmc } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const canEdit = hasCap(perms, "bank_setup", "edit");
  const canApprove = hasCap(perms, "bank_setup", "approve");
  const searchRef = React.useRef(null);

  const [tab, setTabRaw] = React.useState(() => sp.get("status") || (() => { try { return localStorage.getItem(TAB_KEY); } catch (e) { return null; } })() || "all");
  const setTab = (t) => { setTabRaw(t); try { localStorage.setItem(TAB_KEY, t); } catch (e) { /* ignore */ } };
  const [q, setQ] = React.useState(sp.get("q") || "");
  const [open, setOpen] = React.useState({});
  const [sel, setSel] = React.useState(null);
  const [versionsOf, setVersionsOf] = React.useState(null);
  const [help, setHelp] = React.useState(false);

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
  const mineToFix = scoped.filter((c) => c.status === "rejected");
  const pending = scoped.filter((c) => c.status === "pending");
  const drafts = scoped.filter((c) => c.status === "draft");
  const count = (st) => (st === "all" ? scoped.length : scoped.filter((c) => c.status === st).length);

  const needle = q.trim().toLowerCase();
  const matches = (c) => !needle || c.bankName.toLowerCase().includes(needle) || c.accountNumber.includes(needle.replace(/\D/g, "") || "~") || (c.formatName || "").toLowerCase().includes(needle);
  const rows = scoped.filter((c) => (tab === "all" || c.status === tab) && matches(c));
  const banks = Object.entries(rows.reduce((m, c) => ({ ...m, [c.bankName]: [...(m[c.bankName] || []), c] }), {}))
    .map(([bank, list]) => ({ bank, list, issues: list.filter((c) => ["rejected", "pending", "draft"].includes(c.status)).length, accounts: new Set(list.map((c) => c.accountNumber)).size,
      // Severity: anything sent back first, then waiting for a checker, then drafts.
      weight: list.reduce((w, c) => w + ({ rejected: 100, pending: 10, draft: 1 }[c.status] || 0), 0) }))
    .sort((a, b) => b.weight - a.weight || a.bank.localeCompare(b.bank));
  const isOpen = (b) => (open[b.bank] !== undefined ? open[b.bank] : Boolean(needle) || b.issues > 0 || banks.length <= 2);
  const scopeLabel = activeAmc && activeAmc !== "*" ? activeAmc : "all your AMCs";

  return (
    <div className="bs" data-testid="bank-config-landing">
      <div className="bs-head">
        <div>
          <h1>Bank statement setup</h1>
          <p>How each account's statement is fetched and read. <button className="link bs-help" onClick={() => setHelp((h) => !h)} aria-expanded={help}><HelpCircle size={13} /> {help ? "Hide" : "More"}</button></p>
          {help && <div className="bs-helptext">Each setup is approved once (maker–checker) and then used for every file from that account. Today's actual files are in <button className="link" onClick={() => nav("/ingestion")}>Bank files</button>. A bank that sends more than one layout can have more than one setup; the matching one is used automatically.</div>}
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => nav("/bank-setup/new")} data-testid="btn-add-new"><Plus size={16} /> Add account <kbd>N</kbd></button>}
      </div>

      {/* 1 — What needs me */}
      <div className="bs-queue" data-testid="work-queue">
        {[
          ["rejected", canEdit ? "Needs your fix" : "Sent back to makers", mineToFix.length, AlertTriangle, "bad"],
          ["pending", canApprove ? "Waiting for your approval" : "Waiting for checker", pending.length, Hourglass, "warn"],
          ["draft", "Drafts", drafts.length, FilePen, "info"],
        ].map(([k, l, n, Icon, tone]) => (
          <button key={k} className={"bs-q tone-" + tone + (tab === k ? " on" : "") + (n ? "" : " zero")} onClick={() => setTab(tab === k ? "all" : k)} data-testid={"queue-" + k}>
            <Icon size={16} /><span>{l}</span><b className="fx-num">{n}</b>
          </button>
        ))}
        {mineToFix.length + pending.length + drafts.length === 0 && <span className="bs-calm"><CheckCircle2 size={15} /> Nothing needs you here</span>}
      </div>

      {canEdit && mineToFix.length > 0 && tab !== "pending" && tab !== "draft" && (
        <div className="bs-fix" data-testid="fix-list">
          {mineToFix.slice(0, 3).map((c) => (
            <div key={c.id} className="bs-fix-row">
              <AlertTriangle size={15} />
              <div><b>{c.bankName} ·{c.accountNumber.slice(-4)}</b><span>“{c.rejection?.comment}” — {c.rejection?.by}, {timeAgo(c.rejection?.date)}</span></div>
              <button className="btn btn-primary btn-sm" onClick={() => nav(`/bank-setup/edit/${c.id}`)} data-testid={"fix-" + c.id}>Fix <ArrowRight size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* 2 — Find */}
      <div className="bs-bar">
        <div className="search bs-search"><Search /><input ref={searchRef} className="input" placeholder="Search bank, account or last 4 digits" value={q} onChange={(e) => setQ(e.target.value)} data-testid="search-input" /><kbd>/</kbd></div>
        <div className="bs-tabs" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={"tab-" + k}>{l} <em>{count(k)}</em></button>)}
        </div>
      </div>
      <div className="bs-scope">Showing <b>{scopeLabel}</b> · {new Set(rows.map((c) => c.accountNumber)).size} accounts at {banks.length} bank{banks.length !== 1 ? "s" : ""}</div>

      {/* 3 — Banks, each one line */}
      <div className="bs-banks" data-testid="bank-groups">
        {banks.length === 0 && <div className="card bs-empty">{needle ? `No account matches “${q}”.` : tab === "rejected" ? "Nothing sent back — nice work." : "Nothing here yet."}{canEdit && !needle && <button className="link" onClick={() => nav("/bank-setup/new")}>Add an account</button>}</div>}
        {banks.map((b) => {
          const o = isOpen(b);
          const modes = [...new Set(b.list.map((c) => SHORT_MODE[c.downloadMode]))];
          const st = (s) => b.list.filter((c) => c.status === s).length;
          return (
            <div key={b.bank} className={"card bs-bank" + (o ? " open" : "")} data-testid={"bank-" + b.bank}>
              <button className="bs-bank-h" onClick={() => setOpen({ ...open, [b.bank]: !o })} aria-expanded={o}>
                <ChevronRight size={16} className="bs-chev" />
                <b>{b.bank}</b>
                <span className="muted">{b.accounts} account{b.accounts !== 1 ? "s" : ""} · {modes.join(", ")}</span>
                <span className="bs-badges">
                  {st("rejected") > 0 && <span className="bs-badge bad">{st("rejected")} needs fix</span>}
                  {st("pending") > 0 && <span className="bs-badge warn">{st("pending")} pending</span>}
                  {st("draft") > 0 && <span className="bs-badge info">{st("draft")} draft</span>}
                  {!b.issues && <span className="bs-ok"><CheckCircle2 size={13} /> {st("inactive") ? `${st("active")} active · ${st("inactive")} inactive` : "all active"}</span>}
                </span>
              </button>
              {o && (
                <div className="bs-rows">
                  {b.list.sort((x, y) => ["rejected", "pending", "draft", "active", "inactive"].indexOf(x.status) - ["rejected", "pending", "draft", "active", "inactive"].indexOf(y.status)).map((c) => {
                    const Mode = BANK_MODES[c.downloadMode];
                    return (
                      <button key={c.id} className="bs-row" onClick={() => setSel(c)} data-testid={"row-" + c.id}>
                        <span className="bs-acct tnum"><b>{maskAccount(c.accountNumber)}</b><em>{c.schemeName || c.assetClass || ""}</em></span>
                        <span className="bs-mode"><Mode.icon size={14} /> {SHORT_MODE[c.downloadMode]}</span>
                        <span className="bs-tags">
                          {c.priority === "high" && <span className="bs-tag hi">High priority</span>}
                          {c.formatName && <span className="bs-tag">{c.formatName}</span>}
                          {c.processing?.reconciliationType === "Liability" && <span className="bs-tag">Liability · {c.processing.liabilityCategory}</span>}
                        </span>
                        <StatusPill status={c.status} />
                        <span className="bs-when">{timeAgo(c.lastUpdated)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sel && <SetupPanel c={sel} canEdit={canEdit} onClose={() => setSel(null)} nav={nav} onVersions={() => { setVersionsOf(sel); setSel(null); }} />}
      {versionsOf && <VersionsDrawer cfg={versionsOf} onClose={() => setVersionsOf(null)} />}
    </div>
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
