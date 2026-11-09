// "Module footprint": how many modules CAMS has and who is in each.
// Built on what reads accurately: length (ranked bars) and counting (one dot per person) — not bubble areas.
//  • Top: four numbers and one proportion bar of the whole.
//  • Left: every person as a dot, coloured by their home module; hollow = inactive but still holds access.
//  • Right: modules ranked by people, each bar split active / inactive; hover links the two views.
//  • Bottom: modules nobody uses yet, quietly, as one line.
import React from "react";
import { ChevronRight, X } from "lucide-react";
import { CountUp } from "@/features/viz/Viz";

export default function CamsConstellation({ modules, people, persons = [], active, onPick, onRoles }) {
  const [hover, setHover] = React.useState(null);
  const focus = hover || active;
  const live = modules.filter((m) => m.users > 0).sort((a, b) => b.users - a.users);
  const idle = modules.filter((m) => !m.users);
  const byKey = Object.fromEntries(modules.map((m) => [m.key, m]));
  const withRole = persons.length;
  const inactive = persons.filter((p) => p.inactive).length;
  const multi = persons.filter((p) => p.mods.length > 1).length;
  const max = Math.max(1, ...live.map((m) => m.users));
  const rank = Object.fromEntries(live.map((m, i) => [m.key, i]));
  // Dots grouped by home module (largest first), active before inactive, so each colour reads as one block.
  const dots = [...persons].sort((a, b) => (rank[a.home] ?? 99) - (rank[b.home] ?? 99) || Number(a.inactive) - Number(b.inactive));
  const top = live[0];

  return (
    <div className="card mf-card" data-testid="cams-constellation">
      <div className="card-head">
        <h3>Module footprint</h3>
        <span className="muted">{withRole} people across {live.length} of {modules.length} CAMS modules · click a module to filter the list</span>
        {active && <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => onPick(active)}><X size={13} /> Clear filter</button>}
      </div>

      <div className="mf-kpis">
        <div><b><CountUp value={modules.length} /></b><span>modules in CAMS</span><em>{live.length} in use · {idle.length} not started</em></div>
        <div><b><CountUp value={withRole} /></b><span>people with access</span><em>of {people} IDs in scope</em></div>
        <div className="warn"><b><CountUp value={inactive} /></b><span>inactive, still hold access</span><em>{withRole ? Math.round((inactive / withRole) * 100) : 0}% of people with access</em></div>
        <div><b><CountUp value={multi} /></b><span>work in 2+ modules</span><em>access spans teams</em></div>
      </div>

      {/* The whole in one line: share of people per module (a person in two modules counts in both). */}
      <div className="mf-share" role="img" aria-label={`${top ? `${top.label} has ${top.users} of ${withRole} people` : ""}`}>
        {live.map((m, i) => (
          <button key={m.key} type="button" className={"mf-seg" + (focus && focus !== m.key ? " dim" : "")} style={{ flexGrow: m.users, "--c": m.color, animationDelay: `${i * 60}ms` }}
            onPointerEnter={() => setHover(m.key)} onPointerLeave={() => setHover(null)} onClick={() => onPick(m.key)} title={`${m.label}: ${m.users}`}>
            {m.users / (live.reduce((s, x) => s + x.users, 0) || 1) > 0.08 && <span>{m.label} {m.users}</span>}
          </button>
        ))}
      </div>

      <div className="mf-body">
        {/* One dot = one person */}
        <div className="mf-people">
          <div className="mf-sub"><b>Everyone with access</b><span><i className="full" /> active <i className="hollow" /> inactive</span></div>
          <div className="mf-dots" onPointerLeave={() => setHover(null)}>
            {dots.map((p, i) => {
              const inFocus = !focus || p.mods.includes(focus);
              const c = byKey[p.home]?.color || "#8b8f99";
              return <i key={p.id} className={"mf-dot" + (p.inactive ? " off" : "") + (inFocus ? "" : " dim") + (p.mods.length > 1 ? " multi" : "")}
                style={{ "--c": c, animationDelay: `${Math.min(i * 5, 700)}ms` }} title={`${p.name} · ${p.mods.map((k) => byKey[k]?.label).join(" + ")}${p.inactive ? " · inactive" : ""}`} onPointerEnter={() => setHover(p.home)} />;
            })}
          </div>
          <p className="mf-note">{focus && byKey[focus]
            ? <><b>{byKey[focus].label}</b>: {byKey[focus].users} people, {byKey[focus].inactive} of them inactive. Dots light up for everyone who can open it.</>
            : <>Colour is each person's home module; a ring means they also work in another module. Hover a module to see who can open it.</>}</p>
        </div>

        {/* Ranked modules, each bar split active / inactive */}
        <div className="mf-rank">
          <div className="mf-sub"><b>People per module</b><span>active · inactive</span></div>
          {live.map((m, i) => {
            const act = m.users - m.inactive;
            return (
              <div key={m.key} className={"mf-row" + (active === m.key ? " on" : "") + (focus && focus !== m.key ? " dim" : "")} style={{ "--c": m.color, animationDelay: `${i * 60}ms` }}
                onPointerEnter={() => setHover(m.key)} onPointerLeave={() => setHover(null)}>
                <button type="button" className="mf-row-main" onClick={() => onPick(m.key)} data-testid={`module-card-${m.key}`}>
                  <span className="mf-name"><i />{m.label}</span>
                  <span className="mf-track" style={{ width: `${(m.users / max) * 100}%` }}>
                    <em className="a" style={{ flexGrow: act }} />{m.inactive > 0 && <em className="o" style={{ flexGrow: m.inactive }} />}
                  </span>
                  <span className="mf-num"><b>{m.users}</b><small>{withRole ? Math.round((m.users / withRole) * 100) : 0}%</small></span>
                </button>
                <span className="mf-meta">{m.inactive > 0 ? <><b>{m.inactive}</b> inactive</> : "all active"}<span>·</span>
                  <button type="button" className="mf-roles" onClick={() => onRoles(m.key)} data-testid={`view-roles-${m.key}`}>{m.roles} role{m.roles !== 1 ? "s" : ""} <ChevronRight size={12} /></button></span>
              </div>
            );
          })}
        </div>
      </div>

      {idle.length > 0 && (
        <div className="mf-idle">
          <span>Not started</span>
          {idle.map((m) => (
            <button key={m.key} type="button" className="mf-ghost" style={{ "--c": m.color }} onClick={() => onRoles(m.key)} data-testid={`view-roles-${m.key}`} title={`${m.label}: no one assigned yet`}>
              <i />{m.label}<small>{m.roles ? `${m.roles} role${m.roles !== 1 ? "s" : ""} ready` : "no roles yet"}</small>
            </button>
          ))}
          <span className="mf-idle-note">No one has access yet</span>
        </div>
      )}
    </div>
  );
}
