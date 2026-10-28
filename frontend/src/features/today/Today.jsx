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
import { EVENT_TYPES, NO_ACTION_REASONS, supervisorOf, isoDay, fmtDay, ageWords, startOfDay } from "@/lib/events";
import { uid } from "@/lib/format";
import { ArrowRight, ArrowLeft, Hourglass, Clock, Sun, ShieldCheck, Download, Flag, ListChecks, Sparkles, CheckCircle2, X, Repeat, Ban, CalendarDays, Inbox } from "lucide-react";
import { toast } from "sonner";

function useCutoff() {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  return Math.round((new Date(RELEASE_CUTOFF) - now) / 60000);
}

const STEP_KEY = { 1: "files", 2: "match", 3: "cases", 4: "release", 5: "refunds", 6: "close" };
const SHORT = { files: "Bank files", match: "Match payments", cases: "Problem cases", release: "Release money", refunds: "Send refunds", close: "Close the day" };

/** "First seen" line: repeating events show their first date and how often they have repeated since. */
function SeenLine({ it }) {
  if (!it.firstAt) return null;
  return (
    <span className="seen-line" title={it.dedupe ? `${EVENT_TYPES[it.eventType]?.label}: shown once — ${EVENT_TYPES[it.eventType]?.why}` : undefined}>
      <CalendarDays size={12} /> {it.dedupe ? "First seen" : "Since"} {fmtDay(it.firstAt)} ({ageWords(it.firstAt)})
      {it.dedupe && it.count > 1 && <em className="rep-badge"><Repeat size={11} /> repeated {it.count}×</em>}
    </span>
  );
}

/** No action: the maker says why; the item leaves their list and goes to their supervisor. */
function NoActionModal({ item, supervisor, onClose, onSubmit }) {
  const [reason, setReason] = React.useState("");
  const [comment, setComment] = React.useState("");
  const ok = reason && (reason !== "Other" || comment.trim().length >= 5);
  return (
    <Modal id="no-action" title="No action needed?" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!ok} onClick={() => onSubmit(reason, comment.trim())} data-testid="na-submit">Send to {supervisor.split(" ")[0]}</button></>}>
      <p style={{ marginTop: 0 }}><b>{item.title}</b><br /><span className="muted">{item.kind} · {EVENT_TYPES[item.eventType]?.label}{item.dedupe && item.count > 1 ? ` · repeated ${item.count}× since ${fmtDay(item.firstAt)}` : ""}</span></p>
      <p className="muted" style={{ fontSize: 13 }}>It leaves your list now. <b>{supervisor}</b> (your supervisor) checks the call, and it also counts as feedback on how this event is defined. If they disagree, it comes back to you with a note.</p>
      <div className="field"><label className="field-label">Why is no action needed?</label>
        <select className="select" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="na-reason">
          <option value="">Pick a reason…</option>
          {NO_ACTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="field" style={{ marginTop: 10 }}><label className="field-label">Note for your supervisor {reason === "Other" ? "(required)" : "(optional)"}</label>
        <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Bank re-sent the corrected file by email; I loaded it by hand" data-testid="na-comment" />
      </div>
    </Modal>
  );
}

