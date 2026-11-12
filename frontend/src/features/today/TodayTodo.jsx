// Today's to-do (Recon Ops): one task to do next, then the rest of the queue in the order to do them.
// The order is worked out by fixed rules (overdue first, then the earliest time), not typed in by anyone.
// Ticking a task is kept for the day in this browser (prototype only).
import React from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { Art } from "@/components/Art";
import { AREAS, templatesFrom, tasksFor, taskState } from "./todayTasks";

// Work already done before the demo opens (prototype only).
const SEED_DONE = ["tpl_bs_upload_0900", "tpl_cmis_upload_1030", "tpl_checkpoint_0930"];

const fmt = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const RANK = { overdue: 0, soon: 1, later: 2, open: 3 };
const areaOf = (t) => AREAS.find((a) => a.key === t.area)?.label;

/** Why this task sits where it does, in plain words. */
function whenLine(t, st) {
  if (t.phase) return t.phase === "To confirm" ? "No fixed time. Do it when the file arrives." : `Not part of today's work yet (${t.phase}).`;
  if (st === "overdue") return `Was due at ${fmt(t.due)}. Do it now.`;
  if (st === "soon") return `Due at ${fmt(t.due)}, within the hour.`;
  if (st === "later") return `Due at ${fmt(t.due)}.`;
  return t.when || "No fixed time.";
}

export default function TodayTodo() {
  const { perms, personaUser, collections } = useStore();
  const nav = useNavigate();
  const tasks = React.useMemo(() => tasksFor(templatesFrom(collections.task_templates), personaUser.id), [collections.task_templates, personaUser.id]);
  const mine = (t) => (t.assignee ? "Assigned to you" : "Whole team");
  const key = `cams_todo_${personaUser.id}_${new Date().toDateString()}`;
  const [done, setDone] = React.useState(() => {
    const seed = Object.fromEntries(SEED_DONE.map((id) => [id, true]));
    try { return { ...seed, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch (e) { return seed; }
  });
  const [openId, setOpenId] = React.useState(null);
  React.useEffect(() => { try { localStorage.setItem(key, JSON.stringify(done)); } catch (e) { /* storage unavailable */ } }, [key, done]);

  const tick = (t) => {
    const next = !done[t.id];
    setDone((d) => ({ ...d, [t.id]: next }));
    if (next) toast.success(`Done: ${t.title}`);
  };

  // Today's work first, in the order to do it. Work that belongs to a later phase goes to the end.
  const order = (a, b) => (RANK[taskState(a)] - RANK[taskState(b)]) || ((a.due ? new Date(a.due).getTime() : Infinity) - (b.due ? new Date(b.due).getTime() : Infinity));
  const open = tasks.filter((t) => !done[t.id]);
  const queue = [...open.filter((t) => !t.phase).sort(order), ...open.filter((t) => t.phase).sort(order)];
  const next = queue.find((t) => !t.phase);
  const rest = queue.filter((t) => t !== next);
  const finished = tasks.filter((t) => done[t.id]);
  const canOpen = (t) => !t.phase && hasCap(perms, t.screen);

  return (
    <section className="tq" data-testid="today-todo">
      <div className="tq-top">
        <h2>Do this next</h2>
        <span className="tq-progress" aria-label={`${finished.length} of ${tasks.length} done`}>
          <span><b className="tnum">{finished.length}</b> of {tasks.length} done today</span>
          <span className="tt-bar"><i style={{ width: `${tasks.length ? (finished.length / tasks.length) * 100 : 0}%` }} /></span>
        </span>
      </div>

      {next ? (() => { const st = taskState(next); return (
        <div className={"tq-next s-" + st} data-testid="tq-next">
          <div className="tq-next-main">
            <span className={"tq-when " + st}>{whenLine(next, st)}</span>
            <h3>{next.title}</h3>
            <p>{next.detail}</p>
            <small>{areaOf(next)} · <span className="tq-who">{mine(next)}</span></small>
          </div>
          <div className="tq-next-do">
            {canOpen(next) && <button type="button" className="btn btn-primary" onClick={() => nav(next.path)} data-testid="tq-open">Open it <ArrowRight size={15} /></button>}
            <button type="button" className="btn btn-outline" onClick={() => tick(next)} data-testid="tq-done"><Check size={15} /> I have done this</button>
          </div>
        </div>
      ); })() : (
        <div className="card tq-clear" data-testid="tq-clear"><Art name="clipboard" size={120} /><div><h3>Nothing left to do right now</h3><p>Every task for today is ticked off.</p></div></div>
      )}

      {rest.length > 0 && <>
        <h2 className="tq-h">Your queue, one at a time</h2>
        <p className="tq-sub">In the order to do them. Open a card to see what it involves.</p>
        <ol className="tq-list">
          {rest.map((t, i) => { const st = taskState(t); const isOpen = openId === t.id; return (
            <li key={t.id} className={"tq-card" + (isOpen ? " open" : "") + (t.phase ? " later" : "")} data-testid={"task-" + t.id}>
              <button type="button" className="tt-check" onClick={() => tick(t)} aria-pressed={false} aria-label={`Mark "${t.title}" done`} />
              <button type="button" className="tq-head" onClick={() => setOpenId(isOpen ? null : t.id)} aria-expanded={isOpen}>
                <span className="tq-n tnum">{i + 2}</span>
                <b>{t.title}</b>
                <span className={"tq-when " + (t.phase ? "" : st)}>{t.phase ? t.phase : t.due ? fmt(t.due) : t.when}{!t.phase && st === "overdue" ? " · overdue" : ""}</span>
                <ChevronDown size={16} className="tq-chev" />
              </button>
              {isOpen && <div className="tq-body">
                <p>{t.detail}</p>
                <p className="tq-why">{whenLine(t, st)} {areaOf(t)}. <span className="tq-who">{mine(t)}.</span></p>
                {canOpen(t) && <button type="button" className="btn btn-outline btn-sm" onClick={() => nav(t.path)}>Open it <ArrowRight size={13} /></button>}
              </div>}
            </li>
          ); })}
        </ol>
      </>}

      {finished.length > 0 && (
        <details className="tq-done">
          <summary>Done today ({finished.length})</summary>
          {finished.map((t) => (
            <div key={t.id} className="tq-done-row" data-testid={"task-" + t.id}>
              <button type="button" className="tt-check" onClick={() => tick(t)} aria-pressed aria-label={`Mark "${t.title}" not done`}><Check size={13} strokeWidth={3} /></button>
              <span>{t.title}</span><em className="tnum">{t.due ? fmt(t.due) : t.when}</em>
            </div>
          ))}
        </details>
      )}
      <p className="tt-foot">The order is worked out by the system: overdue tasks first, then the earliest time, then tasks with no fixed time. Tasks come from the team's task templates, built from each person's KRAs, and repeat at each scheduled time.{hasCap(perms, "task_templates") && <> <button type="button" className="link" onClick={() => nav("/task-templates")} data-testid="tq-templates">See the team's tasks</button></>}</p>
    </section>
  );
}
