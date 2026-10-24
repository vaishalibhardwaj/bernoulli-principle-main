import React from "react";
import { Drawer } from "@/components/Drawer";
import { MODULE_BY_KEY } from "@/lib/access";
import PermissionMatrix from "./PermissionMatrix";
import { Users } from "lucide-react";

/** Shows every role in a module with its screen × capability matrix. */
export default function RolePermissionsDrawer({ moduleKey, roles, roleCounts, onClose, onFilterRole }) {
  if (!moduleKey) return null;
  const mod = MODULE_BY_KEY[moduleKey];
  const list = roles.filter((r) => r.module === moduleKey && r.status === "active");

  return (
    <Drawer id="role-permissions-drawer" title={`${mod.label} — roles`} subtitle="Roles are permission sets built in Administration › Roles & Access. A user can hold several." onClose={onClose}
      footer={<button type="button" className="btn btn-outline" onClick={onClose} data-testid="btn-close-perm-drawer">Close</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {list.map((r) => (
          <div key={r.id} className="role-block">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <b>{r.name}</b><span className="muted">· {roleCounts[r.id] || 0} users</span>
              <button className="link" style={{ marginLeft: "auto", fontSize: 12 }} onClick={() => { onFilterRole(r.id); onClose(); }} data-testid={`show-users-${r.id}`}>
                <Users size={12} /> Show these users
              </button>
            </div>
            <div className="muted" style={{ marginBottom: 8 }}>{r.description}</div>
            <PermissionMatrix module={moduleKey} perms={r.perms} readOnly compact />
          </div>
        ))}
        {list.length === 0 && <div className="muted">No roles defined for this module yet.</div>}
      </div>
    </Drawer>
  );
}
