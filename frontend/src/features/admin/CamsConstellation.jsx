// Users page summaries:
//  • StatusOverview: "N people hold a CAMS ID", one bar for the whole, four status tiles that filter the list.
//  • ModuleAccess: side card, one row per module with people and roles, bar split active / inactive.
import React from "react";
import { X, GitCompareArrows, ShieldCheck, Settings2, Coins, Send, Repeat, Contact, Headset, ShoppingCart, BarChart3 } from "lucide-react";
import { CountUp } from "@/features/viz/Viz";

export function StatusOverview({ total, statuses, status, onStatus, scope }) {
  const [hover, setHover] = React.useState(null);
  const bar = statuses.filter((s) => s.count > 0);
  const focus = hover || (status !== "all" ? status : null);
  return (
    <section className="uo-top" data-testid="cams-constellation" onPointerLeave={() => setHover(null)}>
      <div className="uo-top-h">
        <h2><b className="tnum"><CountUp value={total} /></b> people hold a CAMS ID.</h2>
        <span className="uo-top-r"><span className="uo-hint">Click a status to filter</span>{scope}</span>
      </div>
      <div className="uo-bar" role="img" aria-label={bar.map((s) => `${s.label} ${s.count}`).join(", ")}>
        {bar.map((s, i) => (
          <button key={s.key} type="button" className={"uo-bar-seg" + (focus && focus !== s.key ? " dim" : "")} style={{ flexGrow: s.count, "--c": s.color, animationDelay: `${i * 80}ms` }}
            onPointerEnter={() => setHover(s.key)} onClick={() => onStatus(status === s.key ? "all" : s.key)} title={`${s.label}: ${s.count}`} aria-label={`${s.label} ${s.count}`} />
        ))}
      </div>
      <div className="uo-tiles">
        {statuses.map((s, i) => (
          <button key={s.key} type="button" className={"uo-tile" + (status === s.key ? " on" : "") + (focus && focus !== s.key ? " dim" : "")} style={{ "--c": s.color, animationDelay: `${100 + i * 60}ms` }}
            onPointerEnter={() => setHover(s.key)} onClick={() => onStatus(status === s.key ? "all" : s.key)} data-testid={s.testid} aria-pressed={status === s.key}>
            <span className="uo-tile-h"><span><i />{s.label}</span><em className="tnum">{Math.round((s.count / (total || 1)) * 100)}%</em></span>
            <b className="tnum"><CountUp value={s.count} /></b>
            <small>{s.hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

const MODULE_ICON = { recon: GitCompareArrows, admin: ShieldCheck, central_setup: Settings2, brokerage: Coins, posting: Send, sip: Repeat, crms: Contact, support: Headset, purchase: ShoppingCart, mis: BarChart3 };

export function ModuleAccess({ modules, active, onPick, onRoles }) {
  const live = modules.filter((m) => m.users > 0).sort((a, b) => b.users - a.users);
  const idle = modules.filter((m) => !m.users);
  const max = Math.max(1, ...live.map((m) => m.users));
  const sum = live.reduce((a, m) => a + m.users, 0);
  return (
    <aside className="uo-mods">
      <div className="uo-mods-h">
        <div><h3>Access by module</h3><p>Active people in each module</p></div>
        {active ? <button type="button" className="uo-mods-clear" onClick={() => onPick(active)}><X size={12} /> Clear</button> : <span className="uo-mods-total tnum">{sum}</span>}
      </div>
      <ul className="uo-mods-list">
        {live.map((m, i) => {
          const Icon = MODULE_ICON[m.key] || ShieldCheck;
          return (
            <li key={m.key} className={"uo-mod" + (active === m.key ? " on" : "") + (active && active !== m.key ? " dim" : "")} style={{ "--c": m.color, "--w": `${(m.users / max) * 100}%`, animationDelay: `${i * 50}ms` }}>
              <button type="button" className="uo-mod-main" onClick={() => onPick(m.key)} data-testid={`module-card-${m.key}`} aria-pressed={active === m.key} title={`Show ${m.label} people`}>
                <span className="uo-mod-ic"><Icon size={16} /></span>
                <span className="uo-mod-t"><b>{m.label}</b><span className="uo-mod-bar"><i /></span></span>
                <span className="uo-mod-n tnum">{m.users}</span>
              </button>
              <button type="button" className="uo-mod-roles" onClick={() => onRoles(m.key)} data-testid={`view-roles-${m.key}`} title={`See ${m.label} roles`}>{m.roles} role{m.roles !== 1 ? "s" : ""}</button>
            </li>
          );
        })}
      </ul>
      {idle.length > 0 && (
        <p className="uo-idle">
          <span>Not in use yet</span>
          {idle.map((m, i) => <React.Fragment key={m.key}><button type="button" onClick={() => onRoles(m.key)} data-testid={`view-roles-${m.key}`}>{m.label}</button>{i < idle.length - 1 ? ", " : ""}</React.Fragment>)}
        </p>
      )}
    </aside>
  );
}
