import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "@/state/store";
import { MODULES, MODULE_BY_KEY, hasCap } from "@/lib/access";
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
  Users, X, Building2, CalendarDays
} from "lucide-react";
import { toast } from "sonner";

// Three ID statuses plus one common "Inactive" flag for active IDs that have gone quiet.
const STATUS_FILTERS = [
  { key: "all", label: "All statuses" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "invited", label: "Invited" },
  { key: "deactivated", label: "Deactivated" },
];
/** Common inactivity status: no login for 10+ days, or no biometric punch-in for 7+ days. */
const isInactive = (u) => u.status === "active" && (isDormant(u) || (u.lastBiometric && daysSince(u.lastBiometric) >= 7));

const isoDay = (d) => d.toISOString().slice(0, 10);
const STATUS_TEXT = { active: "Active", invited: "Invited", invite_expired: "Invited", deactivated: "Deactivated" };

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
      if (statusFilter === "inactive") { if (!isInactive(u)) return false; }
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

  // Roles as plain text, grouped by module so it's always clear which module a role belongs to
  const renderRoles = (u) => {
    const byMod = {};
    (u.roles || []).forEach((rid) => { const r = roleById[rid]; if (r) (byMod[r.module] = byMod[r.module] || []).push(r.name.replace(/^(Recon|Brokerage|Posting|SIP|CRMS|Support|Purchase|MIS) · /, "")); });
    (pendingByUser[u.id] || []).forEach((rid) => { const r = roleById[rid]; if (r) (byMod[r.module] = byMod[r.module] || []).push(`${r.name.replace(/^(Recon|Brokerage|Posting|SIP|CRMS|Support|Purchase|MIS) · /, "")} (pending approval)`); });
    const mods = MODULES.filter((m) => byMod[m.key]);
    if (!mods.length) return <span className="muted">No roles</span>;
    return <span className="um-text" data-testid={`roles-${u.id}`}>{mods.map((m) => <span key={m.key} className="um-role-line"><b>{m.short || m.label}:</b> {byMod[m.key].join(", ")}</span>)}</span>;
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


  return (
    <div className="user-management-page" data-testid="user-management-page">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={24} style={{ color: "#0f766e" }} /> User Management
          </h1>
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


      {/* Admin command view: modules orbit the CAMS core (click a node to filter) + access health */}
      <div className="um-scope" data-testid="um-scope">
        <div className="um-scope-bar">
          <Building2 size={14} />
          <select className="um-scope-sel" value={amcFilter} onChange={(e) => setAmcFilter(e.target.value)} data-testid="scope-amc" aria-label="AMC">
            <option value="all">All AMCs</option>
            {AMCS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="um-scope-div" />
          <CalendarDays size={14} />
          <input className="um-scope-date tnum" type="date" value={fromDate} max={toDate} onChange={(e) => e.target.value && setFromDate(e.target.value)} data-testid="scope-from" aria-label="From date" />
          <span className="muted">to</span>
          <input className="um-scope-date tnum" type="date" value={toDate} min={fromDate} max={today} onChange={(e) => e.target.value && setToDate(e.target.value)} data-testid="scope-to" aria-label="To date" />
          {scopeChanged && <button type="button" className="um-scope-reset" onClick={() => { setAmcFilter("all"); setFromDate(today); setToDate(today); }} data-testid="scope-reset" aria-label="Reset filters"><X size={13} /></button>}
        </div>
      </div>

      <div className="admin-hero">
        <TiltCard className="card orbit-card" max={5}>
          <div className="card-head"><h3>Access by module</h3></div>
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
            const deact = scoped.filter((u) => u.status === "deactivated");
            return [
              ["All users", scoped.length, "blue", "all", "total"],
              ["Active", active.length, "green", "active", "active"],
              ["Inactive", active.filter(isInactive).length, "amber", "inactive", "inactive", `No login for ${DORMANT_DAYS}+ days or no biometric punch-in for 7+ days`],
              ["Deactivated", deact.length, "red", "deactivated", "deactivated"],
            ].map(([l, v, t, f, id, tip]) => (
              <div key={l} className={"ah-tile clickable tone-" + t + (statusFilter === f ? " on" : "")} onClick={() => setStatusFilter(f)} role="button" title={tip} data-testid={`tile-${id}`}>
                <span>{l}</span><b className="fx-num"><CountUp value={v} /></b>
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

          {/* Module, then the roles of that module only */}
          <div className="field" style={{ minWidth: 170 }}>
            <select className="select" value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setRoleFilter("all"); }} data-testid="filter-module-select" aria-label="Module">
              <option value="all">All modules</option>
              {MODULES.map((m) => <option key={m.key} value={m.key}>{m.label} ({moduleCounts[m.key] || 0})</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 190 }}>
            <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} disabled={moduleFilter === "all"} title={moduleFilter === "all" ? "Pick a module first" : undefined} data-testid="filter-role-select" aria-label="Role">
              <option value="all">{moduleFilter === "all" ? "Role — pick a module first" : `All ${MODULE_BY_KEY[moduleFilter]?.label} roles`}</option>
              {moduleFilter !== "all" && roles.filter((r) => r.module === moduleFilter && r.status === "active").map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({roleCounts[r.id] || 0})</option>
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
                        {isInactive(u) && <div className="um-sub amber">Inactive · {isDormant(u) ? `no login ${u.lastLogin ? daysSince(u.lastLogin) : daysSince(u.createdAt)} days` : `no punch-in ${daysSince(u.lastBiometric)} days`}</div>}
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
