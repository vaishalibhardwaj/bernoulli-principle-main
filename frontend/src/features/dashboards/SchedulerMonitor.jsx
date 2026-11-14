// File pickups: the scheduled jobs that fetch files, and the files that landed, for one AMC and a date range.
// Top to bottom: filters (dates start on today), four figures in plain words, three simple charts,
// what requires action (name, last run, status), every pickup, every file. The AMC is the one picked at the top of the app.
// Prototype: today's runs and files come from the seed. Earlier days are rebuilt from each pickup's schedule
// with synthetic outcomes, so the date range has something to show. All data is synthetic.
import React from "react";
import { Download, ArrowDownToLine, AlertTriangle, RefreshCw, Inbox, CheckCircle2, Server, Plug, UploadCloud } from "lucide-react";
import { useStore } from "@/state/store";
import { downloadCsv } from "@/features/reports/csv";
import { userAmcs } from "@/lib/org";
import { Art } from "@/components/Art";
import Picker from "@/components/Picker";
import DateRange, { isoDay, todayRange } from "@/components/DateRange";
import { minsNow, hhmm, ago } from "./dashViz";

const TOPICS = [["bank", "Bank statement"], ["credit", "Credit MIS"], ["remitter", "Remitter"], ["other", "Other"]];
const CHANNEL = { sftp: "SFTP", email: "Email", api: "API", auto: "Portal bot", ui: "UI upload" };
// Channel = where the file lands. SFTP and UI uploads both land in the GCS bucket; portal bots drop into the SFTP area.
const CHANNELS = [["sftp", "SFTP", "ok"], ["api", "API", "blue"], ["ui", "UI upload", "acc"]];
const CHANNEL_ICON = { sftp: Server, api: Plug, ui: UploadCloud };
const OUTCOME = { success: ["Loaded", "ok"], failed: ["Failed", "bad"], pending: ["In progress", "info"], removed: ["Removed before pickup", "warn"], missed: ["Pickup slot missed", "warn"] };
const srcOf = (x) => x.source || (x.channel === "api" ? "api" : x.channel === "ui" ? "ui" : "sftp");
const placedAgo = (f) => (f.placedAt ? Math.max(0, Math.round((Date.now() - new Date(f.placedAt).getTime()) / 60000)) : f.placed);
const every = (j) => (j.everyMin >= 1440 ? "Once a day" : j.everyMin >= 60 && j.everyMin % 60 === 0 ? `Every ${j.everyMin / 60} h` : `Every ${j.everyMin} min`);
const stateOf = (j) => (j.skipped > 0 || j.exec === "skipped" ? ["Did not run", "warn"] : j.exec === "failed" ? ["Failed to run", "bad"] : j.status === "failure" ? ["Ran, file problem", "bad"] : ["Running fine", "ok"]);
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const dayLabel = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); };

/** Today's runs for a job, rebuilt from its interval: failing jobs failed their latest runs; missed jobs skipped slots. */
function runsFor(j) {
  const now = minsNow(); const last = now - j.lastAgo; const out = [];
  const bad = j.status === "failure" && j.exec !== "skipped" ? (j.id.charCodeAt(j.id.length - 1) % 2) + 2 : 0;
  for (let t = last, k = 0; t >= 0 && k < 300; t -= j.everyMin, k++) out.unshift({ t, ok: k >= bad });
  const skipped = j.everyMin >= 1440 ? 0 : Math.max(0, Math.floor(j.lastAgo / j.everyMin) - 1);
  for (let k = 1; k <= skipped; k++) out.push({ t: last + k * j.everyMin, ok: false, skipped: true });
  const next = last + (Math.floor(j.lastAgo / j.everyMin) + 1) * j.everyMin;
  return { runs: out, last, next: j.everyMin >= 1440 ? null : next, late: skipped > 0, skipped };
}

/** An earlier day's runs for a job: every slot of its schedule, a few failed. Synthetic. */
function pastRuns(j, back) {
  const n = j.everyMin >= 1440 ? 1 : Math.floor(1440 / j.everyMin);
  const fails = hash(j.id + back) % 7 === 0 ? 1 + (hash(j.id) % 3) : 0;
  return Array.from({ length: n }, (_, k) => ({ t: k * j.everyMin, ok: k < n - fails || k % 2 === 0 }));
}

