import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "@/state/store";
import { MODULES, hasCap } from "@/lib/access";
import { TiltCard, ModuleOrbit, CountUp } from "@/features/viz/Viz";
import Pagination from "@/components/Pagination";
import { SkeletonRows, EmptyState } from "@/components/bits";
import { formatDate, timeAgo, highlight } from "@/lib/format";
import RolePermissionsDrawer from "./RolePermissionsDrawer";
import AddEditUserDrawer from "./AddEditUserDrawer";
import DeactivateUserModal from "./DeactivateUserModal";
import OnboardingModal from "./OnboardingModal";
import "./userManagement.css";
import { Modal } from "@/components/Modal";
import { AMCS, userAmcs, inScope, isDormant, daysSince, BIOMETRIC_LIMIT_DAYS, DORMANT_DAYS } from "@/lib/org";

import {
  UserPlus, Search, Download, Shield, Pencil, Send, Power, PowerOff,
  Users, Bell, X
} from "lucide-react";
import { toast } from "sonner";

const STATUS_FILTERS = [
  { key: "all", label: "All Statuses" },
  { key: "active", label: "Active" },
  { key: "invited", label: "Invited" },
  { key: "invite_expired", label: "Invite expired" },
  { key: "deactivated", label: "Deactivated (all)" },
  { key: "auto_deactivated", label: "Auto-deactivated · biometric" },
  { key: "biometric_risk", label: `No punch-in 7+ days (still active)` },
  { key: "dormant", label: `Not logged in ${DORMANT_DAYS}+ days` },
];

const isoDay = (d) => d.toISOString().slice(0, 10);
const STATUS_TEXT = { active: "Active", invited: "Invited", invite_expired: "Invite expired", deactivated: "Deactivated" };

