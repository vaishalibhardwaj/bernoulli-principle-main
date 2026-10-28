import React from "react";
import { toast } from "sonner";
import { ShieldCheck, Undo2, Check, Repeat, Download, Lightbulb, Ban, CalendarDays } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { timeAgo } from "@/lib/format";
import { downloadCsv } from "@/features/reports/csv";
import { EVENT_TYPES, fmtDay, ageWords } from "@/lib/events";
import { Modal } from "@/components/Modal";

const TABS = [["pending", "Waiting for you"], ["agreed", "Agreed"], ["sent_back", "Sent back"], ["all", "All"]];
const STATUS_TEXT = { pending: "Waiting for review", agreed: "Agreed", sent_back: "Sent back" };

/**
 * Supervisor view of every Today item a maker marked "No action".
 * Each call is verified here (agree, or send back with a note), and the calls roll up into
 * feedback on the event definitions — so noisy events can be tuned by the rule owners.
 */
export default function NoActionReview() {
  const { collections, perms, act, personaUser } = useStore();
  const canReview = hasCap(perms, "no_action_review", "approve");
  const all = collections.no_action || [];
  const [tab, setTab] = React.useState("pending");
  const [who, setWho] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [sendBack, setSendBack] = React.useState(null);
  const [backNote, setBackNote] = React.useState("");

  const people = [...new Set(all.map((n) => n.by))].sort();
  const rows = all
    .filter((n) => (tab === "all" || n.status === tab) && (who === "all" || n.by === who) && (type === "all" || n.eventType === type))
    .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || new Date(a.firstAt) - new Date(b.firstAt));
  const count = (st) => all.filter((n) => n.status === st).length;

  const review = (n, status, reviewNote) => {
    const res = act({ screen: "no_action_review", cap: "approve", kind: "no_action", id: n.id, target: { owner: n.by }, patch: { status, reviewNote, reviewedAt: new Date().toISOString(), reviewedBy: personaUser.name },
      audit: { entityLabel: n.title, action: status === "agreed" ? "Agree No action" : "Send back No action", from: "Waiting for review", to: STATUS_TEXT[status], comment: reviewNote } });
    if (!res.ok) { toast.error(res.error); return false; }
    toast.success(status === "agreed" ? `Agreed. Counted in the feedback on “${n.kind}”.` : `Sent back to ${n.by} — it is back on their Today list.`);
    return true;
  };

  // Feedback on event definitions: how often each event type is marked No action, and why.
  const feedback = Object.entries(all.reduce((m, n) => { (m[n.eventType] = m[n.eventType] || []).push(n); return m; }, {}))
    .map(([et, list]) => {
      const reasons = list.reduce((m, n) => { m[n.reason] = (m[n.reason] || 0) + 1; return m; }, {});
      const [topReason, topN] = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
      const agreed = list.filter((n) => n.status === "agreed").length;
      const people = new Set(list.map((n) => n.by)).size;
      const signal = agreed >= 2 || (list.length >= 2 && people >= 2);
      return { et, def: EVENT_TYPES[et] || { label: et }, total: list.length, agreed, pending: list.filter((n) => n.status === "pending").length, back: list.filter((n) => n.status === "sent_back").length, topReason, topN, people, signal };
    }).sort((a, b) => b.signal - a.signal || b.total - a.total);

  const exportCsv = () => downloadCsv("no_action_feedback.csv", ["Event type", "Dedupes", "Marked No action", "Agreed", "Waiting", "Sent back", "Top reason", "People"],
    feedback.map((f) => [f.def.label, f.def.dedupe ? "Yes" : "No", f.total, f.agreed, f.pending, f.back, f.topReason, f.people]));

  return (
    <div className="nar" data-testid="no-action-review">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><ShieldCheck size={22} /> No-action review</h1>
          <p>Items your team marked “No action” on Today. Agree, or send them back with a note. Every call also feeds the review of how events are defined.</p>
        </div>
        <div className="actions"><button className="btn btn-outline btn-sm" onClick={exportCsv} data-testid="nar-export"><Download size={14} /> Export feedback</button></div>
      </div>

      {!canReview && <div className="fu-callout warn"><Ban size={16} /><div>You can see these calls but not review them. Reviewing needs the Functional Manager (supervisor) role.</div></div>}

      <div className="nar-kpis">
        {[["Waiting for you", count("pending"), "amber", "pending"], ["Agreed", count("agreed"), "green", "agreed"], ["Sent back", count("sent_back"), "red", "sent_back"], ["Event types to tune", feedback.filter((f) => f.signal).length, "blue", null]].map(([l, v, t, k]) => (
          <button key={l} type="button" className={"ah-tile tone-" + t + (k ? " clickable" : "") + (k && tab === k ? " on" : "")} onClick={k ? () => setTab(k) : () => document.getElementById("nar-feedback")?.scrollIntoView({ behavior: "smooth" })}><span>{l}</span><b className="fx-num">{v}</b></button>
        ))}
      </div>

      <div className="nar-grid">
        <div className="card nar-list">
          <div className="nar-toolbar">
            <div className="segmented">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={"nar-tab-" + k}>{l}{k !== "all" && <em>{count(k)}</em>}</button>)}</div>
            <select className="select" value={who} onChange={(e) => setWho(e.target.value)} data-testid="nar-who"><option value="all">Everyone</option>{people.map((p) => <option key={p}>{p}</option>)}</select>
            <select className="select" value={type} onChange={(e) => setType(e.target.value)} data-testid="nar-type"><option value="all">All event types</option>{Object.entries(EVENT_TYPES).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}</select>
          </div>
          {rows.length === 0 && <p className="muted card-pad">Nothing here.</p>}
          {rows.map((n) => (
            <div key={n.id} className={"nar-row s-" + n.status} data-testid={"nar-" + n.id}>
              <div className="nar-item">
                <span className="nar-kind">{n.kind}{EVENT_TYPES[n.eventType]?.dedupe && <em className="rep-badge" title="Repeating event, shown once"><Repeat size={11} /> {n.count}×</em>}</span>
                <b>{n.title}</b>
                <small>{n.detail}{n.amc ? ` · ${n.amc}` : ""}</small>
                <small className="nar-seen"><CalendarDays size={11} /> {EVENT_TYPES[n.eventType]?.dedupe ? "First seen" : "Since"} {fmtDay(n.firstAt)} ({ageWords(n.firstAt)})</small>
              </div>
              <div className="nar-call">
                <span><b>{n.by}</b> · {timeAgo(n.at)}</span>
                <span className="nar-reason">{n.reason}</span>
                {n.comment && <q>{n.comment}</q>}
                {n.status !== "pending" && <small className={"nar-verdict " + n.status}>{STATUS_TEXT[n.status]}{n.reviewedBy ? ` by ${n.reviewedBy}` : ""}{n.reviewNote ? ` — “${n.reviewNote}”` : ""}</small>}
              </div>
              <div className="nar-acts">
                {n.status === "pending" && canReview ? <>
                  <button className="btn btn-primary btn-sm" onClick={() => review(n, "agreed", "")} data-testid={"nar-agree-" + n.id}><Check size={13} /> Agree</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setSendBack(n); setBackNote(""); }} data-testid={"nar-back-" + n.id}><Undo2 size={13} /> Send back</button>
                </> : <span className={"nar-status " + n.status}>{STATUS_TEXT[n.status]}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="card nar-fb" id="nar-feedback" data-testid="nar-feedback">
          <div className="dz-card-h"><Lightbulb size={14} /> Feedback on event definitions</div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>When the same kind of event keeps being marked No action, the event is probably defined too tightly. These go to the rule owners.</p>
          {feedback.map((f) => (
            <div key={f.et} className={"fb-row" + (f.signal ? " hot" : "")}>
              <div className="fb-top"><b>{f.def.label}</b>{f.def.dedupe && <span className="fb-tag">dedupes</span>}<span className="fb-n">{f.total}</span></div>
              <div className="fb-bar"><i className="ag" style={{ flex: f.agreed }} /><i className="pd" style={{ flex: f.pending }} /><i className="bk" style={{ flex: f.back }} /></div>
              <small>{f.agreed} agreed · {f.pending} waiting · {f.back} sent back · {f.people} {f.people === 1 ? "person" : "people"}</small>
              <small>Most given reason: <b>{f.topReason}</b> ({f.topN})</small>
              {f.signal && <small className="fb-suggest">Suggest reviewing this event's definition{f.topReason.startsWith("Expected") ? " — it fires on known, harmless behaviour" : f.topReason.startsWith("Not a real") ? " — it raises false alarms" : ""}.</small>}
            </div>
          ))}
        </div>
      </div>

      {sendBack && (
        <Modal id="nar-sendback" title={`Send back to ${sendBack.by}?`} onClose={() => setSendBack(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setSendBack(null)}>Cancel</button><button className="btn btn-primary" disabled={backNote.trim().length < 5} onClick={() => { if (review(sendBack, "sent_back", backNote.trim())) setSendBack(null); }} data-testid="nar-back-submit">Send back</button></>}>
          <p style={{ marginTop: 0 }}><b>{sendBack.title}</b><br /><span className="muted">{sendBack.by} said: {sendBack.reason}{sendBack.comment ? ` — “${sendBack.comment}”` : ""}</span></p>
          <div className="field"><label className="field-label">What should {sendBack.by.split(" ")[0]} do? (they see this on Today)</label>
            <textarea className="textarea" value={backNote} onChange={(e) => setBackNote(e.target.value)} placeholder="e.g. This account is yours — please chase the bank and upload the statement" data-testid="nar-back-note" /></div>
        </Modal>
      )}
    </div>
  );
}
