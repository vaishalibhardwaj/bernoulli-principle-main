import React from "react";
import { HeroArt } from "@/components/Art";
import { Activity, Server, Plug, Bot, Upload, Download, AlertTriangle, ArrowRight, FileX2, Clock, Sparkles, Mail } from "lucide-react";
import { useStore } from "@/state/store";
import { downloadCsv } from "@/features/reports/csv";
import { userAmcs } from "@/lib/org";
import { TiltCard } from "@/features/viz/Viz";
import { C, Donut, RunStrip, DayTimeline, HBar, Kpi, minsNow, hhmm, ago } from "./dashViz";

const TOPICS = [["bank", "Bank statement"], ["credit", "Credit MIS"], ["remitter", "Remitter"], ["other", "Other pickups"]];
const CHANNEL = { sftp: ["SFTP", Server], email: ["Email", Mail], api: ["API", Plug], auto: ["Portal bot", Bot], ui: ["UI upload", Upload] };
// Last run status is about the scheduler itself only. Whether a file came and loaded is in "File received" and the remarks.
const EXEC = { ran: ["Ran", "ok"], failed: ["Failed to run", "bad"], skipped: ["Did not run", "warn"] };
const OWNER_HINT = { "IT Support": "the scheduler did not execute", Setup: "ran, but the setup needs fixing (format, login, mapping)", Ops: "ran, but the data needs a person (no file, bad data)" };
// Source = where the file lands. SFTP and UI uploads both land in the GCS bucket; portal bots drop into the SFTP area.
const SOURCES = [["sftp", "SFTP (GCS bucket)"], ["api", "API"], ["ui", "UI upload"]];
const SOURCE_SHORT = { sftp: "SFTP", api: "API", ui: "UI upload" };
const srcOf = (x) => x.source || (x.channel === "api" ? "api" : x.channel === "ui" ? "ui" : "sftp");
/** Minutes ago a file landed: uploads made on screen carry a real timestamp, seeded files carry minutes-ago. */
const placedAgo = (f) => (f.placedAt ? Math.max(0, Math.round((Date.now() - new Date(f.placedAt).getTime()) / 60000)) : f.placed);

/** Recent runs for a job, rebuilt from its interval: failing jobs failed their latest runs; missed jobs skipped a slot. */
function runsFor(j) {
  const now = minsNow(); const last = now - j.lastAgo; const out = [];
  const bad = j.status === "failure" && j.exec !== "skipped" ? (j.id.charCodeAt(j.id.length - 1) % 2) + 2 : 0;
  for (let t = last, k = 0; t >= 0 && k < 300; t -= j.everyMin, k++) out.unshift({ t, ok: k >= bad });
  // Slots that came and went without a run since the last one (e.g. last run 9:00, now 11:18, every 15 min → 8 skipped).
  const skipped = j.everyMin >= 1440 ? 0 : Math.max(0, Math.floor(j.lastAgo / j.everyMin) - 1);
  for (let k = 1; k <= skipped; k++) out.push({ t: last + k * j.everyMin, ok: false, skipped: true });
  const next = last + (Math.floor(j.lastAgo / j.everyMin) + 1) * j.everyMin; // the next slot after now
  return { runs: out, last, next: j.everyMin >= 1440 ? null : next, late: skipped > 0, skipped };
}

/**
 * File-pickup monitoring for operations, IT support and process heads.
 * Overview: health, today's file pipeline, what needs attention, every job at a glance.
 * Advanced: day timeline per job, channel split, pickup latency and the live file flow.
 */