/** An earlier day's files: the same feeds as today, with mostly loaded outcomes. Synthetic. */
function pastFiles(track, back) {
  return track.map((f) => {
    const h = hash(f.id + back) % 23;
    return { ...f, id: `${f.id}_${back}`, back, outcome: h === 0 ? "failed" : h === 1 ? "missed" : "success", note: h === 0 ? "Failed checks" : h === 1 ? "Pickup slot missed" : null, picked: f.picked ?? f.placed, processed: f.processed ?? f.placed };
  });
}

export default function SchedulerMonitor() {
  const { collections, amcUser } = useStore();
  const amc = userAmcs(amcUser)[0];
  const today = isoDay(new Date());
  const [range, setRange] = React.useState(() => todayRange());
  const [channel, setChannel] = React.useState("all");
  const [topic, setTopic] = React.useState("all");
  const [fileShow, setFileShow] = React.useState("all");
  const [, tick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  // The days in the range, newest first, capped at 31 so "All" stays readable.
  const backOf = (iso) => Math.round((new Date(today) - new Date(iso)) / 86400000);
  const fromBack = Math.min(30, range.from ? backOf(range.from) : 30);
  const toBack = Math.max(0, range.to ? backOf(range.to) : 0);
  const days = Array.from({ length: Math.max(0, fromBack - toBack + 1) }, (_, i) => toBack + i);
  const hasToday = days.includes(0);

  const inAmc = (x) => (x.amcs ? x.amcs.includes(amc) : x.amc ? x.amc === amc : true);
  const fits = (x) => inAmc(x) && (channel === "all" || srcOf(x) === channel) && (topic === "all" || (x.topic || x.fileType || "bank") === topic);
  const jobs = (collections.jobs || []).filter(fits).map((j) => ({ ...j, ...runsFor(j) }));
  const baseTrack = (collections.file_track || []).map((f) => ({ ...f, placed: placedAgo(f), source: srcOf(f), fileType: f.fileType || "bank", back: 0 })).filter(fits);
  const track = days.flatMap((b) => (b === 0 ? baseTrack : pastFiles(baseTrack, b)));
  const runsByDay = days.map((b) => ({ b, runs: jobs.flatMap((j) => (b === 0 ? j.runs : pastRuns(j, b))) }));
  const allRuns = runsByDay.flatMap((d) => d.runs);

  const failing = hasToday ? jobs.filter((j) => stateOf(j)[1] !== "ok") : [];
  const runsOk = allRuns.filter((r) => r.ok).length;
  const loaded = track.filter((f) => f.outcome === "success").length;
  const notLoaded = track.filter((f) => !["success", "pending"].includes(f.outcome));
  const files = (fileShow === "problem" ? notLoaded : track).slice().sort((a, b) => a.back - b.back || a.placed - b.placed);

  const single = days.length === 1;

  const exportCsv = () => downloadCsv(`file_pickups_${amc.replace(/\s+/g, "_")}_${range.from || "all"}_${range.to || today}.csv`, ["File type", "Channel", "Pickup", "Interval (min)", "Last run", "Next run", "Status", "Runs skipped"],
    jobs.map((j) => [j.topic, CHANNEL[j.channel] || "SFTP", j.name, j.everyMin, hhmm(j.last), j.next != null ? hhmm(j.next) : "tomorrow", stateOf(j)[0], j.skipped]));

  const failedRuns = allRuns.filter((r) => !r.ok && !r.skipped).length;
  const skippedRuns = allRuns.filter((r) => r.skipped).length;
  const inProgress = track.filter((f) => f.outcome === "pending").length;
  const dayLanes = days.slice().sort((a, b) => b - a).map((b) => ({ b, files: track.filter((f) => f.back === b) }));
  const fmt = (n) => n.toLocaleString("en-IN");

  return (
    <div className="fp2" data-testid="scheduler-monitor">
      <div className="page-head">
        <div><h1>File pickups</h1></div>
        <button className="btn btn-outline btn-sm" onClick={exportCsv} data-testid="fp-export"><Download size={14} /> Export</button>
      </div>

      <div className="fp2-filters" data-testid="sched-filters">
        <DateRange value={range} onChange={setRange} testid="fp-dates" />
        <Picker value={topic} onChange={setTopic} label="File type" testid="sched-type" options={[{ value: "all", label: "All" }, ...TOPICS.map(([k, l]) => ({ value: k, label: l }))]} />
        <Picker value={channel} onChange={setChannel} label="Channel" testid="sched-source" options={[{ value: "all", label: "All" }, ...CHANNELS.map(([k, l]) => ({ value: k, label: l }))]} />
      </div>

      <section className="fp3-cards" data-testid="fp-facts">
        <Card icon={ArrowDownToLine} title="Pickups" big={hasToday ? jobs.length - failing.length : "—"} of={hasToday ? jobs.length : null} words="running fine" part={hasToday && jobs.length ? (jobs.length - failing.length) / jobs.length : 0}
          tag={!hasToday ? ["Shown for today only", ""] : failing.length ? [`${failing.length} need action`, "bad"] : ["All good", "ok"]} />
        <Card icon={RefreshCw} title="Scheduled runs" big={fmt(runsOk)} of={fmt(allRuns.length)} words="ran as planned" part={allRuns.length ? runsOk / allRuns.length : 0}
          tag={failedRuns + skippedRuns ? [`${failedRuns} failed · ${skippedRuns} skipped`, failedRuns ? "bad" : "warn"] : ["All ran", "ok"]} />
        <Card icon={Inbox} title="Files arrived" big={fmt(track.length)} words={single ? "files today" : `files in ${days.length} days`} part={track.length ? 1 : 0}
          tag={[CHANNELS.filter(([k]) => track.some((f) => f.source === k)).map(([k, l]) => `${track.filter((f) => f.source === k).length} ${l}`).join(" · ") || "None yet", ""]} />
        <Card icon={CheckCircle2} title="Files loaded" big={fmt(loaded)} of={fmt(track.length)} words="loaded" part={track.length ? loaded / track.length : 0}
          tag={notLoaded.length ? [`${notLoaded.length} not loaded`, "bad"] : inProgress ? [`${inProgress} in progress`, "warn"] : ["All loaded", "ok"]} />
      </section>

      <div className="fp3-row">
        <section className="card fp3-panel" data-testid="fp-chart-runs">
          <h2>Did the scheduled runs work?</h2>
          <Split key={`r${range.from}${range.to}${channel}${topic}`} parts={[{ label: "Ran", value: runsOk, cls: "ok" }, { label: "Failed", value: failedRuns, cls: "bad" }, { label: "Skipped", value: skippedRuns, cls: "warn" }]} />
        </section>
        <section className="card fp3-panel" data-testid="fp-chart-channel">
          <h2>How did the files arrive?</h2>
          <ul className="fp3-chan" key={`c${range.from}${range.to}${channel}${topic}`}>
            {CHANNELS.map(([k, l, cls], i) => {
              const n = track.filter((f) => f.source === k).length; const Icon = CHANNEL_ICON[k];
              return (
                <li key={k}>
                  <span className={"fp3-chan-ic " + cls} aria-hidden="true"><Icon size={17} /></span>
                  <span className="fp3-chan-l">{l}</span>
                  <span className="fp3-chan-bar"><i className={cls} style={{ width: `${track.length ? (n / track.length) * 100 : 0}%`, animationDelay: `${i * 120}ms` }} /></span>
                  <b className="tnum">{n}</b>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="card fp3-panel" data-testid="fp-chart-trend">
        <div className="fp3-panel-h"><h2>When did the files arrive?</h2>
          <ul className="mo-legend row"><li><i className="ok" />Loaded</li><li><i className="bad" />Not loaded</li><li><i className="warn" />In progress</li></ul></div>
        <Timeline key={`t${range.from}${range.to}${channel}${topic}`} lanes={dayLanes} />
      </section>

      {hasToday && (failing.length > 0 ? (
        <section className="fp2-panel" data-testid="needs-attention">
          <h2 className="sec-h">Requires action <em className="tnum">{failing.length}</em></h2>
          <ul className="fp2-rows">
            {failing.map((j) => (
              <li key={j.id} className="fp2-row need">
                <span className="fp2-ic bad" aria-hidden="true"><AlertTriangle size={18} /></span>
                <span className="fp2-main"><b>{j.name}</b><small>{CHANNEL[j.channel] || "SFTP"} · {every(j)}</small></span>
                <span className="fp2-when"><b className="tnum">{hhmm(j.last)}</b><small>last run · {ago(j.lastAgo)}</small></span>
                <span className={"fp-st " + stateOf(j)[1]}>{stateOf(j)[0]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : jobs.length > 0 && (
        <section className="empty" data-testid="fp-all-fine"><Art name="clock" size={64} /><h3>Every pickup is running fine</h3></section>
      ))}

      <section className="fp2-panel" data-testid="job-table">
        <h2 className="sec-h">All pickups <em className="tnum">{jobs.length}</em></h2>
        {jobs.length === 0 && <div className="empty"><Art name="search" size={56} /><h3>No pickups match these filters</h3></div>}
        {TOPICS.map(([tk, tl]) => {
          const list = jobs.filter((j) => j.topic === tk).sort((a, b) => (stateOf(a)[1] === "ok" ? 1 : 0) - (stateOf(b)[1] === "ok" ? 1 : 0));
          if (!list.length) return null;
          return (
            <div key={tk} className="fp2-group">
              <h3>{tl} <em className="tnum">{list.length}</em></h3>
              <ul className="fp2-rows">
                {list.map((j) => {
                  const [st, tone] = stateOf(j);
                  return (
                    <li key={j.id} className="fp2-row" data-testid={"job-" + j.id}>
                      <span className={"fp2-ic " + tone} aria-hidden="true"><ArrowDownToLine size={18} /></span>
                      <span className="fp2-main"><b>{j.name}</b><small>{CHANNEL[j.channel] || "SFTP"} · {every(j)}</small></span>
                      <span className="fp2-runs" role="img" aria-label={`Last ${Math.min(14, j.runs.length)} runs: ${j.runs.slice(-14).filter((r) => r.ok).length} ran`}>{j.runs.slice(-14).map((r, i) => <i key={i} className={r.skipped ? "skip" : r.ok ? "ok" : "bad"} style={{ animationDelay: `${i * 30}ms` }} />)}</span>
                      <span className="fp2-when"><b className="tnum">{hhmm(j.last)}</b><small>next {j.next == null ? "tomorrow" : hhmm(j.next)}</small></span>
                      <span className={"fp-st " + tone}>{st}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="fp2-panel" data-testid="file-list">
        <div className="fp2-panel-h">
          <h2 className="sec-h">Files <em className="tnum">{track.length}</em></h2>
          <div className="segmented" role="tablist" aria-label="Which files">
            {[["all", `All (${track.length})`], ["problem", `Not loaded (${notLoaded.length})`]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={fileShow === k} className={fileShow === k ? "on" : ""} onClick={() => setFileShow(k)} data-testid={"files-" + k}>{l}</button>)}
          </div>
        </div>
        {files.length === 0 ? <div className="empty"><Art name="folder" size={56} /><h3>{fileShow === "problem" ? "Every file is loaded or in progress" : "No files for these filters"}</h3></div> : (
          <div className="fp-scroll">
            <table className="table fp2-files">
              <thead><tr><th>File</th><th>Date</th><th>Channel</th><th className="num">Arrived</th><th className="num">Picked up</th><th className="num">Processed</th><th>Result</th></tr></thead>
              <tbody>
                {files.slice(0, 200).map((f) => {
                  const [ol, tone] = OUTCOME[f.outcome] || OUTCOME.pending;
                  const at = (m) => (m != null ? hhmm(minsNow() - m) : "—");
                  return (
                    <tr key={f.id}>
                      <td><b>{f.name}</b></td>
                      <td className="tnum">{dayLabel(f.back)}</td>
                      <td>{CHANNELS.find(([k]) => k === f.source)?.[1]}</td>
                      <td className="num tnum">{at(f.placed)}</td>
                      <td className="num tnum">{at(f.picked)}</td>
                      <td className="num tnum">{at(f.processed)}</td>
                      <td><span className={"fp-st " + tone}>{ol}</span>{f.note && <small className="muted fp2-note">{f.note}</small>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {files.length > 200 && <p className="muted fp2-note">Showing 200 of {files.length}. Narrow the dates or export.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

/** One figure in plain words: "15 of 19 running fine", a bar that fills to that share, and a status tag. */
function Card({ icon: Icon, title, big, of, words, part, tag }) {
  const [label, tone] = tag;
  return (
    <div className="fp3-card">
      <div className="fp3-card-top"><span className={"fp3-card-ic " + (tone || "")} aria-hidden="true"><Icon size={18} /></span><span>{title}</span></div>
      <p className="fp3-big"><b className="tnum">{big}</b>{of != null && <span> of {of}</span>} <em>{words}</em></p>
      <span className="fp3-bar" aria-hidden="true"><i className={tone || "ok"} style={{ width: `${Math.round(part * 100)}%` }} /></span>
      <span className={"fp3-tag " + (tone || "")}>{label}</span>
    </div>
  );
}

/** One long bar split by share, with the counts in big plain numbers underneath. */
function Split({ parts }) {
  const total = Math.max(1, parts.reduce((t, p) => t + p.value, 0));
  return (
    <div className="fp3-split">
      <div className="fp3-split-bar" role="img" aria-label={parts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(", ")}>
        {parts.filter((p) => p.value).map((p, i) => <i key={p.label} className={p.cls} style={{ flexGrow: p.value, minWidth: 6, animationDelay: `${i * 140}ms` }} />)}
      </div>
      <ul className="fp3-split-k">
        {parts.map((p) => <li key={p.label}><i className={p.cls} /><b className="tnum">{p.value.toLocaleString("en-IN")}</b><span>{p.label}</span><em className="tnum">{Math.round((p.value / total) * 100)}%</em></li>)}
      </ul>
    </div>
  );
}

/** A clock line per day from 6 am to 11 pm; each file is a dot at the time it arrived, coloured by what happened to it. */
function Timeline({ lanes }) {
  const START = 6 * 60, END = 23 * 60;
  const pos = (m) => `${Math.min(100, Math.max(0, ((m - START) / (END - START)) * 100))}%`;
  const ticks = [6, 9, 12, 15, 18, 21];
  return (
    <div className="fp3-tl">
      <div className="fp3-tl-scale" aria-hidden="true"><span />{ticks.map((h) => <em key={h} style={{ left: pos(h * 60) }}>{h === 12 ? "12 pm" : h > 12 ? `${h - 12} pm` : `${h} am`}</em>)}</div>
      {lanes.map(({ b, files }) => (
        <div key={b} className="fp3-tl-lane">
          <span className="fp3-tl-day">{dayLabel(b)}</span>
          <div className="fp3-tl-track">
            {ticks.map((h) => <u key={h} style={{ left: pos(h * 60) }} />)}
            {b === 0 && <s className="fp3-tl-now" style={{ left: pos(minsNow()) }} title="Now" />}
            {files.map((f, i) => {
              const t = minsNow() - f.placed; const tone = f.outcome === "success" ? "ok" : f.outcome === "pending" ? "warn" : "bad";
              return <i key={f.id} className={tone} style={{ left: pos(b === 0 ? t : ((t % 1440) + 1440) % 1440), animationDelay: `${i * 50}ms` }} title={`${f.name} · arrived ${hhmm(b === 0 ? t : ((t % 1440) + 1440) % 1440)} · ${(OUTCOME[f.outcome] || OUTCOME.pending)[0]}`} />;
            })}
          </div>
          <span className="fp3-tl-n tnum">{files.length}</span>
        </div>
      ))}
    </div>
  );
}
