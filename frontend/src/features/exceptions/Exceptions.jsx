import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "@/state/store";
import { Drawer } from "@/components/Drawer";
import { hasCap } from "@/lib/access";
import { ROOT_CAUSES, EXCEPTION_TYPES } from "@/mock/opsSeed";
import { timeAgo } from "@/lib/format";
import { inrShort, inr, dur, Conf, Stat, PhaseBadge, ReadOnlyNote, timeLeftWords } from "@/features/ops/ui";
import { PLAIN_EXCEPTION, PLAIN_CASE_STATUS, stripNumbers } from "@/lib/plain";
import { Siren, Hourglass, UserPlus, Check, X, Sparkles, MessageSquare, Download } from "lucide-react";
import { toast } from "sonner";
import { JourneyBar } from "@/features/today/Cycle";
import { scopeToUser } from "@/lib/journey";

const ageDays = (e) => Math.floor(e.ageHours / 24);
const HIGH_VALUE = 1000000; // ₹10 lakh
const THRESHOLD_DAYS = 5;
/** Bucket edges, e.g. [5, 10, 20] → 0–5, 6–10, 11–20, over 20 days. */
const bucketsFrom = (b) => [...b.map((hi, i) => ({ key: "b" + i, lo: i ? b[i - 1] + 1 : 0, hi, label: `${i ? b[i - 1] + 1 : 0}–${hi} days` })), { key: "b" + b.length, lo: b[b.length - 1] + 1, hi: 99999, label: `Over ${b[b.length - 1]} days` }];

const STATUS = { open: ["Open", "pill-draft"], in_progress: ["In progress", "pill-pending"], pending_approval: ["Closure pending checker", "pill-pending"], closed: ["Closed", "pill-active"] };
const priority = (e) => Math.round((Math.log10(Math.max(1000, e.amount)) * 10) * (e.interestHoursLeft < 24 ? 3 : e.interestHoursLeft < 48 ? 2 : 1) + e.ageHours / 6);

