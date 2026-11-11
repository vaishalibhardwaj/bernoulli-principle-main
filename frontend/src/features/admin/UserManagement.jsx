import React, { useState, useMemo, useEffect, useRef } from "react";
import { HeroArt } from "@/components/Art";
import { useStore } from "@/state/store";
import { MODULES, MODULE_BY_KEY, SCREENS, hasCap } from "@/lib/access";
import { Avatar } from "@/components/au";
import { EmptyState } from "@/components/bits";
import { formatDate, timeAgo, highlight } from "@/lib/format";
import RolePermissionsDrawer from "./RolePermissionsDrawer";
import AddEditUserDrawer from "./AddEditUserDrawer";
import DeactivateUserModal from "./DeactivateUserModal";
import OnboardingModal from "./OnboardingModal";
import { StatusOverview, ModuleAccess } from "./CamsConstellation";
import "./userManagement.css";
import { Modal } from "@/components/Modal";
import { AMCS, userAmcs, inScope, isDormant, daysSince, BIOMETRIC_LIMIT_DAYS, DORMANT_DAYS } from "@/lib/org";

import {
  UserPlus, Search, Download, Shield, Pencil, Power, PowerOff,
  Users, X, Building2, CalendarDays, MoreHorizontal
} from "lucide-react";
import { toast } from "sonner";

// Three ID statuses plus one common "Inactive" flag for active IDs that have gone quiet.
/** Common inactivity status: no login for 10+ days, or no biometric punch-in for 7+ days. */
const isInactive = (u) => u.status === "active" && (isDormant(u) || (u.lastBiometric && daysSince(u.lastBiometric) >= 7));

const isoDay = (d) => d.toISOString().slice(0, 10);
const STATUS_WORD = { active: "Active", inactive: "Inactive", invited: "Invited", deactivated: "Deactivated" };

