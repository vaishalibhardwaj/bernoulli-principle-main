import React from "react";
import { Art } from "@/components/Art";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { useApprovals } from "@/features/approvals/useApprovals";
import { Drawer } from "@/components/Drawer";
import { Modal } from "@/components/Modal";
import { downloadCsv } from "@/features/reports/csv";
import { useCycle } from "./Cycle";
import { useWorkItems } from "./workItems";
import { AREAS, templatesFrom, tasksFor, taskState, taskRoute } from "./todayTasks";
import { ReviewModal } from "@/features/approvals/ReviewQueue";
import DateRange, { todayRange, inRange as inDates } from "@/components/DateRange";
import { useFailedFiles, useCutoffMins, greeting, longDate } from "@/features/home/NowStrip";
import { EVENT_TYPES, NO_ACTION_REASONS, supervisorOf, isoDay, fmtDay, ageWords } from "@/lib/events";
import { uid } from "@/lib/format";
import { ArrowRight, ArrowLeft, Hourglass, ShieldCheck, Download, Flag, ListChecks, CheckCircle2, X, Repeat, Ban, CalendarDays, Check } from "lucide-react";
import { toast } from "sonner";

const STEP_KEY = { 1: "files", 2: "match", 3: "cases", 4: "release", 5: "refunds", 6: "close" };

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
  const { collections, perms, personaUser, act, audit, currentUser, activeAmc, upsert, addAudit } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const { steps } = useCycle();
  const work = useWorkItems();
  const approvals = useApprovals().filter((a) => !a.own);
  const isChecker = hasCap(perms, "inbox", "approve");
  const mins = useCutoffMins();
  const failedFiles = useFailedFiles();
  const [idx, setIdx] = React.useState(0);
  const [queueOpen, setQueueOpen] = React.useState(false);
  const [doneOpen, setDoneOpen] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(loc.hash === "#close");
  const [note, setNote] = React.useState("");
  const [naItem, setNaItem] = React.useState(null);
  const [reviewKey, setReviewKey] = React.useState(null);
  // Dates start on today and show everything still open today; changing a date filters by when an item started.
  const [range, setRange] = React.useState(() => todayRange(false));
  const today = isoDay(new Date());
  const supervisor = supervisorOf(personaUser);
  // My No-action calls: pending or agreed ones leave my list; sent-back ones return with the supervisor's note.
  const myNa = React.useMemo(() => {
    const m = {};
    (collections.no_action || []).filter((n) => n.by === personaUser.name).forEach((n) => { if (!m[n.itemId] || m[n.itemId].at < n.at) m[n.itemId] = n; });
    return m;
  }, [collections.no_action, personaUser.name]);
  const openWork = React.useMemo(() => work.filter((w) => !myNa[w.id] || myNa[w.id].status === "sent_back").map((w) => (myNa[w.id] ? { ...w, sentBack: myNa[w.id] } : w)), [work, myNa]);

  const first = personaUser.name.split(" ")[0];
  // Sent back to me: my No-action calls the supervisor returned, and my own work a checker rejected.
  const sentBackMine = [
    ...openWork.filter((w) => w.sentBack).map((w) => ({ id: w.id, go: () => pickItem(w) })),
    ...(collections.refunds || []).filter((r) => r.status === "rejected" && (r.owner || "").startsWith(first)).map((r) => ({ id: r.id, go: () => nav("/refunds") })),
    ...["bank_config", "credit_config"].flatMap((k) => (collections[k] || []).filter((c) => c.status === "rejected" && c.owner === currentUser).map((c) => ({ id: c.id, go: () => nav(k === "bank_config" ? "/bank-setup?status=rejected" : "/credit-mis") }))),
  ];
  const greet = greeting();
  const release = (collections.releases || [])[0] || { status: "not_started" };
  const close = (collections.dayclose || [])[0] || { status: "open" };
  const canSubmitClose = hasCap(perms, "ingestion", "edit");
  const canSignClose = hasCap(perms, "ingestion", "approve");
  const carried = (collections.exceptions || []).filter((e) => e.status !== "closed").length;

  // The day's tasks and which of them are already ticked (waiting for review or reviewed).
  const tasks = React.useMemo(() => tasksFor(templatesFrom(collections.task_templates), personaUser.id), [collections.task_templates, personaUser.id]);
  const taskDone = React.useMemo(() => Object.fromEntries((collections.task_done || []).filter((r) => r.ownerId === personaUser.id && r.date === new Date().toDateString() && ["pending", "approved"].includes(r.status)).map((r) => [r.taskId, r])), [collections.task_done, personaUser.id]);
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const tickTask = (t) => {
    upsert("task_done", { id: `td_${personaUser.id}_${t.id}`, taskId: t.id, ownerId: personaUser.id, owner: first, date: new Date().toDateString(), doneAt: new Date().toISOString(), status: "pending" });
    addAudit({ entityType: "task_done", entityId: t.id, entityLabel: t.title, action: "Task marked done", from: "To do", to: "Waiting for review" });
    toast.success(`Done: ${t.title}. Sent to your functional manager for review.`);
  };

  // ---- One queue, in the order the day needs it ----
  const queue = React.useMemo(() => {
    const q = [];
    if (isChecker) {
      approvals.forEach((a) => q.push({
        id: a.kind + a.id, tone: a.urgent ? "red" : "amber", kind: a.kind, eventType: null, firstAt: a.at || a.submittedAt || null, title: a.title, detail: a.detail, hint: `Sent by ${a.owner || "—"}`,
        approval: a, firstAt: a.when || null, primary: { label: "Review", run: () => setReviewKey(a.kind + a.id) },
      }));
    }
    // Work that needs a person, for everyone who has it: files that failed or changed layout, balances that do not match,
    // late or missing statements and the other events from useWorkItems. Checkers see it too, alongside their approvals.
    {
      if (hasCap(perms, "release", "edit") && release.status === "not_started" && steps.some((s) => s.key === "release")) {
        q.push({ id: "release", eventType: "release", firstAt: new Date().toISOString(), tone: mins < 120 ? "red" : "amber", kind: "Release money", step: 4, title: "Prepare today's fund release", detail: "Matched, realised money goes to Transaction Posting so units can be allotted", when: mins > 0 ? `Cut-off in ${Math.floor(mins / 60)}h ${mins % 60}m` : "Cut-off passed", hint: "One click — your checker releases it", primary: { label: "Prepare release", run: () => nav("/release") } });
      }
      const myKeys = steps.map((s) => s.key);
      openWork.filter((w) => !w.step || myKeys.includes(STEP_KEY[w.step])).forEach((w) => q.push({ ...w, noActionOk: true }));
    }
    // Today's tasks from the person's KRAs (Ops), with the time each is due.
    if (hasCap(perms, "ingestion", "view")) {
      tasks.filter((t) => !t.phase && !taskDone[t.id] && (!myNa["task:" + t.id] || myNa["task:" + t.id].status === "sent_back")).forEach((t) => {
        const st = taskState(t);
        q.push({ id: "task:" + t.id, task: t, tone: st === "overdue" ? "red" : st === "soon" ? "amber" : "green", kind: "Task", eventType: "task", firstAt: t.due || null, title: t.title, detail: t.detail,
          when: !t.due ? (t.when || "No fixed time") : st === "overdue" ? `Was due at ${fmtTime(t.due)}. Do it now.` : `Due at ${fmtTime(t.due)}`,
          hint: AREAS.find((x) => x.key === t.area)?.label, noActionOk: true, sentBack: myNa["task:" + t.id]?.status === "sent_back" ? myNa["task:" + t.id] : null,
          primary: (() => { const r = taskRoute(t); return hasCap(perms, r.screen) ? { label: r.label, run: () => nav(r.path) } : null; })(),
          secondary: { label: "I have done this", run: () => tickTask(t) } });
      });
    }
    if (steps.some((s) => s.key === "close") && (canSubmitClose && close.status === "open") || (canSignClose && close.status === "pending" && !(close.submittedBy || "").startsWith(first))) {
      q.push({ id: "close", eventType: "day_close", firstAt: new Date().toISOString(), tone: "green", kind: "Close the day", step: 6, title: close.status === "pending" ? "Sign off today's reconciliation" : "Close the day when you're done", detail: close.status === "pending" ? `Submitted by ${close.submittedBy}` : `${carried} open items will carry forward`, hint: "Produces the day summary for the AMCs", primary: { label: close.status === "pending" ? "Sign off" : "Close the day", run: () => setCloseOpen(true) } });
    }
    const order = { red: 0, amber: 1, green: 2 };
    const t = (x) => (x.firstAt ? new Date(x.firstAt).getTime() : Date.now());
    return q.sort((a, b) => (a.id === "close") - (b.id === "close") || order[a.tone] - order[b.tone] || t(a) - t(b));
  }, [isChecker, approvals, openWork, perms, release.status, mins, canSubmitClose, canSignClose, close.status, close.submittedBy, carried, first, nav, steps, tasks, taskDone, myNa]); // eslint-disable-line react-hooks/exhaustive-deps

  // The focus list: every open item, or those that started within the dates once a date is changed.
  const ranged = queue.filter((q) => inDates(q.firstAt, range));
  const i = Math.min(idx, Math.max(0, ranged.length - 1));
  const focus = ranged[i];
  const doneTasks = Object.keys(taskDone).length;
  const pickItem = (it) => { const k = ranged.findIndex((x) => x.id === it.id); if (k >= 0) setIdx(k); };
  const markNoAction = (reason, comment) => {
    const it = naItem;
    const rec = { id: uid("na"), itemId: it.id, by: personaUser.name, supervisor, eventType: it.eventType, kind: EVENT_TYPES[it.eventType]?.label || it.kind, title: it.title, detail: it.detail, reason, comment, at: new Date().toISOString(), status: "pending", firstAt: it.firstAt, count: it.count || 1, amc: activeAmc || null };
    const res = act({ screen: "today", cap: "view", kind: "no_action", patch: rec, audit: { entityLabel: it.title, action: "No action", to: `Sent to ${supervisor}`, comment: `${reason}${comment ? " — " + comment : ""}` } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(`Recorded and sent to ${supervisor} to check.`);
    setNaItem(null);
  };
  const submitClose = () => {
    const res = act({ screen: "ingestion", cap: "edit", kind: "dayclose", id: "day_today", patch: { status: "pending", submittedBy: currentUser, carried, note: note.trim(), submittedAt: new Date().toISOString() }, audit: { entityLabel: "Day close", action: "Submit day close", from: "Open", to: "Pending", comment: `${carried} items carried forward` } });
    if (res.ok) { toast.success("Sent to your checker to sign off the day."); setCloseOpen(false); } else toast.error(res.error);
  };
  const signClose = () => {
    const res = act({ screen: "ingestion", cap: "approve", kind: "dayclose", id: "day_today", target: { owner: close.submittedBy }, patch: { status: "closed", closedBy: currentUser, closedAt: new Date().toISOString() }, audit: { entityLabel: "Day close", action: "Sign off day", from: "Pending", to: "Closed" } });
    if (res.ok) { toast.success("Day signed off. Summary sent to AMCs."); setCloseOpen(false); } else toast.error(res.error);
  };
  const daySummary = () => downloadCsv(`day_summary_${new Date().toISOString().slice(0, 10)}.csv`, ["Step", "Status", "Detail"], steps.map((s) => [s.title, s.state, s.summary]));
  // Done today: every action this person recorded today (History entries), newest first, with each task's review status.
  const doneList = audit.filter((a) => a.user === first && !a.denied && new Date(a.ts).toDateString() === new Date().toDateString()).slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const reviewOf = (a) => { if (a.entityType !== "task_done") return null; const r = (collections.task_done || []).find((x) => x.ownerId === personaUser.id && x.taskId === a.entityId && x.date === new Date().toDateString()); return r ? { pending: "Waiting for review", approved: `Reviewed by ${r.reviewedBy}`, returned: `Sent back by ${r.reviewedBy}` }[r.status] : null; };
  const runPrimary = (it) => (it.id === "close" ? setCloseOpen(true) : it.primary?.run());

  const cutPct = (() => { const cut = new Date(); const start = new Date(); start.setHours(9, 0, 0, 0); cut.setTime(Date.now() + mins * 60000); return Math.max(0, Math.min(100, ((Date.now() - start) / Math.max(1, cut - start)) * 100)); })();
  const reviewList = approvals;
  const rIdx = reviewList.findIndex((a) => a.kind + a.id === reviewKey);

  return (
    <div className="td" data-testid="today">
      <header className="td-head">
        <div className="td-hello">
          <h1>{greet}, {first}</h1>
          <p>{longDate()}{activeAmc ? <> · <b>{activeAmc}</b></> : null}</p>
        </div>
        <div className="td-status" role="group" aria-label="Your day at a glance">
          <button type="button" className={"td-chip" + (approvals.length ? " has" : "")} onClick={() => nav("/approvals")} data-testid="now-approvals"><i className="acc" /><span>Approvals waiting</span><b className="tnum">{approvals.length}</b></button>
          <button type="button" className={"td-chip" + (sentBackMine.length ? " has" : "")} onClick={() => (sentBackMine[0] ? sentBackMine[0].go() : setQueueOpen(true))} data-testid="now-sent-back"><i className="warn" /><span>Sent back to you</span><b className="tnum">{sentBackMine.length}</b></button>
          <button type="button" className={"td-chip" + (failedFiles.length ? " has bad" : "")} onClick={() => nav("/ingestion")} data-testid="now-failed"><i className="bad" /><span>Files that failed</span><b className="tnum">{failedFiles.length}</b></button>
          <button type="button" className={"td-chip done" + (doneList.length ? " has" : "")} onClick={() => setDoneOpen(true)} data-testid="now-done"><Check size={14} /><span>Done today</span><b className="tnum">{doneList.length}</b></button>
          <span className={"td-cut" + (mins <= 0 ? " passed" : mins < 60 ? " soon" : "")} data-testid="now-cutoff" title="Fund release cutoff">
            <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" className="trk" /><circle cx="18" cy="18" r="15" className="arc" strokeDasharray={`${(cutPct / 100) * 94.2} 94.2`} transform="rotate(-90 18 18)" /></svg>
            <span><small>Fund release cutoff</small><b>{mins > 0 ? `${Math.floor(mins / 60) ? `${Math.floor(mins / 60)}h ` : ""}${mins % 60}m left` : "Passed"}</b></span>
          </span>
        </div>
      </header>

      <section className={"td-focus tone-" + (focus?.tone || "green")} data-testid="next-action">
        <div className="td-focus-top">
          <span className="td-label">Do this next</span>
          <div className="td-focus-tools">
            {focus && <span className="td-pos tnum">{i + 1} <em>of {ranged.length}</em></span>}
            <DateRange value={range} onChange={(v) => { setRange(v); setIdx(0); }} testid="today-range" />
            <button type="button" className="td-all" onClick={() => setQueueOpen(true)} data-testid="open-queue" aria-label={`See all ${ranged.length} items`}><ListChecks size={14} /> See all</button>
          </div>
        </div>

        {focus ? (
            <div key={focus.id} className="td-body td-enter">
              <div className="td-kind"><span className={"td-dot " + focus.tone} />{focus.id === "close" ? "End of day" : focus.kind}{focus.hint && <em>{focus.hint}</em>}</div>
              {focus.when && <p className={"td-when " + focus.tone}><Hourglass size={13} /> {focus.when}</p>}
              <h2>{focus.title}</h2>
              {focus.detail && <p className="td-detail">{focus.detail}</p>}
              {!focus.task && <SeenLine it={focus} />}
              {focus.sentBack && <div className="sent-back" data-testid="sent-back"><Ban size={13} /> Your No action call was sent back by {focus.sentBack.supervisor}: “{focus.sentBack.reviewNote}”</div>}
              <div className="td-actions">
                {(focus.primary || focus.id === "close") && <button className="btn btn-primary" onClick={() => runPrimary(focus)} data-testid="next-action-btn">{focus.id === "close" ? "Close the day" : focus.primary.label} <ArrowRight size={14} /></button>}
                {focus.secondary && <button className="btn btn-outline" onClick={focus.secondary.run} data-testid="focus-secondary"><Check size={15} /> {focus.secondary.label}</button>}
                {focus.noActionOk && <button className="btn btn-ghost" onClick={() => setNaItem(focus)} data-testid="focus-no-action"><Ban size={14} /> No action required</button>}
                <span className="td-nav">
                  <button className="dl-kebab" disabled={i === 0} onClick={() => setIdx(i - 1)} aria-label="Previous"><ArrowLeft size={14} /></button>
                  <button className="btn btn-ghost" disabled={i >= ranged.length - 1} onClick={() => setIdx(i + 1)} data-testid="focus-skip">Skip for now <ArrowRight size={14} /></button>
                </span>
              </div>
            </div>
          ) : (
            <div key="clear" className="td-body td-clear td-enter">
              <Art name="badges" size={84} /><h2>You're all clear</h2><p>Nothing is waiting for you{range.touched ? " in these dates" : ""}.</p>
            </div>
          )}

        <footer className="td-foot">
          <span className="td-progress"><span><b className="tnum">{doneTasks}</b> of {doneTasks + tasks.filter((t) => !t.phase && !taskDone[t.id]).length} tasks done today</span><i><u style={{ width: `${(doneTasks / Math.max(1, doneTasks + tasks.filter((t) => !t.phase && !taskDone[t.id]).length)) * 100}%` }} /></i></span>
          <span className="td-steps" aria-hidden="true">{ranged.slice(0, 12).map((x, k) => <i key={x.id} className={x.tone + (k === i ? " on" : "")} />)}</span>
        </footer>
      </section>

      {naItem && <NoActionModal item={naItem} supervisor={supervisor} onClose={() => setNaItem(null)} onSubmit={markNoAction} />}
      {rIdx >= 0 && <ReviewModal a={reviewList[rIdx]} pos={rIdx + 1} total={reviewList.length} onClose={() => setReviewKey(null)}
        onPrev={rIdx > 0 ? () => setReviewKey(reviewList[rIdx - 1].kind + reviewList[rIdx - 1].id) : null}
        onNext={rIdx < reviewList.length - 1 ? () => setReviewKey(reviewList[rIdx + 1].kind + reviewList[rIdx + 1].id) : null}
        onDone={() => setReviewKey(null)} />}

      {queueOpen && (
        <Drawer id="queue-drawer" title={`Your list · ${ranged.length}`} subtitle="Most urgent first, then oldest first. Pick one to work on it." onClose={() => setQueueOpen(false)}>
          <div className="q-list">
            {ranged.map((it, k) => (
              <button key={it.id} className={"un-row tone-" + it.tone + (k === i ? " on" : "")} onClick={() => { setIdx(k); setQueueOpen(false); }}>
                <i /><span className="un-num">{k + 1}</span><span className="un-title">{it.title}<small>{it.kind}{it.when ? ` · ${it.when}` : it.firstAt ? ` · since ${fmtDay(it.firstAt)}` : ""}</small></span><ArrowRight size={13} />
              </button>
            ))}
          </div>
        </Drawer>
      )}

      {doneOpen && (
        <Drawer id="done-drawer" title={`Done today · ${doneList.length}`} subtitle="Everything you did today, newest first. Ticked tasks show whether your functional manager has reviewed them." onClose={() => setDoneOpen(false)}>
          {doneList.length === 0 ? <div className="empty" style={{ border: 0 }}><Art name="clipboard" size={64} /><h3>Nothing yet today</h3><p>What you finish, approve, upload or mark as no action shows here.</p></div> : (
            <ul className="done-list" data-testid="done-list">
              {doneList.map((a) => (
                <li key={a.id}>
                  <span className="done-ic" aria-hidden="true"><Check size={14} /></span>
                  <span className="done-main"><b>{a.action}</b><small>{a.entityLabel || "—"}{a.comment ? ` · ${a.comment}` : ""}</small>{reviewOf(a) && <em className={"done-rv " + (/Reviewed/.test(reviewOf(a)) ? "ok" : /Sent back/.test(reviewOf(a)) ? "bad" : "")}>{reviewOf(a)}</em>}</span>
                  <span className="done-at tnum">{new Date(a.ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
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
            <p className="muted" style={{ margin: "14px 0 8px" }}>Anything not finished carries forward to tomorrow ({carried} open item{carried !== 1 ? "s" : ""}). Leave a note for tomorrow's team.</p>
            <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. SBI statement still missing; chased RM at 3:10 PM" />
          </>}
          {close.status === "pending" && <p style={{ marginTop: 14 }}>Submitted by <b>{close.submittedBy}</b>. {close.carried} item{close.carried !== 1 ? "s" : ""} carried forward.{close.note && <> Note: “{close.note}”</>}</p>}
          {close.status === "closed" && <p style={{ marginTop: 14 }}>Closed by <b>{close.closedBy}</b>. The day summary has gone to the AMCs.</p>}
        </Modal>
      )}
    </div>
  );
}
