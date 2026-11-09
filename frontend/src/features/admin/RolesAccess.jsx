import React from "react";
import { ROLE_DEFAULTS, defaultPerms } from "@/lib/access";
import { useStore } from "@/state/store";
import { Drawer } from "@/components/Drawer";
import { MODULES, MODULE_BY_KEY, SCREENS, CAP_LABELS, hasCap, isPrivileged } from "@/lib/access";
import { timeAgo } from "@/lib/format";
import PermissionMatrix from "./PermissionMatrix";
import { KeyRound, Plus, Pencil, ShieldCheck, Check, X, Users, LayoutGrid, Clock, GitCompareArrows, Settings2, Coins, Send, Repeat, Contact, Headset, ShoppingCart, BarChart3 } from "lucide-react";
import { AvatarStack } from "@/components/au";

const MODULE_ICON = { recon: GitCompareArrows, admin: ShieldCheck, central_setup: Settings2, brokerage: Coins, posting: Send, sip: Repeat, crms: Contact, support: Headset, purchase: ShoppingCart, mis: BarChart3 };
// Strongest capability decides a screen chip's colour.
const TOP_CAP = (caps) => (caps.includes("approve") ? "approve" : caps.includes("edit") ? "edit" : caps.includes("export") ? "export" : "view");
const CAP_WORD = { approve: "approves", edit: "does the work", export: "exports", view: "views" };
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
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><KeyRound size={24} /> Roles & Access</h1>
          <p>Build roles from screen-level permissions for any module. Every role change and every privileged grant needs a second admin.</p>
        </div>
        <div className="actions">
          {canEdit && <button className="btn btn-primary" onClick={openNew} data-testid="btn-new-role"><Plus size={16} /> New role</button>}
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
          <div className="au-bar">
            <div className="au-tabs" role="tablist" aria-label="Module">
              {[{ key: "all", label: "All modules" }, ...MODULES.filter((m) => roles.some((r) => r.module === m.key))].map((m) => (
                <button key={m.key} role="tab" aria-selected={moduleFilter === m.key} className={moduleFilter === m.key ? "on" : ""} onClick={() => setModuleFilter(m.key)}>
                  {m.label} <em>{m.key === "all" ? roles.length : roles.filter((r) => r.module === m.key).length}</em>
                </button>
              ))}
            </div>
            <span className="rc2-legend"><i className="c-approve" /> approves <i className="c-edit" /> does the work <i className="c-export" /> exports <i className="c-view" /> views</span>
          </div>
          <div className="role-grid rc2-grid">
            {roles.filter((r) => moduleFilter === "all" || r.module === moduleFilter).map((r) => <RoleCard key={r.id} r={r} holders={users.filter((u) => (u.roles || []).includes(r.id)).map((u) => u.name)} canEdit={canEdit} onEdit={() => setEditing({ ...r, perms: { ...r.perms }, changeNote: "" })} />)}
          </div>
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
            <label className="toggle-inline"><input type="checkbox" className="cb" checked={Boolean(editing.peer)} onChange={(e) => setEditing({ ...editing, peer: e.target.checked })} data-testid="role-peer" />
              <span><b>Peer team: members check each other</b><br /><span className="muted">Holders can both submit and approve on the same screen. Anyone in the team approves anyone else's work, never their own. Used by the Central Setup Team.</span></span></label>
            <div className="field"><label className="field-label">Screen permissions</label>
              <PermissionMatrix module={editing.module} perms={editing.perms} onChange={(p) => setEditing({ ...editing, perms: p })} /></div>
            {!editing.peer && Object.values(editing.perms).some((c) => c.includes("edit")) && Object.values(editing.perms).some((c) => c.includes("approve")) && (
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

/** One role as a card: who it is for, how many people hold it, and what it can do in plain words. */
function RoleCard({ r, holders, canEdit, onEdit }) {
  const [all, setAll] = React.useState(false);
  const mod = MODULE_BY_KEY[r.module];
  const Icon = MODULE_ICON[r.module] || KeyRound;
  const screens = Object.entries(r.perms).filter(([s, caps]) => SCREENS[s] && caps.length).sort((a, b) => ["approve", "edit", "export", "view"].indexOf(TOP_CAP(a[1])) - ["approve", "edit", "export", "view"].indexOf(TOP_CAP(b[1])));
  const n = (cap) => screens.filter(([, caps]) => caps.includes(cap)).length;
  const shown = all ? screens : screens.slice(0, 8);
  return (
    <div className="card role-tile rc2" style={{ "--b": mod?.color, "--mc": mod?.color }} data-testid={"role-" + r.id}>
      <div className="rc2-top">
        <span className="au-badge"><Icon size={18} /></span>
        <span className="rc2-name"><b>{r.name}</b><em>{mod?.label}{isPrivileged(r) && <span className="rc2-priv">Privileged</span>}{r.simple && <span className="rc2-priv soft">Simple view</span>}</em></span>
        {canEdit && r.status === "active" && <button type="button" className="au-arrow" onClick={onEdit} title="Edit role" aria-label={`Edit ${r.name}`} data-testid={"edit-role-" + r.id}><Pencil size={16} /></button>}
      </div>
      {r.status !== "active" && <span className={"au-st " + (r.status === "pending" ? "pending" : "rejected")}>{r.status === "pending" ? "Pending approval" : "Rejected"}</span>}
      <div className="rc2-users">
        <b>{holders.length}</b><span>{holders.length === 1 ? "person" : "people"}</span>
        <AvatarStack names={holders} />
      </div>
      <p className="rc2-desc" title={r.description}>{r.description}</p>
      <div className="rc2-sum">
        <span><b>{screens.length}</b> screens</span>
        {n("edit") > 0 && <span><i className="c-edit" /><b>{n("edit")}</b> does the work</span>}
        {n("approve") > 0 && <span><i className="c-approve" /><b>{n("approve")}</b> approves</span>}
      </div>
      <div className="rc2-caps">
        {shown.map(([s, caps]) => (
          <span key={s} className={"rc2-cap c-" + TOP_CAP(caps)} title={`${SCREENS[s].label}: ${CAP_WORD[TOP_CAP(caps)]}${caps.includes("export") && TOP_CAP(caps) !== "export" ? ", exports" : ""}`}>
            <i />{SCREENS[s].label}
          </span>
        ))}
        {screens.length > 8 && <button type="button" className="rc2-more" onClick={() => setAll((a) => !a)}>{all ? "Show less" : `+${screens.length - 8} more`}</button>}
      </div>
    </div>
  );
}
