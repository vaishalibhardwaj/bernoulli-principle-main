import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "@/state/store";
import { MODULES, MODULE_BY_KEY, SCREENS, hasCap } from "@/lib/access";
import { EmptyState, SkeletonBlock } from "@/components/bits";
import Picker from "@/components/Picker";
import DateRange from "@/components/DateRange";
import { usePopover, PopoverPanel } from "@/components/Popover";
import { formatDate, timeAgo, highlight } from "@/lib/format";
import RolePermissionsDrawer from "./RolePermissionsDrawer";
import AddEditUserDrawer from "./AddEditUserDrawer";
import DeactivateUserModal from "./DeactivateUserModal";
import OnboardingModal from "./OnboardingModal";
import "./userManagement.css";
import { Modal } from "@/components/Modal";
import { AMCS, userAmcs, inScope, isDormant, daysSince, BIOMETRIC_LIMIT_DAYS } from "@/lib/org";

import { UserPlus, Search, Download, Shield, Pencil, Power, PowerOff, X, Building2, MoreHorizontal, ChevronDown } from "lucide-react";
import { toast } from "sonner";

// Three ID statuses plus one common "Inactive" flag for active IDs that have gone quiet.
/** Common inactivity status: no login for 10+ days, or no biometric punch-in for 7+ days. */
const isInactive = (u) => u.status === "active" && (isDormant(u) || (u.lastBiometric && daysSince(u.lastBiometric) >= 7));