export default function UserManagement() {
  const {
    users,
    actor,
    addUser,
    updateUser,
    deactivateUser,
    requestReactivation,
    activateOnboardedUser,
    roles,
    perms,
    collections,
  } = useStore();
  const canEdit = hasCap(perms, "users", "edit");
  // Activating, deactivating and reactivating IDs belongs to the ID-management persona (not built yet).
  // The Central Setup Team only assigns roles and AMC access, so nobody holds this capability today.
  const canManageIds = hasCap(perms, "users", "deactivate");
  const pendingByUser = useMemo(() => {
    const m = {};
    (collections.access_requests || []).filter((r) => r.status === "pending" && r.kind === "assign").forEach((r) => { m[r.userId] = [...(m[r.userId] || []), ...r.roleIds]; });
    return m;
  }, [collections.access_requests]);
  const roleById = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r])), [roles]);

  // Drawers and Modals
  const [selectedRolePerms, setSelectedRolePerms] = useState(null);
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deactivatingUser, setDeactivatingUser] = useState(null);
  const [onboardingUser, setOnboardingUser] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  // Scope for "Access by module" and the user tiles: all AMCs, as on today, unless changed
  const today = isoDay(new Date());
  const [amcFilter, setAmcFilter] = useState("all");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Fake short latency on filter change for polished enterprise feel
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(t);
  }, [debouncedSearch, roleFilter, moduleFilter, statusFilter, amcFilter, page, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, moduleFilter, statusFilter, amcFilter]);

  // Users in scope: AMC filter, and holding an ID at some point between From and To.
  // Status is read as on the To date (someone deactivated after To still counts as active).
  const scoped = useMemo(() => {
    const fromTs = new Date(fromDate + "T00:00:00").getTime();
    const toTs = new Date(toDate + "T23:59:59").getTime();
    return users
      .filter((u) => amcFilter === "all" || inScope(u, amcFilter))
      .filter((u) => !u.createdAt || new Date(u.createdAt).getTime() <= toTs)
      .filter((u) => !(u.status === "deactivated" && u.deactivatedAt && new Date(u.deactivatedAt).getTime() < fromTs))
      .map((u) => (u.status === "deactivated" && u.deactivatedAt && new Date(u.deactivatedAt).getTime() > toTs ? { ...u, status: "active", autoDeactivated: false } : u));
  }, [users, amcFilter, fromDate, toDate]);
  const scopeChanged = amcFilter !== "all" || fromDate !== today || toDate !== today;

  // Modules a role reaches: its own, plus any module whose screens it grants (the Central Setup Team role is filed
  // under Administration but works Central Setup screens, so it counts there too).
  const modsOf = React.useCallback((r) => new Set([r.module, ...Object.keys(r.perms || {}).map((k) => SCREENS[k]?.module).filter(Boolean)]), []);
  // Live counts: users per module and per role (a user can count in several)
  const { roleCounts } = useMemo(() => {
    const mc = {}; const rc = {};
    scoped.forEach((u) => {
      const mods = new Set();
      (u.roles || []).forEach((rid) => { rc[rid] = (rc[rid] || 0) + 1; const r = roleById[rid]; if (r) modsOf(r).forEach((m) => mods.add(m)); });
      mods.forEach((m) => { mc[m] = (mc[m] || 0) + 1; });
    });
    return { roleCounts: rc };
  }, [scoped, roleById, modsOf]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return scoped.filter((u) => {
      // Role filter
      if (roleFilter !== "all" && !(u.roles || []).includes(roleFilter)) return false;
      if (moduleFilter !== "all" && !(u.roles || []).some((rid) => roleById[rid] && modsOf(roleById[rid]).has(moduleFilter))) return false;
      // Status filter
      if (statusFilter === "inactive") { if (!isInactive(u)) return false; }
      else if (statusFilter === "active") { if (u.status !== "active" || isInactive(u)) return false; }
      else if (statusFilter === "invited") { if (!["invited", "invite_expired"].includes(u.status)) return false; }
      else if (statusFilter !== "all" && u.status !== statusFilter) return false;
      // Search
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const matchesName = (u.name || "").toLowerCase().includes(q);
        const matchesEmp = (u.empNo || "").toLowerCase().includes(q);
        const matchesEmail = (u.email || "").toLowerCase().includes(q);
        if (!matchesName && !matchesEmp && !matchesEmail) return false;
      }
      return true;
    });
  }, [scoped, roleFilter, moduleFilter, statusFilter, debouncedSearch, roleById, modsOf]);

  const total = filteredUsers.length;
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  // Export CSV handler
  const handleExportCsv = (list = filteredUsers) => {
    const headers = ["Name", "Employee No", "Designation", "Email", "Phone", "Roles", "Status", "Last Login"];
    const rows = list.map((u) => [
      `"${u.name}"`,
      `"${u.empNo}"`,
      `"${u.designation}"`,
      `"${u.email}"`,
      `"${u.phone}"`,
      `"${(u.roles || []).map((r) => roleById[r]?.name || r).join(" + ")}"`,
      `"${u.status}"`,
      `"${u.lastLogin ? formatDate(u.lastLogin) : "Never"}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cams_users_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${list.length} users to CSV`);
  };

  // Roles as plain text, grouped by module so it's always clear which module a role belongs to
  const renderRoles = (u) => {
    const byMod = {};
    (u.roles || []).forEach((rid) => { const r = roleById[rid]; if (r) (byMod[r.module] = byMod[r.module] || []).push(r.name.replace(/^(Recon|Brokerage|Posting|SIP|CRMS|Support|Purchase|MIS) · /, "")); });
    (pendingByUser[u.id] || []).forEach((rid) => { const r = roleById[rid]; if (r) (byMod[r.module] = byMod[r.module] || []).push(`${r.name.replace(/^(Recon|Brokerage|Posting|SIP|CRMS|Support|Purchase|MIS) · /, "")} (pending approval)`); });
    const mods = MODULES.filter((m) => byMod[m.key]);
    if (!mods.length) return <span className="muted">No roles</span>;
    return <span className="uo-roles" data-testid={`roles-${u.id}`}>{mods.map((m) => <span key={m.key} className="uo-role" style={{ "--c": m.color }}><i /><span className="uo-role-t"><b>{m.label}</b><small>{byMod[m.key].join(", ")}</small></span></span>)}</span>;
  };


  const [reactivating, setReactivating] = useState(null);
  const pendingReactivation = useMemo(() => new Set((collections.access_requests || []).filter((r) => r.kind === "reactivate" && r.status === "pending").map((r) => r.userId)), [collections.access_requests]);
  const handleToggleReactivate = (user) => setReactivating(user);


  // Bulk selection (export the ticked people) and the open row menu
  const [selected, setSelected] = useState(() => new Set());
  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pageIds = pageRows.map((u) => u.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); pageIds.forEach((id) => (allOnPage ? n.delete(id) : n.add(id))); return n; });

  const statusOf = (u) => (u.status === "deactivated" ? "deactivated" : ["invited", "invite_expired"].includes(u.status) ? "invited" : isInactive(u) ? "inactive" : "active");
  const statusCount = (k) => scoped.filter((u) => statusOf(u) === k).length;
  const STATUSES = [
    { key: "active", label: "Active", count: statusCount("active"), color: "#22a06b", hint: "Signed in and punched in recently", testid: "tile-active" },
    { key: "inactive", label: "Inactive", count: statusCount("inactive"), color: "#e8a23a", hint: `No sign-in ${DORMANT_DAYS}+ days or no punch-in 7+ days`, testid: "tile-inactive" },
    { key: "invited", label: "Invited", count: statusCount("invited"), color: "#7b61e8", hint: "Has roles, hasn't signed in yet", testid: "tile-invited" },
    { key: "deactivated", label: "Deactivated", count: statusCount("deactivated"), color: "#e5484d", hint: "ID switched off, cannot sign in", testid: "tile-deactivated" },
  ];
  const toList = () => setTimeout(() => document.getElementById("um-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  const pickModule = (k) => { setModuleFilter(moduleFilter === k ? "all" : k); setRoleFilter("all"); };

  const activity = (u, st) => {
    const ago = (iso) => { const d = daysSince(iso); return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
    if (st === "deactivated") return [<>Switched off</>, u.deactivatedAt ? formatDate(u.deactivatedAt) : (u.deactivationReason || "—")];
    if (st === "invited") return [<>Never signed in</>, u.status === "invite_expired" ? "Invite expired" : `Invite sent ${ago(u.invitedAt || u.createdAt)}`];
    const first = u.lastLogin ? timeAgo(u.lastLogin) : "Never signed in";
    const bio = u.lastBiometric ? (daysSince(u.lastBiometric) >= 7 ? `No punch-in ${daysSince(u.lastBiometric)} days` : `Punched in ${ago(u.lastBiometric)}`) : "No punch-in record";
    return [first, bio];
  };

  return (
    <div className="user-management-page" data-testid="user-management-page">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Users size={24} /> User Management</h1>
          <p>Find a person, check what they can do, fix their access.</p>
        </div>
        <div className="actions">
          <HeroArt name="badges" />
          <span title={`Disabled until the ID management integration is confirmed. It will disable IDs with no biometric punch-in for ${BIOMETRIC_LIMIT_DAYS} consecutive days.`}>
            <button type="button" className="btn btn-outline" disabled data-testid="btn-biometric-check"><Shield size={15} /> Run biometric check</button>
          </span>
          {canEdit && <button type="button" className="btn btn-primary" onClick={() => { setEditingUser(null); setAddEditOpen(true); }} data-testid="btn-add-user"><UserPlus size={16} /> Assign roles</button>}
        </div>
      </div>

      <StatusOverview scope={
      <div className="ux-scope" data-testid="um-scope">
        <Building2 size={14} />
        <select value={amcFilter} onChange={(e) => setAmcFilter(e.target.value)} data-testid="scope-amc" aria-label="AMC">
          <option value="all">All AMCs</option>
          {AMCS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="ux-scope-div" />
        <CalendarDays size={14} />
        <input className="tnum" type="date" value={fromDate} max={toDate} onChange={(e) => e.target.value && setFromDate(e.target.value)} data-testid="scope-from" aria-label="From date" />
        <span className="muted">to</span>
        <input className="tnum" type="date" value={toDate} min={fromDate} max={today} onChange={(e) => e.target.value && setToDate(e.target.value)} data-testid="scope-to" aria-label="To date" />
        {scopeChanged && <button type="button" className="ux-scope-reset" onClick={() => { setAmcFilter("all"); setFromDate(today); setToDate(today); }} data-testid="scope-reset" aria-label="Reset filters"><X size={13} /></button>}
      </div>
      } total={scoped.length} statuses={STATUSES} status={statusFilter} onStatus={(k) => { setStatusFilter(k); if (k !== "all") toList(); }} />

      <div className="uo-grid">
        <div className="uo-list" id="um-list">
          <div className="uo-list-top">
            <div className="uo-seg" role="tablist" aria-label="Status">
              {[{ key: "all", label: "All", count: scoped.length }, ...STATUSES].map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={statusFilter === t.key} className={statusFilter === t.key ? "on" : ""} onClick={() => setStatusFilter(t.key)} data-testid={t.key === "all" ? "tile-total" : `seg-${t.key}`}>
                  {t.label} <em className="tnum">{t.count}</em>
                </button>
              ))}
            </div>
            <div className="uo-tools" data-testid="user-toolbar">
              <label className="uo-search"><Search size={16} /><input type="text" placeholder="Search name or ID" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="user-search-input" /></label>
              {moduleFilter !== "all" && (
                <span className="uo-chip" style={{ "--c": MODULE_BY_KEY[moduleFilter]?.color }}><i />{MODULE_BY_KEY[moduleFilter]?.label}{roleFilter !== "all" && <> · {roleById[roleFilter]?.name.replace(/^.*· /, "")}</>}
                  <button type="button" onClick={() => { setModuleFilter("all"); setRoleFilter("all"); }} aria-label="Clear module filter" data-testid="btn-reset-filters"><X size={12} /></button></span>
              )}
              <button type="button" className="uo-btn" onClick={() => handleExportCsv(selected.size ? filteredUsers.filter((u) => selected.has(u.id)) : filteredUsers)} data-testid="btn-export-csv">
                <Download size={15} /> {selected.size ? `Export ${selected.size} selected` : "Export"}
              </button>
              {selected.size > 0 && <button type="button" className="uo-link" onClick={() => setSelected(new Set())}>Clear selection</button>}
            </div>
          </div>

          <div className="uo-table" data-testid="user-table" role="table">
            <div className="uo-tr uo-th" role="row">
              <span><input type="checkbox" className="uo-check" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" /></span>
              <span>Name</span><span>Module &amp; role</span><span>Status</span><span>Last activity</span><span />
            </div>
            {loading ? <div className="ux-skel">{Array.from({ length: 6 }).map((_, i) => <i key={i} />)}</div> : pageRows.map((u, i) => {
              const st = statusOf(u);
              const [l1, l2] = activity(u, st);
              const isSelf = u.id === actor.id;
              return (
                <div key={u.id} className={"uo-tr st-" + st + (selected.has(u.id) ? " sel" : "")} role="row" style={{ animationDelay: `${Math.min(i * 20, 240)}ms` }} data-testid={`user-row-${u.id}`}>
                  <span><input type="checkbox" className="uo-check" checked={selected.has(u.id)} onChange={() => toggleSel(u.id)} aria-label={`Select ${u.name}`} /></span>
                  <span className="uo-who">
                    <Avatar name={u.name} size={38} />
                    <span>
                      <b>{highlight(u.name, debouncedSearch)}{isSelf && <em className="ux-you" title="You are signed in as this user">You</em>}</b>
                      <small className="tnum">{highlight(u.empNo, debouncedSearch)} · <span data-testid={`amc-${u.id}`}><AmcCell user={u} compact /></span></small>
                    </span>
                  </span>
                  <span>{renderRoles(u)}</span>
                  <span><span className={"ux-pill " + st} data-testid={`status-${u.status}`}><i />{STATUS_WORD[st]}</span></span>
                  <span className={"uo-act" + (st === "inactive" ? " warn" : "")}><b>{l1}</b><small>{l2}</small></span>
                  <span><RowMenu user={u} isSelf={isSelf} canEdit={canEdit} canManageIds={canManageIds} pending={pendingReactivation.has(u.id)}
                    onEdit={() => { setEditingUser(u); setAddEditOpen(true); }} onDeactivate={() => setDeactivatingUser(u)} onReactivate={() => handleToggleReactivate(u)} /></span>
                </div>
              );
            })}
            {!loading && pageRows.length === 0 && <EmptyState icon={Users} title="No one matches" subtitle="Try another name, or clear the filters." />}
          </div>

          <div className="uo-foot">
            <span>Showing <b>{total ? `${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + pageRows.length}` : 0}</b> of <b>{total}</b></span>
            <span className="uo-pager">
              <button type="button" className="uo-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="users-pager-prev">Previous</button>
              <button type="button" className="uo-btn" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)} data-testid="users-pager-next">Next</button>
            </span>
          </div>
        </div>

        {(() => {
          // Active people only: inactive, invited and deactivated IDs are left out of this view.
          const activePeople = scoped.filter((u) => statusOf(u) === "active");
          const activeIn = (k) => activePeople.filter((u) => (u.roles || []).some((rid) => roleById[rid] && modsOf(roleById[rid]).has(k))).length;
          return <ModuleAccess modules={MODULES.map((m) => ({ key: m.key, label: m.label, color: m.color, users: activeIn(m.key), roles: roles.filter((r) => modsOf(r).has(m.key)).length }))}
            active={moduleFilter === "all" ? null : moduleFilter} onPick={pickModule} onRoles={setSelectedRolePerms} />;
        })()}
      </div>
      {/* Role Permissions Drawer */}
      <RolePermissionsDrawer
        moduleKey={selectedRolePerms}
        roles={roles}
        roleCounts={roleCounts}
        onClose={() => setSelectedRolePerms(null)}
        onFilterRole={(rid) => { setRoleFilter(rid); setModuleFilter("all"); }}
      />

      {/* Add / Edit User Drawer */}
      <AddEditUserDrawer
        isOpen={addEditOpen}
        onClose={() => {
          setAddEditOpen(false);
          setEditingUser(null);
        }}
        editingUser={editingUser}
        allUsers={users}
        actor={actor}
        roles={roles}
        onSaveUser={(form, id) => {
          const res = id ? updateUser(id, form) : addUser(form);
          if (res.ok && res.pending) toast.info(`${res.pending} privileged role(s) sent to a second admin for approval`);
          return res;
        }}
        onOpenInviteEmail={(newUser) => {
          setOnboardingUser(newUser);
        }}
      />

      {/* Deactivate User Modal */}
      {reactivating && <ReactivateModal user={reactivating} onClose={() => setReactivating(null)} onSubmit={(reason, ticket, bio) => {
        const res = requestReactivation(reactivating.id, reason, ticket, bio);
        if (!res.ok) { toast.error(res.error); return; }
        toast.success(`Reactivation of ${reactivating.name} sent to a second admin (Roles & Access → Approvals).`);
        setReactivating(null);
      }} />}
      <DeactivateUserModal
        isOpen={Boolean(deactivatingUser)}
        user={deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        onConfirmDeactivate={(userId, reason) => {
          deactivateUser(userId, reason);
        }}
      />

      {/* Onboarding Flow Preview Modal */}
      <OnboardingModal
        isOpen={Boolean(onboardingUser)}
        user={onboardingUser}
        onClose={() => setOnboardingUser(null)}
        onUserActivated={(userId) => {
          activateOnboardedUser(userId);
        }}
      />
    </div>
  );
}

