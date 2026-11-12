import React from "react";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "@/state/store";
import { downloadCsv } from "@/features/reports/csv";
import { userAmcs } from "@/lib/org";
import { Art } from "@/components/Art";
import { RunStrip, DayTimeline, minsNow, hhmm, ago } from "./dashViz";

const TOPICS = [["bank", "Bank statement"], ["credit", "Credit MIS"], ["remitter", "Remitter"], ["other", "Other pickups"]];
const CHANNEL = { sftp: "SFTP", email: "Email", api: "API", auto: "Portal bot", ui: "UI upload" };
const OWNER_HINT = { "IT Support": "The job itself did not run.", Setup: "The job ran, but the setup needs fixing (format, login or mapping).", Ops: "The job ran, but the data needs a person (no file, or bad data)." };
// Source = where the file lands. SFTP and UI uploads both land in the GCS bucket; portal bots drop into the SFTP area.
const SOURCES = [["sftp", "SFTP (GCS bucket)"], ["api", "API"], ["ui", "UI upload"]];
const SOURCE_SHORT = { sftp: "SFTP", api: "API", ui: "UI upload" };
const OUTCOME = { success: ["Loaded", "ok"], failed: ["Failed", "bad"], pending: ["In progress", ""], removed: ["Removed before pickup", "warn"], missed: ["Pickup slot missed", "warn"] };
const srcOf = (x) => x.source || (x.channel === "api" ? "api" : x.channel === "ui" ? "ui" : "sftp");
/** Minutes ago a file landed: uploads made on screen carry a real timestamp, seeded files carry minutes-ago. */
const placedAgo = (f) => (f.placedAt ? Math.max(0, Math.round((Date.now() - new Date(f.placedAt).getTime()) / 60000)) : f.placed);
const every = (j) => (j.everyMin >= 1440 ? "Once a day" : j.everyMin >= 60 && j.everyMin % 60 === 0 ? `Every ${j.everyMin / 60} h` : `Every ${j.everyMin} min`);
/** One status per pickup. A job that ran but brought no usable file is still a problem for someone. */
const stateOf = (j) => (j.skipped > 0 || j.exec === "skipped" ? ["Did not run", "warn"] : j.exec === "failed" ? ["Failed to run", "bad"] : j.status === "failure" ? ["Ran, file problem", "bad"] : ["Running fine", "ok"]);

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
 * File pickups: the scheduled jobs that fetch files, and the files that landed today, for one AMC at a time.
 * Order on the page: what needs a person, every pickup grouped by file type, then today's files.
 */
