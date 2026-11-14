import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Flag, AlertTriangle, Hourglass, FilePen, CheckCircle2, Eye, Pencil, Copy, History, ArrowRight } from "lucide-react";
import VersionsDrawer from "./VersionsDrawer";
import { useStore } from "@/state/store";
import MappingSummary from "@/features/mapping/MappingSummary";
import StatusStandardisation from "@/features/admin/StatusStandardisation";
import NarrationTags from "@/features/narration/NarrationTags";
import { BANK_MODES } from "@/lib/constants";
import { hasCap } from "@/lib/access";
import { inScope, amcOfAccount, userAmcs } from "@/lib/org";
import { StatusPill } from "@/components/bits";
import Picker from "@/components/Picker";
import { Drawer } from "@/components/Drawer";
import { maskAccount, timeAgo, formatDate } from "@/lib/format";
import { summarizeSetup } from "@/lib/setupSchema";

const SHORT_MODE = { auto: "Portal bot", manual: "SFTP / manual", email: "Email", api: "API" };
const TABS = [["all", "All"], ["active", "Active"], ["rejected", "Fix required"], ["pending", "Pending for approval"], ["draft", "Drafts"], ["inactive", "Inactive"]];

/**
 * Bank statement setup, built for daily use over many years:
 *  1. What needs me (fix / waiting / drafts) comes first.
 *  2. Banks, not 200 flat rows — each bank is one line; problems open by themselves.
 *  3. Rows show only what differs from the default; everything else is one click away in a side panel.
 */
