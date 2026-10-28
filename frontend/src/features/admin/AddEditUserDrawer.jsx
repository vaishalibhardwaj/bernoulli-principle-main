import React, { useState, useEffect } from "react";
import { AMCS } from "@/lib/org";
import { Drawer } from "@/components/Drawer";
import { MODULE_BY_KEY, isPrivileged } from "@/lib/access";
import { idmDirectory, IDM_SYNCED_AT } from "@/mock/directory";
import { formatDateTime } from "@/lib/format";
import PermissionMatrix from "./PermissionMatrix";
import { Info, ShieldAlert, Check, Search, X, Copy, UserCheck } from "lucide-react";
import { toast } from "sonner";

/** Functionalities an admin assigns access for; each maps to platform modules whose roles it offers. */
const FUNCTIONALITIES = [
  { key: "recon", label: "Recon", modules: ["recon"] },
  { key: "brokerage", label: "Brokerage", modules: ["brokerage"] },
  { key: "operations", label: "Operations", modules: ["posting", "purchase", "sip", "crms", "support"] },
  { key: "common", label: "Common", modules: ["admin", "mis"] },
];
const funcOfModule = (m) => FUNCTIONALITIES.find((f) => f.modules.includes(m))?.key;

/**
 * Recon roles that can't be held together. PROVISIONAL — Arun to confirm the full list of Recon roles and pairs.
 * [roleA, roleB, why]
 */
const RECON_CONFLICTS = [
  ["role_recon_setup_maker", "role_recon_checker", "a maker can't approve the setups they create"],
  ["role_recon_ops_maker", "role_recon_checker", "a maker can't approve their own daily work"],
  ["role_functional_manager", "role_recon_setup_maker", "a functional manager approves work, so can't also be a maker"],
  ["role_functional_manager", "role_recon_ops_maker", "a functional manager approves work, so can't also be a maker"],
  ["role_recon_auditor", "role_recon_setup_maker", "an auditor reviews the work, so can't also do it"],
  ["role_recon_auditor", "role_recon_ops_maker", "an auditor reviews the work, so can't also do it"],
  ["role_recon_auditor", "role_recon_checker", "an auditor reviews approvals, so can't also approve"],
];

const EMPTY = { name: "", empNo: "", phone: "", email: "", designation: "", roles: [], amcs: ["ALL"], funcs: [] };

/**
 * Assign Roles. The person always comes from the IDM directory (search, then pick) — never typed in.
 * Then: copy roles from someone similar (optional), pick functionalities, pick roles per functionality, set AMC access.
 */
