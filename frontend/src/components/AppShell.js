import React from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Landmark, CreditCard, GitCompareArrows, History, Gauge, Inbox, Combine, Siren, ScanText,
  PanelLeftClose, PanelLeft, ChevronRight, LogOut, RotateCcw, AlertTriangle, Bell, Users, Shield, KeyRound,
  Calculator, Wallet, BookUser, FileStack, FileWarning, Layers, Undo2, Percent, ChevronDown, Eye,
  Home, ClipboardCheck, FileInput, Banknote, Search, Building2, Scale, Clock, Activity, Tags, FolderCog, ClipboardList,
  ListTodo,
} from "lucide-react";
import CommandPalette from "@/components/CommandPalette";
import { useApprovals } from "@/features/approvals/useApprovals";
import { dailyCycle } from "@/lib/journey";
import { useStore } from "@/state/store";
import { userAmcs, inScope, amcOfAccount } from "@/lib/org";
import { ConfirmModal } from "@/components/Modal";
import { StateBlock, ScreenBoundary } from "@/components/bits";
import { navFor, homePath, screenForPath, hasCap, PERSONAS, VERTICALS, screenLabel, MODULES } from "@/lib/access";
import { toast } from "sonner";

const ICONS = {
  balances: Banknote, scheduler: Activity, cutoffs: Clock, narration_tags: Tags, status_std: Scale,
  today: Home, inbox: ClipboardCheck, setup_approvals: ClipboardCheck, setup_tasks: ClipboardList, setup_todo: ListTodo, setup_scheduler: Activity, release: Banknote, refunds: Undo2,
  command: Gauge, ingestion: FileInput, match: Combine, exceptions: Siren, extraction: ScanText,
  bank_setup: Landmark, credit_mis: CreditCard, mapping: GitCompareArrows,
  approvals: LayoutDashboard, audit: History, users: Users, roles: KeyRound,
  brk_compute: Calculator, brk_payout: Wallet, brk_master: BookUser,
  pst_queue: FileStack, pst_nigo: FileWarning, pst_batch: Layers, rf_queue: Undo2, rf_interest: Percent,
};

