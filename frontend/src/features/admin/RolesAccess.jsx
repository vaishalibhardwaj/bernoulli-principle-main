import React from "react";
import { ROLE_DEFAULTS, defaultPerms } from "@/lib/access";
import { useStore } from "@/state/store";
import { Drawer } from "@/components/Drawer";
import { MODULES, MODULE_BY_KEY, SCREENS, CAP_LABELS, hasCap, isPrivileged } from "@/lib/access";
import { timeAgo } from "@/lib/format";
import PermissionMatrix from "./PermissionMatrix";
import { KeyRound, Plus, Pencil, ShieldCheck, Check, X, Users, LayoutGrid, Clock } from "lucide-react";
import { toast } from "sonner";
import "./userManagement.css";

const TABS = [
  { key: "roles", label: "Roles", icon: KeyRound },
  { key: "approvals", label: "Access approvals", icon: ShieldCheck },
  { key: "catalogue", label: "Screen catalogue", icon: LayoutGrid },
];

function diffPerms(before = {}, after = {}) {
  const out = [];
  new Set([...Object.keys(before), ...Object.keys(after)]).forEach((s) => {
    const b = new Set(before[s] || []); const a = new Set(after[s] || []);
    a.forEach((c) => !b.has(c) && out.push({ screen: SCREENS[s]?.label || s, cap: CAP_LABELS[c], added: true }));
    b.forEach((c) => !a.has(c) && out.push({ screen: SCREENS[s]?.label || s, cap: CAP_LABELS[c], added: false }));
  });
  return out;
}

