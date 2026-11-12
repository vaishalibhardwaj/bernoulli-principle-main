// Team tasks: the templates every Ops person's Today list is built from.
// Level 1 and Level 2 change when a task is due, who does it and whether it is on. Only Level 2 adds new tasks
// (whether Level 1/2 should add tasks at all is still to be confirmed). Everyone else sees the list read-only.
import React from "react";
import { Plus, Lock } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { AREAS, SAMPLE_KRAS, templatesFrom } from "./todayTasks";

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const parseTimes = (txt) => txt.split(",").map((x) => x.trim()).filter(Boolean);
const fmt = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

export default function TaskTemplates() {
  const { collections, perms, users, upsert, addAudit } = useStore();
  const canEdit = hasCap(perms, "task_templates", "edit");
  const canAdd = hasCap(perms, "task_templates", "approve");
  const templates = templatesFrom(collections.task_templates);
  const ops = users.filter((u) => (u.roles || []).includes("role_recon_ops") && u.status === "active");
  const nameOf = (id) => users.find((u) => u.id === id)?.name || "Whole team";
  const [editing, setEditing] = React.useState(null);
  const [adding, setAdding] = React.useState(false);

  const save = (t, change, what) => {
    const next = { ...t, ...change };
    upsert("task_templates", next);
    addAudit({ action: "Task template changed", entity: "task_template", entityId: t.id, details: `${t.title}: ${what}` });
    toast.success(`Saved: ${t.title}`);
  };

  return (
    <div data-testid="task-templates">
      <div className="page-head"><div>
        <h1>Team tasks</h1>
        <p>Each Ops person's Today list is built from these tasks, every day. A task with several times shows up once per time.
          {canEdit ? " Change the times, who does it, or switch a task off." : " Only Level 1 and Level 2 users can change them."}</p>
      </div>
      {canAdd && <div className="actions"><button className="btn btn-primary" onClick={() => setAdding(true)} data-testid="tt-add"><Plus size={15} /> Add a task</button></div>}
      </div>

      {!canEdit && <div className="fu-callout"><Lock size={16} /><div>You can see the team's tasks but not change them.</div></div>}

      {adding && <NewTask ops={ops} onCancel={() => setAdding(false)} onSave={(t) => { upsert("task_templates", t); addAudit({ action: "Task template added", entity: "task_template", entityId: t.id, details: t.title }); toast.success(`Added: ${t.title}`); setAdding(false); }} />}

      <div className="card">
        <table className="table tt-table">
          <thead><tr><th>Task</th><th>KRA</th><th>When</th><th>Who does it</th><th>On</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {templates.map((t) => editing === t.id
              ? <EditRow key={t.id} t={t} ops={ops} onCancel={() => setEditing(null)} onSave={(change, what) => { save(t, change, what); setEditing(null); }} />
              : (
                <tr key={t.id} data-testid={"tt-row-" + t.id} className={t.active === false ? "muted" : ""}>
                  <td><b>{t.title}</b>{t.phase && <span className="muted"> · {t.phase}</span>}<div className="muted" style={{ fontSize: 12.5 }}>{AREAS.find((a) => a.key === t.area)?.label}</div></td>
                  <td>{t.kra || <span className="muted">—</span>}</td>
                  <td><div className="tt-times">{t.times?.length ? t.times.map((x) => <span key={x}>{fmt(x)}</span>) : <span>{t.when || "No fixed time"}</span>}</div></td>
                  <td>{nameOf(t.assignee)}</td>
                  <td>{canEdit
                    ? <input type="checkbox" checked={t.active !== false} onChange={(e) => save(t, { active: e.target.checked }, e.target.checked ? "switched on" : "switched off")} aria-label={`${t.title} on`} data-testid={"tt-on-" + t.id} />
                    : t.active === false ? "Off" : "On"}</td>
                  {canEdit && <td><button className="btn btn-outline btn-sm" onClick={() => setEditing(t.id)} data-testid={"tt-edit-" + t.id}>Change</button></td>}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditRow({ t, ops, onCancel, onSave }) {
  const [times, setTimes] = React.useState((t.times || []).join(", "));
  const [assignee, setAssignee] = React.useState(t.assignee || "");
  const list = parseTimes(times);
  const bad = list.find((x) => !TIME_RE.test(x));
  const submit = () => {
    if (bad) { toast.error(`"${bad}" is not a time. Use 24-hour HH:MM, for example 15:30.`); return; }
    const sorted = [...new Set(list.map((x) => x.padStart(5, "0")))].sort();
    onSave({ times: sorted, assignee: assignee || null }, `times ${sorted.join(", ") || "none"}; assigned to ${assignee ? ops.find((u) => u.id === assignee)?.name : "whole team"}`);
  };
  return (
    <tr data-testid={"tt-editing-" + t.id}>
      <td><b>{t.title}</b></td>
      <td>{t.kra || "—"}</td>
      <td><input className="input" value={times} onChange={(e) => setTimes(e.target.value)} placeholder="09:00, 15:00" aria-label="Times, 24-hour, comma separated" data-testid="tt-times" /></td>
      <td><select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Who does it" data-testid="tt-assignee">
        <option value="">Whole team</option>
        {ops.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select></td>
      <td />
      <td style={{ whiteSpace: "nowrap" }}><button className="btn btn-primary btn-sm" onClick={submit} data-testid="tt-save">Save</button> <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button></td>
    </tr>
  );
}

function NewTask({ ops, onCancel, onSave }) {
  const [f, setF] = React.useState({ title: "", detail: "", area: "upload", kra: SAMPLE_KRAS[1], times: "", assignee: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = () => {
    const list = parseTimes(f.times);
    if (!f.title.trim()) { toast.error("Give the task a name."); return; }
    const bad = list.find((x) => !TIME_RE.test(x));
    if (bad) { toast.error(`"${bad}" is not a time. Use 24-hour HH:MM.`); return; }
    onSave({ id: "tpl_" + Date.now().toString(36), title: f.title.trim(), detail: f.detail.trim(), area: f.area, kra: f.kra || null, times: [...new Set(list.map((x) => x.padStart(5, "0")))].sort(), when: list.length ? undefined : "No fixed time", screen: "today", path: "/today", assignee: f.assignee || null, active: true });
  };
  return (
    <div className="card fu-card" data-testid="tt-new">
      <h3 style={{ marginTop: 0 }}>New task</h3>
      <div className="fu-details">
        <label>Task<input className="input" value={f.title} onChange={set("title")} placeholder="Upload remitter file (ICICI Bank)" data-testid="tt-new-title" /></label>
        <label>Area<select className="select" value={f.area} onChange={set("area")}>{AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
        <label>KRA<select className="select" value={f.kra} onChange={set("kra")}>{SAMPLE_KRAS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label>Times (24-hour)<input className="input" value={f.times} onChange={set("times")} placeholder="10:00, 14:00" data-testid="tt-new-times" /></label>
        <label>Who does it<select className="select" value={f.assignee} onChange={set("assignee")}><option value="">Whole team</option>{ops.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label style={{ gridColumn: "1 / -1" }}>What to do<input className="input" value={f.detail} onChange={set("detail")} placeholder="One line on what the task involves" /></label>
      </div>
      <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary" onClick={submit} data-testid="tt-new-save">Add task</button><button className="btn btn-ghost" onClick={onCancel}>Cancel</button></div>
    </div>
  );
}