export default function Today() {
  const { collections, perms, personaUser, act, audit, currentUser } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const { steps } = useCycle();
  const work = useWorkItems();
  const approvals = useApprovals().filter((a) => !a.own);
  const isChecker = hasCap(perms, "inbox", "approve");
  const mins = useCutoff();
  const [idx, setIdx] = React.useState(0);
  const [queueOpen, setQueueOpen] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(loc.hash === "#close");
  const [note, setNote] = React.useState("");
  const [naItem, setNaItem] = React.useState(null);
  const [showAllPending, setShowAllPending] = React.useState(false);
  // Date range for the focus list; "Overall pending" ignores it. An item counts if it was active at any point in the range.
  const today = isoDay(new Date());
  const [from, setFrom] = React.useState(today);
  const [to, setTo] = React.useState(today);
  const fromTs = startOfDay(from + "T00:00:00").getTime();
  const toTs = startOfDay(to + "T00:00:00").getTime() + 86400000 - 1;
  const inRange = (it) => !it.firstAt || (new Date(it.firstAt).getTime() <= toTs && new Date(it.lastAt || it.firstAt).getTime() >= fromTs);
  const supervisor = supervisorOf(personaUser);
  // My No-action calls: pending or agreed ones leave my list; sent-back ones return with the supervisor's note.
  const myNa = React.useMemo(() => {
    const m = {};
    (collections.no_action || []).filter((n) => n.by === personaUser.name).forEach((n) => { if (!m[n.itemId] || m[n.itemId].at < n.at) m[n.itemId] = n; });
    return m;
  }, [collections.no_action, personaUser.name]);
  const openWork = React.useMemo(() => work.filter((w) => !myNa[w.id] || myNa[w.id].status === "sent_back").map((w) => (myNa[w.id] ? { ...w, sentBack: myNa[w.id] } : w)), [work, myNa]);

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
  const isSetup = hasCap(perms, "bank_setup", "edit") || hasCap(perms, "credit_mis", "edit");
  const isOps = hasCap(perms, "match", "view") || hasCap(perms, "release", "view");
  const waitingMine = [
    ...(collections.bank_config || []).filter((c) => /pending/.test(c.status || "") && c.owner === currentUser),
    ...(collections.credit_config || []).filter((c) => /pending/.test(c.status || "") && c.owner === currentUser),
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
        id: a.kind + a.id, tone: a.urgent ? "red" : "amber", kind: a.kind, eventType: null, firstAt: a.at || a.submittedAt || null, title: a.title, detail: a.detail, hint: `Sent by ${a.owner || "—"}`,
        primary: a.approve || a.config ? { label: "Approve", run: () => { const r = (a.approve || a.config.approve)(); if (r && r.ok === false) toast.error(r.error); else toast.success(`${a.kind} approved`); } } : { label: "Review", run: () => nav(a.review) },
        secondary: a.reject ? (a.needsComment ? { label: "Review & send back", run: () => nav(`/approvals?kind=${encodeURIComponent(a.kind)}`) } : { label: "Send back", run: () => { const r = a.reject(); if (r && r.ok === false) toast.error(r.error); else toast("Sent back to " + (a.owner || "the maker")); } }) : null,
        more: { label: "Open in Approvals", run: () => nav("/approvals") },
      }));
    } else {
      if (hasCap(perms, "release", "edit") && release.status === "not_started" && steps.some((s) => s.key === "release")) {
        q.push({ id: "release", eventType: "release", firstAt: new Date().toISOString(), tone: mins < 120 ? "red" : "amber", kind: "Release money", step: 4, title: "Prepare today's fund release", detail: "Matched, realised money goes to Transaction Posting so units can be allotted", when: mins > 0 ? `Cut-off in ${Math.floor(mins / 60)}h ${mins % 60}m` : "Cut-off passed", hint: "One click — your checker releases it", primary: { label: "Prepare release", run: () => nav("/release") } });
      }
      const myKeys = steps.map((s) => s.key);
      openWork.filter((w) => !w.step || myKeys.includes(STEP_KEY[w.step])).forEach((w) => q.push({ ...w, noActionOk: true }));
    }
    if (steps.some((s) => s.key === "close") && (canSubmitClose && close.status === "open") || (canSignClose && close.status === "pending" && !(close.submittedBy || "").startsWith(first))) {
      q.push({ id: "close", eventType: "day_close", firstAt: new Date().toISOString(), tone: "green", kind: "Close the day", step: 6, title: close.status === "pending" ? "Sign off today's reconciliation" : "Close the day when you're done", detail: close.status === "pending" ? `Submitted by ${close.submittedBy}` : `${carried} open items will carry forward`, hint: "Produces the day summary for the AMCs", primary: { label: close.status === "pending" ? "Sign off" : "Close the day", run: () => setCloseOpen(true) } });
    }
    const order = { red: 0, amber: 1, green: 2 };
    const t = (x) => (x.firstAt ? new Date(x.firstAt).getTime() : Date.now());
    return q.sort((a, b) => (a.id === "close") - (b.id === "close") || order[a.tone] - order[b.tone] || t(a) - t(b));
  }, [isChecker, approvals, openWork, perms, release.status, mins, canSubmitClose, canSignClose, close.status, close.submittedBy, carried, first, nav, steps]);

  // Focus list = the queue within the date range. Overall pending = every open item, no date limit, oldest first.
  const ranged = queue.filter(inRange); // eslint-disable-line react-hooks/exhaustive-deps
  const overall = queue.filter((q) => q.firstAt).slice().sort((a, b) => new Date(a.firstAt) - new Date(b.firstAt));
  const olderCount = overall.filter((q) => new Date(q.firstAt).getTime() < startOfDay(Date.now()).getTime()).length;
  const i = Math.min(idx, Math.max(0, ranged.length - 1));
  const focus = ranged[i];
  const upNext = ranged.slice(i + 1, i + 4);
  const doneSteps = steps.filter((s) => s.state === "done").length;
  const pickItem = (it) => { const k = ranged.findIndex((x) => x.id === it.id); if (k >= 0) setIdx(k); else { setFrom(isoDay(it.firstAt)); setTo(today); setIdx(0); toast(`Date range widened to ${fmtDay(it.firstAt)} – today so this item is in your focus list.`); } window.scrollTo({ top: 0, behavior: "smooth" }); };
  const markNoAction = (reason, comment) => {
    const it = naItem;
    const rec = { id: uid("na"), itemId: it.id, by: personaUser.name, supervisor, eventType: it.eventType, kind: EVENT_TYPES[it.eventType]?.label || it.kind, title: it.title, detail: it.detail, reason, comment, at: new Date().toISOString(), status: "pending", firstAt: it.firstAt, count: it.count || 1, amc: (collections.files || [])[0]?.amc };
    const res = act({ screen: "today", cap: "view", kind: "no_action", patch: rec, audit: { entityLabel: it.title, action: "No action", to: `Sent to ${supervisor}`, comment: `${reason}${comment ? " — " + comment : ""}` } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(`Sent to ${supervisor} to verify. It also goes into the feedback on “${rec.kind}”.`);
    setNaItem(null);
  };

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
        <div className="deck-head-r">
          <div className="today-range" data-testid="today-range">
            <CalendarDays size={14} />
            <input type="date" className="input tnum" value={from} max={to} onChange={(e) => { if (e.target.value) { setFrom(e.target.value); setIdx(0); } }} data-testid="range-from" aria-label="From" />
            <span>to</span>
            <input type="date" className="input tnum" value={to} min={from} max={today} onChange={(e) => { if (e.target.value) { setTo(e.target.value); setIdx(0); } }} data-testid="range-to" aria-label="To" />
            {[["Today", 0], ["7 days", 6], ["30 days", 29]].map(([l, d]) => { const f = isoDay(Date.now() - d * 86400000); return <button key={l} className={"rg-chip" + (from === f && to === today ? " on" : "")} onClick={() => { setFrom(f); setTo(today); setIdx(0); }}>{l}</button>; })}
          </div>
          {isOps && <span className={"cutoff-chip" + (mins < 60 ? " hot" : "")}><Clock size={13} /> Fund release cut-off {mins > 0 ? `in ${Math.floor(mins / 60)}h ${mins % 60}m` : "passed"}</span>}
        </div>
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
            {focus && <span className="fc-count">{i + 1} <em>of {ranged.length}</em></span>}
          </div>
          <AnimatePresence mode="wait">
            {focus ? (
              <motion.div key={focus.id} className="fc-body" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
                <div className="fc-kind">{focus.step && <span className="step-chip">{SHORT[STEP_KEY[focus.step]]}</span>}{focus.kind}{focus.light && <Light tone={focus.tone}>{focus.light}</Light>}</div>
                <h2>{focus.title}</h2>
                <p>{focus.detail}</p>
                <SeenLine it={focus} />
                {focus.sentBack && <div className="sent-back" data-testid="sent-back"><Ban size={13} /> Your No-action call was sent back by {focus.sentBack.supervisor}: “{focus.sentBack.reviewNote}”</div>}
                <div className="fc-hint">{focus.when && <span className={"mw-when " + focus.tone}><Hourglass size={13} /> {focus.when}</span>}{focus.hint}</div>
                <div className="fc-actions">
                  <button className="btn btn-primary btn-lg" onClick={focus.primary.run} data-testid="next-action-btn">{focus.primary.label} <ArrowRight size={16} /></button>
                  {focus.secondary && <button className="btn btn-outline btn-lg" onClick={focus.secondary.run} data-testid="focus-secondary">{focus.secondary.label}</button>}
                  {focus.more && <button className="link" onClick={focus.more.run}>{focus.more.label}</button>}
                  {focus.noActionOk && <button className="btn btn-ghost btn-sm na-btn" onClick={() => setNaItem(focus)} data-testid="focus-no-action" title={`Goes to ${supervisor} to verify`}><Ban size={13} /> No action</button>}
                  <div className="fc-nav">
                    <button className="icon-btn" disabled={i === 0} onClick={() => setIdx(i - 1)} aria-label="Previous"><ArrowLeft size={16} /></button>
                    <button className="btn btn-ghost btn-sm" disabled={i >= ranged.length - 1} onClick={() => setIdx(i + 1)} data-testid="focus-skip">Skip for now <ArrowRight size={13} /></button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="clear" className="fc-body fc-clear" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <CheckCircle2 size={34} /><h2>You're all clear{from !== today || to !== today ? " for these dates" : " for today"}</h2><p>{overall.length ? `${overall.length} older or out-of-range item${overall.length !== 1 ? "s are" : " is"} still open — see Overall pending below.` : "Nothing is waiting for you. New work appears here automatically."}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </TiltCard>

        {/* 2 — Where the day stands */}
        <div className="day-panel card">
          <RingProgress value={doneSteps} max={Math.max(1, steps.length)} label={`of your ${steps.length} steps done`} size={132} />
          <div className="dp-stats">
            <div><span>Done by you</span><b className="fx-num"><CountUp value={doneToday} /></b></div>
            <div><span>{isChecker ? "Waiting for you" : "In range"}</span><b className="fx-num"><CountUp value={ranged.length} /></b></div>
            {!isChecker && <div><span>Checker approval</span><b className="fx-num"><CountUp value={waitingMine} /></b></div>}
            <div><span>Overall pending</span><b className="fx-num"><CountUp value={overall.length} /></b></div>
            {isOps && !isSetup && <div><span>Realised today</span><b className="fx-num">{inrShort(release.amount || 19874410000)}</b></div>}
            {(collections.no_action || []).some((n) => n.by === personaUser.name && n.status === "pending") && <div><span>With {supervisor.split(" ")[0]} (No action)</span><b className="fx-num"><CountUp value={(collections.no_action || []).filter((n) => n.by === personaUser.name && n.status === "pending").length} /></b></div>}
          </div>
        </div>
      </div>


      {/* 3 — Only the next three, never an endless list */}
      <div className="upnext card" data-testid="up-next">
        <div className="card-head"><h3><ListChecks size={15} /> Up next</h3>
          <button className="link" onClick={() => setQueueOpen(true)} data-testid="open-queue">See everything in range ({ranged.length}) <ArrowRight size={12} /></button></div>
        {upNext.length === 0 && <div className="card-pad muted">Nothing else after this one.</div>}
        {upNext.map((it, k) => (
          <button key={it.id} className={"un-row tone-" + it.tone} onClick={() => setIdx(i + 1 + k)}>
            <i /><span className="un-kind">{it.kind}</span><span className="un-title">{it.title}</span>{it.dedupe && it.count > 1 && <em className="rep-badge"><Repeat size={11} /> {it.count}×</em>}{it.when && <span className={"mw-when " + it.tone}>{it.when}</span>}<ArrowRight size={13} />
          </button>
        ))}
      </div>

      {/* 4 — Overall pending: every open item, no date limit, oldest first */}
      <div className="card op-card" data-testid="overall-pending">
        <div className="card-head"><h3><Inbox size={15} /> Overall pending</h3>
          <span className="muted">{overall.length} open · {olderCount} from before today · oldest first · no date limit</span></div>
        {overall.length === 0 && <div className="card-pad muted">Nothing open.</div>}
        <div className="op-list">
          {(showAllPending ? overall : overall.slice(0, 8)).map((it) => (
            <div key={it.id} className={"op-row tone-" + it.tone} data-testid={"op-" + it.id}>
              <i />
              <span className="op-date tnum"><b>{fmtDay(it.firstAt)}</b><small>{ageWords(it.firstAt)}</small></span>
              <span className="op-main"><b>{it.title}</b><small>{it.kind}{EVENT_TYPES[it.eventType] ? ` · ${EVENT_TYPES[it.eventType].label}` : ""}{it.sentBack ? " · sent back by supervisor" : ""}</small></span>
              {it.dedupe && it.count > 1 ? <em className="rep-badge" title={`Shown once. ${EVENT_TYPES[it.eventType]?.why}`}><Repeat size={11} /> {it.count}× since {fmtDay(it.firstAt)}</em> : <span />}
              <span className="op-acts">
                {it.noActionOk && <button className="btn btn-ghost btn-sm" onClick={() => setNaItem(it)} data-testid={"op-na-" + it.id}><Ban size={12} /> No action</button>}
                <button className="btn btn-outline btn-sm" onClick={() => pickItem(it)}>Work on it</button>
              </span>
            </div>
          ))}
        </div>
        {overall.length > 8 && <button className="link op-more" onClick={() => setShowAllPending((v) => !v)} data-testid="op-toggle">{showAllPending ? "Show fewer" : `Show all ${overall.length}`}</button>}
      </div>

      {naItem && <NoActionModal item={naItem} supervisor={supervisor} onClose={() => setNaItem(null)} onSubmit={markNoAction} />}

      {queueOpen && (
        <Drawer id="queue-drawer" title={isChecker ? "Everything waiting for your approval" : "Everything in this date range"} subtitle="Pick any item to make it your focus. Red first, then amber, then green; oldest first within each." onClose={() => setQueueOpen(false)}>
          <div className="q-list">
            {ranged.map((it, k) => (
              <button key={it.id} className={"un-row tone-" + it.tone + (k === i ? " on" : "")} onClick={() => { setIdx(k); setQueueOpen(false); }}>
                <i /><span className="un-num">{k + 1}</span><span className="un-title">{it.title}<small>{it.kind}{it.firstAt ? ` · ${it.dedupe ? "first seen" : "since"} ${fmtDay(it.firstAt)}` : ""}{it.dedupe && it.count > 1 ? ` · ${it.count}×` : ""}{it.when ? ` · ${it.when}` : ""}</small></span><ArrowRight size={13} />
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