const isoDay = (d) => d.toISOString().slice(0, 10);
// Three statuses on screen: Active (ID works), Inactive (ID switched off), Pending (invited, not signed in yet).
// An active ID that has gone quiet stays Active and carries a "no sign-in" note in Last activity.
const STATUS_WORD = { active: "Active", inactive: "Inactive", pending: "Pending" };
const STATUS_PILL = { active: "active", inactive: "deactivated", pending: "invited" };
const statusOf = (u) => (u.status === "deactivated" ? "inactive" : ["invited", "invite_expired"].includes(u.status) ? "pending" : "active");

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
      if (statusFilter !== "all" && statusOf(u) !== statusFilter) return false;
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

  const statusCount = (k) => scoped.filter((u) => statusOf(u) === k).length;
  const STATUSES = [
    { key: "active", label: "Active", count: statusCount("active"), testid: "tile-active" },
    { key: "inactive", label: "Inactive", count: statusCount("inactive"), testid: "tile-inactive" },
    { key: "pending", label: "Pending", count: statusCount("pending"), testid: "tile-invited" },
  ];
  const pickModule = (k) => { setModuleFilter(moduleFilter === k ? "all" : k); setRoleFilter("all"); };

  const activity = (u, st) => {
    const ago = (iso) => { const d = daysSince(iso); return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
    if (st === "inactive") return [<>Switched off</>, u.deactivatedAt ? formatDate(u.deactivatedAt) : (u.deactivationReason || "—"), false];
    if (st === "pending") return [<>Never signed in</>, u.status === "invite_expired" ? "Invite expired" : `Invite sent ${ago(u.invitedAt || u.createdAt)}`, false];
    const first = u.lastLogin ? timeAgo(u.lastLogin) : "Never signed in";
    const quiet = isInactive(u);
    const bio = u.lastBiometric ? (daysSince(u.lastBiometric) >= 7 ? `No punch-in ${daysSince(u.lastBiometric)} days` : `Punched in ${ago(u.lastBiometric)}`) : "No punch-in record";
    return [first, quiet && isDormant(u) ? `No sign-in ${daysSince(u.lastLogin || u.createdAt)} days` : bio, quiet];
  };
  const amcOptions = [{ value: "all", label: "All AMCs", count: AMCS.length }, ...AMCS.map((a) => ({ value: a, label: a }))];
  const COLS = "24px 40px minmax(170px, 1.3fr) minmax(130px, .9fr) minmax(190px, 1.4fr) 104px minmax(130px, 1fr) 40px";

  return (
    <div className="user-management-page um2" data-testid="user-management-page">
      <div className="page-head"><div><h1>Users</h1></div></div>
      <div className="um2-toolbar">
        <div className="um2-scope">
          <Picker value={amcFilter} onChange={setAmcFilter} label="AMC" testid="scope-amc" width={280} options={amcOptions} />
          <DateRange value={{ from: fromDate, to: toDate }} onChange={(v) => { if (v.from) setFromDate(v.from); if (v.to) setToDate(v.to); }} testid="scope" />
          {scopeChanged && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAmcFilter("all"); setFromDate(today); setToDate(today); }} data-testid="scope-reset"><X size={13} /> Reset</button>}
        </div>
        <div className="um2-acts">
          <span title={`Disabled until the ID management integration is confirmed. It will disable IDs with no biometric punch-in for ${BIOMETRIC_LIMIT_DAYS} consecutive days.`}>
            <button type="button" className="btn btn-outline" disabled data-testid="btn-biometric-check"><Shield size={15} /> Run biometric check</button>
          </span>
          {canEdit && <button type="button" className="btn btn-primary" onClick={() => { setEditingUser(null); setAddEditOpen(true); }} data-testid="btn-add-user"><UserPlus size={16} /> Assign roles</button>}
        </div>
      </div>

      <section className="um2-hero" data-testid="um-scope">
        <button type="button" className={"um2-total" + (statusFilter === "all" ? " on" : "")} onClick={() => setStatusFilter("all")} data-testid="tile-total">
          <span>People with a CAMS ID</span><b className="tnum">{scoped.length}</b>
        </button>
        {STATUSES.map((t) => (
          <button key={t.key} type="button" className={"um2-stat s-" + t.key + (statusFilter === t.key ? " on" : "")} onClick={() => setStatusFilter(statusFilter === t.key ? "all" : t.key)} data-testid={t.testid}>
            <span><i aria-hidden="true" />{t.label}</span><b className="tnum">{t.count}</b>
            <em className="um2-bar" aria-hidden="true"><u style={{ width: `${scoped.length ? (t.count / scoped.length) * 100 : 0}%` }} /></em>
          </button>
        ))}
      </section>

      <div className="um2-grid">
        {(() => {
          // Active people only (signed in recently): inactive, pending and quiet IDs are left out of this view.
          const activePeople = scoped.filter((u) => statusOf(u) === "active" && !isInactive(u));
          const mods = MODULES.map((m) => ({ key: m.key, label: m.label, users: activePeople.filter((u) => (u.roles || []).some((rid) => roleById[rid] && modsOf(roleById[rid]).has(m.key))).length })).sort((x, y) => y.users - x.users);
          const max = Math.max(1, ...mods.map((m) => m.users));
          return (
            <section className="um2-mods" data-testid="module-strip">
              <header><h2>People by module</h2>{moduleFilter !== "all" && <button type="button" className="link" onClick={() => pickModule(moduleFilter)}>Show everyone</button>}</header>
              <ul>
                {mods.map((m) => (
                  <li key={m.key}>
                    <button type="button" className={"um2-mod" + (moduleFilter === m.key ? " on" : "") + (!m.users ? " none" : "")} onClick={() => pickModule(m.key)} aria-pressed={moduleFilter === m.key} data-testid={`module-card-${m.key}`}>
                      <span>{m.label}</span><b className="tnum">{m.users}</b>
                      <i aria-hidden="true"><u style={{ width: `${(m.users / max) * 100}%` }} /></i>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })()}
        <section id="um-list">
          <div className="dl-bar" data-testid="user-toolbar">
            <label className="rq-search"><Search size={15} aria-hidden="true" /><input type="text" placeholder="Search name or employee ID" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search people" data-testid="user-search-input" /></label>
            <Picker value={statusFilter} onChange={setStatusFilter} label="Status" testid="status-filter" width={220} options={[{ value: "all", label: "All", count: scoped.length }, ...STATUSES.map((t) => ({ value: t.key, label: t.label, count: t.count }))]} />
            {moduleFilter !== "all" && (
              <span className="um2-chip">{MODULE_BY_KEY[moduleFilter]?.label}{roleFilter !== "all" && <> · {roleById[roleFilter]?.name.replace(/^.*· /, "")}</>}
                <button type="button" onClick={() => { setModuleFilter("all"); setRoleFilter("all"); }} aria-label="Clear module filter" data-testid="btn-reset-filters"><X size={12} /></button></span>
            )}
            <button type="button" className="btn btn-outline btn-sm um2-export" onClick={() => handleExportCsv(selected.size ? filteredUsers.filter((u) => selected.has(u.id)) : filteredUsers)} data-testid="btn-export-csv">
              <Download size={14} /> {selected.size ? `Export ${selected.size} selected` : "Export"}
            </button>
            {selected.size > 0 && <button type="button" className="link" onClick={() => setSelected(new Set())}>Clear selection</button>}
          </div>

          <div className="dl" data-testid="user-table" style={{ "--cols": COLS }}>
            <div className="dl-h" role="row">
              <span><input type="checkbox" className="uo-check" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" /></span>
              <span /><span>Person</span><span>AMC access</span><span>Module and role</span><span>Status</span><span>Last activity</span><span />
            </div>
            {loading ? <SkeletonBlock rows={6} label="Loading people" /> : (
              <ul className="rq-list">
                {pageRows.map((u) => {
                  const st = statusOf(u);
                  const [l1, l2, quiet] = activity(u, st);
                  const isSelf = u.id === actor.id;
                  return (
                    <li key={u.id}>
                      <div className={"dl-r um2-row" + (selected.has(u.id) ? " sel" : "")} data-testid={`user-row-${u.id}`}>
                        <span><input type="checkbox" className="uo-check" checked={selected.has(u.id)} onChange={() => toggleSel(u.id)} aria-label={`Select ${u.name}`} /></span>
                        <span className="dl-ic um2-av" aria-hidden="true">{u.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                        <span className="dl-main"><b>{highlight(u.name, debouncedSearch)}{isSelf && <em className="um2-you">You</em>}</b><small className="tnum" title={u.designation || undefined}>{highlight(u.empNo, debouncedSearch)}</small></span>
                        <span className="dl-c" data-testid={`amc-${u.id}`}><AmcCell user={u} /></span>
                        <span className="um2-roles">{renderRoles(u)}</span>
                        <span><span className={"pill pill-" + (st === "active" ? "active" : st === "inactive" ? "rejected" : "pending")} data-testid={`status-${STATUS_PILL[st]}`}><span className="dot" />{STATUS_WORD[st]}</span></span>
                        <span className={"dl-main um2-act" + (quiet ? " warn" : "")}><b>{l1}</b><small>{l2}</small></span>
                        <RowMenu user={u} isSelf={isSelf} canEdit={canEdit} canManageIds={canManageIds} pending={pendingReactivation.has(u.id)}
                          onEdit={() => { setEditingUser(u); setAddEditOpen(true); }} onDeactivate={() => setDeactivatingUser(u)} onReactivate={() => handleToggleReactivate(u)} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {!loading && pageRows.length === 0 && <EmptyState art="search" title="No one matches" subtitle="Try another name, or clear the filters." />}
            <div className="um2-foot">
              <span className="tnum">{total ? `${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + pageRows.length}` : 0} of {total}</span>
              <span className="um2-pager">
                <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="users-pager-prev">Previous</button>
                <button type="button" className="btn btn-outline btn-sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)} data-testid="users-pager-next">Next</button>
              </span>
            </div>
          </div>
        </section>

      </div>
      <RolePermissionsDrawer moduleKey={selectedRolePerms} roles={roles} roleCounts={roleCounts} onClose={() => setSelectedRolePerms(null)} onFilterRole={(rid) => { setRoleFilter(rid); setModuleFilter("all"); }} />
      <AddEditUserDrawer isOpen={addEditOpen} onClose={() => { setAddEditOpen(false); setEditingUser(null); }} editingUser={editingUser} allUsers={users} actor={actor} roles={roles}
        onSaveUser={(form, id) => { const res = id ? updateUser(id, form) : addUser(form); if (res.ok && res.pending) toast.info(`${res.pending} privileged role(s) sent to a second admin for approval`); return res; }}
        onOpenInviteEmail={(newUser) => setOnboardingUser(newUser)} />
      {reactivating && <ReactivateModal user={reactivating} onClose={() => setReactivating(null)} onSubmit={(reason, ticket, bio) => {
        const res = requestReactivation(reactivating.id, reason, ticket, bio);
        if (!res.ok) { toast.error(res.error); return; }
        toast.success(`Reactivation of ${reactivating.name} sent to a second admin (Roles & Access → Approvals).`);
        setReactivating(null);
      }} />}
      <DeactivateUserModal isOpen={Boolean(deactivatingUser)} user={deactivatingUser} onClose={() => setDeactivatingUser(null)} onConfirmDeactivate={(userId, reason) => deactivateUser(userId, reason)} />
      <OnboardingModal isOpen={Boolean(onboardingUser)} user={onboardingUser} onClose={() => setOnboardingUser(null)} onUserActivated={(userId) => activateOnboardedUser(userId)} />
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

/** AMC access: "All AMCs", one AMC by name, or "3 AMCs" that opens the full list above the page. */
function AmcCell({ user }) {
  const pop = usePopover();
  const all = !user?.amcs || user.amcs.includes("ALL");
  const list = userAmcs(user);
  if (all) return <span className="um2-amc"><Building2 size={14} /> All AMCs</span>;
  if (list.length === 1) return <span className="um2-amc" title={list[0]}><Building2 size={14} /> {list[0]}</span>;
  return (
    <>
      <button type="button" ref={pop.btn} className="um2-amc more" onClick={pop.toggle} aria-expanded={pop.open} data-testid={`amc-more-${user.id}`}><Building2 size={14} /> {list.length} AMCs <ChevronDown size={13} /></button>
      <PopoverPanel state={pop} width={280} label={`${user.name}'s AMCs`}>
        <span className="pop-l">{user.name.split(" ")[0]} works on {list.length} AMCs</span>
        <ul className="pop-list" data-testid={`amc-pop-${user.id}`}>{list.map((a) => <li key={a}><Building2 size={14} />{a}</li>)}</ul>
      </PopoverPanel>
    </>
  );
}

/** Row actions behind one "⋯" button: edit roles, deactivate or request reactivation. */
function RowMenu({ user, isSelf, canEdit, canManageIds, pending, onEdit, onDeactivate, onReactivate }) {
  const pop = usePopover();
  if (!canEdit && !canManageIds) return <span />;
  const run = (fn) => () => { pop.close(); fn(); };
  return (
    <span className="dl-more">
      <button type="button" ref={pop.btn} className="dl-kebab" onClick={pop.toggle} aria-expanded={pop.open} aria-label={`Actions for ${user.name}`} data-testid={`row-menu-${user.id}`}><MoreHorizontal size={17} /></button>
      <PopoverPanel state={pop} align="right" width={260} className="pop-menu" label={`Actions for ${user.name}`}>
        {canEdit && <button type="button" onClick={run(onEdit)} data-testid={`action-edit-${user.id}`}><Pencil size={14} /> Edit roles and AMC access</button>}
        {canManageIds && (user.status === "deactivated"
          ? <button type="button" disabled={pending} onClick={run(onReactivate)} data-testid={`action-reactivate-${user.id}`}><Power size={14} /> {pending ? "Reactivation requested" : "Request reactivation"}</button>
          : <button type="button" className="danger" disabled={isSelf} onClick={run(onDeactivate)} data-testid={`action-deactivate-${user.id}`}><PowerOff size={14} /> {isSelf ? "Can't deactivate yourself" : "Deactivate"}</button>)}
      </PopoverPanel>
    </span>
  );
}