export default function Exceptions() {
  const { collections, perms, act, currentUser, personaUser, simple, upsert, amcUser } = useStore();
  const ST = simple ? PLAIN_CASE_STATUS : STATUS;
  const typeLabel = (t) => (simple && PLAIN_EXCEPTION[t]) || t;
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const all = scopeToUser(collections, amcUser).exceptions; // this person's AMCs only
  const bounds = (collections.settings || []).find((x) => x.id === "aging")?.bounds || [5, 10, 20];
  const buckets = bucketsFrom(bounds);
  const [age, setAge] = React.useState(sp.get("age") || null);
  const [editBuckets, setEditBuckets] = React.useState(null);
  const canConfigure = hasCap(perms, "exceptions", "approve") || hasCap(perms, "exceptions", "export") && hasCap(perms, "inbox", "approve");
  const canEdit = hasCap(perms, "exceptions", "edit");
  const canApprove = hasCap(perms, "exceptions", "approve");
  const [view, setView] = React.useState(simple ? "mine" : sp.get("risk") ? "risk" : canApprove && !canEdit ? "approval" : "open");
  const [type, setType] = React.useState("all");
  const [sel, setSel] = React.useState([]);
  const [openId, setOpenId] = React.useState(sp.get("case"));
  const [cause, setCause] = React.useState("");
  const [note, setNote] = React.useState("");

  const VIEWS = simple ? [
    ["mine", "My cases", (e) => e.owner === personaUser.name && e.status !== "closed"],
    ["unassigned", "Nobody working on these", (e) => !e.owner && e.status !== "closed"],
    ["closed", "Done", (e) => e.status === "closed" && e.owner === personaUser.name],
  ] : [
    ["open", "All open", (e) => e.status !== "closed"],
    ["mine", "My cases", (e) => e.owner === personaUser.name && e.status !== "closed"],
    ["unassigned", "Unassigned", (e) => !e.owner && e.status !== "closed"],
    ["risk", "Interest clock < 24h", (e) => e.status !== "closed" && e.amount > 0 && e.interestHoursLeft < 24],
    ["approval", "Closure pending checker", (e) => e.status === "pending_approval"],
    ["closed", "Closed", (e) => e.status === "closed"],
  ];
  const vf = (VIEWS.find((v) => v[0] === view) || VIEWS[0])[2];
  const ageFilter = (e) => !age || (age === "over5" ? ageDays(e) > THRESHOLD_DAYS : (() => { const b = buckets.find((x) => x.key === age); return b && ageDays(e) >= b.lo && ageDays(e) <= b.hi; })());
  // With an aging filter on, oldest and highest-value first; otherwise the usual priority score.
  const rows = all.filter(vf).filter((e) => type === "all" || e.type === type).filter(ageFilter)
    .sort((a, b) => (age ? ageDays(b) - ageDays(a) || b.amount - a.amount : priority(b) - priority(a)));
  const saveBuckets = () => {
    const b = editBuckets.map(Number);
    if (b.some((x) => !Number.isInteger(x) || x < 1) || b.some((x, i) => i && x <= b[i - 1])) { toast.error("Use whole days in increasing order, e.g. 5, 10, 20"); return; }
    upsert("settings", { id: "aging", bounds: b, by: currentUser, at: new Date().toISOString() });
    toast.success(`Aging buckets set to ${bucketsFrom(b).map((x) => x.label).join(" · ")}`); setEditBuckets(null);
  };
  const followUp = (e, kind) => {
    const text = kind === "remit" ? `Asked ${e.bankName} for remittance details (remitter name, account, purpose) for ${inr(e.amount)}` : kind === "amc" ? "Asked the AMC / distributor whether this payment belongs to one of their investors" : "";
    if (update(e, { status: "in_progress", owner: e.owner || personaUser.name, followUps: [...(e.followUps || []), { kind, at: new Date().toISOString(), by: personaUser.name }], notes: [...(e.notes || []), { by: personaUser.name, at: new Date().toISOString(), text }] }, kind === "remit" ? "Request remittance details" : "Ask AMC / distributor", text)) toast.success("Follow-up recorded on the case");
  };
  const open = all.find((e) => e.id === openId);

  const update = (e, patch, action, comment, cap = "edit") => {
    const res = act({ screen: "exceptions", cap, kind: "exceptions", id: e.id, target: e, patch, audit: { entityLabel: `${e.ref} · ${e.type}`, action, from: STATUS[e.status][0], to: STATUS[patch.status || e.status][0], comment } });
    if (!res.ok) toast.error(res.error);
    return res.ok;
  };
  const bulkAssign = () => {
    let n = 0; sel.forEach((id) => { const e = all.find((x) => x.id === id); if (e && update(e, { owner: personaUser.name, status: e.status === "open" ? "in_progress" : e.status }, "Assign", `Assigned to ${personaUser.name}`)) n++; });
    toast.success(simple ? `${n} case${n !== 1 ? "s are" : " is"} now yours` : `${n} case(s) assigned to you`); setSel([]);
  };
  const requestClose = (e) => {
    if (!cause) { toast.error(simple ? "Please pick why this happened" : "Pick a root cause — it feeds the trends view"); return; }
    if (update(e, { status: "pending_approval", rootCause: cause, owner: e.owner || personaUser.name, closedBy: currentUser }, "Request closure", `Root cause: ${cause}`)) { toast.success(simple ? "Done from your side. Your team lead will approve it." : "Sent to a checker to confirm closure"); setCause(""); }
  };
  const decideClose = (e, yes) => {
    const target = { ...e, owner: e.closedBy };
    const res = act({ screen: "exceptions", cap: "approve", kind: "exceptions", id: e.id, target, patch: { status: yes ? "closed" : "in_progress" }, audit: { entityLabel: `${e.ref} · ${e.type}`, action: yes ? "Approve closure" : "Reopen case", from: "Closure pending checker", to: yes ? "Closed" : "In progress" } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(yes ? "Case closed" : "Case sent back to the maker");
  };
  const addNote = (e) => { if (!note.trim()) return; if (update(e, { notes: [...(e.notes || []), { by: personaUser.name, at: new Date().toISOString(), text: note.trim() }] }, "Add note", note.trim())) setNote(""); };
  const runSuggestion = (e) => {
    if (e.suggestion.action.startsWith("Open in Match")) return nav("/match");
    if (e.suggestion.action.startsWith("Open File")) return nav("/ingestion");
    if (e.suggestion.action.startsWith("Create refund")) {
      const refId = "rf_" + e.id;
      if ((collections.refunds || []).some((r) => r.id === refId)) return nav(`/refunds?refund=${refId}`);
      const amount = e.type === "Excess credit" ? Math.round(e.amount * 0.2) : e.amount;
      const reason = { "Unmatched credit": "Unidentified credit — returned to source", "Cross collection": "Unidentified credit — returned to source", "Excess credit": "Investor paid too much", "Duplicate credit": "Investor paid twice", "NIGO rejection": "Application rejected — refund needed" }[e.type] || "Refund";
      upsert("refunds", { id: refId, ref: "RF-" + e.ref.slice(4), investor: e.investor, pan: "—", amount, reason, ageDays: Math.floor(e.ageHours / 24), bankAcct: "XXXX" + String(1000 + (e.ref.charCodeAt(6) * 37) % 9000), ifsc: "—", verified: null, status: "draft", owner: personaUser.name, sourceCase: e.id, createdAt: new Date().toISOString() });
      update(e, { status: "in_progress", owner: e.owner || personaUser.name, notes: [...(e.notes || []), { by: personaUser.name, at: new Date().toISOString(), text: `Refund ${"RF-" + e.ref.slice(4)} created for ${inr(amount)}` }] }, "Create refund", `Refund of ${inr(amount)}`);
      toast.success(simple ? "Refund created. Finish it on the Refunds page." : "Refund drafted and linked to this case", { action: { label: "Open refund", onClick: () => nav(`/refunds?refund=${refId}`) } });
      return;
    }
    if (update(e, { status: "in_progress", owner: e.owner || personaUser.name, notes: [...(e.notes || []), { by: personaUser.name, at: new Date().toISOString(), text: `Ran suggested step: ${e.suggestion.action}` }] }, e.suggestion.action, e.suggestion.text)) toast.success(`${e.suggestion.action} — logged on the case`);
  };

  const causes = ROOT_CAUSES.map((c) => ({ c, n: all.filter((e) => e.rootCause === c).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const maxCause = Math.max(1, ...causes.map((x) => x.n));
  const openList = all.filter((e) => e.status !== "closed");

  return (
    <div data-testid="exceptions">
      <JourneyBar current="cases" />
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Siren size={24} /> {simple ? "Problem cases" : "Exceptions"}</h1>
          {simple ? <p>Payments that could not be sorted out automatically. Most urgent at the top.</p> : <p>One workbench for every exception type. Each case has an owner, a ₹ amount, an interest clock, a suggested fix and a root cause. Highest priority first.</p>}
        </div>
        {!simple && <div className="actions">
          <PhaseBadge phase="P2">cases · SLA & interest clock · root causes · bulk actions</PhaseBadge>
          {hasCap(perms, "exceptions", "export") && <button className="btn btn-outline btn-sm" onClick={() => toast.success(`Exported ${rows.length} cases to CSV`)}><Download size={14} /> Export</button>}
        </div>}
      </div>
      {!canEdit && !canApprove && <ReadOnlyNote what="Maker" />}

      {!simple && <div className="ops-stats">
        <Stat label="Open cases" value={openList.length} sub={inrShort(openList.reduce((s, e) => s + e.amount, 0)) + " total"} onClick={() => setView("open")} />
        <Stat label="Interest clock < 24h" value={openList.filter((e) => e.amount > 0 && e.interestHoursLeft < 24).length} sub="Work these first" tone="red" onClick={() => setView("risk")} id="ex-risk" />
        <Stat label="Unassigned" value={openList.filter((e) => !e.owner).length} sub="Pick up or bulk-assign" tone="amber" onClick={() => setView("unassigned")} />
        <Stat label="Closure pending checker" value={all.filter((e) => e.status === "pending_approval").length} sub="Maker–checker on closure" tone="blue" onClick={() => setView("approval")} />
      </div>}

      <AgingPanel list={openList} buckets={buckets} active={age} onPick={(k) => { setAge(age === k ? null : k); setView(simple ? "unassigned" : "open"); }}
        canConfigure={canConfigure} editing={editBuckets} setEditing={setEditBuckets} bounds={bounds} onSave={saveBuckets} showBreach={canApprove || hasCap(perms, "exceptions", "export")} />
      {age && <div className="age-chip-row"><span className="pill pill-pending"><span className="dot" />Showing {age === "over5" ? `cases past the ${THRESHOLD_DAYS}-day threshold` : buckets.find((b) => b.key === age)?.label} · oldest and largest first</span><button className="link" onClick={() => setAge(null)}>Clear</button></div>}

      <div className={"ex-layout" + (simple ? " single" : "")}>
        <div className="card">
          <div className="toolbar" style={{ flexWrap: "wrap" }}>
            <div className="segmented">{VIEWS.map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => { setView(k); setSel([]); }} data-testid={"ex-view-" + k}>{l}</button>)}</div>
            {!simple && <select className="select" style={{ maxWidth: 200 }} value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{EXCEPTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}
            {sel.length > 0 && canEdit && <button className="btn btn-primary btn-sm" onClick={bulkAssign} data-testid="bulk-assign"><UserPlus size={13} /> {simple ? `Take ${sel.length} case${sel.length !== 1 ? "s" : ""}` : `Assign ${sel.length} to me`}</button>}
          </div>
          <table className="grid" data-testid="ex-table">
            <thead><tr><th style={{ width: 30 }} /><th>Case</th><th>{simple ? "What happened" : "Type"}</th><th>Investor / bank</th><th style={{ textAlign: "right" }}>Amount</th><th>{simple ? "Time left" : "Interest clock"}</th><th>{simple ? "Who" : "Owner"}</th><th>Status</th>{!simple && <th style={{ textAlign: "right" }}>Priority</th>}</tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} onClick={() => setOpenId(e.id)} style={{ cursor: "pointer" }} data-testid={"ex-row-" + e.id}>
                  <td onClick={(ev) => ev.stopPropagation()}><input type="checkbox" className="cb" disabled={!canEdit} checked={sel.includes(e.id)} onChange={() => setSel((s) => s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id])} /></td>
                  <td className="tnum">{e.ref}{ageDays(e) > THRESHOLD_DAYS && e.amount > 0 && <span className="age-tag" title={`${ageDays(e)} days old`}>{ageDays(e)}d</span>}{e.amount >= HIGH_VALUE && <span className="hv-tag">High value</span>}</td>
                  <td>{typeLabel(e.type)}</td>
                  <td>{e.investor}<div className="muted">{e.bankName}</div></td>
                  <td className="tnum" style={{ textAlign: "right" }}>{e.amount ? inrShort(e.amount) : "—"}</td>
                  <td>{e.amount ? <span className={"clock " + (e.interestHoursLeft < 24 ? "red" : e.interestHoursLeft < 48 ? "amber" : "")}><Hourglass size={12} /> {simple ? timeLeftWords(e.interestHoursLeft) : dur(e.interestHoursLeft)}</span> : <span className="muted">{simple ? "—" : "n/a"}</span>}</td>
                  <td>{e.owner === personaUser.name && simple ? "You" : e.owner || <span className="muted">{simple ? "Nobody yet" : "Unassigned"}</span>}</td>
                  <td><span className={"pill " + ST[e.status][1]}><span className="dot" />{ST[e.status][0]}</span></td>
                  {!simple && <td className="tnum" style={{ textAlign: "right" }}><b>{priority(e)}</b></td>}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: "center", padding: 30 }}>{simple && view === "mine" ? "You have no open cases. Check \"Nobody working on these\" to pick one up." : "No cases in this view."}</td></tr>}
            </tbody>
          </table>
        </div>

        {!simple && <div className="card">
          <div className="card-head"><h3>Root-cause trends</h3><span className="muted">From closed cases</span></div>
          <div className="card-pad">
            {causes.map((x) => (
              <div key={x.c} className="cause-row"><span>{x.c}</span><span className="fn-bar tone-violet"><i style={{ width: `${(x.n / maxCause) * 100}%` }} /></span><b>{x.n}</b></div>
            ))}
            <div className="muted" style={{ marginTop: 10 }}>A spike in "Bank narration format changed" points to a bank file layout change. Check Bank files.</div>
          </div>
        </div>}
      </div>

      {open && (
        <Drawer id="case-drawer" title={`${open.ref} — ${typeLabel(open.type)}`} subtitle={`${open.investor} · ${open.bankName} · opened ${timeAgo(open.createdAt)}`} onClose={() => setOpenId(null)}>
          <div className="kv-line"><span>Amount</span><b className="tnum">{open.amount ? inr(open.amount) : "—"}</b></div>
          <div className="kv-line"><span>{simple ? "Time left" : "Interest clock"}</span>{open.amount ? <span className={"clock " + (open.interestHoursLeft < 24 ? "red" : "")}><Hourglass size={12} /> {simple ? (open.interestHoursLeft <= 0 ? "Late — penalty interest is already running" : `${timeLeftWords(open.interestHoursLeft)} before penalty interest starts`) : `${dur(open.interestHoursLeft)} until delayed interest accrues`}</span> : <span className="muted">n/a</span>}</div>
          <div className="kv-line"><span>{simple ? "Who" : "Owner"}</span>{open.owner || (simple ? "Nobody yet" : "Unassigned")}</div>
          <div className="kv-line"><span>Status</span><span className={"pill " + ST[open.status][1]}><span className="dot" />{ST[open.status][0]}</span></div>

          <div className="kv-line"><span>Age</span><b className={ageDays(open) > THRESHOLD_DAYS ? "age-red" : ""}>{ageDays(open)} day{ageDays(open) !== 1 ? "s" : ""}{ageDays(open) > THRESHOLD_DAYS ? ` · past the ${THRESHOLD_DAYS}-day threshold` : ""}</b></div>
          {["Unmatched credit", "Excess credit", "Cross collection"].includes(open.type) && (
            <div className="fd-section" data-testid="investigate">
              <h4>Find out who sent this money</h4>
              <p className="muted" style={{ marginTop: 0 }}>Nothing on our side matches this credit. Ask for the remittance details; if nobody claims it, return it to the source account.</p>
              <ul className="ph-list small">{(open.followUps || []).map((f, i) => <li key={i} className="ok"><i /><div>{f.kind === "remit" ? "Remittance details requested from the bank" : "AMC / distributor asked"} · {f.by} · {timeAgo(f.at)}</div></li>)}</ul>
              {canEdit && open.status !== "closed" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-outline btn-sm" onClick={() => followUp(open, "remit")} data-testid="ask-remittance">Ask bank for remittance details</button>
                <button className="btn btn-outline btn-sm" onClick={() => followUp(open, "amc")}>Ask AMC / distributor</button>
                {ageDays(open) > THRESHOLD_DAYS && <button className="btn btn-outline btn-sm" onClick={() => runSuggestion({ ...open, suggestion: { action: "Create refund (unidentified)" } })} data-testid="refund-source">Return to source account</button>}
              </div>}
            </div>
          )}

          <div className="fd-section suggestion-box">
            <h4><Sparkles size={14} /> {simple ? "What to do" : "Suggested resolution"} {!simple && <Conf value={open.suggestion.conf} />}</h4>
            <p>{simple ? stripNumbers(open.suggestion.text) : open.suggestion.text}</p>
            {canEdit && open.status !== "closed" && open.status !== "pending_approval" && <button className="btn btn-fill btn-sm" onClick={() => runSuggestion(open)} data-testid="run-suggestion">{simple ? open.suggestion.action.replace("Match Workbench", "Match payments").replace("File Inbox", "Bank files today") : open.suggestion.action}</button>}
          </div>

          {canEdit && ["open", "in_progress"].includes(open.status) && (
            <div className="fd-section">
              <h4>{simple ? "Finished? Tell us why it happened" : "Close case"}</h4>
              <select className="select" value={cause} onChange={(e) => setCause(e.target.value)} data-testid="root-cause"><option value="">{simple ? "Pick one…" : "Root cause (required)…"}</option>{ROOT_CAUSES.map((c) => <option key={c}>{c}</option>)}</select>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => requestClose(open)} data-testid="request-close"><Check size={13} /> {simple ? "Mark as done" : "Request closure"}</button>
            </div>
          )}
          {open.status === "pending_approval" && (
            <div className="fd-section">
              <h4>{simple ? `Marked done by ${open.closedBy || open.owner} — waiting for approval` : `Closure requested by ${open.closedBy || open.owner} · root cause: ${open.rootCause}`}</h4>
              {canApprove && (open.closedBy || open.owner) !== currentUser && !(open.closedBy || "").startsWith(currentUser) ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => decideClose(open, false)}><X size={13} /> Send back</button>
                  <button className="btn btn-success btn-sm" onClick={() => decideClose(open, true)} data-testid="approve-close"><Check size={13} /> Approve closure</button>
                </div>
              ) : <span className="muted">Waiting for a checker.</span>}
            </div>
          )}

          <div className="fd-section">
            <h4><MessageSquare size={14} /> Notes</h4>
            {(open.notes || []).map((n, i) => <div key={i} className="note-item"><b>{n.by}</b> <span className="muted">{timeAgo(n.at)}</span><div>{n.text}</div></div>)}
            {(open.notes || []).length === 0 && <div className="muted">No notes yet.</div>}
            {canEdit && <div style={{ display: "flex", gap: 8, marginTop: 8 }}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the next person…" /><button className="btn btn-outline btn-sm" onClick={() => addNote(open)}>Add</button></div>}
          </div>
        </Drawer>
      )}
    </div>
  );
}

