import React from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/state/store";
import { dailyCycle, nextStepFor, stepsForUser, scopeToUser } from "@/lib/journey";
import { hasCap } from "@/lib/access";
import { Check, Clock, Hourglass, ArrowRight, AlertTriangle } from "lucide-react";

/** Today's cycle for the signed-in person: their AMCs, their steps. `all` is the whole team's cycle. */
export function useCycle() {
  const { collections, perms, personaUser, amcUser } = useStore();
  const all = dailyCycle(scopeToUser(collections, amcUser));
  const { mine, others } = stepsForUser(all, perms, personaUser);
  return { steps: mine, all, others, next: nextStepFor(mine, perms) };
}

function StateIcon({ s }) {
  if (s.state === "done") return <span className="cy-ico done"><Check size={14} strokeWidth={3} /></span>;
  if (s.state === "waiting") return <span className="cy-ico waiting"><Hourglass size={13} /></span>;
  return <span className={"cy-ico " + s.state}>{s.n}</span>;
}

/** Full stepper used on Today. */
export function CycleStepper({ steps, mine }) {
  const { perms } = useStore();
  return (
    <ol className="cycle" data-testid="daily-cycle">
      {steps.map((s) => (
        <li key={s.key} className={"cy-step " + s.state + (s.late ? " late" : "")} data-testid={"cycle-" + s.key}>
          <div className="cy-top"><StateIcon s={s} />{mine === s.key && <span className="cy-mine">You're here</span>}<span className="cy-by">{s.late ? <><AlertTriangle size={11} /> was due {s.by}</> : <><Clock size={11} /> by {s.by}</>}</span></div>
          <div className="cy-title">{s.title}</div>
          <div className="cy-sum">{s.summary}</div>
          {s.state !== "done" && hasCap(perms, s.screen) && <Link className="cy-link" to={s.cta.path}>{s.cta.label} <ArrowRight size={12} /></Link>}
        </li>
      ))}
    </ol>
  );
}

const SHORT = { files: "Bank files", match: "Match payments", cases: "Problem cases", release: "Release money", refunds: "Send refunds", close: "Close the day" };

/** Compact "where am I in the day" bar shown at the top of every daily-cycle screen. */
export function JourneyBar({ current }) {
  const { steps: mine, all } = useCycle();
  const { perms } = useStore();
  // Only the person's own steps (plus the page they're on, if it isn't one of theirs).
  const steps = mine.some((s) => s.key === current) ? mine : [...mine, ...all.filter((s) => s.key === current)].sort((a, b) => all.indexOf(all.find((x) => x.key === a.key)) - all.indexOf(all.find((x) => x.key === b.key)));
  const idx = steps.findIndex((s) => s.key === current);
  const after = steps.slice(idx + 1).find((s) => s.state !== "done" && hasCap(perms, s.screen));
  const cur = steps[idx];
  return (
    <div className="journey-bar" data-testid="journey-bar">
      <span className="jb-label">Your steps today</span>
      <div className="jb-steps">
        {steps.map((s) => (
          <Link key={s.key} to={s.cta.path} className={"jb-step " + s.state + (s.key === current ? " current" : "")} title={`${s.title} — ${s.summary}`}>
            <StateIcon s={s} /><span>{SHORT[s.key]}</span>
          </Link>
        ))}
      </div>
      {cur && cur.state === "done" && after && <Link className="btn btn-primary btn-sm jb-next" to={after.cta.path}>Next: {after.title} <ArrowRight size={13} /></Link>}
      {cur && cur.state !== "done" && <span className="jb-status">{cur.summary}</span>}
    </div>
  );
}
