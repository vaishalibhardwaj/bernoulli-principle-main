import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { inrShort, Light } from "@/features/ops/ui";
import { useApprovals } from "@/features/approvals/useApprovals";
import { RELEASE_CUTOFF } from "@/mock/opsSeed";
import { Drawer } from "@/components/Drawer";
import { Modal } from "@/components/Modal";
import { TiltCard, RingProgress, CountUp } from "@/features/viz/Viz";
import { downloadCsv } from "@/features/reports/csv";
import { useCycle } from "./Cycle";
import { useWorkItems } from "./workItems";
import { ArrowRight, ArrowLeft, Hourglass, Clock, Sun, ShieldCheck, Download, Flag, Check, ListChecks, Sparkles, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

function useCutoff() {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  return Math.round((new Date(RELEASE_CUTOFF) - now) / 60000);
}

const STEP_KEY = { 1: "files", 2: "match", 3: "cases", 4: "release", 5: "refunds", 6: "close" };
const SHORT = { files: "Bank files", match: "Match payments", cases: "Problem cases", release: "Release money", refunds: "Send refunds", close: "Close the day" };

/** The day as a glowing track: six stations, progress line up to the last finished one. */
function CycleTrack({ steps, others, mine, onPick, assigned, checker }) {
  const doneIdx = steps.reduce((m, s, i) => (s.state === "done" ? i : m), -1);
  const done = steps.filter((s) => s.state === "done").length;
  const pending = steps.filter((s) => s.state !== "done").reduce((n, s) => n + ((checker ? s.waitingOn : s.count) || 0), 0);
  if (!steps.length) return null;
  return (
    <div className="track card" data-testid="daily-cycle">
      <div className="track-head">
        <b>Your steps today</b>
        <span className="muted">{done} of {steps.length} done · {pending} item{pending !== 1 ? "s" : ""} {checker ? "waiting for your approval" : "pending"}{assigned ? " · steps assigned to you by your admin" : " · from your roles"}</span>
        {others.length > 0 && <span className="track-others" title={others.map((s) => s.title).join(", ")}>Other teams handle: {others.map((s) => SHORT[s.key]).join(", ")}</span>}
      </div>
      <ol style={{ "--n": steps.length }}>
        <div className="track-line"><motion.i initial={{ width: 0 }} animate={{ width: `${steps.length > 1 ? (Math.max(0, doneIdx) / (steps.length - 1)) * 100 : done ? 100 : 0}%` }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} /></div>
        {steps.map((s) => (
          <li key={s.key} className={"st " + s.state + (s.late ? " late" : "") + (mine === s.key ? " mine" : "")} onClick={() => onPick(s)} data-testid={"cycle-" + s.key} title={s.why}>
            <span className="st-node">{s.state === "done" ? <Check size={14} strokeWidth={3} /> : s.state === "waiting" ? <Hourglass size={12} /> : s.n}</span>
            <b>{SHORT[s.key]}</b>
            <small>{s.late && s.state !== "done" ? "late · was due " : "by "}{s.by}</small>
            {mine === s.key && <em>You're here</em>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Today() {
  const { collections, perms, personaUser, act, audit, currentUser } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const { steps, others, next } = useCycle();
  const work = useWorkItems();
  const approvals = useApprovals().filter((a) => !a.own);
  const isChecker = hasCap(perms, "inbox", "approve");
  const mins = useCutoff();
  const [idx, setIdx] = React.useState(0);
  const [queueOpen, setQueueOpen] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(loc.hash === "#close");
  const [note, setNote] = React.useState("");

  const first = personaUser.name.split(" ")[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayStr = new Date().toDateString();
  const doneToday = audit.filter((a) => a.user === first && !a.denied && new Date(a.ts).toDateString() === todayStr).length;
  const release = (collections.releases || [])[0] || { status: "not_started" };
  const close = (collections.dayclose || [])[0] || { status: "open" };
  const canSubmitClose = hasCap(perms, "match", "edit") || hasCap(perms, "release", "edit");
  const canSignClose = hasCap(perms, "release", "approve");
  const carried = (collections.exceptions || []).filter((e) => e.status !== "closed").length;
  const waitingMine = [
    ...(collections.matches || []).filter((m) => m.status === "pending" && m.owner === first),
    ...(collections.exceptions || []).filter((e) => e.status === "pending_approval" && e.closedBy === first),
    ...(collections.refunds || []).filter((r) => r.status === "pending" && (r.owner || "").startsWith(first)),
    ...(collections.documents || []).filter((d) => d.status === "pending_checker" && d.owner === first),
  ].length;

  // ---- One queue, in the order the day needs it ----
  const queue = React.useMemo(() => {
    const q = [];
    if (isChecker) {
      approvals.forEach((a) => q.push({
        id: a.kind + a.id, tone: a.urgent ? "red" : "amber", kind: a.kind, title: a.title, detail: a.detail, hint: `Sent by ${a.owner || "—"}`,
        primary: a.approve || a.config ? { label: "Approve", run: () => { const r = (a.approve || a.config.approve)(); if (r && r.ok === false) toast.error(r.error); else toast.success(`${a.kind} approved`); } } : { label: "Review", run: () => nav(a.review) },
        secondary: a.reject ? (a.needsComment ? { label: "Review & send back", run: () => nav(`/approvals?kind=${encodeURIComponent(a.kind)}`) } : { label: "Send back", run: () => { const r = a.reject(); if (r && r.ok === false) toast.error(r.error); else toast("Sent back to " + (a.owner || "the maker")); } }) : null,
        more: { label: "Open in Approvals", run: () => nav("/approvals") },
      }));
    } else {
      if (hasCap(perms, "release", "edit") && release.status === "not_started" && steps.some((s) => s.key === "release")) {
        q.push({ id: "release", tone: mins < 120 ? "red" : "amber", kind: "Release money", step: 4, title: "Prepare today's fund release", detail: "Matched, realised money goes to Transaction Posting so units can be allotted", when: mins > 0 ? `Cut-off in ${Math.floor(mins / 60)}h ${mins % 60}m` : "Cut-off passed", hint: "One click — your checker releases it", primary: { label: "Prepare release", run: () => nav("/release") } });
      }
      const myKeys = steps.map((s) => s.key);
      work.filter((w) => !w.step || myKeys.includes(STEP_KEY[w.step])).forEach((w) => q.push(w));
    }
    if (steps.some((s) => s.key === "close") && (canSubmitClose && close.status === "open") || (canSignClose && close.status === "pending" && !(close.submittedBy || "").startsWith(first))) {
      q.push({ id: "close", tone: "green", kind: "Close the day", step: 6, title: close.status === "pending" ? "Sign off today's reconciliation" : "Close the day when you're done", detail: close.status === "pending" ? `Submitted by ${close.submittedBy}` : `${carried} open items will carry forward`, hint: "Produces the day summary for the AMCs", primary: { label: close.status === "pending" ? "Sign off" : "Close the day", run: () => setCloseOpen(true) } });
    }
    const order = { red: 0, amber: 1, green: 2 };
    return q.sort((a, b) => (a.id === "close") - (b.id === "close") || order[a.tone] - order[b.tone]);
  }, [isChecker, approvals, work, perms, release.status, mins, canSubmitClose, canSignClose, close.status, close.submittedBy, carried, first, nav, steps]);

  const i = Math.min(idx, Math.max(0, queue.length - 1));
  const focus = queue[i];
  const upNext = queue.slice(i + 1, i + 4);
  const doneSteps = steps.filter((s) => s.state === "done").length;
  const mine = isChecker ? steps.find((s) => s.waitingOn)?.key || null : (focus?.step ? STEP_KEY[focus.step] : next?.key);

  // "Welcome back": what changed in this person's queue since they last opened Today (after a break or a new login).
  const seenKey = `cams_seen_${personaUser.id}`;
  const since = React.useMemo(() => { try { return JSON.parse(localStorage.getItem(seenKey) || "null"); } catch (e) { return null; } }, [seenKey]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { try { localStorage.setItem(seenKey, JSON.stringify({ at: Date.now(), ids: queue.map((q) => q.id) })); } catch (e) { /* storage unavailable */ } }, [seenKey, queue]);
  const [hideBack, setHideBack] = React.useState(false);
  const newSince = since ? queue.filter((q) => !since.ids.includes(q.id)) : [];
  const clearedSince = since ? since.ids.filter((id) => !queue.some((q) => q.id === id)).length : 0;

  const submitClose = () => {
    const res = act({ screen: "release", cap: "edit", kind: "dayclose", id: "day_today", patch: { status: "pending", submittedBy: currentUser, carried, note: note.trim(), submittedAt: new Date().toISOString() }, audit: { entityLabel: "Day close", action: "Submit day close", from: "Open", to: "Pending", comment: `${carried} items carried forward` } });
    if (res.ok) { toast.success("Sent to your checker to sign off the day."); setCloseOpen(false); } else toast.error(res.error);
  };
  const signClose = () => {
    const res = act({ screen: "release", cap: "approve", kind: "dayclose", id: "day_today", target: { owner: close.submittedBy }, patch: { status: "closed", closedBy: currentUser, closedAt: new Date().toISOString() }, audit: { entityLabel: "Day close", action: "Sign off day", from: "Pending", to: "Closed" } });
    if (res.ok) { toast.success("Day signed off. Summary sent to AMCs."); setCloseOpen(false); } else toast.error(res.error);
  };
  const daySummary = () => downloadCsv(`day_summary_${new Date().toISOString().slice(0, 10)}.csv`, ["Step", "Status", "Detail"], steps.map((s) => [s.title, s.state, s.summary]));

  return (
    <div className="deck" data-testid="today">
      <div className="deck-head">
        <div>
          <div className="eyebrow-sm"><Sun size={13} /> {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1>{greet}, {first}</h1>
        </div>
        <span className={"cutoff-chip" + (mins < 60 ? " hot" : "")}><Clock size={13} /> Fund release cut-off {mins > 0 ? `in ${Math.floor(mins / 60)}h ${mins % 60}m` : "passed"}</span>
      </div>

      {since && !hideBack && (newSince.length > 0 || clearedSince > 0) && (
        <div className="welcome-back" data-testid="welcome-back">
          <Sun size={15} />
          <span>Welcome back. Since {new Date(since.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}: <b>{newSince.length} new</b> item{newSince.length !== 1 ? "s" : ""} in your queue{clearedSince ? `, ${clearedSince} cleared` : ""}. You have {queue.length} in total.</span>
          <button className="link" onClick={() => setQueueOpen(true)} data-testid="wb-open-queue">See my full queue</button>
          <button className="icon-btn" onClick={() => setHideBack(true)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <div className="deck-hero">
        {/* 1 — The one thing to do now */}
        <TiltCard className={"focus-card tone-" + (focus?.tone || "green")} max={4} data-testid="next-action">
          <div className="fc-top">
            <span className="fc-eyebrow"><Sparkles size={13} /> {isChecker ? "Your focus for today: approvals" : "Your focus for today"}</span>
            {focus && <span className="fc-count">{i + 1} <em>of {queue.length}</em></span>}
          </div>
          <AnimatePresence mode="wait">
            {focus ? (
              <motion.div key={focus.id} className="fc-body" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
                <div className="fc-kind">{focus.step && <span className="step-chip">{SHORT[STEP_KEY[focus.step]]}</span>}{focus.kind}{focus.light && <Light tone={focus.tone}>{focus.light}</Light>}</div>
                <h2>{focus.title}</h2>
                <p>{focus.detail}</p>
                <div className="fc-hint">{focus.when && <span className={"mw-when " + focus.tone}><Hourglass size={13} /> {focus.when}</span>}{focus.hint}</div>
                <div className="fc-actions">
                  <button className="btn btn-primary btn-lg" onClick={focus.primary.run} data-testid="next-action-btn">{focus.primary.label} <ArrowRight size={16} /></button>
                  {focus.secondary && <button className="btn btn-outline btn-lg" onClick={focus.secondary.run} data-testid="focus-secondary">{focus.secondary.label}</button>}
                  {focus.more && <button className="link" onClick={focus.more.run}>{focus.more.label}</button>}
                  <div className="fc-nav">
                    <button className="icon-btn" disabled={i === 0} onClick={() => setIdx(i - 1)} aria-label="Previous"><ArrowLeft size={16} /></button>
                    <button className="btn btn-ghost btn-sm" disabled={i >= queue.length - 1} onClick={() => setIdx(i + 1)} data-testid="focus-skip">Skip for now <ArrowRight size={13} /></button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="clear" className="fc-body fc-clear" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <CheckCircle2 size={34} /><h2>You're all clear</h2><p>Nothing is waiting for you. New work appears here automatically.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </TiltCard>

        {/* 2 — Where the day stands */}
        <div className="day-panel card">
          <RingProgress value={doneSteps} max={Math.max(1, steps.length)} label={`of your ${steps.length} steps done`} size={132} />
          <div className="dp-stats">
            <div><span>Done by you</span><b className="fx-num"><CountUp value={doneToday} /></b></div>
            <div><span>{isChecker ? "Waiting for you" : "In your queue"}</span><b className="fx-num"><CountUp value={queue.length} /></b></div>
            <div><span>Waiting for approval</span><b className="fx-num"><CountUp value={waitingMine} /></b></div>
            <div><span>Realised today</span><b className="fx-num">{inrShort(release.amount || 19874410000)}</b></div>
          </div>
        </div>
      </div>

      <CycleTrack checker={isChecker} steps={steps} others={others} assigned={!!personaUser.workflowSteps?.length} mine={mine} onPick={(s) => (s.key === "close" ? setCloseOpen(true) : hasCap(perms, s.screen) ? nav(s.cta.path) : toast(s.summary))} />

      {/* 3 — Only the next three, never an endless list */}
      <div className="upnext card" data-testid="up-next">
        <div className="card-head"><h3><ListChecks size={15} /> Up next</h3>
          <button className="link" onClick={() => setQueueOpen(true)} data-testid="open-queue">See the whole queue ({queue.length}) <ArrowRight size={12} /></button></div>
        {upNext.length === 0 && <div className="card-pad muted">Nothing else after this one.</div>}
        {upNext.map((it, k) => (
          <button key={it.id} className={"un-row tone-" + it.tone} onClick={() => setIdx(i + 1 + k)}>
            <i /><span className="un-kind">{it.kind}</span><span className="un-title">{it.title}</span>{it.when && <span className={"mw-when " + it.tone}>{it.when}</span>}<ArrowRight size={13} />
          </button>
        ))}
      </div>

      {queueOpen && (
        <Drawer id="queue-drawer" title={isChecker ? "Everything waiting for your approval" : "Your whole queue"} subtitle="Pick any item to make it your focus. Red first, then amber, then green." onClose={() => setQueueOpen(false)}>
          <div className="q-list">
            {queue.map((it, k) => (
              <button key={it.id} className={"un-row tone-" + it.tone + (k === i ? " on" : "")} onClick={() => { setIdx(k); setQueueOpen(false); }}>
                <i /><span className="un-num">{k + 1}</span><span className="un-title">{it.title}<small>{it.kind}{it.when ? ` · ${it.when}` : ""}</small></span><ArrowRight size={13} />
              </button>
            ))}
          </div>
        </Drawer>
      )}

      {closeOpen && (canSubmitClose || canSignClose) && (
        <Modal id="close-day" size="lg" title="Close the day" onClose={() => setCloseOpen(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={daySummary}><Download size={13} /> Day summary (CSV)</button>
            <span style={{ flex: 1 }} />
            {close.status === "open" && canSubmitClose && <button className="btn btn-primary" onClick={submitClose} data-testid="submit-close"><Flag size={14} /> Submit day close</button>}
            {close.status === "pending" && canSignClose && !(close.submittedBy || "").startsWith(first) && <button className="btn btn-success" onClick={signClose} data-testid="sign-close"><ShieldCheck size={14} /> Sign off the day</button>}
            <button className="btn btn-outline" onClick={() => setCloseOpen(false)}><X size={14} /> Not yet</button>
          </>}>
          <ul className="cd-check">
            {steps.slice(0, 5).map((s) => <li key={s.key} className={s.state}>{s.state === "done" ? <CheckCircle2 size={15} /> : <Hourglass size={15} />}<span><b>{s.title}</b> — {s.summary}</span></li>)}
          </ul>
          {close.status === "open" && canSubmitClose && <>
            <p className="muted" style={{ margin: "14px 0 8px" }}>Anything not finished carries forward to tomorrow ({carried} open case{carried !== 1 ? "s" : ""}). Leave a note for tomorrow's team.</p>
            <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. SBI statement still missing; chased RM at 3:10 PM" />
          </>}
          {close.status === "pending" && <p style={{ marginTop: 14 }}>Submitted by <b>{close.submittedBy}</b>. {close.carried} item{close.carried !== 1 ? "s" : ""} carried forward.{close.note && <> Note: “{close.note}”</>}</p>}
          {close.status === "closed" && <p style={{ marginTop: 14 }}>Closed by <b>{close.closedBy}</b>. The day summary has gone to the AMCs.</p>}
        </Modal>
      )}
    </div>
  );
}