/** Controlled reactivation: reason required; biometric cases also need an IDM ticket and confirmed punch-in. */
function ReactivateModal({ user, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [ticket, setTicket] = useState("");
  const [bio, setBio] = useState(false);
  const auto = user.autoDeactivated;
  const ready = reason.trim().length >= 10 && (!auto || (ticket.trim() && bio));
  return (
    <Modal id="reactivate-modal" title={`Reactivate ${user.name}?`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!ready} onClick={() => onSubmit(reason.trim(), ticket.trim(), bio)} data-testid="reactivate-submit">Send for approval</button></>}>
      <p style={{ marginTop: 0 }}>{auto ? <>Disabled automatically: <b>{user.deactivationReason}</b>.</> : <>Deactivated by {user.deactivatedBy || "an admin"}{user.deactivationReason ? <>: <b>{user.deactivationReason}</b></> : ""}.</>} A second admin must approve before the ID works again.</p>
      <div className="field"><label className="field-label">Why should this ID be reactivated? (10+ characters)</label><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Back from medical leave on 20 Oct; manager confirmed" data-testid="reactivate-reason" /></div>
      {auto && <>
        <div className="field" style={{ marginTop: 10 }}><label className="field-label">Identity management ticket no.</label><input className="input tnum" value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="IDM-2026-…" data-testid="reactivate-ticket" /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 13 }}><input type="checkbox" checked={bio} onChange={(e) => setBio(e.target.checked)} data-testid="reactivate-bio" /> The user has punched in on the biometric system again</label>
      </>}
    </Modal>
  );
}

