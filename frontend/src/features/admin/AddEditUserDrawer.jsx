import React, { useState, useEffect } from "react";
import { AMCS, CYCLE_STEPS } from "@/lib/org";
import { Drawer } from "@/components/Drawer";
import { COMPANY_DOMAIN } from "@/lib/rbac";
import { MODULES, MODULE_BY_KEY, isPrivileged, sodConflicts } from "@/lib/access";
import PermissionMatrix from "./PermissionMatrix";
import { validateUser } from "@/lib/credentials";
import { Sparkles, Info, ShieldAlert, Check } from "lucide-react";
import { toast } from "sonner";

// Preset sample records for instant testing
const SAMPLE_PRESETS = {
  operator: {
    label: "Ops Maker",
    name: "Aakash Patel",
    empNo: "EMP-2088",
    phone: "+91 98765 43210",
    email: "aakash.patel@camsonline.com",
    designation: "Reconciliation Specialist",
    roles: ["role_recon_ops_maker"],
  },
  authoriser: {
    label: "Recon Checker",
    name: "Sunita Nambiar",
    empNo: "EMP-3019",
    phone: "+91 98111 22334",
    email: "sunita.nambiar@camsonline.com",
    designation: "Recon Operations Lead",
    roles: ["role_recon_checker"],
  },
  viewer: {
    label: "Auditor + Posting viewer",
    name: "Vikram Chandra",
    empNo: "EMP-4105",
    phone: "+91 98333 44556",
    email: "vikram.chandra@camsonline.com",
    designation: "Internal Audit Executive",
    roles: ["role_recon_auditor", "role_pst_viewer"],
  },
  admin: {
    label: "Platform Admin",
    name: "Tanvi Deshmukh",
    empNo: "EMP-1008",
    phone: "+91 98444 55667",
    email: "tanvi.deshmukh@camsonline.com",
    designation: "Systems & Security Admin",
    roles: ["role_platform_admin"],
  },
};