export default function UserManagement() {
  const {
    users,
    actor,
    addUser,
    updateUser,
    deactivateUser,
    requestReactivation,
    resendInvite,
    activateOnboardedUser,
    adminNotifications,
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
  const [dismissedNotifs, setDismissedNotifs] = useState([]);

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
  const [pageSize, setPageSize] = useState(15);
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
  const fmtDay = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const scopeLabel = `${amcFilter === "all" ? "All AMCs" : amcFilter} · ${fromDate === toDate ? `as on ${fmtDay(toDate)}` : `${fmtDay(fromDate)} – ${fmtDay(toDate)}`}`;

  // Live counts: users per module and per role (a user can count in several)
  const { moduleCounts, roleCounts } = useMemo(() => {
    const mc = {}; const rc = {};
    scoped.forEach((u) => {
      const mods = new Set();
      (u.roles || []).forEach((rid) => { rc[rid] = (rc[rid] || 0) + 1; const r = roleById[rid]; if (r) mods.add(r.module); });
      mods.forEach((m) => { mc[m] = (mc[m] || 0) + 1; });
    });
    return { moduleCounts: mc, roleCounts: rc };
  }, [scoped, roleById]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (amcFilter !== "all" && !inScope(u, amcFilter)) return false;
      // Role filter
      if (roleFilter !== "all" && !(u.roles || []).includes(roleFilter)) return false;
      if (moduleFilter !== "all" && !(u.roles || []).some((rid) => roleById[rid]?.module === moduleFilter)) return false;
      // Status filter
      if (statusFilter === "auto_deactivated") { if (!(u.status === "deactivated" && u.autoDeactivated)) return false; }
      else if (statusFilter === "dormant") { if (!isDormant(u)) return false; }
      else if (statusFilter === "biometric_risk") { if (!(u.status === "active" && daysSince(u.lastBiometric) >= 7)) return false; }
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
  }, [users, amcFilter, roleFilter, moduleFilter, statusFilter, debouncedSearch, roleById]);

  const total = filteredUsers.length;
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  // Export CSV handler
  const handleExportCsv = () => {
    const headers = ["Name", "Employee No", "Designation", "Email", "Phone", "Roles", "Status", "Last Login"];
    const rows = filteredUsers.map((u) => [
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
    toast.success(`Exported ${filteredUsers.length} users to CSV`);
  };

  // Roles as plain text; privileged grants still awaiting a second admin are marked
  const renderRoles = (u) => {
    const names = (u.roles || []).map((rid) => roleById[rid]?.name).filter(Boolean);
    const pending = (pendingByUser[u.id] || []).map((rid) => `${roleById[rid]?.name || rid} (pending approval)`);
    const all = [...names, ...pending];
    return all.length ? <span className="um-text" data-testid={`roles-${u.id}`}>{all.join(", ")}</span> : <span className="muted">No roles</span>;
  };

  const handleResendInvite = (user) => {
    const res = resendInvite(user.id);
    if (res.ok) {
      toast.success(`Fresh invite and temporary password sent to ${user.name}`);
    } else {
      toast.error(res.error || "Failed to resend invite");
    }
  };

  const [reactivating, setReactivating] = useState(null);
  const pendingReactivation = useMemo(() => new Set((collections.access_requests || []).filter((r) => r.kind === "reactivate" && r.status === "pending").map((r) => r.userId)), [collections.access_requests]);
  const handleToggleReactivate = (user) => setReactivating(user);

  const visibleNotifs = adminNotifications.filter((n) => !dismissedNotifs.includes(n.id));

  return (
    <div className="user-management-page" data-testid="user-management-page">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={24} style={{ color: "#0f766e" }} /> User Management
          </h1>
          <p>Assign roles and AMC access for every CAMS module. IDs themselves (activation, deactivation) are managed by the ID management team.</p>
        </div>
        <div className="actions">
          {/* Kept visible but off until the ID management integration is agreed */}
          <span title={`Disabled until the ID management integration is confirmed. It will disable IDs with no biometric punch-in for ${BIOMETRIC_LIMIT_DAYS} consecutive days.`}>
            <button type="button" className="btn btn-outline" disabled data-testid="btn-biometric-check"><Shield size={15} /> Run biometric check</button>
          </span>
          {canEdit && <button
            type="button"
            className="btn btn-primary"
            style={{ background: "#0f766e", borderColor: "#0f766e" }}
            onClick={() => {
              setEditingUser(null);
              setAddEditOpen(true);
            }}
            data-testid="btn-add-user"
          >
            <UserPlus size={16} /> Assign roles
          </button>}
        </div>
      </div>

      {/* Admin Broadcast Notification Banners (e.g. Meera added Kiran Das as Operator) */}
      {visibleNotifs.slice(0, 2).map((n) => (
        <div
          key={n.id}
          className="sess-banner info"
          style={{ marginBottom: 16 }}
          data-testid="admin-notif-banner"
        >
          <span className="ico"><Bell size={18} /></span>
          <div>
            <b>Admin Notice:</b> {n.message} • <span style={{ opacity: 0.8, fontSize: 12 }}>{timeAgo(n.ts)}</span>
          </div>
          <button
            type="button"
            className="x"
            onClick={() => setDismissedNotifs((prev) => [...prev, n.id])}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}

      {/* Admin command view: modules orbit the CAMS core (click a node to filter) + access health */}
      <div className="um-scope" data-testid="um-scope">
        <div className="field">
          <label className="field-label">AMC</label>
          <select className="select" value={amcFilter} onChange={(e) => setAmcFilter(e.target.value)} data-testid="scope-amc">
            <option value="all">All AMCs</option>
            {AMCS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">From</label>
          <input className="input tnum" type="date" value={fromDate} max={toDate} onChange={(e) => e.target.value && setFromDate(e.target.value)} data-testid="scope-from" />
        </div>
        <div className="field">
          <label className="field-label">To (as on)</label>
          <input className="input tnum" type="date" value={toDate} min={fromDate} max={today} onChange={(e) => e.target.value && setToDate(e.target.value)} data-testid="scope-to" />
        </div>
        <span className="um-scope-note">Showing <b>{scopeLabel}</b>. The AMC also filters the user list below.</span>
        {scopeChanged && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAmcFilter("all"); setFromDate(today); setToDate(today); }} data-testid="scope-reset">Reset</button>}
      </div>

      <div className="admin-hero">
        <TiltCard className="card orbit-card" max={5}>
          <div className="card-head"><h3>Access by module</h3><span className="muted">Click a module to filter users · node size = users with access</span></div>
          <div className="orbit-wrap">
            <ModuleOrbit total={scoped.filter((u) => (u.roles || []).length).length} modules={MODULES.map((m) => ({ key: m.key, label: m.label, color: m.color, users: moduleCounts[m.key] || 0 }))} active={moduleFilter === "all" ? null : moduleFilter}
              onPick={(k) => { setModuleFilter(moduleFilter === k ? "all" : k); setRoleFilter("all"); }} />
            <div className="orbit-side">
              {MODULES.map((m) => (
                <button key={m.key} className={"om-row" + (moduleFilter === m.key ? " on" : "")} style={{ "--mc": m.color }} onClick={() => { setModuleFilter(moduleFilter === m.key ? "all" : m.key); setRoleFilter("all"); }} data-testid={`module-card-${m.key}`}>
                  <i /><span>{m.label}</span><b className="fx-num">{moduleCounts[m.key] || 0}</b>
                  <em onClick={(e) => { e.stopPropagation(); setSelectedRolePerms(m.key); }} data-testid={`view-roles-${m.key}`}>roles</em>
                </button>
              ))}
            </div>
          </div>
        </TiltCard>
        <div className="access-health">
          {(() => {
            const active = scoped.filter((u) => u.status === "active");
            const invited = scoped.filter((u) => u.status === "invited" || u.status === "invite_expired");
            const deact = scoped.filter((u) => u.status === "deactivated");
            const dormant = active.filter(isDormant).length;
            const auto = deact.filter((u) => u.autoDeactivated).length;
            return [
              ["All users", scoped.length, "blue", "all", "Active + invites pending + deactivated", "total"],
              ["Active", active.length, "green", "active", dormant ? `${dormant} not logged in ${DORMANT_DAYS}+ days` : null, "active", "dormant"],
              ["Invites pending", invited.length, "amber", "invited", invited.filter((u) => u.status === "invite_expired").length ? `${invited.filter((u) => u.status === "invite_expired").length} expired` : null, "invited", "invite_expired"],
              ["Deactivated", deact.length, "red", "deactivated", auto ? `${auto} by the biometric rule` : null, "deactivated", "auto_deactivated"],
            ].map(([l, v, t, f, sub, id, subF]) => (
              <div key={l} className={"ah-tile clickable tone-" + t + (statusFilter === f ? " on" : "")} onClick={() => setStatusFilter(f)} role="button" data-testid={`tile-${id}`}>
                <span>{l}</span><b className="fx-num"><CountUp value={v} /></b>
                {sub && <small onClick={subF ? (e) => { e.stopPropagation(); setStatusFilter(subF); } : undefined} className={subF ? "link" : ""}>{sub}</small>}
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        {/* Toolbar */}
        <div className="toolbar" data-testid="user-toolbar">
          {/* Search */}
          <div className="search" style={{ minWidth: 300 }}>
            <Search />
            <input
              className="input"
              type="text"
              placeholder="Search by name, emp. no., or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="user-search-input"
            />
          </div>

          {/* Role Filter */}
          <div className="field" style={{ minWidth: 160 }}>
            <select
              className="select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              data-testid="filter-role-select"
            >
              <option value="all">All Roles</option>
              {MODULES.map((m) => (
                <optgroup key={m.key} label={m.label}>
                  {roles.filter((r) => r.module === m.key && r.status === "active").map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({roleCounts[r.id] || 0})</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="field" style={{ minWidth: 160 }}>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="filter-status-select"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Shortcut */}
          {(roleFilter !== "all" || moduleFilter !== "all" || statusFilter !== "all" || search) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setRoleFilter("all");
                setModuleFilter("all");
                setStatusFilter("all");
                setSearch("");
              }}
              data-testid="btn-reset-filters"
            >
              Clear filters
            </button>
          )}

          {/* Export CSV */}
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginLeft: "auto" }}
            onClick={handleExportCsv}
            data-testid="btn-export-csv"
          >
            <Download size={14} /> Export users CSV
          </button>
        </div>

        {/* Table */}
        <div className="grid-scroll">
          <table className="grid" data-testid="user-table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Name</th>
                <th style={{ width: 110 }}>Emp. No.</th>
                <th>Designation</th>
                <th>Work Email</th>
                <th style={{ width: 150 }}>AMC access</th>
                <th style={{ width: 260 }}>Role</th>
                <th style={{ width: 130 }}>Status</th>
                <th style={{ width: 130 }}>Last Login</th>
                <th style={{ width: 160, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            {loading ? (
              <SkeletonRows rows={pageSize > 15 ? 12 : 8} cols={9} />
            ) : (
              <tbody>
                {pageRows.map((u) => {
                  const isSelf = u.id === actor.id;
                  const canResend = u.status === "invited" || u.status === "invite_expired";
                  return (
                    <tr key={u.id} data-testid={`user-row-${u.id}`}>
                      {/* Name */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontWeight: 700, color: "hsl(var(--text))" }}>
                            {highlight(u.name, debouncedSearch)}
                          </span>
                          {isSelf && (
                            <span
                              style={{
                                fontSize: 10,
                                background: "#0f766e",
                                color: "#fff",
                                padding: "1px 6px",
                                borderRadius: 4,
                                fontWeight: 700,
                              }}
                              title="You are currently signed in as this user"
                            >
                              YOU
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Emp No */}
                      <td className="tnum" style={{ fontWeight: 600 }}>
                        {highlight(u.empNo, debouncedSearch)}
                      </td>

                      {/* Designation */}
                      <td>{u.designation || "—"}</td>

                      {/* Email */}
                      <td className="tnum" style={{ fontSize: 12 }}>
                        {highlight(u.email, debouncedSearch)}
                      </td>

                      {/* AMC access */}
                      <td data-testid={`amc-${u.id}`}><AmcCell user={u} /></td>

                      {/* Role */}
                      <td>{renderRoles(u)}</td>

                      {/* Status */}
                      <td>
                        <span className="um-text" data-testid={`status-${u.status}`}>{STATUS_TEXT[u.status] || u.status}</span>
                        {u.status === "deactivated" && u.autoDeactivated && <div className="um-sub">Biometric rule · {daysSince(u.lastBiometric)}d no punch-in</div>}
                        {pendingReactivation.has(u.id) && <div className="um-sub amber">Reactivation awaiting 2nd admin</div>}
                        {isDormant(u) && <div className="um-sub red">Inactive {u.lastLogin ? daysSince(u.lastLogin) : daysSince(u.createdAt)} days</div>}
                      </td>

                      {/* Last Login */}
                      <td className="tnum" style={{ color: "hsl(var(--muted))", fontSize: 12 }}>
                        {u.lastLogin ? timeAgo(u.lastLogin) : "Never"}
                        {u.lastBiometric && <div className={"um-sub" + (daysSince(u.lastBiometric) >= 7 ? " amber" : "")}>Punch-in {daysSince(u.lastBiometric) === 0 ? "today" : `${daysSince(u.lastBiometric)}d ago`}</div>}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div className="cell-actions" style={{ justifyContent: "flex-end" }}>
                          {/* Edit user */}
                          {canEdit && <button
                            type="button"
                            className="row-icon-btn"
                            title="Edit roles and AMC access"
                            onClick={() => {
                              setEditingUser(u);
                              setAddEditOpen(true);
                            }}
                            data-testid={`action-edit-${u.id}`}
                          >
                            <Pencil size={15} />
                          </button>}

                          {/* Resend invite */}
                          {canResend && canEdit && (
                            <button
                              type="button"
                              className="row-icon-btn"
                              title="Resend invite (generates new temporary password)"
                              onClick={() => handleResendInvite(u)}
                              data-testid={`action-resend-${u.id}`}
                            >
                              <Send size={15} color="#b45309" />
                            </button>
                          )}

                          {/* Deactivate / Reactivate */}
                          {!canManageIds ? null : u.status === "deactivated" ? (
                            <button
                              type="button"
                              className="row-icon-btn"
                              title={pendingReactivation.has(u.id) ? "Reactivation already requested" : "Request reactivation (second admin approves)"}
                              disabled={pendingReactivation.has(u.id)}
                              onClick={() => handleToggleReactivate(u)}
                              data-testid={`action-reactivate-${u.id}`}
                            >
                              <Power size={15} color="#047857" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="row-icon-btn"
                              disabled={isSelf}
                              title={isSelf ? "Admins cannot deactivate themselves" : "Deactivate user"}
                              onClick={() => setDeactivatingUser(u)}
                              data-testid={`action-deactivate-${u.id}`}
                            >
                              <PowerOff size={15} color={isSelf ? "#94a3b8" : "#b91c1c"} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>

          {!loading && pageRows.length === 0 && (
            <EmptyState
              icon={Users}
              title="No users match the selected criteria"
              subtitle="Try adjusting your search terms, role filter, or status filter."
            />
          )}
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            idPrefix="users-pager"
          />
        )}
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
function AmcCell({ user }) {
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
  if (all) return <span className="um-text">All AMCs ({list.length})</span>;
  if (list.length === 1) return <span className="um-text">{list[0]}</span>;
  return (
    <span className="amc-cell" ref={ref}>
      <span className="um-text">{list[0]}</span>{" "}
      <button type="button" className="amc-more" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`amc-more-${user.id}`}>+{list.length - 1} more</button>
      {open && (
        <div className="amc-pop" data-testid={`amc-pop-${user.id}`}>
          <div className="amc-pop-head">{user.name.split(" ")[0]} · {list.length} AMCs</div>
          <ul>{list.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
    </span>
  );
}