/** Aging of unresolved cases: count and ₹ per bucket, the 5-day threshold, and a breach summary for managers. */
function AgingPanel({ list, buckets, active, onPick, canConfigure, editing, setEditing, bounds, onSave, showBreach }) {
  const money = list.filter((e) => e.amount > 0);
  const cells = buckets.map((b) => { const l = money.filter((e) => ageDays(e) >= b.lo && ageDays(e) <= b.hi); return { ...b, n: l.length, amt: l.reduce((s, e) => s + e.amount, 0), past: b.lo > THRESHOLD_DAYS || b.hi > THRESHOLD_DAYS }; });
  const breach = money.filter((e) => ageDays(e) > THRESHOLD_DAYS);
  const oldest = breach.reduce((m, e) => Math.max(m, ageDays(e)), 0);
  const maxN = Math.max(1, ...cells.map((c) => c.n));
  return (
    <div className="card aging-card" data-testid="aging">
      <div className="card-head">
        <h3>How old are unresolved payments?</h3>
        <span className="muted">Count and amount per age band · click a band to list those cases, oldest and largest first</span>
        {canConfigure && !editing && <button className="link" style={{ marginLeft: "auto" }} onClick={() => setEditing(bounds.map(String))} data-testid="edit-buckets">Change bands</button>}
      </div>
      {editing && <div className="bucket-edit">Band edges (days):{editing.map((v, i) => <input key={i} className="input tnum" value={v} onChange={(e) => setEditing(editing.map((x, j) => (j === i ? e.target.value : x)))} data-testid={"bucket-" + i} />)}<button className="btn btn-primary btn-sm" onClick={onSave}>Save</button><button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button></div>}
      <div className="aging-grid">
        {cells.map((c) => (
          <button key={c.key} className={"aging-cell" + (c.lo > THRESHOLD_DAYS ? " past" : "") + (active === c.key ? " on" : "")} onClick={() => onPick(c.key)} data-testid={"age-" + c.key}>
            <span className="ac-label">{c.label}</span>
            <b className="tnum">{c.n}</b>
            <span className="tnum">{inrShort(c.amt)}</span>
            <i style={{ width: `${(c.n / maxN) * 100}%` }} />
          </button>
        ))}
      </div>
      {showBreach && (
        <div className="breach-row" data-testid="breach-summary">
          <span><b>{breach.length}</b> case{breach.length !== 1 ? "s" : ""} past the {THRESHOLD_DAYS}-day threshold · <b>{inrShort(breach.reduce((s, e) => s + e.amount, 0))}</b> · oldest {oldest} days · {breach.filter((e) => e.amount >= HIGH_VALUE).length} high-value (₹10 L+)</span>
          <button className="btn btn-outline btn-sm" onClick={() => onPick("over5")} data-testid="show-breaches">Show breaches</button>
        </div>
      )}
      <div className="muted aging-note">The 5-day threshold and how age is counted (calendar vs business days, by transaction type) must be checked against the applicable SEBI requirements before production.</div>
    </div>
  );
}