export default function BankConfigLanding() {
  const { collections, perms, amcUser, personaUser } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const canEdit = hasCap(perms, "bank_setup", "edit");
  const canApprove = hasCap(perms, "bank_setup", "approve");

  // Opens on Fix required when something was sent back; otherwise on All. The dropdown below changes it.
  const [tabPick, setTab] = React.useState(() => sp.get("status") || null);
  const [q, setQ] = React.useState(sp.get("q") || "");
  const [bankF, setBankF] = React.useState("all");
  const [shown, setShown] = React.useState(20);
  const [sel, setSel] = React.useState(null);
  const [versionsOf, setVersionsOf] = React.useState(null);
  // Four sections. Column mapping, transaction type mapping and narration tags keep their own permissions.
  const SECTIONS = [["list", "Accounts", "bank_setup"], ["mapping", "Column mapping", "mapping"], ["types", "Transaction type mapping", "status_std"], ["tags", "Narration tags", "narration_tags"]].filter(([, , scr]) => hasCap(perms, scr));
  const [view, setViewRaw] = React.useState(() => { const v = new URLSearchParams(window.location.search).get("view"); return ["mapping", "types", "tags"].includes(v) ? v : "list"; });
  const setView = (v) => { setViewRaw(v); const n = new URLSearchParams(window.location.search); n.set("view", v); setSp(n, { replace: true }); };

  React.useEffect(() => { if (sp.get("status") || sp.get("q")) { sp.delete("status"); setSp(sp, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Only the AMC(s) this person is working on.
  const scoped = collections.bank_config.filter((c) => inScope(amcUser, amcOfAccount(c.accountNumber)));
  const mineToFix = scoped.filter((c) => c.status === "rejected");
  const tab = tabPick || (mineToFix.length ? "rejected" : "all");
  const pending = scoped.filter((c) => c.status === "pending");
  const drafts = scoped.filter((c) => c.status === "draft");
  const count = (st) => (st === "all" ? scoped.length : scoped.filter((c) => c.status === st).length);

  const needle = q.trim().toLowerCase();
  const matches = (c) => !needle || c.bankName.toLowerCase().includes(needle) || c.accountNumber.includes(needle.replace(/\D/g, "") || "~") || (c.formatName || "").toLowerCase().includes(needle);
  const rows = scoped.filter((c) => (tab === "all" || c.status === tab) && matches(c));
  const bankNames = [...new Set(scoped.map((c) => c.bankName))].sort();
  const ORDER = ["rejected", "pending", "draft", "active", "inactive"];
  const list = rows.filter((c) => bankF === "all" || c.bankName === bankF).sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status) || x.bankName.localeCompare(y.bankName));

  return (
    <div className="bs" data-testid="bank-config-landing">
      <div className="bs-head">
        <div>
          <h1>Bank statement setup</h1>
        </div>
        {canEdit && view === "list" && <button className="btn btn-primary" onClick={() => nav("/bank-setup/new")} data-testid="btn-add-new"><Plus size={16} /> Add setup</button>}
      </div>

      <nav className="src-sections" role="tablist" aria-label="Bank statement setup sections">
        {SECTIONS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => setView(k)} data-testid={"view-" + k}>{l}</button>)}
      </nav>

      {view === "mapping" ? <MappingSummary embedded type="bank" /> : view === "types" ? <StatusStandardisation embedded /> : view === "tags" ? <NarrationTags embedded /> : <>
      {/* 1 — What needs me */}
      <div className="bs-queue" data-testid="work-queue">
        {[
          ["rejected", "Fix required", mineToFix.length, AlertTriangle, "bad"],
          ["pending", "Pending approval", canApprove ? pending.filter((c) => c.owner !== personaUser.name.split(" ")[0]).length : pending.length, Hourglass, "warn"],
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
        <div className="search bs-search"><Search /><input className="input" placeholder="Search bank, account or last 4 digits" aria-label="Search bank, account or last 4 digits" value={q} onChange={(e) => setQ(e.target.value)} data-testid="search-input" /></div>
        <Picker value={bankF} onChange={(v) => { setBankF(v); setShown(20); }} label="Bank" testid="bank-filter" align="right" width={260} options={[{ value: "all", label: "All banks", count: bankNames.length }, ...bankNames.map((n) => ({ value: n, label: n, count: scoped.filter((c) => c.bankName === n).length }))]} />
        <Picker value={tab} onChange={(v) => { setTab(v); setShown(20); }} label="Status" testid="status-filter" align="right" width={250} options={TABS.map(([k, l]) => ({ value: k, label: l, count: count(k) }))} />
      </div>
      <div className="dl" data-testid="bank-groups" style={{ "--cols": "44px minmax(0, 1.5fr) 150px minmax(0, 1fr) 96px 170px 104px 64px" }}>
        <div className="dl-h" aria-hidden="true"><span /><span>Account</span><span>Mode</span><span>Account type</span><span>Priority</span><span>Status</span><span>Updated</span><span /></div>
        {rows.length === 0 && <div className="dl-empty">{needle ? `No account matches “${q}”.` : tab === "rejected" ? "Nothing needs a fix." : "Nothing here yet."}{canEdit && !needle && <button className="link" onClick={() => nav("/bank-setup/new")}>Add a setup</button>}</div>}
        <ul className="rq-list">
          {list.slice(0, shown).map((c) => {
            const Mode = BANK_MODES[c.downloadMode];
            const liab = c.processing?.reconciliationType === "Liability";
            return (
              <li key={c.id}>
                <button type="button" className="dl-r" onClick={() => setSel(c)} data-testid={"row-" + c.id}>
                  <span className="dl-ic" aria-hidden="true">{c.bankName.slice(0, 1)}</span>
                  <span className="dl-main"><b>{c.bankName} · {maskAccount(c.accountNumber)}</b><small>{c.schemeName || c.assetClass || ""}{c.formatName ? ` · ${c.formatName}` : ""}</small></span>
                  <span className="dl-c"><Mode.icon size={14} /> {SHORT_MODE[c.downloadMode]}</span>
                  <span className="dl-c">{liab ? `Liability · ${c.processing.liabilityCategory}` : "Subscription"}</span>
                  <span className="dl-c">{c.priority === "high" ? <span className="bs-tag prio"><Flag size={12} /> High</span> : <span className="muted">Normal</span>}</span>
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
