import React from "react";
import { Tags, Plus, Check, X, Pencil } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { uid, formatDate } from "@/lib/format";
import { toast } from "sonner";

const TAGS = ["Bank charges", "GST on charges", "Interest credit", "Return / reversal", "Internal transfer", "Other"];
const MATCH = { contains: "contains", starts: "starts with", regex: "pattern (regex)" };
const test = (rule, text) => {
  const t = String(text).toUpperCase(); const p = rule.pattern.toUpperCase();
  try { return rule.match === "regex" ? new RegExp(rule.pattern, "i").test(text) : rule.match === "starts" ? t.startsWith(p) : t.includes(p); } catch (e) { return false; }
};
/** Tag a narration with the first active rule that fits. */
// While an edit waits for approval, the approved rule (kept in .previous) stays in use.
const live = (r) => (r.status === "pending" && r.previous ? { ...r, ...r.previous, status: "active" } : r);
export const tagFor = (rules, narration) => (rules || []).map(live).find((r) => r.status === "active" && test(r, narration))?.tag || null;

/**
 * Narration pattern tagging (e.g. bank charges, interest, GST): rows whose narration fits a pattern get a tag and
 * are kept out of payment matching. Maker adds or edits; a checker approves on this same screen.
 */
/** bank: one bank's own rules ("All banks" = the rules for every bank); undefined = every rule. */
export default function NarrationTags({ embedded = false, bank }) {
  const { collections, perms, act, currentUser } = useStore();
  const allRules = collections.narration_tags || [];
  const rules = bank ? allRules.filter((r) => (r.bank || "All banks") === bank) : [...allRules].sort((a, b) => ((a.bank || "All banks") === "All banks" ? 0 : 1) - ((b.bank || "All banks") === "All banks" ? 0 : 1) || (a.bank || "").localeCompare(b.bank || ""));
  const banks = [...new Set((collections.bank_config || []).map((c) => c.bankName))].sort();
  const canEdit = hasCap(perms, "narration_tags", "edit");
  const canApprove = hasCap(perms, "narration_tags", "approve");
  const [draft, setDraft] = React.useState({ pattern: "", match: "contains", tag: "Bank charges", bank: bank || "All banks" });
  const [sample, setSample] = React.useState("BANK CHARGES GST 18% ON NEFT");
  const [editing, setEditing] = React.useState(null); // { id, match, pattern, tag }
  const saveEdit = (row) => {
    const pattern = editing.pattern.trim();
    if (pattern.length < 2) { toast.error("Type the text to look for"); return; }
    if (editing.match === "regex") { try { new RegExp(pattern); } catch (e) { toast.error("That pattern isn't valid"); return; } }
    if (pattern === row.pattern && editing.match === row.match && editing.tag === row.tag) { setEditing(null); return; }
    const r = act({ screen: "narration_tags", cap: "edit", kind: "narration_tags", id: row.id, target: row, patch: { match: editing.match, pattern, tag: editing.tag, status: "pending", owner: currentUser, previous: { match: row.match, pattern: row.pattern, tag: row.tag, owner: row.owner } },
      audit: { entityLabel: `Narration tag “${row.pattern}”`, action: "Edit narration tag", from: `${MATCH[row.match]} “${row.pattern}” → ${row.tag}`, to: `${MATCH[editing.match]} “${pattern}” → ${editing.tag}` } });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success("Change sent to another team member. The current rule keeps working until then.");
    setEditing(null);
  };

  const add = () => {
    if (draft.pattern.trim().length < 2) { toast.error("Type the text to look for"); return; }
    if (draft.match === "regex") { try { new RegExp(draft.pattern); } catch (e) { toast.error("That pattern isn't valid"); return; } }
    const row = { ...draft, pattern: draft.pattern.trim(), id: uid("nt"), status: "pending", owner: currentUser, createdAt: new Date().toISOString() };
    const r = act({ screen: "narration_tags", cap: "edit", kind: "narration_tags", id: row.id, target: row, patch: () => row, audit: { entityLabel: `Narration tag “${row.pattern}” → ${row.tag}`, action: "Add narration tag", to: "Pending for approval" } });
    if (!r.ok) toast.error(r.error); else { toast.success("Sent to a checker"); setDraft({ ...draft, pattern: "" }); }
  };
  const decide = (row, yes) => {
    const patch = yes ? { status: "active", approvedBy: currentUser, previous: null } : row.previous ? { ...row.previous, status: "active", previous: null } : { status: "rejected", approvedBy: currentUser };
    const r = act({ screen: "narration_tags", cap: "approve", kind: "narration_tags", id: row.id, target: row, patch, audit: { entityLabel: `Narration tag “${row.pattern}”`, action: yes ? "Approve narration tag" : "Reject narration tag", from: "Pending for approval", to: yes ? "Active" : row.previous ? "Kept as before" : "Rejected" } });
    if (!r.ok) toast.error(r.error); else toast.success(yes ? "Tag is live for files loaded from now on" : "Rejected");
  };
  const hit = tagFor(bank ? allRules.filter((r) => [bank, "All banks"].includes(r.bank || "All banks")) : allRules, sample);

  return (
    <div data-testid="narration-tags">
      {!embedded && <div className="page-head"><div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Tags size={22} /> Narration tags<span className="shared-amc" title="These settings are not per AMC: a change applies to every AMC.">Same for every AMC</span></h1>
        <p>Recognise rows like bank charges, interest or GST from their narration and tag them, so they don't sit in matching as unknown credits or debits. Every new or changed tag needs a checker.</p>
      </div></div>}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="field"><label className="field-label">Try a narration</label><input className="input tnum" value={sample} onChange={(e) => setSample(e.target.value)} data-testid="nt-sample" /></div>
        <div style={{ marginTop: 8 }} data-testid="nt-result">{hit ? <span className="chip chip-previous">Tagged: {hit}</span> : <span className="muted">No active tag fits — the row goes to matching as normal.</span>}</div>
      </div>

      <div className="card">
        <table className="grid">
          <thead><tr><th>Narration…</th><th>Pattern</th><th>Tag</th>{!bank && <th>Bank</th>}<th>Status</th><th>By</th><th /></tr></thead>
          <tbody>{rules.length === 0 && <tr><td colSpan={7} className="muted">No tags of its own yet{canEdit ? " — add one below." : "."}</td></tr>}{rules.map((r) => { const ed = editing && editing.id === r.id; return (
            <tr key={r.id} data-testid={"nt-" + r.id}>
              {ed ? <>
                <td><select className="select" value={editing.match} onChange={(e) => setEditing({ ...editing, match: e.target.value })}>{Object.entries(MATCH).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                <td><input className="input tnum" value={editing.pattern} onChange={(e) => setEditing({ ...editing, pattern: e.target.value })} autoFocus data-testid="nt-edit-pattern" /></td>
                <td><select className="select" value={editing.tag} onChange={(e) => setEditing({ ...editing, tag: e.target.value })}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></td>
              </> : <>
                <td>{MATCH[r.match]}</td>
                <td className="tnum"><code>{r.pattern}</code>{r.previous && r.previous.pattern !== r.pattern && <span className="muted"> (was {r.previous.pattern})</span>}</td>
                <td><b>{r.tag}</b>{r.previous && r.previous.tag !== r.tag && <span className="muted"> (was {r.previous.tag})</span>}</td>
              </>}
              {!bank && <td>{(r.bank || "All banks") === "All banks" ? "Every bank" : r.bank}</td>}
              <td>{r.status === "active" ? <span className="pill pill-active"><span className="dot" />Active</span> : r.status === "pending" ? <span className="pill pill-pending"><span className="dot" />Pending for approval</span> : <span className="pill pill-rejected"><span className="dot" />Rejected</span>}</td>
              <td className="muted">{r.owner} · {formatDate(r.createdAt)}</td>
              <td>
                {ed ? <span style={{ display: "flex", gap: 6 }}><button className="btn btn-primary btn-sm" onClick={() => saveEdit(r)} data-testid="nt-edit-save">Save</button><button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button></span>
                  : r.status === "pending" ? (canApprove && r.owner !== currentUser && <span style={{ display: "flex", gap: 6 }}><button className="btn btn-success btn-sm" onClick={() => decide(r, true)} data-testid={"nt-approve-" + r.id}><Check size={13} /> Approve</button><button className="btn btn-outline btn-sm" onClick={() => decide(r, false)}><X size={13} /> Reject</button></span>)
                  : r.status === "active" && canEdit && <button className="au-round row-edit" title="Edit" aria-label={`Edit ${r.pattern}`} onClick={() => setEditing({ id: r.id, match: r.match, pattern: r.pattern, tag: r.tag })} data-testid={"nt-edit-" + r.id}><Pencil size={14} /></button>}
              </td>
            </tr>
          ); })}</tbody>
        </table>
        {canEdit && (
          <div className="std-add" data-testid="nt-add">
            <select className="select" value={draft.match} onChange={(e) => setDraft({ ...draft, match: e.target.value })}>{Object.entries(MATCH).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input className="input tnum" placeholder="e.g. BANK CHARGES" value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} data-testid="nt-pattern" />
            <select className="select" value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select>
            {!bank && <select className="select" value={draft.bank} onChange={(e) => setDraft({ ...draft, bank: e.target.value })} aria-label="Bank" data-testid="nt-bank"><option value="All banks">Every bank</option>{banks.map((b) => <option key={b}>{b}</option>)}</select>}
            <button className="btn btn-primary" onClick={add} data-testid="nt-add-btn"><Plus size={15} /> Add</button>
          </div>
        )}
      </div>
    </div>
  );
}