export default function SchedulerMonitor() {
  const { collections, personaUser, amcUser, setAmc } = useStore();
  const myAmcs = userAmcs(personaUser);
  const amc = userAmcs(amcUser)[0];
  const [source, setSource] = React.useState("all");
  const [topic, setTopic] = React.useState("all");
  const inAmc = (x) => (x.amcs ? x.amcs.includes(amc) : x.amc ? x.amc === amc : true);
  const jobs = (collections.jobs || []).filter((j) => inAmc(j) && (source === "all" || srcOf(j) === source) && (topic === "all" || j.topic === topic));
  const track = (collections.file_track || []).map((f) => ({ ...f, placed: placedAgo(f), source: srcOf(f), fileType: f.fileType || "bank" }))
    .filter((f) => inAmc(f) && (source === "all" || f.source === source) && (topic === "all" || f.fileType === topic))
    .sort((a, b) => a.placed - b.placed);
  const [mode, setMode] = React.useState(() => { try { return localStorage.getItem("cams_sched_mode") || "overview"; } catch (e) { return "overview"; } });
  const [, tick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const switchMode = (m) => { setMode(m); try { localStorage.setItem("cams_sched_mode", m); } catch (e) { /* ignore */ } };

  const enriched = jobs.map((j) => ({ ...j, ...runsFor(j) }));
  const failing = enriched.filter((j) => j.status === "failure");
  const healthy = enriched.length - failing.length;
  const overdue = enriched.filter((j) => j.late && j.next != null);
  const soonest = enriched.filter((j) => j.next != null && !j.late).sort((a, b) => a.next - b.next)[0];
  const n = (pred) => track.filter(pred).length;
  const pipe = { placed: track.length, picked: n((f) => f.picked != null), processed: n((f) => f.processed != null), ok: n((f) => f.outcome === "success") };
  const lat = track.filter((f) => f.picked != null).map((f) => ({ f, m: f.placed - f.picked }));
  const list = enriched.slice().sort((a, b) => (a.status === "failure" ? 0 : 1) - (b.status === "failure" ? 0 : 1));
  // Scheduler success rate today: slots that ran without the job erroring, over all slots that were due (skipped slots count as failures).
  const slots = enriched.reduce((t, j) => t + j.runs.length, 0);
  const slotsOk = enriched.reduce((t, j) => t + j.runs.filter((r) => r.ok).length, 0);
  const successRate = slots ? Math.round((slotsOk / slots) * 100) : 100;
  // Bank statements received today, by how they came in.
  const recvd = (collections.files || []).filter((f) => f.receivedAt && inAmc({ amc: f.amc }));
  const byMode = [["SFTP", recvd.filter((f) => f.channel === "sftp" || f.channel === "manual").length], ["Email", recvd.filter((f) => f.channel === "email").length], ["API / portal", recvd.filter((f) => f.channel === "api" || f.channel === "auto").length]];

  const exportCsv = () => downloadCsv(`scheduler_jobs_${amc.replace(/\s+/g, "_")}.csv`, ["File type", "Mode", "Job", "Interval (min)", "Last run", "Next scheduled run", "Last run status", "Slots skipped", "File received", "Status remarks", "Who acts"],
    enriched.map((j) => [j.topic, (CHANNEL[j.channel] || CHANNEL.sftp)[0], j.name, j.everyMin, hhmm(j.last), j.next != null ? hhmm(j.next) : "tomorrow", j.skipped > 0 ? "Did not run" : (EXEC[j.exec] || EXEC.ran)[0], j.skipped, j.recvAgo == null ? "" : hhmm(minsNow() - j.recvAgo), j.remarks, j.owner || ""]));

  return (
    <div className="dz" data-testid="scheduler-monitor">
      <div className="dz-head">
        <div>
          <h1><Activity size={22} /> Scheduler monitor</h1>
          <p>Every file-pickup job and every file that landed today — from SFTP (GCS bucket), API and UI upload — for one AMC at a time.</p>
        </div>
        <HeroArt name="folder" />
        <div className="dz-actions">
          <div className="segmented dz-mode" data-testid="sched-mode">
            <button className={mode === "overview" ? "on" : ""} onClick={() => switchMode("overview")}>Overview</button>
            <button className={mode === "advanced" ? "on" : ""} onClick={() => switchMode("advanced")} data-testid="mode-advanced"><Sparkles size={13} /> Advanced</button>
          </div>
          <button className="btn btn-outline btn-sm" onClick={exportCsv}><Download size={14} /> Export</button>
        </div>
      </div>

      <div className="dz-filters" data-testid="sched-filters">
        <label className="dz-filter"><span>AMC</span>
          <select className="select" value={amc} onChange={(e) => setAmc(e.target.value)} disabled={myAmcs.length < 2} data-testid="sched-amc">
            {myAmcs.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="dz-filter"><span>Source</span>
          <select className="select" value={source} onChange={(e) => setSource(e.target.value)} data-testid="sched-source">
            <option value="all">All sources</option>
            {SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="dz-filter"><span>File type</span>
          <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)} data-testid="sched-type">
            <option value="all">All file types</option>
            {TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {(source !== "all" || topic !== "all") && <button className="btn btn-ghost btn-sm" onClick={() => { setSource("all"); setTopic("all"); }} data-testid="sched-clear">Clear</button>}
        <span className="dz-filter-note">{enriched.length} job{enriched.length !== 1 ? "s" : ""} · {track.length} file{track.length !== 1 ? "s" : ""} today{myAmcs.length > 1 ? " · switching AMC here also switches it everywhere" : ""}</span>
      </div>

      <div className="sm-modes" data-testid="files-by-mode">
        <span className="sm-modes-l">Bank statements received today</span>
        {byMode.map(([l, v]) => <span key={l} className="sm-mode"><b className="fx-num">{v}</b>{l}</span>)}
        <span className="sm-mode total"><b className="fx-num">{recvd.length}</b>in all</span>
      </div>

      {/* Row 1 — health · pipeline · key numbers */}
      <div className="dz-hero">
        <TiltCard className="card dz-card" max={4}>
          <div className="dz-card-h">Job health</div>
          <div className="dz-health">
            <Donut size={156} value={`${healthy}/${enriched.length}`} sub="jobs healthy"
              segments={[{ v: healthy, color: C.ok }, { v: failing.filter((j) => j.exec !== "skipped").length, color: C.bad }, { v: failing.filter((j) => j.exec === "skipped").length, color: C.warn }]} />
            <ul className="dz-legend">
              <li><i style={{ background: C.ok }} />Running fine <b>{healthy}</b></li>
              <li><i style={{ background: C.bad }} />Failing <b>{failing.filter((j) => j.exec !== "skipped").length}</b></li>
              <li><i style={{ background: C.warn }} />Did not run <b>{failing.filter((j) => j.exec === "skipped").length}</b></li>
            </ul>
          </div>
        </TiltCard>

        <TiltCard className="card dz-card" max={4}>
          <div className="dz-card-h">Files today — from the moment they land in GCS</div>
          <div className="dz-funnel" data-testid="pipeline">
            {[["Landed (SFTP + UI)", pipe.placed], ["Picked up", pipe.picked], ["Processed", pipe.processed], ["Loaded", pipe.ok]].map(([l, v], i) => (
              <div key={l} className="dz-stage"><b className="fx-num">{v}</b><span>{l}</span><i style={{ width: `${(v / (pipe.placed || 1)) * 100}%`, opacity: 1 - i * 0.15 }} /></div>
            ))}
          </div>
          <div className="dz-chips">
            <span className="dz-chip info" data-testid="count-sftp">{n((f) => f.source === "sftp")} via SFTP</span>
            <span className="dz-chip info" data-testid="count-ui">{n((f) => f.source === "ui")} via UI upload</span>
            {n((f) => f.source === "api") > 0 && <span className="dz-chip info">{n((f) => f.source === "api")} via API</span>}
            <span className="dz-chip bad">{n((f) => f.outcome === "failed")} failed</span>
            <span className="dz-chip info">{n((f) => f.outcome === "pending")} in progress</span>
            <span className="dz-chip warn">{n((f) => f.outcome === "removed")} removed before pickup</span>
            <span className="dz-chip warn">{n((f) => f.outcome === "missed")} missed slot</span>
          </div>
        </TiltCard>

        <div className="dz-kpis">
          <Kpi label="Scheduler success rate" value={`${successRate}%`} sub={`${slotsOk} of ${slots} slots ran today`} tone={successRate >= 95 ? "ok" : successRate >= 85 ? "warn" : "bad"} testid="kpi-success" />
          <Kpi label="Jobs failing" value={failing.length} sub={failing.length ? "see below" : "all clear"} tone={failing.length ? "bad" : "ok"} />
          <Kpi label="Runs overdue" value={overdue.length} sub={overdue[0] ? overdue[0].name.split(" — ")[1] || overdue[0].name : "none"} tone={overdue.length ? "warn" : "ok"} />
          <Kpi label="Next run" value={soonest ? `${Math.max(1, Math.round(soonest.next - minsNow()))}m` : "—"} sub={soonest ? soonest.name.replace(/^SFTP pickup — /, "") : ""} />
        </div>
      </div>

      {/* Row 2 — only what needs a person */}
      {failing.length > 0 && (
        <div className="card dz-attn" data-testid="needs-attention">
          <div className="dz-card-h"><AlertTriangle size={14} /> Needs attention <span className="muted">· {failing.length}</span></div>
          {failing.map((j) => {
            const Icon = (CHANNEL[j.channel] || CHANNEL.sftp)[1];
            return (
              <div key={j.id} className={"dz-attn-row" + (j.exec === "skipped" ? " warn" : "")}>
                <span className="dz-attn-ico"><Icon size={14} /></span>
                <div><b>{j.name}</b><span>{j.remarks}{j.owner ? ` · ${j.owner} acts` : ""}</span></div>
                <span className="muted">last file {ago(j.recvAgo)}</span>
                <RunStrip runs={j.runs.slice(-8).map((r) => r.ok)} />
              </div>
            );
          })}
        </div>
      )}

      {/* Row 3 — every job, one row each. Last run status = the scheduler only; file received and remarks = the file. */}
      <div className="card dz-card sm-table-card" data-testid="job-table">
        <div className="dz-card-h">Every scheduler job <span className="muted">· {list.length} · now {hhmm(minsNow())}</span></div>
        {list.length === 0 ? <p className="muted">No jobs match these filters for {amc}.</p> : (
          <div className="sm-scroll">
            <table className="grid sm-table">
              <thead><tr><th>Job</th><th>Mode</th><th>Interval</th><th>Last run</th><th>Next scheduled run</th><th>Last run status</th><th>File received</th><th>Status remarks</th><th>Who acts</th></tr></thead>
              <tbody>
                {list.map((j) => {
                  const [cl, Icon] = CHANNEL[j.channel] || CHANNEL.sftp;
                  const [ex, tone] = EXEC[j.exec] || EXEC.ran;
                  return (
                    <tr key={j.id} className={j.status === "failure" ? "bad" : ""} data-testid={"job-" + j.id}>
                      <td><b>{j.name}</b><div className="muted sm-sub">{TOPICS.find((t) => t[0] === j.topic)?.[1]}</div></td>
                      <td><span className="dz-ch"><Icon size={12} /> {cl}</span></td>
                      <td className="tnum">{j.everyMin >= 1440 ? "daily" : `every ${j.everyMin} min`}</td>
                      <td className="tnum">{hhmm(j.last)}<div className="muted sm-sub">{ago(j.lastAgo)}</div></td>
                      <td className="tnum">{j.next == null ? "tomorrow" : hhmm(j.next)}{j.skipped > 0 && <div className="sm-skip">{j.skipped} slot{j.skipped > 1 ? "s" : ""} skipped since {hhmm(j.last)}</div>}</td>
                      <td><span className={"sm-exec " + (j.skipped > 0 ? "warn" : tone)}>{j.skipped > 0 ? "Did not run" : ex}</span></td>
                      <td className="tnum">{j.recvAgo == null ? <span className="muted">no file</span> : hhmm(minsNow() - j.recvAgo)}</td>
                      <td className="sm-rem">{j.remarks}</td>
                      <td>{j.owner ? <span className={"sm-owner o-" + j.owner.replace(/\s/g, "")} title={OWNER_HINT[j.owner]}>{j.owner}</span> : <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted sm-legend">Who acts: <b>IT Support</b> when the scheduler did not execute · <b>Setup</b> or <b>Ops</b> when it ran but there was no data, the wrong format or bad data.</p>
      </div>

      {mode === "advanced" && <Advanced enriched={enriched} topic={topic} track={track} lat={lat} />}
      {mode !== "advanced" && <FileList track={track} />}
    </div>
  );
}

function Advanced({ enriched, topic, track, lat }) {
  const lanes = enriched.filter((j) => j.everyMin < 1440).map((j) => ({ label: j.name.replace(/^SFTP pickup — |^Credit MIS /, ""), runs: j.runs.map((r) => ({ ...r })), next: j.next, nextLate: j.late }));
  const byCh = Object.keys(CHANNEL).map((c) => { const l = enriched.filter((j) => j.channel === c); return { c, ok: l.filter((j) => j.status === "success").length, bad: l.filter((j) => j.status === "failure").length }; });
  const stage = (f) => (f.outcome === "removed" || f.outcome === "missed" ? 1 : f.processed != null ? 3 : f.picked != null ? 2 : 1);
  return (
    <div className="dz-adv" data-testid="advanced">
      <div className="card dz-card">
        <div className="dz-card-h">Today's runs, 00:00–24:00 — {topic === "all" ? "all file types" : TOPICS.find((t) => t[0] === topic)[1]} <span className="muted">· dot = a run · hollow = next expected · scroll sideways for the whole day</span></div>
        <DayTimeline lanes={lanes} start={0} end={24 * 60} pxPerHour={110} />
      </div>
      <div className="dz-adv-grid">
        <div className="card dz-card">
          <div className="dz-card-h">By channel</div>
          <div className="dz-ch-row">
            {byCh.map(({ c, ok, bad }) => (
              <div key={c} className="dz-ch-cell">
                <Donut size={104} thickness={10} value={`${ok}/${ok + bad}`} segments={[{ v: ok, color: C.ok }, { v: bad, color: C.bad }]} />
                <span>{CHANNEL[c][0]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card dz-card">
          <div className="dz-card-h">Wait from landed to picked up <span className="muted">· minutes</span></div>
          {lat.sort((a, b) => b.m - a.m).map(({ f, m }) => <HBar key={f.id} label={f.name} value={m} max={Math.max(...lat.map((x) => x.m))} color={m > 10 ? C.warn : C.info} right={`${m}m`} />)}
        </div>
      </div>
      <div className="card dz-card">
        <div className="dz-card-h">Live file flow <span className="muted">· every file since it landed — SFTP and UI upload</span></div>
        <FlowTable track={track} stage={stage} />
      </div>
      <p className="muted dz-foot"><ArrowRight size={12} /> Tracked from the moment a file lands, so a file deleted before pickup or a skipped scheduler slot is visible here too.</p>
    </div>
  );
}

/** Overview: the day's files in one short table, newest first. */
function FileList({ track }) {
  const stage = (f) => (f.outcome === "removed" || f.outcome === "missed" ? 1 : f.processed != null ? 3 : f.picked != null ? 2 : 1);
  return (
    <div className="card dz-card" data-testid="file-list">
      <div className="dz-card-h">Files today <span className="muted">· {track.length} · SFTP and UI uploads, newest first</span></div>
      {track.length ? <FlowTable track={track} stage={stage} /> : <p className="muted">No files yet for these filters.</p>}
    </div>
  );
}

function FlowTable({ track, stage }) {
  return (
        <div className="dz-flow">
          <div className="dz-flow-h"><span>File</span><span>Landed</span><span>Picked up</span><span>Processed</span><span>Outcome</span></div>
          {track.map((f) => (
            <div key={f.id} className={"dz-flow-row o-" + f.outcome}>
              <span className="tnum"><b>{f.name}</b><em><i className={"dz-src s-" + f.source}>{SOURCE_SHORT[f.source]}</i> {f.folder}</em></span>
              {[f.placed, f.picked, f.processed].map((m, i) => (
                <span key={i} className={"dz-step" + (i < stage(f) ? " done" : "") + (i === 1 && f.outcome === "removed" ? " gone" : "") + (i === 1 && f.outcome === "missed" ? " late" : "")}>
                  <i />{m != null ? hhmm(minsNow() - m) : i === 1 && f.outcome === "removed" ? <><FileX2 size={11} /> removed</> : i === 1 && f.outcome === "missed" ? <><Clock size={11} /> slot missed</> : "—"}
                </span>
              ))}
              <span className="dz-out">{f.note}</span>
            </div>
          ))}
        </div>
  );
}