export default function SchedulerMonitor() {
  const { collections, personaUser, amcUser, setAmc } = useStore();
  const myAmcs = userAmcs(personaUser);
  const amc = userAmcs(amcUser)[0];
  const [source, setSource] = React.useState("all");
  const [topic, setTopic] = React.useState("all");
  const [open, setOpen] = React.useState(null);
  const [fileShow, setFileShow] = React.useState("all");
  const [, tick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  const inAmc = (x) => (x.amcs ? x.amcs.includes(amc) : x.amc ? x.amc === amc : true);
  const jobs = (collections.jobs || []).filter((j) => inAmc(j) && (source === "all" || srcOf(j) === source) && (topic === "all" || j.topic === topic)).map((j) => ({ ...j, ...runsFor(j) }));
  const track = (collections.file_track || []).map((f) => ({ ...f, placed: placedAgo(f), source: srcOf(f), fileType: f.fileType || "bank" }))
    .filter((f) => inAmc(f) && (source === "all" || f.source === source) && (topic === "all" || f.fileType === topic))
    .sort((a, b) => a.placed - b.placed);
  const failing = jobs.filter((j) => stateOf(j)[1] !== "ok");
  const slots = jobs.reduce((t, j) => t + j.runs.length, 0);
  const slotsOk = jobs.reduce((t, j) => t + j.runs.filter((r) => r.ok).length, 0);
  const loaded = track.filter((f) => f.outcome === "success").length;
  const notLoaded = track.filter((f) => f.outcome !== "success" && f.outcome !== "pending");
  const files = fileShow === "problem" ? notLoaded : track;
  const lanes = jobs.filter((j) => j.everyMin < 1440).map((j) => ({ label: j.name.replace(/^SFTP pickup — |^Credit MIS /, ""), runs: j.runs.map((r) => ({ ...r })), next: j.next, nextLate: j.late }));

  const exportCsv = () => downloadCsv(`file_pickups_${amc.replace(/\s+/g, "_")}.csv`, ["File type", "How", "Pickup", "Interval (min)", "Last run", "Next run", "Status", "Runs skipped", "File received", "What happened", "Who acts"],
    jobs.map((j) => [j.topic, CHANNEL[j.channel] || "SFTP", j.name, j.everyMin, hhmm(j.last), j.next != null ? hhmm(j.next) : "tomorrow", stateOf(j)[0], j.skipped, j.recvAgo == null ? "" : hhmm(minsNow() - j.recvAgo), j.remarks, j.owner || ""]));

  return (
    <div className="fp" data-testid="scheduler-monitor">
      <div className="page-head">
        <div>
          <h1>File pickups</h1>
          <p>The scheduled jobs that fetch bank statements and Credit MIS files, and every file that landed today. Come here when a file has not arrived.</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}><Download size={14} /> Export</button>
      </div>

      <div className="fp-filters" data-testid="sched-filters">
        <label><span>AMC</span>
          <select className="select" value={amc} onChange={(e) => setAmc(e.target.value)} disabled={myAmcs.length < 2} data-testid="sched-amc">
            {myAmcs.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label><span>Comes in by</span>
          <select className="select" value={source} onChange={(e) => setSource(e.target.value)} data-testid="sched-source">
            <option value="all">Any way</option>
            {SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label><span>File type</span>
          <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)} data-testid="sched-type">
            <option value="all">All file types</option>
            {TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {(source !== "all" || topic !== "all") && <button className="btn btn-ghost btn-sm" onClick={() => { setSource("all"); setTopic("all"); }} data-testid="sched-clear">Clear</button>}
      </div>

      <div className="fp-facts" data-testid="fp-facts">
        <div><b className="tnum">{jobs.length - failing.length} of {jobs.length}</b><span>pickups running fine</span></div>
        <div><b className="tnum">{slotsOk} of {slots}</b><span>scheduled runs happened today</span></div>
        <div><b className="tnum">{loaded} of {track.length}</b><span>files that landed are loaded</span></div>
      </div>

      {failing.length > 0 ? (
        <section className="fp-need" data-testid="needs-attention">
          <h2>{failing.length} {failing.length === 1 ? "pickup needs" : "pickups need"} a person</h2>
          {failing.map((j) => (
            <div key={j.id} className="fp-need-row">
              <div className="fp-need-main">
                <b>{j.name}</b>
                <p>{j.remarks}</p>
                <small>Last ran {hhmm(j.last)} ({ago(j.lastAgo)}){j.skipped > 0 ? `, ${j.skipped} run${j.skipped > 1 ? "s" : ""} skipped since` : ""}. Last file {j.recvAgo == null ? "not received today" : ago(j.recvAgo)}.</small>
              </div>
              <div className="fp-need-who">
                <span className={"fp-st " + stateOf(j)[1]}>{stateOf(j)[0]}</span>
                {j.owner && <span className="fp-who"><b>{j.owner}</b> acts<small>{OWNER_HINT[j.owner]}</small></span>}
              </div>
            </div>
          ))}
        </section>
      ) : jobs.length > 0 && (
        <section className="fp-clear"><Art name="clock" size={72} /><div><b>Every pickup is running fine</b><span>Nothing here needs a person right now.</span></div></section>
      )}

      <section className="card fp-card" data-testid="job-table">
        <div className="fp-card-h"><h2>All pickups</h2><span>{jobs.length} · now {hhmm(minsNow())}</span></div>
        {jobs.length === 0 && <p className="fp-none">No pickups match these filters for {amc}.</p>}
        {TOPICS.map(([tk, tl]) => {
          const list = jobs.filter((j) => j.topic === tk).sort((a, b) => (stateOf(a)[1] === "ok" ? 1 : 0) - (stateOf(b)[1] === "ok" ? 1 : 0));
          if (!list.length) return null;
          return (
            <div key={tk} className="fp-group">
              <div className="fp-group-h">{tl} <em>{list.length}</em></div>
              <div className="fp-row fp-row-h"><span>Pickup</span><span>How</span><span>Schedule</span><span>Last run</span><span>Next run</span><span>File received</span><span>Status</span><span /></div>
              {list.map((j) => {
                const [st, tone] = stateOf(j); const isOpen = open === j.id;
                return (
                  <React.Fragment key={j.id}>
                    <button type="button" className={"fp-row" + (isOpen ? " open" : "")} onClick={() => setOpen(isOpen ? null : j.id)} aria-expanded={isOpen} data-testid={"job-" + j.id}>
                      <span><b>{j.name}</b></span>
                      <span>{CHANNEL[j.channel] || "SFTP"}</span>
                      <span>{every(j)}</span>
                      <span className="tnum">{hhmm(j.last)}</span>
                      <span className="tnum">{j.next == null ? "Tomorrow" : hhmm(j.next)}</span>
                      <span className="tnum">{j.recvAgo == null ? <i>No file today</i> : hhmm(minsNow() - j.recvAgo)}</span>
                      <span><em className={"fp-st " + tone}>{st}</em></span>
                      <span>{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                    </button>
                    {isOpen && (
                      <div className="fp-detail">
                        <div><label>What happened</label><p>{j.remarks || "Ran as scheduled."}</p></div>
                        <div><label>Who acts</label><p>{j.owner ? <><b>{j.owner}</b>. {OWNER_HINT[j.owner]}</> : "No one. Nothing to do."}</p></div>
                        <div><label>Last 8 runs</label><RunStrip runs={j.runs.slice(-8).map((r) => r.ok)} />{j.skipped > 0 && <p>{j.skipped} run{j.skipped > 1 ? "s" : ""} skipped since {hhmm(j.last)}.</p>}</div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}
        <p className="fp-foot">Who acts: <b>IT Support</b> when the job did not run. <b>Setup</b> or <b>Ops</b> when it ran but there was no file, the wrong format or bad data.</p>
        {lanes.length > 0 && (
          <details className="fp-day" data-testid="advanced">
            <summary>Show every run today, hour by hour</summary>
            <p>A dot is a run. A hollow dot is the next run expected. Scroll sideways for the whole day.</p>
            <DayTimeline lanes={lanes} start={0} end={24 * 60} pxPerHour={110} />
          </details>
        )}
      </section>

      <section className="card fp-card" data-testid="file-list">
        <div className="fp-card-h">
          <h2>Files today</h2><span>{track.length} landed · {SOURCES.map(([k]) => `${track.filter((f) => f.source === k).length} ${SOURCE_SHORT[k]}`).join(" · ")}</span>
          <div className="segmented" role="tablist" aria-label="Which files">
            {[["all", `All (${track.length})`], ["problem", `Not loaded (${notLoaded.length})`]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={fileShow === k} className={fileShow === k ? "on" : ""} onClick={() => setFileShow(k)} data-testid={"files-" + k}>{l}</button>)}
          </div>
        </div>
        {files.length === 0 ? <p className="fp-none">{fileShow === "problem" ? "Every file that landed is loaded or still in progress." : "No files yet for these filters."}</p> : (
          <div className="fp-scroll">
            <table className="fp-files">
              <thead><tr><th>File</th><th>Came in by</th><th>Landed</th><th>Picked up</th><th>Wait</th><th>Processed</th><th>Result</th></tr></thead>
              <tbody>
                {files.map((f) => {
                  const [ol, tone] = OUTCOME[f.outcome] || OUTCOME.pending;
                  return (
                    <tr key={f.id}>
                      <td><b>{f.name}</b><small>{f.folder}</small></td>
                      <td>{SOURCE_SHORT[f.source]}</td>
                      <td className="tnum">{hhmm(minsNow() - f.placed)}</td>
                      <td className="tnum">{f.picked != null ? hhmm(minsNow() - f.picked) : "—"}</td>
                      <td className="tnum">{f.picked != null ? `${Math.max(0, f.placed - f.picked)} min` : "—"}</td>
                      <td className="tnum">{f.processed != null ? hhmm(minsNow() - f.processed) : "—"}</td>
                      <td><em className={"fp-st " + tone}>{ol}</em>{f.note && <small>{f.note}</small>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="fp-foot">A file is tracked from the moment it lands, so a file removed before pickup or a skipped run shows here too.</p>
      </section>
    </div>
  );
}