export default function AddEditUserDrawer({
  isOpen,
  onClose,
  editingUser,
  allUsers,
  actor,
  onSaveUser,
  onOpenInviteEmail,
  roles = [],
}) {
  const isEditing = Boolean(editingUser);
  const isSelf = isEditing && editingUser.id === actor.id;

  const [form, setForm] = useState({
    name: "",
    empNo: "",
    phone: "",
    email: "",
    designation: "",
    roles: [],
    amcs: ["ALL"],
    workflowSteps: [],
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (editingUser) {
      setForm({
        name: editingUser.name || "",
        empNo: editingUser.empNo || "",
        phone: editingUser.phone || "",
        email: editingUser.email || "",
        designation: editingUser.designation || "",
        roles: editingUser.roles || [],
        amcs: editingUser.amcs || ["ALL"],
        workflowSteps: editingUser.workflowSteps || [],
      });
      setErrors({});
      setTouched({});
    } else {
      setForm({
        name: "",
        empNo: "",
        phone: "",
        email: "",
        designation: "",
        roles: [],
        amcs: ["ALL"],
        workflowSteps: [],
      });
      setErrors({});
      setTouched({});
    }
  }, [editingUser, isOpen]);

  if (!isOpen) return null;

  // Single field click-to-populate helper
  const handleFieldClickOrFocus = (fieldName) => {
    // Only auto-fill if the field is currently blank
    if (!form[fieldName] || form[fieldName].trim() === "") {
      const preset = SAMPLE_PRESETS.operator;
      setForm((prev) => ({
        ...prev,
        [fieldName]: preset[fieldName],
      }));
      setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    }
  };

  // Preset button click (fills the entire form)
  const applyPreset = (presetKey) => {
    const preset = SAMPLE_PRESETS[presetKey];
    if (!preset) return;
    setForm({
      ...preset,
      empNo: isEditing ? (editingUser.empNo || preset.empNo) : `EMP-${preset.empNo.split("-")[1] || "2099"}`,
    });
    setErrors({});
    toast.success(`Populated sample details for ${preset.name} (${preset.label})`);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const valErrors = validateUser({ ...form, role: "operator" }, allUsers, editingUser?.id);
    if (!form.roles.length) valErrors.roles = "Pick at least one role";
    if (Object.keys(valErrors).length > 0) {
      setErrors(valErrors);
      setTouched({
        name: true,
        empNo: true,
        phone: true,
        email: true,
        designation: true,
      });
      toast.error("Please correct the errors in the form before saving.");
      return;
    }

    const res = onSaveUser(form, editingUser?.id);
    if (res.ok) {
      if (isEditing) {
        toast.success(`Updated ${form.name}'s profile successfully.`);
        onClose();
      } else {
        toast.success(`User ${form.name} created immediately! Invite dispatched.`);
        onClose();
        if (onOpenInviteEmail && res.user) {
          onOpenInviteEmail(res.user);
        }
      }
    } else {
      toast.error(res.error || "Failed to save user");
    }
  };

  const roleById = Object.fromEntries(roles.map((r) => [r.id, r]));
  const conflicts = sodConflicts(form.roles, roles);
  const before = editingUser?.roles || [];
  const privilegedAdds = form.roles.filter((r) => !before.includes(r) && isPrivileged(roleById[r]));
  const toggleRole = (rid) => {
    if (isSelf) return;
    setForm((f) => ({ ...f, roles: f.roles.includes(rid) ? f.roles.filter((x) => x !== rid) : [...f.roles, rid] }));
    setErrors((e) => ({ ...e, roles: undefined }));
  };
  // Union of selected roles per module, for the effective-access preview
  const effective = {};
  form.roles.forEach((rid) => {
    const r = roleById[rid];
    if (!r) return;
    effective[r.module] = effective[r.module] || {};
    Object.entries(r.perms).forEach(([sk, caps]) => { effective[r.module][sk] = Array.from(new Set([...(effective[r.module][sk] || []), ...caps])); });
  });

  return (
    <Drawer
      id="add-edit-user-drawer"
      title={isEditing ? `Edit User — ${editingUser.name}` : "Add New User"}
      subtitle={
        isEditing
          ? "Update account details and role assignment. Changes take effect immediately."
          : "Creates user immediately. Status is set to Invited and temporary credentials are generated."
      }
      onClose={onClose}
      footer={
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" className="btn btn-outline" onClick={onClose} data-testid="drawer-cancel">
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={conflicts.length > 0} data-testid="drawer-save-user">
            <Check size={16} /> {isEditing ? "Save Changes" : "Save and Send Invite"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Quick Sample Populate Bar */}
        {!isEditing && (
          <div className="quick-fill-bar" data-testid="quick-fill-bar">
            <div className="qfb-title">
              <Sparkles size={14} /> ⚡ Click any field below to auto-populate, or pick a sample persona:
            </div>
            <div className="quick-fill-chips">
              <button
                type="button"
                className="qf-chip"
                onClick={() => applyPreset("operator")}
                data-testid="preset-operator"
              >
                + Ops Maker (Aakash)
              </button>
              <button
                type="button"
                className="qf-chip"
                onClick={() => applyPreset("authoriser")}
                data-testid="preset-authoriser"
              >
                + Recon Checker (Sunita)
              </button>
              <button
                type="button"
                className="qf-chip"
                onClick={() => applyPreset("viewer")}
                data-testid="preset-viewer"
              >
                + Auditor + Posting (Vikram)
              </button>
              <button
                type="button"
                className="qf-chip"
                onClick={() => applyPreset("admin")}
                data-testid="preset-admin"
              >
                + Platform Admin (Tanvi)
              </button>
            </div>
          </div>
        )}

        {/* Self-edit warning banner */}
        {isSelf && (
          <div className="note warn" data-testid="self-edit-note">
            <ShieldAlert size={16} />
            <div>
              <b>Self-Edit Restriction:</b> You are logged in as this user ({actor.name}). System policy prevents admins from changing their own role or deactivating their own account.
            </div>
          </div>
        )}

        {/* Full Name */}
        <div className="field">
          <label className="field-label" htmlFor="user-fullname">
            Full Name <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
          </label>
          <input
            id="user-fullname"
            data-testid="user-fullname"
            className={`input ${errors.name ? "invalid" : ""}`}
            type="text"
            placeholder="e.g. Aakash Patel (Click to populate)"
            value={form.name}
            onClick={() => !isEditing && handleFieldClickOrFocus("name")}
            onFocus={() => !isEditing && handleFieldClickOrFocus("name")}
            onChange={(e) => handleChange("name", e.target.value)}
          />
          {!form.name && !isEditing && (
            <span className="click-hint">⚡ Click field to auto-fill sample name</span>
          )}
          {errors.name && <span className="field-error" data-testid="error-name">{errors.name}</span>}
        </div>

        {/* Employee Number */}
        <div className="field">
          <label className="field-label" htmlFor="user-empno">
            Employee Number <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
          </label>
          <input
            id="user-empno"
            data-testid="user-empno"
            className={`input tnum ${errors.empNo ? "invalid" : ""}`}
            type="text"
            placeholder="e.g. EMP-2088 (Click to populate)"
            value={form.empNo}
            onClick={() => !isEditing && handleFieldClickOrFocus("empNo")}
            onFocus={() => !isEditing && handleFieldClickOrFocus("empNo")}
            onChange={(e) => handleChange("empNo", e.target.value)}
          />
          {!form.empNo && !isEditing && (
            <span className="click-hint">⚡ Click field to auto-fill sample employee ID</span>
          )}
          {errors.empNo && <span className="field-error" data-testid="error-empno">{errors.empNo}</span>}
        </div>

        {/* Mobile Number */}
        <div className="field">
          <label className="field-label" htmlFor="user-phone">
            Mobile Number (10-digit Indian number) <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
          </label>
          <input
            id="user-phone"
            data-testid="user-phone"
            className={`input tnum ${errors.phone ? "invalid" : ""}`}
            type="text"
            placeholder="+91 98765 43210 (Click to populate)"
            value={form.phone}
            onClick={() => !isEditing && handleFieldClickOrFocus("phone")}
            onFocus={() => !isEditing && handleFieldClickOrFocus("phone")}
            onChange={(e) => handleChange("phone", e.target.value)}
          />
          {!form.phone && !isEditing && (
            <span className="click-hint">⚡ Click field to auto-fill sample mobile number</span>
          )}
          {errors.phone && <span className="field-error" data-testid="error-phone">{errors.phone}</span>}
        </div>

        {/* Work Email */}
        <div className="field">
          <label className="field-label" htmlFor="user-email">
            Work Email (Must end with @{COMPANY_DOMAIN}) <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
          </label>
          <input
            id="user-email"
            data-testid="user-email"
            className={`input ${errors.email ? "invalid" : ""}`}
            type="email"
            placeholder={`e.g. aakash.patel@${COMPANY_DOMAIN} (Click to populate)`}
            value={form.email}
            onClick={() => !isEditing && handleFieldClickOrFocus("email")}
            onFocus={() => !isEditing && handleFieldClickOrFocus("email")}
            onChange={(e) => handleChange("email", e.target.value)}
          />
          {!form.email && !isEditing && (
            <span className="click-hint">⚡ Click field to auto-fill valid company email</span>
          )}
          {errors.email && <span className="field-error" data-testid="error-email">{errors.email}</span>}
        </div>

        {/* Designation */}
        <div className="field">
          <label className="field-label" htmlFor="user-designation">
            Designation <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
          </label>
          <input
            id="user-designation"
            data-testid="user-designation"
            className={`input ${errors.designation ? "invalid" : ""}`}
            type="text"
            placeholder="e.g. Reconciliation Specialist (Click to populate)"
            value={form.designation}
            onClick={() => !isEditing && handleFieldClickOrFocus("designation")}
            onFocus={() => !isEditing && handleFieldClickOrFocus("designation")}
            onChange={(e) => handleChange("designation", e.target.value)}
          />
          {!form.designation && !isEditing && (
            <span className="click-hint">⚡ Click field to auto-fill sample designation</span>
          )}
          {errors.designation && <span className="field-error" data-testid="error-designation">{errors.designation}</span>}
        </div>

        {/* Roles: many per user, across modules */}
        <div className="field" data-testid="user-roles">
          <label className="field-label">
            Roles <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
            <span className="muted" style={{ fontWeight: 500 }}>Pick one or more, from any module</span>
          </label>
          {isSelf && <span style={{ fontSize: 11.5, color: "hsl(var(--muted))" }}>🔒 You cannot change your own roles.</span>}
          <div className="role-picker">
            {MODULES.map((m) => {
              const list = roles.filter((r) => r.module === m.key && r.status === "active");
              if (!list.length) return null;
              return (
                <div key={m.key} className="rp-module" style={{ "--mc": m.color }}>
                  <div className="rp-title"><i />{m.label}</div>
                  {list.map((r) => (
                    <label key={r.id} className={"rp-role" + (form.roles.includes(r.id) ? " on" : "")}>
                      <input type="checkbox" className="cb" checked={form.roles.includes(r.id)} disabled={isSelf} onChange={() => toggleRole(r.id)} data-testid={`pick-${r.id}`} />
                      <div>
                        <b>{r.name}</b>{isPrivileged(r) && <span className="priv-tag">needs 2nd admin</span>}
                        <div className="muted">{r.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
          {errors.roles && <span className="field-error">{errors.roles}</span>}
          {conflicts.length > 0 && (
            <div className="note warn" data-testid="sod-conflict"><ShieldAlert size={16} /><div><b>Segregation of duties conflict.</b> These roles together make this user both Maker and Checker on: {conflicts.join(", ")}. Remove one to save.</div></div>
          )}
          {privilegedAdds.length > 0 && conflicts.length === 0 && (
            <div className="note" data-testid="priv-note"><Info size={16} /><div>{privilegedAdds.map((r) => roleById[r]?.name).join(", ")} grant{privilegedAdds.length === 1 ? "s" : ""} Checker/Admin rights. {privilegedAdds.length === 1 ? "It" : "They"} will be <b>pending until a second admin approves</b> in Roles & Access. Other roles apply immediately.</div></div>
          )}
        </div>

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

        <div className="field" data-testid="user-steps">
          <label className="field-label">Daily-cycle steps this person handles <span className="muted" style={{ fontWeight: 500 }}>— leave empty to follow their roles. Their Today stepper shows only these.</span></label>
          <div className="chip-row">
            {CYCLE_STEPS.map(([k, l]) => {
              const on = form.workflowSteps.includes(k);
              return <button type="button" key={k} className={"filter-chip" + (on ? " on" : "")} data-testid={"step-pick-" + k}
                onClick={() => setForm((f) => ({ ...f, workflowSteps: on ? f.workflowSteps.filter((x) => x !== k) : [...f.workflowSteps, k] }))}>{l}</button>;
            })}
          </div>
        </div>

        {Object.keys(effective).length > 0 && (
          <div className="field" data-testid="effective-access">
            <label className="field-label">Effective access <span className="muted" style={{ fontWeight: 500 }}>— the only screens this user will see</span></label>
            {Object.entries(effective).map(([mk, p]) => (
              <div key={mk} style={{ marginBottom: 8 }}>
                <div className="rp-title" style={{ "--mc": MODULE_BY_KEY[mk].color }}><i />{MODULE_BY_KEY[mk].label}</div>
                <PermissionMatrix module={mk} perms={p} readOnly compact highlight={conflicts} />
              </div>
            ))}
          </div>
        )}
      </form>
    </Drawer>
  );
}
