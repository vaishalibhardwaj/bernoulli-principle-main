import React, { useState, useMemo, useEffect } from "react";
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
import { amcLabel, userAmcs, isDormant, daysSince, BIOMETRIC_LIMIT_DAYS, DORMANT_DAYS } from "@/lib/org";

import {
  UserPlus, Search, Download, Shield, Pencil, Send, Power, PowerOff,
  ExternalLink, Users, Bell, X, CheckCircle2, AlertCircle
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

export default function UserManagement() {
  const {
    users,
    actor,
    addUser,
    updateUser,
    deactivateUser,
    requestReactivation,
    runBiometricCheck,
    resendInvite,
    activateOnboardedUser,
    adminNotifications,
    roles,
    perms,
    collections,
  } = useStore();
  const canEdit = hasCap(perms, "users", "edit");
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
  }, [debouncedSearch, roleFilter, moduleFilter, statusFilter, page, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, moduleFilter, statusFilter]);

  // Live counts: users per module and per role (a user can count in several)
  const { moduleCounts, roleCounts } = useMemo(() => {
    const mc = {}; const rc = {};
    users.forEach((u) => {
      const mods = new Set();
      (u.roles || []).forEach((rid) => { rc[rid] = (rc[rid] || 0) + 1; const r = roleById[rid]; if (r) mods.add(r.module); });
      mods.forEach((m) => { mc[m] = (mc[m] || 0) + 1; });
    });
    return { moduleCounts: mc, roleCounts: rc };
  }, [users, roleById]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
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
  }, [users, roleFilter, moduleFilter, statusFilter, debouncedSearch, roleById]);

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

  // Status Chip Renderer
  const renderStatusChip = (status) => {
    switch (status) {
      case "active":
        return <span className="us-pill us-active" data-testid="status-active"><span className="dot" />Active</span>;
      case "invited":
        return <span className="us-pill us-invited" data-testid="status-invited"><span className="dot" />Invited</span>;
      case "invite_expired":
        return <span className="us-pill us-expired" data-testid="status-expired"><span className="dot" />Invite expired</span>;
      case "deactivated":
        return <span className="us-pill us-deactivated" data-testid="status-deactivated"><span className="dot" />Deactivated</span>;
      default:
        return <span className="us-pill us-deactivated">{status}</span>;
    }
  };

  // Role chips: one per role, coloured by module; pending privileged grants shown dashed
  const renderRoles = (u) => (
    <div className="role-chips">
      {(u.roles || []).map((rid) => {
        const r = roleById[rid];
        if (!r) return null;
        return <span key={rid} className="role-chip" style={{ "--mc": MODULE_BY_KEY[r.module]?.color }} title={r.description} data-testid={`role-chip-${rid}`}>{r.name}</span>;
      })}
      {(pendingByUser[u.id] || []).map((rid) => (
        <span key={"p" + rid} className="role-chip pending" title="Awaiting second-admin approval">{roleById[rid]?.name || rid} · pending</span>
      ))}
      {!(u.roles || []).length && !(pendingByUser[u.id] || []).length && <span className="muted">No roles</span>}
    </div>
  );

  const handleResendInvite = (user) => {
    const res = resendInvite(user.id);
    if (res.ok) {
      toast.success(`Fresh invite and temporary password dispatched for ${user.name}`);
      setOnboardingUser(res.user);
    } else {
      toast.error(res.error || "Failed to resend invite");
    }
  };

  const [reactivating, setReactivating] = useState(null);
  const pendingReactivation = useMemo(() => new Set((collections.access_requests || []).filter((r) => r.kind === "reactivate" && r.status === "pending").map((r) => r.userId)), [collections.access_requests]);
  const handleToggleReactivate = (user) => setReactivating(user);
  const runCheck = () => {
    const n = runBiometricCheck();
    toast(n ? `${n} ID${n > 1 ? "s" : ""} disabled: no biometric punch-in for ${BIOMETRIC_LIMIT_DAYS}+ consecutive days.` : `Nobody has crossed ${BIOMETRIC_LIMIT_DAYS} days without a biometric punch-in.`);
  };

  const visibleNotifs = adminNotifications.filter((n) => !dismissedNotifs.includes(n.id));

  return (
    <div className="user-management-page" data-testid="user-management-page">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={24} style={{ color: "#0f766e" }} /> User Management
          </h1>
          <p>One identity layer for every CAMS module. Users hold one or more roles; each role grants screen-level View / Maker / Checker / Export.</p>
        </div>
        <div className="actions">
          {canEdit && <button type="button" className="btn btn-outline" onClick={runCheck} data-testid="btn-biometric-check" title={`Disables IDs with no biometric punch-in for ${BIOMETRIC_LIMIT_DAYS} consecutive days. Policy to be confirmed with the identity management team.`}><Shield size={15} /> Run biometric check</button>}
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
            <UserPlus size={16} /> Add user
          </button>}
        </div>
      </div>

      {/* Admin Broadcast Notification Banners (e.g. Meera added Kiran Das as Operator) */}
      {visibleNotifs.slice(0, 2).map((n) => (
        <div
          key={n.id}
          className="sess-banner info"
          style={{ background: "#f0fdfa", border: "1px solid #99f6e4", color: "#134e4a", marginBottom: 16 }}
          data-testid="admin-notif-banner"
        >
          <span className="ico"><Bell size={18} color="#0f766e" /></span>
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
      <div className="admin-hero">
        <TiltCard className="card orbit-card" max={5}>
          <div className="card-head"><h3>Access by module</h3><span className="muted">Click a module to filter users · node size = users with access</span></div>
          <div className="orbit-wrap">
            <ModuleOrbit total={users.filter((u) => (u.roles || []).length).length} modules={MODULES.map((m) => ({ key: m.key, label: m.label, color: m.color, users: moduleCounts[m.key] || 0 }))} active={moduleFilter === "all" ? null : moduleFilter}
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
          {[
            ["Active users", users.filter((u) => u.status === "active").length, "green"],
            ["Invites pending", users.filter((u) => u.status === "invited" || u.status === "invite_expired").length, "amber"],
            ["Access changes to approve", (collections.access_requests || []).filter((r) => r.status === "pending").length, "blue"],
            [`Not logged in ${DORMANT_DAYS}+ days`, users.filter(isDormant).length, "red", "dormant"],
            ["Auto-deactivated (biometric)", users.filter((u) => u.status === "deactivated" && u.autoDeactivated).length, "amber", "auto_deactivated"],
          ].map(([l, v, t, f]) => (
            <div key={l} className={"ah-tile tone-" + t + (f ? " clickable" : "")} onClick={f ? () => setStatusFilter(f) : undefined} role={f ? "button" : undefined}><span>{l}</span><b className="fx-num"><CountUp value={v} /></b></div>
          ))}
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
                <th style={{ width: 260 }}>Roles</th>
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
                      <td style={{ color: "#334155" }}>{u.designation || "—"}</td>

                      {/* Email */}
                      <td className="tnum" style={{ fontSize: 12 }}>
                        {highlight(u.email, debouncedSearch)}
                      </td>

                      {/* AMC access */}
                      <td style={{ fontSize: 12 }} title={userAmcs(u).join(", ")} data-testid={`amc-${u.id}`}>{amcLabel(u)}</td>

                      {/* Role */}
                      <td>{renderRoles(u)}</td>

                      {/* Status */}
                      <td>
                        {renderStatusChip(u.status)}
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
                          {/* View Onboarding preview for invited / expired */}
                          {canResend && (
                            <button
                              type="button"
                              className="row-icon-btn"
                              title="Preview Onboarding & Invite Email"
                              onClick={() => setOnboardingUser(u)}
                              data-testid={`action-preview-${u.id}`}
                            >
                              <ExternalLink size={15} color="#0f766e" />
                            </button>
                          )}

                          {/* Edit user */}
                          {canEdit && <button
                            type="button"
                            className="row-icon-btn"
                            title="Edit user details"
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
                          {!canEdit ? null : u.status === "deactivated" ? (
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