export default function RolesAccess() {
  const { roles, users, perms, collections, submitRole, decideAccess, personaUser } = useStore();
  const [tab, setTab] = React.useState(hasCap(perms, "roles", "approve") ? "approvals" : "roles");
  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [editing, setEditing] = React.useState(null);
  const [comment, setComment] = React.useState({});
  const canEdit = hasCap(perms, "roles", "edit");
  const canApprove = hasCap(perms, "roles", "approve");

  const requests = (collections.access_requests || []).slice().sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  const pending = requests.filter((r) => r.status === "pending");
  const userCount = (rid) => users.filter((u) => (u.roles || []).includes(rid)).length;
  const roleById = Object.fromEntries(roles.map((r) => [r.id, r]));

  const openNew = () => setEditing({ id: null, name: "", module: "recon", description: "", perms: { command: ["view"] }, changeNote: "" });
  const save = () => {
    if (editing.name.trim().length < 3) { toast.error("Give the role a name (3+ characters)"); return; }
    if (!Object.keys(editing.perms).length) { toast.error("Grant at least one screen"); return; }
    const res = submitRole({ ...editing, name: editing.name.trim() });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Role sent to a second admin for approval");
    setEditing(null);
  };
  const decide = (req, yes) => {
    const c = (comment[req.id] || "").trim();
    if (!yes && c.length < 10) { toast.error("Rejection needs a comment of at least 10 characters"); return; }
    const res = decideAccess(req.id, yes, c);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(yes ? "Access change approved and applied" : "Access change rejected");
  };

  const describe = (req) => {
    if (req.kind === "reactivate") {
      const u = users.find((x) => x.id === req.userId);
      return { title: `Reactivate ${u?.name || req.userId}${u?.autoDeactivated ? " (auto-deactivated, biometric)" : ""}`, sub: `${req.note}${req.biometricConfirmed ? " · biometric punch-in confirmed" : ""}`, changes: [] };
    }
    if (req.kind === "assign") {
      const u = users.find((x) => x.id === req.userId);
      return { title: `Grant ${req.roleIds.map((r) => roleById[r]?.name || r).join(", ")} to ${u?.name || req.userId}`, sub: req.note, changes: [] };
    }
    const base = roleById[req.roleId];
    return {
      title: `${req.kind === "role_new" ? "New role" : "Edit role"}: ${req.draft.name}`,
      sub: `${MODULE_BY_KEY[req.draft.module]?.label}${req.note ? " · " + req.note : ""}`,
      changes: diffPerms(req.kind === "role_new" ? {} : base?.perms, req.draft.perms),
      affected: req.kind === "role_edit" ? userCount(req.roleId) : 0,
    };
  };

  return (
    <div data-testid="roles-access">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><KeyRound size={24} style={{ color: "#0f766e" }} /> Roles & Access</h1>
          <p>Build roles from screen-level permissions for any module. Every role change and every privileged grant needs a second admin.</p>
        </div>
        <div className="actions">
          {canEdit && <button className="btn btn-primary" style={{ background: "#0f766e", borderColor: "#0f766e" }} onClick={openNew} data-testid="btn-new-role"><Plus size={16} /> New role</button>}
        </div>
      </div>

      <div className="segmented tabs-row" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)} data-testid={"tab-" + t.key}>
            <t.icon size={14} /> {t.label}{t.key === "approvals" && pending.length > 0 && <span className="count-badge">{pending.length}</span>}
          </button>
        ))}
      </div>

      {tab === "roles" && (
        <>
          <div className="chip-row" style={{ marginBottom: 14 }}>
            {[{ key: "all", label: "All modules" }, ...MODULES].map((m) => (
              <button key={m.key} className={"filter-chip" + (moduleFilter === m.key ? " on" : "")} onClick={() => setModuleFilter(m.key)}>{m.label}</button>
            ))}
          </div>
          <div className="role-grid">
            {roles.filter((r) => moduleFilter === "all" || r.module === moduleFilter).map((r) => (
              <div key={r.id} className="card role-tile" style={{ "--mc": MODULE_BY_KEY[r.module]?.color }} data-testid={"role-" + r.id}>
                <div className="rt-head">
                  <span className="rt-module">{MODULE_BY_KEY[r.module]?.label}</span>
                  {r.status !== "active" && <span className={"pill " + (r.status === "pending" ? "pill-pending" : "pill-rejected")}><span className="dot" />{r.status === "pending" ? "Pending approval" : "Rejected"}</span>}
                  {isPrivileged(r) && <span className="priv-tag">privileged</span>}
                  {r.simple && <span className="simple-tag">simple view</span>}
                </div>
                <h3>{r.name}</h3>
                <p className="muted">{r.description}</p>
                <div className="rt-caps">
                  {Object.entries(r.perms).map(([s, caps]) => (
                    <span key={s} className="rt-cap" title={caps.map((c) => CAP_LABELS[c]).join(", ")}>{SCREENS[s]?.label}<em>{caps.filter((c) => c !== "view").map((c) => CAP_LABELS[c][0]).join("") || "V"}</em></span>
                  ))}
                </div>
                <div className="rt-foot">
                  <span className="muted"><Users size={12} /> {userCount(r.id)} users</span>
                  {canEdit && r.status === "active" && <button className="btn btn-outline btn-sm" onClick={() => setEditing({ ...r, perms: { ...r.perms }, changeNote: "" })} data-testid={"edit-role-" + r.id}><Pencil size={13} /> Edit</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 10 }}>Capability letters: M = Maker, C = Checker, E = Export, V = View only.</div>
        </>
      )}

      {tab === "approvals" && (
        <div className="card">
          <div className="card-head"><h3>Access changes awaiting a second admin</h3><span className="muted">{canApprove ? "You can approve requests raised by other admins" : "Read-only — you don't have the Checker capability on Roles & Access"}</span></div>
          {requests.length === 0 && <div className="card-pad muted">No access requests.</div>}
          {requests.map((req) => {
            const d = describe(req);
            const own = req.requestedBy === personaUser.name;
            return (
              <div key={req.id} className={"acr-row " + req.status} data-testid={"acr-" + req.id}>
                <div className="acr-main">
                  <div className="acr-title">{d.title}</div>
                  <div className="muted">{d.sub}</div>
                  <div className="muted"><Clock size={11} /> Requested by {req.requestedBy} · {timeAgo(req.requestedAt)}{d.affected ? ` · affects ${d.affected} users immediately on approval` : ""}</div>
                  {d.changes.length > 0 && (
                    <div className="acr-diff">
                      {d.changes.map((c, i) => <span key={i} className={c.added ? "add" : "rem"}>{c.added ? "+" : "−"} {c.screen}: {c.cap}</span>)}
                    </div>
                  )}
                </div>
                {req.status === "pending" ? (
                  canApprove && !own ? (
                    <div className="acr-actions">
                      <input className="input" placeholder="Comment (required to reject)" value={comment[req.id] || ""} onChange={(e) => setComment((c) => ({ ...c, [req.id]: e.target.value }))} />
                      <button className="btn btn-outline btn-sm" onClick={() => decide(req, false)} data-testid={"reject-" + req.id}><X size={13} /> Reject</button>
                      <button className="btn btn-success btn-sm" onClick={() => decide(req, true)} data-testid={"approve-" + req.id}><Check size={13} /> Approve</button>
                    </div>
                  ) : <span className="pill pill-pending"><span className="dot" />{own ? "Your request — another admin must approve" : "Pending"}</span>
                ) : <span className={"pill " + (req.status === "approved" ? "pill-active" : "pill-rejected")}><span className="dot" />{req.status === "approved" ? `Approved by ${req.decidedBy}` : `Rejected by ${req.decidedBy}`}</span>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "catalogue" && (
        <div className="catalogue">
          {MODULES.map((m) => (
            <div key={m.key} className="card" style={{ "--mc": m.color }}>
              <div className="card-head"><h3><i className="mod-dot" />{m.label}</h3><span className="muted">{m.screens.length} screens · new modules register their screens here; no user-management code changes</span></div>
              <table className="grid">
                <thead><tr><th>Screen</th><th>Capabilities offered</th><th>Granted by roles</th></tr></thead>
                <tbody>
                  {m.screens.map((s) => (
                    <tr key={s.key}>
                      <td><b>{s.label}</b>{s.phase && <span className={"phase-tag " + s.phase.toLowerCase()}>{s.phase}</span>}</td>
                      <td>{s.caps.map((c) => CAP_LABELS[c]).join(" · ")}</td>
                      <td>{roles.filter((r) => r.status === "active" && r.perms[s.key]).map((r) => r.name).join(", ") || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Drawer id="role-builder" title={editing.id ? `Edit role — ${editing.name}` : "New role"} subtitle="Tick what this role can do on each screen. Saving sends it to a second admin; nothing changes until approved." onClose={() => setEditing(null)}
          footer={<div style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
            <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} data-testid="role-submit"><ShieldCheck size={15} /> Submit for approval</button>
          </div>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field"><label className="field-label">Role name</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Recon · Exceptions Maker (HDFC desk)" data-testid="role-name" /></div>
            <div className="field"><label className="field-label">Module</label>
              <select className="select" value={editing.module} disabled={Boolean(editing.id)} onChange={(e) => setEditing({ ...editing, module: e.target.value, perms: {} })} data-testid="role-module">
                {MODULES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select></div>
            <div className="field"><label className="field-label">Start from default menus</label>
              <div className="chip-row" data-testid="role-defaults">
                {Object.entries(ROLE_DEFAULTS).map(([k, d]) => <button type="button" key={k} className="filter-chip" onClick={() => setEditing({ ...editing, perms: defaultPerms(editing.module, k) })} data-testid={"role-default-" + k}>{d.label}</button>)}
              </div>
              <span className="muted" style={{ fontSize: 12 }}>Fills every screen of this module with the usual rights for that role type. Then tick or untick screens below to adjust it.</span></div>
            <div className="field"><label className="field-label">Description</label>
              <input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="What is this role for?" /></div>
            <label className="toggle-inline"><input type="checkbox" className="cb" checked={Boolean(editing.simple)} onChange={(e) => setEditing({ ...editing, simple: e.target.checked })} data-testid="role-simple" />
              <span><b>Daily user: simple view</b><br /><span className="muted">Plain words, one "My Work" queue, no charts or percentages. Use for people who work the daily queue.</span></span></label>
            <div className="field"><label className="field-label">Screen permissions</label>
              <PermissionMatrix module={editing.module} perms={editing.perms} onChange={(p) => setEditing({ ...editing, perms: p })} /></div>
            {Object.values(editing.perms).some((c) => c.includes("edit")) && Object.values(editing.perms).some((c) => c.includes("approve")) && (
              <div className="note warn"><div>This role mixes Maker and Checker rights. That's allowed on <i>different</i> screens, but a user will be blocked if any combination of their roles gives both on the <i>same</i> screen.</div></div>
            )}
            {editing.id && <div className="field"><label className="field-label">Reason for change</label>
              <input className="input" value={editing.changeNote} onChange={(e) => setEditing({ ...editing, changeNote: e.target.value })} placeholder="Shown to the approving admin" /></div>}
            {editing.id && <div className="muted">Affects {userCount(editing.id)} users as soon as it is approved.</div>}
          </div>
        </Drawer>
      )}
    </div>
  );
}
