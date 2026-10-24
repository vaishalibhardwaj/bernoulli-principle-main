import React from "react";
import { Tags, Plus, Check, X } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { uid, formatDate } from "@/lib/format";
import { toast } from "sonner";

const MATCH = { contains: "contains", starts: "starts with", regex: "pattern (regex)" };
const test = (rule, text) => {
  const t = String(text).toUpperCase(); const p = rule.pattern.toUpperCase();
  try { return rule.match === "regex" ? new RegExp(rule.pattern, "i").test(text) : rule.match === "starts" ? t.startsWith(p) : t.includes(p); } catch (e) { return false; }
};
/** Tag a narration with the first active rule that fits. */
export const tagFor = (rules, narration) => (rules || []).find((r) => r.status === "active" && test(r, narration))?.tag || null;

/**
 * Narration pattern tagging (e.g. bank charges, interest, GST): rows whose narration fits a pattern get a tag and
 * are kept out of payment matching. Maker adds or edits; a checker approves on this same screen.
 */
export default function NarrationTags() {
  const { collections, perms, act, currentUser } = useStore();
  const rules = collections.narration_tags || [];
  const canEdit = hasCap(perms, "narration_tags", "edit");
  const canApprove = hasCap(perms, "narration_tags", "approve");
  const [draft, setDraft] = React.useState({ pattern: "", match: "contains", tag: "Bank charges", bank: "All banks" });
  const [sample, setSample] = React.useState("BANK CHARGES GST 18% ON NEFT");

  const add = () => {
    if (draft.pattern.trim().length < 2) { toast.error("Type the text to look for"); return; }
    if (draft.match === "regex") { try { new RegExp(draft.pattern); } catch (e) { toast.error("That pattern isn't valid"); return; } }
    const row = { ...draft, pattern: draft.pattern.trim(), id: uid("nt"), status: "pending", owner: currentUser, createdAt: new Date().toISOString() };
    const r = act({ screen: "narration_tags", cap: "edit", kind: "narration_tags", id: row.id, target: row, patch: () => row, audit: { entityLabel: `Narration tag “${row.pattern}” → ${row.tag}`, action: "Add narration tag", to: "Pending for approval" } });
    if (!r.ok) toast.error(r.error); else { toast.success("Sent to a checker"); setDraft({ ...draft, pattern: "" }); }
  };
  const decide = (row, yes) => {
    const r = act({ screen: "narration_tags", cap: "approve", kind: "narration_tags", id: row.id, target: row, patch: { status: yes ? "active" : "rejected", approvedBy: currentUser }, audit: { entityLabel: `Narration tag “${row.pattern}”`, action: yes ? "Approve narration tag" : "Reject narration tag", from: "Pending for approval", to: yes ? "Active" : "Rejected" } });
    if (!r.ok) toast.error(r.error); else toast.success(yes ? "Tag is live for files loaded from now on" : "Rejected");
  };
  const hit = tagFor(rules, sample);

  return (
    <div data-testid="narration-tags">
      <div className="page-head"><div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Tags size={22} /> Narration tags</h1>
        <p>Recognise rows like bank charges, interest or GST from their narration and tag them, so they don't sit in matching as unknown credits or debits. Every new or changed tag needs a checker.</p>
      </div></div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="field"><label className="field-label">Try a narration</label><input className="input tnum" value={sample} onChange={(e) => setSample(e.target.value)} data-testid="nt-sample" /></div>
        <div style={{ marginTop: 8 }} data-testid="nt-result">{hit ? <span className="chip chip-previous">Tagged: {hit}</span> : <span className="muted">No active tag fits — the row goes to matching as normal.</span>}</div>
      </div>

      <div className="card">
        <table className="grid">
          <thead><tr><th>Narration…</th><th>Pattern</th><th>Tag</th><th>Bank</th><th>Status</th><th>By</th><th /></tr></thead>
          <tbody>{rules.map((r) => (
            <tr key={r.id} data-testid={"nt-" + r.id}>
              <td>{MATCH[r.match]}</td><td className="tnum"><code>{r.pattern}</code></td><td><b>{r.tag}</b></td><td>{r.bank}</td>
              <td>{r.status === "active" ? <span className="pill pill-active"><span className="dot" />Active</span> : r.status === "pending" ? <span className="pill pill-pending"><span className="dot" />Pending for approval</span> : <span className="pill pill-rejected"><span className="dot" />Rejected</span>}</td>
              <td className="muted">{r.owner} · {formatDate(r.createdAt)}</td>
              <td>{r.status === "pending" && canApprove && r.owner !== currentUser && <span style={{ display: "flex", gap: 6 }}><button className="btn btn-success btn-sm" onClick={() => decide(r, true)} data-testid={"nt-approve-" + r.id}><Check size={13} /> Approve</button><button className="btn btn-outline btn-sm" onClick={() => decide(r, false)}><X size={13} /> Reject</button></span>}</td>
            </tr>
          ))}</tbody>
        </table>
        {canEdit && (
          <div className="std-add" data-testid="nt-add">
            <select className="select" value={draft.match} onChange={(e) => setDraft({ ...draft, match: e.target.value })}>{Object.entries(MATCH).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input className="input tnum" placeholder="e.g. BANK CHARGES" value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} data-testid="nt-pattern" />
            <select className="select" value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })}>{["Bank charges", "GST on charges", "Interest credit", "Return / reversal", "Internal transfer", "Other"].map((t) => <option key={t}>{t}</option>)}</select>
            <button className="btn btn-primary" onClick={add} data-testid="nt-add-btn"><Plus size={15} /> Add — needs checker</button>
          </div>
        )}
      </div>
    </div>
  );
}
