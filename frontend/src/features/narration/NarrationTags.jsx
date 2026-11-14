// Narration tags: rows whose narration fits a pattern (bank charges, interest, GST…) get a tag and stay out of matching.
// Add or edit a tag here; every new or changed tag is approved by a teammate in To do.
// While a change waits, the approved version stays in use (rejecting restores it).
import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { uid, formatDate } from "@/lib/format";
import { StatusPill } from "@/components/bits";
import Picker from "@/components/Picker";
import { toast } from "sonner";

const MATCH = { contains: "Contains", starts: "Starts with", regex: "Pattern (regex)" };
const TAGS = ["Bank charges", "GST on charges", "Interest credit", "Return / reversal", "Internal transfer", "Other"];
const test = (rule, text) => {
  const t = String(text).toUpperCase(); const p = rule.pattern.toUpperCase();
  try { return rule.match === "regex" ? new RegExp(rule.pattern, "i").test(text) : rule.match === "starts" ? t.startsWith(p) : t.includes(p); } catch (e) { return false; }
};
/** Tag a narration with the first active rule that fits. */
export const tagFor = (rules, narration) => (rules || []).find((r) => r.status === "active" && test(r, narration))?.tag || null;

const EMPTY = { pattern: "", match: "contains", tag: "Bank charges", bank: "All banks" };

export default function NarrationTags({ embedded = false }) {
  const nav = useNavigate();
  const { collections, perms, act, currentUser } = useStore();
  const rules = collections.narration_tags || [];
  const canEdit = hasCap(perms, "narration_tags", "edit");
  const canApprove = hasCap(perms, "narration_tags", "approve");
  const [form, setForm] = React.useState(null); // null = closed; { ...fields, id? } = adding or editing
  const [status, setStatus] = React.useState("all");
  const banks = ["All banks", ...new Set((collections.bank_config || []).map((c) => c.bankName))];

  const save = () => {
    if (form.pattern.trim().length < 2) { toast.error("Type the text to look for"); return; }
    if (form.match === "regex") { try { new RegExp(form.pattern); } catch (e) { toast.error("That pattern isn't valid"); return; } }
    const old = form.id ? rules.find((r) => r.id === form.id) : null;
    const fields = { pattern: form.pattern.trim(), match: form.match, tag: form.tag, bank: form.bank };
    const row = old
      ? { ...old, ...fields, status: "pending", owner: currentUser, createdAt: new Date().toISOString(), previous: old.status === "active" ? { pattern: old.pattern, match: old.match, tag: old.tag, bank: old.bank, status: "active", owner: old.owner, createdAt: old.createdAt } : old.previous }
      : { ...fields, id: uid("nt"), status: "pending", owner: currentUser, createdAt: new Date().toISOString() };
    const r = act({ screen: "narration_tags", cap: "edit", kind: "narration_tags", id: row.id, target: row, patch: () => row, audit: { entityLabel: `Narration tag “${row.pattern}” → ${row.tag}`, action: old ? "Change narration tag" : "Add narration tag", from: old ? "Active" : null, to: "Pending for approval" } });
    if (!r.ok) toast.error(r.error); else { toast.success("Sent to a teammate for approval"); setForm(null); }
  };

  const ORDER = ["pending", "rejected", "active", "inactive"];
  const list = rules.filter((r) => status === "all" || r.status === status).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const count = (k) => (k === "all" ? rules.length : rules.filter((r) => r.status === k).length);

  return (
    <div data-testid="narration-tags">
      {!embedded && <div className="page-head"><div><h1>Narration tags</h1></div></div>}

      <div className="dl-bar">
        <Picker value={status} onChange={setStatus} label="Status" testid="nt-status" width={240}
          options={[["all", "All statuses"], ["active", "Active"], ["pending", "Pending for approval"], ["rejected", "Rejected"]].map(([k, l]) => ({ value: k, label: l, count: count(k) }))} />
        {canEdit && !form && <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY })} data-testid="nt-add-open"><Plus size={15} /> Add tag</button>}
      </div>

      {form && (
        <div className="dl-form" data-testid="nt-add">
          <h3>{form.id ? "Change tag" : "New tag"}</h3>
          <label>Narration<select className="select" value={form.match} onChange={(e) => setForm({ ...form, match: e.target.value })}>{Object.entries(MATCH).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Text to look for<input className="input tnum" placeholder="e.g. BANK CHARGES" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} data-testid="nt-pattern" autoFocus /></label>
          <label>Tag<select className="select" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Bank<select className="select" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })}>{banks.map((b) => <option key={b}>{b}</option>)}</select></label>
          <div className="acts"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={save} data-testid="nt-add-btn">Send for approval</button></div>
        </div>
      )}

      <div className="dl" style={{ "--cols": "40px 112px minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, .9fr) 160px 140px 128px" }}>
        <div className="dl-h" aria-hidden="true"><span /><span>Narration</span><span>Text to look for</span><span>Tag</span><span>Bank</span><span>Status</span><span>Added by</span><span /></div>
        {list.length === 0 && <div className="dl-empty">No tags here.</div>}
        <ul className="rq-list">
          {list.map((r) => (
            <li key={r.id}>
              <div className="dl-r" data-testid={"nt-" + r.id}>
                <span className="dl-ic" aria-hidden="true">{r.tag.slice(0, 1)}</span>
                <span className="dl-c">{MATCH[r.match]}</span>
                <span className="dl-c"><code className="dl-code" title={r.pattern}>{r.pattern}</code></span>
                <span className="dl-c"><b className="dl-strong">{r.tag}</b></span>
                <span className="dl-c">{r.bank}</span>
                <StatusPill status={r.status} />
                <span className="dl-c muted">{r.owner} · {formatDate(r.createdAt)}</span>
                <span className="dl-act">
                  {r.status === "pending"
                    ? (r.owner === currentUser ? <span className="muted">Waiting for a teammate</span> : canApprove ? <button type="button" className="link" onClick={() => nav("/setup-todo?tab=approve")} data-testid={"nt-review-" + r.id}>Review in To do</button> : null)
                    : canEdit && <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm({ id: r.id, pattern: r.pattern, match: r.match, tag: r.tag, bank: r.bank })} data-testid={"nt-edit-" + r.id}><Pencil size={13} /> Edit</button>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