/** AMC access: the first AMC by name, the rest one click away in a small list. */
function AmcCell({ user, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const all = !user?.amcs || user.amcs.includes("ALL");
  const list = userAmcs(user);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  if (all) return <span className="um-text">{compact ? "All AMCs" : `All AMCs (${list.length})`}</span>;
  if (list.length === 1) return <span className="um-text uo-amc1" title={list[0]}>{list[0]}</span>;
  return (
    <span className="amc-cell" ref={ref}>
      {compact ? <button type="button" className="amc-more" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`amc-more-${user.id}`}>{list.length} AMCs</button>
        : <><span className="um-text">{list[0]}</span>{" "}<button type="button" className="amc-more" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`amc-more-${user.id}`}>+{list.length - 1} more</button></>}
      {open && (
        <div className="amc-pop" data-testid={`amc-pop-${user.id}`}>
          <div className="amc-pop-head">{user.name.split(" ")[0]} · {list.length} AMCs</div>
          <ul>{list.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
    </span>
  );
}

/** Row actions behind one "⋯" button: edit roles, deactivate or request reactivation. */
function RowMenu({ user, isSelf, canEdit, canManageIds, pending, onEdit, onDeactivate, onReactivate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  if (!canEdit && !canManageIds) return null;
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <span className="uo-menu" ref={ref}>
      <button type="button" className="uo-kebab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Actions for ${user.name}`} data-testid={`row-menu-${user.id}`}><MoreHorizontal size={17} /></button>
      {open && (
        <div className="uo-menu-pop" role="menu">
          {canEdit && <button type="button" role="menuitem" onClick={run(onEdit)} data-testid={`action-edit-${user.id}`}><Pencil size={14} /> Edit roles &amp; AMC access</button>}
          {canManageIds && (user.status === "deactivated"
            ? <button type="button" role="menuitem" disabled={pending} onClick={run(onReactivate)} data-testid={`action-reactivate-${user.id}`}><Power size={14} /> {pending ? "Reactivation requested" : "Request reactivation"}</button>
            : <button type="button" role="menuitem" className="danger" disabled={isSelf} onClick={run(onDeactivate)} data-testid={`action-deactivate-${user.id}`}><PowerOff size={14} /> {isSelf ? "Can't deactivate yourself" : "Deactivate"}</button>)}
        </div>
      )}
    </span>
  );
}