export default function AddEditUserDrawer({ isOpen, onClose, editingUser, allUsers, actor, onSaveUser, onOpenInviteEmail, roles = [] }) {
  const [form, setForm] = useState(EMPTY);
  const [target, setTarget] = useState(null); // existing platform user being changed, if any
  const [q, setQ] = useState("");
  const [copyFrom, setCopyFrom] = useState("");

  const fill = (u) => ({
    name: u.name || "", empNo: u.empNo || "", phone: u.phone || "", email: u.email || "", designation: u.designation || "",
    roles: u.roles || [], amcs: u.amcs || ["ALL"],
    funcs: [...new Set((u.roles || []).map((rid) => funcOfModule(roles.find((r) => r.id === rid)?.module)).filter(Boolean))],
  });

  useEffect(() => {
    setQ(""); setCopyFrom("");
    if (editingUser) { setForm(fill(editingUser)); setTarget(editingUser); } else { setForm(EMPTY); setTarget(null); }
  }, [editingUser, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const picked = Boolean(form.empNo);
  const isSelf = Boolean(target) && target.id === actor.id;
  const directory = idmDirectory(allUsers);
  const needle = q.trim().toLowerCase();
  const results = needle.length < 2 ? [] : directory.filter((p) => p.name.toLowerCase().includes(needle) || p.empNo.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle)).slice(0, 8);

  const pickPerson = (p) => {
    const existing = allUsers.find((u) => u.empNo.toUpperCase() === p.empNo.toUpperCase());
    setTarget(existing || null);
    setForm(existing ? fill(existing) : { ...EMPTY, name: p.name, empNo: p.empNo, phone: p.phone, email: p.email, designation: p.designation });
    setQ("");
    if (existing) toast(`${p.name} already has access — you're changing their roles.`);
  };

  const copyRoles = (uid) => {
    const src = allUsers.find((u) => u.id === uid);
    if (!src) return;
    const f = fill(src);
    setForm((cur) => ({ ...cur, roles: f.roles, amcs: f.amcs, funcs: f.funcs }));
    setCopyFrom("");
    toast.success(`Copied ${f.roles.length} role(s) and AMC access from ${src.name}. Review before saving.`);
  };

  const roleById = Object.fromEntries(roles.map((r) => [r.id, r]));
  const toggleFunc = (k) => setForm((f) => {
    const on = f.funcs.includes(k);
    const mods = FUNCTIONALITIES.find((x) => x.key === k).modules;
    // Turning a functionality off also drops its roles, so nothing hidden stays assigned.
    return { ...f, funcs: on ? f.funcs.filter((x) => x !== k) : [...f.funcs, k], roles: on ? f.roles.filter((rid) => !mods.includes(roleById[rid]?.module)) : f.roles };
  });
  const addRole = (rid) => rid && setForm((f) => (f.roles.includes(rid) ? f : { ...f, roles: [...f.roles, rid] }));
  const removeRole = (rid) => setForm((f) => ({ ...f, roles: f.roles.filter((x) => x !== rid) }));

  // Recon-only role-conflict validation.
  const conflicts = RECON_CONFLICTS.filter(([a, b]) => form.roles.includes(a) && form.roles.includes(b))
    .map(([a, b, why]) => `${form.name || "This person"} can't be both ${roleById[a]?.name || a} and ${roleById[b]?.name || b} — ${why}.`);
  const before = target?.roles || [];
  const privilegedAdds = form.roles.filter((r) => !before.includes(r) && isPrivileged(roleById[r]));

  const effective = {};
  form.roles.forEach((rid) => {
    const r = roleById[rid];
    if (!r) return;
    effective[r.module] = effective[r.module] || {};
    Object.entries(r.perms).forEach(([sk, caps]) => { effective[r.module][sk] = Array.from(new Set([...(effective[r.module][sk] || []), ...caps])); });
  });

  const save = () => {
    if (!picked) { toast.error("Search for the person first"); return; }
    if (!form.roles.length) { toast.error("Pick at least one role"); return; }
    if (conflicts.length) { toast.error(conflicts[0]); return; }
    const res = onSaveUser({ name: form.name, empNo: form.empNo, phone: form.phone, email: form.email, designation: form.designation, roles: form.roles, amcs: form.amcs }, target?.id);
    if (!res.ok) { toast.error(res.error || "Couldn't save"); return; }
    toast.success(target ? `Roles updated for ${form.name}.` : `Roles assigned to ${form.name}. Invite sent.`);
    onClose();
    if (!target && onOpenInviteEmail && res.user) onOpenInviteEmail(res.user);
  };

  return (
    <Drawer id="add-edit-user-drawer" title={target ? `Assign Roles — ${form.name}` : "Assign Roles"}
      subtitle={target ? "Change what this person can access. Checker and admin roles wait for a second admin." : "Find the person, then choose what they can access. Checker and admin roles wait for a second admin."}
      onClose={onClose}
      footer={<div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
        <button type="button" className="btn btn-outline" onClick={onClose} data-testid="drawer-cancel">Cancel</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!picked || conflicts.length > 0 || isSelf} data-testid="drawer-save-user"><Check size={16} /> {target ? "Save roles" : "Assign roles and send invite"}</button>
      </div>}>
      <div className="ar" data-testid="assign-roles">
        {isSelf && <div className="note warn" data-testid="self-edit-note"><ShieldAlert size={16} /><div>You can't change your own roles. Another admin has to do it.</div></div>}

        {/* 1 — Person, from the IDM directory */}
        {!editingUser && (
          <div className="field">
            <label className="field-label">Person <span className="muted" style={{ fontWeight: 500 }}>— from ID management (synced {formatDateTime(IDM_SYNCED_AT).split(", ")[1]}, active people only)</span></label>
            <div className="search ar-search"><Search /><input className="input" autoFocus placeholder="Name, employee number or work email" value={q} onChange={(e) => setQ(e.target.value)} data-testid="idm-search" /></div>
            {results.length > 0 && (
              <div className="ar-results" data-testid="idm-results">
                {results.map((p) => {
                  const has = allUsers.some((u) => u.empNo.toUpperCase() === p.empNo.toUpperCase());
                  return (
                    <button type="button" key={p.empNo} className="ar-result" onClick={() => pickPerson(p)} data-testid={"idm-" + p.empNo}>
                      <b>{p.name}</b><span className="tnum">{p.empNo}</span><span>{p.email}</span>{has && <em>has access</em>}
                    </button>
                  );
                })}
              </div>
            )}
            {needle.length >= 2 && results.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>No active person matches “{q}” in ID management.</span>}
          </div>
        )}

        {picked && (<>
          <div className="ar-person" data-testid="person-labels">
            {[["Name", form.name], ["Employee no.", form.empNo], ["Work email", form.email], ["Mobile", form.phone], ["Designation", form.designation]].map(([k, v]) => (
              <div key={k}><span>{k}:</span> <b>{v || "—"}</b></div>
            ))}
            {!editingUser && <button type="button" className="link" onClick={() => { setForm(EMPTY); setTarget(null); }}>Change person</button>}
          </div>

          {/* 2 — Shortcut: start from someone similar (sits below Designation) */}
          {!isSelf && (
            <div className="ar-copy" data-testid="copy-roles">
              <Copy size={14} />
              <span>Start from someone similar:</span>
              <select className="select" value={copyFrom} onChange={(e) => copyRoles(e.target.value)} data-testid="copy-from">
                <option value="">Copy roles from another user…</option>
                {allUsers.filter((u) => u.status === "active" && u.empNo !== form.empNo && (u.roles || []).length).slice(0, 60).map((u) => <option key={u.id} value={u.id}>{u.name} — {(u.roles || []).map((r) => roleById[r]?.name).filter(Boolean).join(", ")}</option>)}
              </select>
            </div>
          )}

          {/* 3 — Functionalities, then roles per functionality */}
          <div className="field">
            <label className="field-label">Select functionality <span className="muted" style={{ fontWeight: 500 }}>— pick one or more</span></label>
            <div className="chip-row" data-testid="func-picker">
              {FUNCTIONALITIES.map((f) => <button type="button" key={f.key} disabled={isSelf} className={"filter-chip" + (form.funcs.includes(f.key) ? " on" : "")} onClick={() => toggleFunc(f.key)} data-testid={"func-" + f.key}>{f.label}</button>)}
            </div>
          </div>

          {FUNCTIONALITIES.filter((f) => form.funcs.includes(f.key)).map((f) => {
            const available = roles.filter((r) => f.modules.includes(r.module) && r.status === "active");
            const chosen = form.roles.filter((rid) => f.modules.includes(roleById[rid]?.module));
            return (
              <div key={f.key} className="ar-func" data-testid={"roles-" + f.key}>
                <div className="ar-func-h"><b>{f.label} roles</b></div>
                <select className="select" value="" disabled={isSelf} onChange={(e) => addRole(e.target.value)} data-testid={"role-select-" + f.key}>
                  <option value="">Add a {f.label} role…</option>
                  {available.filter((r) => !chosen.includes(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}{isPrivileged(r) ? " (needs 2nd admin)" : ""}</option>)}
                </select>
                <div className="ar-chosen">
                  {chosen.length === 0 && <span className="muted">No {f.label} role yet.</span>}
                  {chosen.map((rid) => (
                    <span key={rid} className="ar-role" title={roleById[rid]?.description}>{roleById[rid]?.name}{!isSelf && <button type="button" onClick={() => removeRole(rid)} aria-label={`Remove ${roleById[rid]?.name}`}><X size={12} /></button>}</span>
                  ))}
                </div>
                {f.key === "recon" && conflicts.map((c) => <div key={c} className="field-error ar-conflict" data-testid="role-conflict"><ShieldAlert size={13} /> {c}</div>)}
              </div>
            );
          })}

          {privilegedAdds.length > 0 && conflicts.length === 0 && (
            <div className="note" data-testid="priv-note"><Info size={16} /><div>{privilegedAdds.map((r) => roleById[r]?.name).join(", ")} {privilegedAdds.length === 1 ? "gives" : "give"} checker/admin rights and will wait for a <b>second admin</b> in Roles & Access. Other roles apply right away.</div></div>
          )}

          {/* 4 — AMC access */}
          <div className="field" data-testid="user-amcs">
            <label className="field-label">AMC access <span className="muted" style={{ fontWeight: 500 }}>— which AMCs' records this person works on</span></label>
            <div className="chip-row">
              <button type="button" className={"filter-chip" + (form.amcs.includes("ALL") ? " on" : "")} onClick={() => setForm((f) => ({ ...f, amcs: ["ALL"] }))} data-testid="amc-all">All AMCs</button>
              {AMCS.map((a) => {
                const on = !form.amcs.includes("ALL") && form.amcs.includes(a);
                return <button type="button" key={a} className={"filter-chip" + (on ? " on" : "")} data-testid={"amc-pick-" + a.split(" ")[0]}
                  onClick={() => setForm((f) => { const cur = f.amcs.includes("ALL") ? [] : f.amcs; const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]; return { ...f, amcs: next.length ? next : ["ALL"] }; })}>{a}</button>;
              })}
            </div>
          </div>

          {Object.keys(effective).length > 0 && (
            <details className="ar-effective" data-testid="effective-access">
              <summary><UserCheck size={14} /> What {form.name.split(" ")[0]} will be able to see and do</summary>
              {Object.entries(effective).map(([mk, p]) => (
                <div key={mk} style={{ marginTop: 8 }}>
                  <div className="rp-title" style={{ "--mc": MODULE_BY_KEY[mk].color }}><i />{MODULE_BY_KEY[mk].label}</div>
                  <PermissionMatrix module={mk} perms={p} readOnly compact />
                </div>
              ))}
            </details>
          )}
        </>)}
      </div>
    </Drawer>
  );
}
