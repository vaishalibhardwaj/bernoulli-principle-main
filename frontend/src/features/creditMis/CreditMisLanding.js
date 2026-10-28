import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, AlertTriangle, Hourglass, FilePen, CheckCircle2, Eye, Pencil, Copy, HelpCircle, ArrowRight, Download, FileSpreadsheet } from "lucide-react";
import { useStore } from "@/state/store";
import { CREDIT_MODES } from "@/lib/constants";
import { hasCap } from "@/lib/access";
import { inScope, amcOfAccount, userAmcs } from "@/lib/org";
import { StatusPill } from "@/components/bits";
import { Drawer } from "@/components/Drawer";
import { maskAccount, timeAgo, formatDate } from "@/lib/format";
import { summarizeSetup, paLabel, normPa, feedOptionLabel, PA_OPTIONS } from "@/lib/setupSchema";
import { toast } from "sonner";

const SHORT_MODE = { email: "Email", auto: "Portal bot", manual: "SFTP / manual", api: "API" };
const TABS = [["all", "All"], ["active", "Active"], ["rejected", "Needs fix"], ["pending", "Pending"], ["draft", "Drafts"], ["inactive", "Inactive"]];
const TAB_KEY = "cams_cmis_tab";
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
  const { collections, perms, amcUser } = useStore();
  const nav = useNavigate();
  const canEdit = hasCap(perms, "credit_mis", "edit");
  const canApprove = hasCap(perms, "credit_mis", "approve");
  const searchRef = React.useRef(null);

  const [tab, setTabRaw] = React.useState(() => { try { return localStorage.getItem(TAB_KEY) || "all"; } catch (e) { return "all"; } });
  const setTab = (t) => { setTabRaw(t); try { localStorage.setItem(TAB_KEY, t); } catch (e) { /* ignore */ } };
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState({});
  const [sel, setSel] = React.useState(null);
  const [help, setHelp] = React.useState(false);

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
  const toFix = scoped.filter((c) => c.status === "rejected");
  const pending = scoped.filter((c) => c.status === "pending");
  const drafts = scoped.filter((c) => c.status === "draft");
  const count = (st) => (st === "all" ? scoped.length : scoped.filter((c) => c.status === st).length);

  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const matches = (c) => !needle || c.bankName.toLowerCase().includes(needle) || paName(paOf(c)).toLowerCase().includes(needle) || paOf(c).toLowerCase().includes(needle) || (digits && c.accountNumber.includes(digits));
  const rows = scoped.filter((c) => (tab === "all" || c.status === tab) && matches(c));
  const groups = Object.entries(rows.reduce((m, c) => ({ ...m, [paOf(c)]: [...(m[paOf(c)] || []), c] }), {}))
    .map(([pa, list]) => ({ pa, list, issues: list.filter((c) => ["rejected", "pending", "draft"].includes(c.status)).length,
      // Severity: anything sent back first, then waiting for a checker, then drafts.
      weight: list.reduce((w, c) => w + ({ rejected: 100, pending: 10, draft: 1 }[c.status] || 0), 0) }))
    .sort((a, b) => b.weight - a.weight || paName(a.pa).localeCompare(paName(b.pa)));
  const isOpen = (g) => (open[g.pa] !== undefined ? open[g.pa] : Boolean(needle) || g.issues > 0 || groups.length <= 2);
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
          <h1>Credit MIS setup</h1>
          <p>Which payment aggregators send settlement files, and how each file is read. <button className="link bs-help" onClick={() => setHelp((h) => !h)} aria-expanded={help}><HelpCircle size={13} /> {help ? "Hide" : "More"}</button></p>
          {help && <div className="bs-helptext">An aggregator (Razorpay, BillDesk…) settles many investor payments as <b>one</b> credit in the bank. Its Credit MIS file lists the payments inside that credit. Each setup here says where that file comes from and how to read it, so every payment can be matched to its purchase. <button className="link" onClick={exportCsv}><Download size={12} /> Export this list</button></div>}
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => nav("/credit-mis/new")} data-testid="btn-add-credit"><Plus size={16} /> Add feed <kbd>N</kbd></button>}
      </div>

      {/* 1 — What needs me */}
      <div className="bs-queue" data-testid="work-queue">
        {[
          ["rejected", canEdit ? "Needs your fix" : "Sent back to makers", toFix.length, AlertTriangle, "bad"],
          ["pending", canApprove ? "Waiting for your approval" : "Waiting for checker", pending.length, Hourglass, "warn"],
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
        <div className="search bs-search"><Search /><input ref={searchRef} className="input" placeholder="Search aggregator, bank or last 4 digits" value={q} onChange={(e) => setQ(e.target.value)} data-testid="credit-search" /><kbd>/</kbd></div>
        <div className="bs-tabs" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={"tab-" + k}>{l} <em>{count(k)}</em></button>)}
        </div>
      </div>
      <div className="bs-scope">Showing <b>{scopeLabel}</b> · {rows.length} setups from {groups.length} aggregator{groups.length !== 1 ? "s" : ""}</div>

      {/* 3 — Aggregators, each one line */}
      <div className="bs-banks" data-testid="pa-groups">
        {groups.length === 0 && <div className="card bs-empty">{needle ? `Nothing matches “${q}”.` : tab === "rejected" ? "Nothing sent back — nice work." : "Nothing here yet."}{canEdit && !needle && <button className="link" onClick={() => nav("/credit-mis/new")}>Add a feed</button>}</div>}
        {groups.map((g) => {
          const o = isOpen(g);
          const modes = [...new Set(g.list.map((c) => SHORT_MODE[c.feedMode]))];
          const banks = new Set(g.list.map((c) => c.bankName)).size;
          const st = (s) => g.list.filter((c) => c.status === s).length;
          return (
            <div key={g.pa} className={"card bs-bank" + (o ? " open" : "")} data-testid={"pa-" + g.pa}>
              <button className="bs-bank-h" onClick={() => setOpen({ ...open, [g.pa]: !o })} aria-expanded={o}>
                <ChevronRight size={16} className="bs-chev" />
                <b>{paName(g.pa)}</b>
                <span className="muted">{g.list.length} account{g.list.length !== 1 ? "s" : ""} at {banks} bank{banks !== 1 ? "s" : ""} · {modes.join(", ")}</span>
                <span className="bs-badges">
                  {st("rejected") > 0 && <span className="bs-badge bad">{st("rejected")} needs fix</span>}
                  {st("pending") > 0 && <span className="bs-badge warn">{st("pending")} pending</span>}
                  {st("draft") > 0 && <span className="bs-badge info">{st("draft")} draft</span>}
                  {!g.issues && <span className="bs-ok"><CheckCircle2 size={13} /> {st("inactive") ? `${st("active")} active · ${st("inactive")} inactive` : "all active"}</span>}
                </span>
              </button>
              {o && (
                <div className="bs-rows">
                  {g.list.sort((x, y) => ["rejected", "pending", "draft", "active", "inactive"].indexOf(x.status) - ["rejected", "pending", "draft", "active", "inactive"].indexOf(y.status)).map((c) => {
                    const Mode = CREDIT_MODES[c.feedMode];
                    return (
                      <button key={c.id} className="bs-row" onClick={() => setSel(c)} data-testid={"credit-row-" + c.id}>
                        <span className="bs-acct tnum"><b>{c.bankName}</b><em>{maskAccount(c.accountNumber)} · {c.accountCategory}</em></span>
                        <span className="bs-mode"><Mode.icon size={14} /> {SHORT_MODE[c.feedMode]}</span>
                        <span className="bs-tags">
                          {c.feedOption === "NO_FEED" && <span className="bs-tag hi" title="No MIS file — each bank-statement credit is copied as the feed">No feed — uses bank credit</span>}
                          {c.feedOption === "CREDIT_REVERSAL_FEED" && <span className="bs-tag">Includes reversals</span>}
                          {c.feedOption === "SETTLEMENT_ONLY" && <span className="bs-tag">Settlement summary only</span>}
                          {c.fileConfig?.instrumentStatus === "D" && <span className="bs-tag hi" title="Every row is a failed / reversed payment">Debit-only file</span>}
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