const EXTRA_CRUMBS = [
  [/^\/bank-setup\/bank\/([^/]+)/, (m) => decodeURIComponent(m[1])], [/^\/bank-setup\/rules/, "Rules for all banks"],
  [/^\/credit-mis\/pa\/([^/]+)/, (m) => ({ RAZORPAY: "Razorpay", CASHFREE: "Cashfree" }[decodeURIComponent(m[1])] || decodeURIComponent(m[1]))],
  [/^\/bank-setup\/new/, "Add New"], [/^\/bank-setup\//, "Configuration"],
  [/^\/credit-mis\/new/, "Add New"], [/^\/credit-mis\//, "Configuration"], [/^\/mapping\//, "Columns"],
];

const RECON_SETUP_PATHS = MODULES.find((m) => m.key === "central_setup").screens.filter((x) => x.group === "Recon").map((x) => x.path);

export default function AppShell() {
  const { state, role, currentUser, currentRole, persona, perms, switchPersona, toggleSidebar, resetDemo, collections, simple, setSimple, personaUser, amcUser, activeAmc, setAmc, crossAmc, vertical, setVertical } = useStore();
  const myAmcs = userAmcs(personaUser);
  const [amcOpen, setAmcOpen] = React.useState(false);
  const amcName = activeAmc || myAmcs[0];
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [personaOpen, setPersonaOpen] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [bannerSeen, setBannerSeen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [bellOpen, setBellOpen] = React.useState(false);
  const approvals = useApprovals().filter((a) => !a.own);

  React.useEffect(() => { setBannerSeen(false); }, [persona, state.sessionId]);
  // One shortcut for power users: Ctrl or Cmd + K opens search from anywhere. Everything else stays mouse-first.
  React.useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const modKey = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl";
  React.useEffect(() => {
    const close = () => { setMenuOpen(false); setPersonaOpen(false); setBellOpen(false); };
    if (menuOpen || personaOpen || bellOpen) { window.addEventListener("click", close); return () => window.removeEventListener("click", close); }
  }, [menuOpen, personaOpen, bellOpen]);

  const modules = navFor(perms, simple);
  const [openFolders, setOpenFolders] = React.useState({});
  // The Central Setup Team works across AMCs (users, roles and setups), so it never picks a working AMC.
  // Recon setup pages (Central Setup › Recon): the Central Setup Team works on one AMC at a time here.
  const onReconSetup = RECON_SETUP_PATHS.some((p) => loc.pathname === p || loc.pathname.startsWith(p + "/"));
  const worksOnAmc = modules.some((m) => !["admin", "central_setup"].includes(m.key)) || (crossAmc && onReconSetup);
  const screen = screenForPath(loc.pathname);
  const allowed = !screen || hasCap(perms, screen.key, "view");

  const rejectedCount = collections.bank_config.filter((c) => c.owner === currentUser && c.status === "rejected").length;
  const queueCount = ["bank_config", "credit_config", "bank_mapping"].reduce((n, k) => n + collections[k].filter((x) => x.status === "pending").length, 0);
  const accessPending = (collections.access_requests || []).filter((r) => r.status === "pending").length;
  const openExceptions = (collections.exceptions || []).filter((e) => e.status === "open" && e.interestHoursLeft < 24).length;
  const driftCount = (collections.files || []).filter((f) => ["drift", "unknown", "check_failed", "late", "missing"].includes(f.status)).length;
  const docsToReview = (collections.documents || []).filter((d) => d.status === "needs_review").length;

  const myWorkCount = (collections.exceptions || []).filter((e) => e.status !== "closed" && e.status !== "pending_approval" && (e.owner === personaUser.name || (!e.owner && e.amount > 0 && e.interestHoursLeft < 24))).length
    + (collections.suggestions || []).filter((s) => !s.decided).length + docsToReview;
  const release = (collections.releases || [])[0];
  const badgeFor = (key) => ({
    today: hasCap(perms, "inbox", "approve") ? 0 : hasCap(perms, "match", "edit") ? myWorkCount : 0,
    inbox: approvals.length,
    setup_approvals: approvals.length,
    setup_tasks: (state.collections.setup_requests || []).filter((t) => t.status === "open" && inScope(amcUser, t.amc)).length,
    // To do: approvals + open Ops requests + setups sent back, for the AMC picked at the top.
    setup_todo: approvals.length + (state.collections.setup_requests || []).filter((t) => t.status === "open" && inScope(amcUser, t.amc)).length
      + ["bank_config", "credit_config"].reduce((n, k) => n + (state.collections[k] || []).filter((c) => c.status === "rejected" && inScope(amcUser, amcOfAccount(c.accountNumber))).length, 0)
      + (state.collections.bank_mapping || []).filter((m) => m.status === "rejected").length,
    release: release && ((release.status === "not_started" && hasCap(perms, "release", "edit")) || (release.status === "pending" && hasCap(perms, "release", "approve"))) ? 1 : 0,
    refunds: hasCap(perms, "refunds", "edit") ? (collections.refunds || []).filter((r) => r.status === "draft").length : 0,
    approvals: 0,
    bank_setup: role === "maker" ? rejectedCount : 0,
    roles: hasCap(perms, "roles", "approve") ? accessPending : 0,
    exceptions: openExceptions,
    ingestion: driftCount,
    extraction: docsToReview,
  }[key] || 0);

  const crumbs = screen ? (simple ? [screenLabel(screen, true)] : [screen.moduleLabel, screen.crumb || screen.label]) : ["CAMS Operations"];
  EXTRA_CRUMBS.forEach(([re, label]) => { const m = loc.pathname.match(re); if (m && crumbs.length === 2) crumbs.push(typeof label === "function" ? label(m) : label); });
  const toggleSimple = () => { setSimple(!simple); setMenuOpen(false); nav("/"); };

  const late = dailyCycle(collections).filter((s) => s.late && s.state !== "done" && hasCap(perms, s.screen));
  const notes = [
    ...late.map((s) => ({ id: "late-" + s.key, tone: "red", text: `${s.title} was due by ${s.by}`, sub: s.summary, path: s.cta.path })),
    ...(approvals.length ? [{ id: "ap", tone: "amber", text: `${approvals.length} item${approvals.length > 1 ? "s" : ""} waiting for your approval`, sub: approvals.slice(0, 2).map((a) => a.kind).join(", "), path: "/approvals" }] : []),
    ...(role === "maker" && rejectedCount ? [{ id: "rej", tone: "amber", text: `${rejectedCount} setup${rejectedCount > 1 ? "s" : ""} sent back to you`, sub: "Fix and resubmit", path: "/bank-setup?status=rejected" }] : []),
    ...(hasCap(perms, "ingestion") && driftCount ? [{ id: "files", tone: "amber", text: `${driftCount} bank file${driftCount > 1 ? "s" : ""} need attention`, sub: "Late, missing or changed layout", path: "/ingestion" }] : []),
  ];
  const personaLabel = PERSONAS.find((p) => p.id === persona)?.label || currentUser;
  const choosePersona = (id) => { switchPersona(id); setPersonaOpen(false); nav("/"); };

  return (
    <div className={"shell" + (state.sidebarCollapsed ? " collapsed" : "") + (simple ? " simple" : "")}>
      <aside className={"sidebar" + (state.sidebarCollapsed ? " mini" : "")}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Shield size={15} /></div>
          <div className="brand-text">CAMS Recon</div>
        </div>
        <div className="sb-profile" data-testid="sb-profile">
          <span className="sb-avatar" aria-hidden="true">{personaUser.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}<i /></span>
          <span className="sb-who"><b>{personaUser.name}</b><small>{personaLabel.split(" · ")[1] || currentRole}</small></span>
        </div>

        <nav className="nav" data-testid="sidebar-nav">
          {modules.map((m) => (
            <div key={m.key} className="nav-module" data-testid={"nav-module-" + m.key}>
              {modules.length > 1 && <div className="nav-module-title"><i style={{ background: m.color }} />{m.label}</div>}
              {m.groups.map((g) => {
                // Folder modules (Central Setup) show each group as a dropdown: click "Recon" to open its setup screens.
                const folder = m.folders && !state.sidebarCollapsed;
                const open = !folder || (openFolders[m.key + g.name] ?? true);
                return (
                <React.Fragment key={g.name}>
                  {folder ? (
                    <button type="button" className={"nav-item nav-folder" + (open ? " open" : "")} onClick={() => setOpenFolders((o) => ({ ...o, [m.key + g.name]: !open }))} aria-expanded={open} data-testid={"nav-folder-" + g.name.toLowerCase()}>
                      <FolderCog /><span className="nav-label">{g.name}</span><ChevronRight className="nav-chev" />
                    </button>
                  ) : g.name !== m.label && <div className="nav-section-title">{g.name}</div>}
                  {open && <div className={folder ? "nav-folder-items" : undefined}>{g.screens.map((s, k) => {
                    const Icon = ICONS[s.key] || Layers;
                    const badge = badgeFor(s.key);
                    return (
                      <React.Fragment key={s.key}>
                      <NavLink to={s.path} end={s.path === "/dashboard"} style={{ "--ic": `var(--ic-${(k % 6) + 1})` }} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")} data-testid={"nav-" + s.key}>
                        <Icon /><span className="nav-label">{screenLabel(s, simple)}</span>{s.step && <span className="nav-step" title={`Step ${s.step} of the daily cycle`}>{s.step}</span>}
                        {badge > 0 && <span className="nav-badge pop" key={badge}>{badge}</span>}
                      </NavLink>
                      </React.Fragment>
                    );
                  })}</div>}
                </React.Fragment>
                );
              })}
            </div>
          ))}
        </nav>

        <button className="nav-item" onClick={toggleSidebar} data-testid="sidebar-toggle" style={{ margin: 10 }}>
          {state.sidebarCollapsed ? <PanelLeft /> : <PanelLeftClose />}
          <span className="nav-label">Collapse</span>
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-icon btn-ghost" onClick={toggleSidebar} data-testid="topbar-collapse" aria-label="Toggle sidebar">
            {state.sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <nav className="crumbs" data-testid="breadcrumb">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="sep" size={14} />}
                {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
              </React.Fragment>
            ))}
          </nav>
          {worksOnAmc && <div style={{ position: "relative" }}>
            <button className="amc-chip" onClick={(e) => { e.stopPropagation(); if (myAmcs.length > 1) setAmcOpen((o) => !o); }} data-testid="amc-switch" title={myAmcs.length > 1 ? "Switch AMC" : "Your AMC"}>
              <Building2 size={14} /><span>{amcName}</span>{myAmcs.length > 1 && <ChevronDown size={13} />}
            </button>
            {amcOpen && (
              <div className="menu-pop" style={{ width: 280, left: 0, right: "auto" }} onClick={(e) => e.stopPropagation()} data-testid="amc-menu">
                <div className="menu-head"><b>{crossAmc ? "Set up which AMC?" : "Work on which AMC?"}</b><span>{crossAmc ? "Applies to every Recon setup screen" : "One AMC at a time — every list shows only its records"}</span></div>
                <div className="menu-sep" />
                {myAmcs.map((a) => <button key={a} className={"menu-item" + (activeAmc === a ? " on" : "")} onClick={() => { setAmc(a); setAmcOpen(false); }} data-testid={"amc-opt-" + a.split(" ")[0]}><span className="dot" />{a}</button>)}
              </div>
            )}
          </div>}
          <button className="search-trigger" onClick={() => setPaletteOpen(true)} data-testid="open-search" aria-keyshortcuts="Control+K Meta+K"><Search size={14} /><span>Search or jump to…</span><kbd>{modKey} K</kbd></button>
          <div className="topbar-spacer" />
          <div style={{ position: "relative" }}>
            <button className="icon-btn" aria-label="Notifications" data-testid="bell" onClick={(e) => { e.stopPropagation(); setBellOpen((o) => !o); }}>
              <Bell size={17} />{notes.length > 0 && <span className="bell-dot">{notes.length}</span>}
            </button>
            {bellOpen && (
              <div className="menu-pop bell-pop" onClick={(e) => e.stopPropagation()} data-testid="bell-menu">
                <div className="menu-head"><b>Needs your attention</b><span>{notes.length ? "Click to go straight there" : "You're all caught up"}</span></div>
                {notes.map((n) => (
                  <button key={n.id} className={"note-row tone-" + n.tone} onClick={() => { setBellOpen(false); nav(n.path); }}>
                    <i /><div><b>{n.text}</b><span>{n.sub}</span></div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Demo persona switcher — each persona is a real seeded user with a different role mix */}
          <div style={{ position: "relative" }}>
            <button className="persona-btn" data-testid="persona-switch" onClick={(e) => { e.stopPropagation(); setPersonaOpen((o) => !o); }}>
              <span className="dot" />{personaLabel}<ChevronDown size={14} />
            </button>
            {personaOpen && (
              <div className="menu-pop" style={{ width: 300 }} onClick={(e) => e.stopPropagation()} data-testid="persona-menu">
                <div className="menu-head"><b>View the app as…</b><span>Navigation follows each user's screen permissions</span></div>
                <div className="menu-sep" />
                {PERSONAS.map((p) => (
                  <button key={p.id} className={"menu-item" + (p.id === persona ? " on" : "")} onClick={() => choosePersona(p.id)} data-testid={"persona-" + p.id}>
                    <span className="dot" />{p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Business vertical — MF by default; KRA is listed but not live yet */}
          <label className="vertical-pick" title="Business vertical">
            <span>Vertical</span>
            <select value={vertical} onChange={(e) => setVertical(e.target.value)} data-testid="vertical-select">
              {VERTICALS.map((v) => <option key={v.key} value={v.key} disabled={v.later}>{v.label}{v.later ? " (later)" : ""}</option>)}
            </select>
          </label>

          <div style={{ position: "relative" }}>
            <button className="avatar" data-testid="avatar-menu-btn" onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}>
              {currentUser[0]}
            </button>
            {menuOpen && (
              <div className="menu-pop" onClick={(e) => e.stopPropagation()} data-testid="user-menu">
                <div className="menu-head"><b>{currentUser}</b><span>{currentRole}</span></div>
                <div className="menu-sep" />
                <button className="menu-item" onClick={toggleSimple} data-testid="menu-simple"><Eye /> {simple ? "Switch to full view" : "Switch to simple view"}</button>
                <button className="menu-item" onClick={() => { setConfirmReset(true); setMenuOpen(false); }} data-testid="menu-reset-demo"><RotateCcw /> Reset demo data</button>
                <div className="menu-sep" />
                <button className="menu-item" data-testid="menu-logout"><LogOut /> Sign out</button>
              </div>
            )}
          </div>
        </header>
        {worksOnAmc && myAmcs.length > 1 && !activeAmc && (
          <div className="overlay amc-pick" data-testid="amc-picker">
            <div className="modal" style={{ maxWidth: 460 }}>
              <div className="modal-head"><h3>Hello {currentUser.split(" ")[0]} — which AMC are you {crossAmc ? "setting up" : "working on"}?</h3></div>
              <div className="modal-body">
                <p className="muted" style={{ marginTop: 0 }}>{crossAmc
                  ? <>Every Recon setup screen will show only this AMC's setups, tasks and approvals. Switch any time from the AMC name at the top.</>
                  : <>You have access to {myAmcs.length} AMCs. You work on one AMC at a time — pick one; switch any time from the AMC name at the top.</>}</p>
                <div className="amc-grid">
                  {myAmcs.map((a) => <button key={a} className="amc-card" onClick={() => setAmc(a)} data-testid={"amc-pick-" + a.split(" ")[0]}><Building2 size={16} />{a}</button>)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="content">
          <div className="page-wrap">
            {!bannerSeen && role === "auth" && queueCount > 0 && allowed && loc.pathname === "/dashboard" && (
              <div className="sess-banner info" data-testid="banner-auth-queue">
                <span className="ico"><Bell size={20} /></span>
                <div><b>{queueCount} configuration{queueCount > 1 ? "s" : ""}</b> awaiting your review.</div>
                <button className="btn btn-primary btn-sm" onClick={() => { setBannerSeen(true); nav("/dashboard"); }}>Open queue</button>
                <button className="x" onClick={() => setBannerSeen(true)} aria-label="Dismiss"><span style={{ fontSize: 18 }}>×</span></button>
              </div>
            )}
            {allowed ? <ScreenBoundary resetKey={loc.pathname}><Outlet /></ScreenBoundary> : (
              <StateBlock art="lock" testid="no-access" title={`You don't have access to ${screenLabel(screen, simple)}`}
                action={<button className="btn btn-primary" onClick={() => nav(homePath(perms, simple))}>Go to my home screen</button>}>
                Access is given per screen through roles. Ask the Central Setup Team to add a role that includes {screen.label}. Nothing on this screen was opened or changed.
              </StateBlock>
            )}
          </div>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {confirmReset && (
        <ConfirmModal id="reset-demo-modal" title="Reset demo data?" danger confirmLabel="Reset everything"
          message="This clears all your changes and restores the original seeded demo state (users, roles, configs, files, cases, audit log). This cannot be undone."
          onConfirm={() => { resetDemo(); toast.success("Demo data reset to original seed"); nav("/"); }}
          onClose={() => setConfirmReset(false)} />
      )}
    </div>
  );
}
