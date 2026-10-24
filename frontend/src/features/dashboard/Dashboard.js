import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Clock, CheckCircle2, XCircle, FileEdit, Landmark, CreditCard, GitCompareArrows, Plus, Activity } from "lucide-react";
import { useStore } from "@/state/store";
import { STATUS, KIND_LABELS } from "@/lib/constants";
import Sparkline, { seriesFor } from "@/components/Sparkline";
import { timeAgo } from "@/lib/format";
import AuthQueue from "@/features/authQueue/AuthQueue";

const ORDER = ["active", "pending", "draft", "rejected", "inactive"];
const BAR_COLOR = { active: "hsl(var(--st-active))", pending: "hsl(var(--st-pending))", draft: "hsl(var(--st-draft))", rejected: "hsl(var(--st-rejected))", inactive: "hsl(var(--st-inactive))" };

export default function Dashboard() {
  const { collections, role, currentUser, audit } = useStore();
  const nav = useNavigate();
  const everything = [...collections.bank_config, ...collections.credit_config, ...collections.bank_mapping];
  const count = (s, list = everything) => list.filter((x) => x.status === s).length;
  const approvedAudit = audit.filter((a) => a.action === "Approve").length;
  const rejectedAudit = audit.filter((a) => a.action === "Reject").length;

  const metrics = role === "maker" ? [
    { key: "drafts", label: "My drafts", val: count("draft"), icon: FileEdit, delta: "resume anytime", to: "/bank-setup?status=draft", tone: "neutral" },
    { key: "pending", label: "Awaiting approval", val: count("pending"), icon: Clock, delta: "with Arun", to: "/bank-setup?status=pending", tone: "amber" },
    { key: "rejected", label: "Needs rework", val: count("rejected"), icon: XCircle, delta: "action required", to: "/bank-setup?status=rejected", tone: "red" },
    { key: "active", label: "Active setups", val: count("active"), icon: CheckCircle2, delta: "in production", to: "/bank-setup?status=active", tone: "green" },
  ] : [
    { key: "pending", label: "Awaiting your review", val: count("pending"), icon: Clock, delta: "SLA 5 min", to: "/dashboard", tone: "amber" },
    { key: "approved", label: "Approved", val: approvedAudit, icon: CheckCircle2, delta: "this session", to: "/audit", tone: "green" },
    { key: "rejected", label: "Rejected", val: rejectedAudit, icon: XCircle, delta: "sent back", to: "/audit", tone: "red" },
    { key: "active", label: "Active setups", val: count("active"), icon: Landmark, delta: "in production", to: "/bank-setup?status=active", tone: "neutral" },
  ];

  const total = everything.length || 1;
  const recent = audit.slice(0, 7);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div data-testid="dashboard">
      <div className="hero">
        <div>
          <div className="eyebrow">{role === "maker" ? "Maker workspace" : "Authoriser workspace"}</div>
          <h1>{greet}, {currentUser}</h1>
          <p>{role === "maker" ? "Here's where your configurations stand today." : `${count("pending")} submissions are waiting for your decision.`}</p>
        </div>
        <div className="hero-actions">
          {role === "maker" && <>
            <button className="btn btn-outline" onClick={() => nav("/credit-mis/new")} data-testid="hero-new-credit"><CreditCard size={15} /> New Credit MIS</button>
            <button className="btn btn-primary" onClick={() => nav("/bank-setup/new")} data-testid="hero-new-bank"><Plus size={15} /> New bank setup</button>
          </>}
          {role === "auth" && <button className="btn btn-primary" onClick={() => document.getElementById("queue-anchor")?.scrollIntoView({ behavior: "smooth" })} data-testid="hero-open-queue">Open queue <ArrowUpRight size={15} /></button>}
        </div>
      </div>

      <div className="metric-grid" data-testid="dashboard-metrics">
        {metrics.map((m) => (
          <button key={m.key} className={"metric tone-" + m.tone} onClick={() => nav(m.to)} data-testid={"dash-metric-" + m.key}>
            <div className="m-top"><span className="m-ico"><m.icon /></span><span className="m-lbl">{m.label}</span></div>
            <div className="m-row">
              <div className="m-val tnum">{m.val}</div>
              <Sparkline data={seriesFor(m.key + m.val, 14, Math.max(2, m.val))} width={110} height={34} color={BAR_COLOR[m.key] || "hsl(var(--primary))"} id={"spark-" + m.key} />
            </div>
            <div className="m-delta">{m.delta}</div>
          </button>
        ))}
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><h3>Portfolio by status</h3><span className="muted">{everything.length} records across bank, credit MIS &amp; mapping</span></div>
          <div className="card-pad">
            <div className="stackbar" data-testid="status-stackbar">
              {ORDER.map((s) => count(s) > 0 && <span key={s} style={{ width: `${(count(s) / total) * 100}%`, background: BAR_COLOR[s] }} title={`${STATUS[s].label}: ${count(s)}`} />)}
            </div>
            <div className="legend-row">
              {ORDER.map((s) => (
                <span key={s} className="lg"><i style={{ background: BAR_COLOR[s] }} />{STATUS[s].label}<b className="tnum">{count(s)}</b></span>
              ))}
            </div>
            <div className="mini-tiles">
              {[["Bank setups", collections.bank_config, Landmark, "/bank-setup"], ["Credit MIS feeds", collections.credit_config, CreditCard, "/credit-mis"], ["Column mappings", collections.bank_mapping, GitCompareArrows, "/mapping"]].map(([l, list, I, to]) => (
                <button key={l} className="tile" onClick={() => nav(to)} data-testid={"tile-" + to.slice(1)}>
                  <I /><div><b className="tnum">{list.length}</b><span>{l}</span></div>
                  <small>{count("active", list)} active · {count("pending", list)} pending</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3><Activity size={15} /> Recent activity</h3><button className="link" onClick={() => nav("/audit")} data-testid="dash-view-audit">View all</button></div>
          <ul className="feed" data-testid="activity-feed">
            {recent.map((a) => (
              <li key={a.id}>
                <span className={"feed-dot " + (a.action === "Reject" || a.action === "Rejected" ? "rej" : a.action === "Approve" ? "ok" : "")} />
                <div>
                  <div className="feed-what"><b>{a.user}</b> {a.action.toLowerCase()} <span className="muted">{KIND_LABELS[a.entityType]}</span></div>
                  <div className="feed-sub">{a.entityLabel} · {timeAgo(a.ts)}</div>
                </div>
              </li>
            ))}
            {recent.length === 0 && <li className="muted" style={{ padding: 16 }}>No activity yet.</li>}
          </ul>
        </div>
      </div>

      <div id="queue-anchor" />
      <AuthQueue embedded />
    </div>
  );
}
