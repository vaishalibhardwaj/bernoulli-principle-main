import React from "react";
import { Drawer } from "@/components/Drawer";
import { useStore } from "@/state/store";
import { formatDate, maskAccount } from "@/lib/format";
import { hasCap } from "@/lib/access";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const DAY = 86400000;

/** Immutable, effective-dated versions of a bank setup, with diff and rollback (rollback is maker–checker). */
function versionsFor(cfg) {
  const fc = cfg.fileConfig || {};
  const pr = cfg.processing || {};
  const cur = {
    "File start row": String(fc.startRow ?? 1), "File start column": String(fc.startColumn ?? 1), "Separator": fc.separator || ",",
    "Upload path": fc.uploadPath || "—", "Compute running balance": pr.computeRunningBalance ? "On" : "Off",
    "Validate running balance": pr.validateRunningBalance ? "On" : "Off", "Direct match": pr.directMatch ? "On" : "Off", "Download mode": cfg.downloadMode,
  };
  const v2 = { ...cur, "Validate running balance": "Off", "Direct match": "Off" };
  const v1 = { ...v2, "File start row": "1", "Upload path": "/inbound/legacy" };
  const t = Date.now();
  return [
    { v: 3, values: cur, by: cfg.owner || "Priya", approvedBy: "Arun", effective: new Date(t - 12 * DAY).toISOString(), note: "Enabled balance validation and Direct Match" },
    { v: 2, values: v2, by: "Priya", approvedBy: "Arun", effective: new Date(t - 64 * DAY).toISOString(), note: "Header moved after bank format change" },
    { v: 1, values: v1, by: "Kiran", approvedBy: "Arun", effective: new Date(t - 190 * DAY).toISOString(), note: "Initial onboarding" },
  ];
}

export default function VersionsDrawer({ cfg, onClose }) {
  const { submit, perms } = useStore();
  const versions = React.useMemo(() => versionsFor(cfg), [cfg]);
  const [a, setA] = React.useState(1);
  const [b, setB] = React.useState(0);
  const A = versions[a], B = versions[b];
  const keys = Object.keys(B.values);
  const canRollback = hasCap(perms, "bank_setup", "edit") && cfg.status !== "pending";

  const rollback = (ver) => {
    submit("bank_config", { ...cfg, rollbackTo: ver.v }, `${cfg.bankName} · ${maskAccount(cfg.accountNumber)} (rollback to v${ver.v})`);
    toast.success(`Rollback to v${ver.v} submitted, effective from the next file once approved`);
    onClose();
  };

  return (
    <Drawer id="versions-drawer" title={`Version history — ${cfg.bankName} · ${maskAccount(cfg.accountNumber)}`} subtitle="Every approved change is a new immutable, effective-dated version. Rollback goes through maker–checker." onClose={onClose}>
      <div className="ver-list">
        {versions.map((v, i) => (
          <div key={v.v} className="ver-item">
            <span className="ver-badge"><History size={12} /> v{v.v}{i === 0 && " · current"}</span>
            <div><b>{v.note}</b><div className="muted">Made by {v.by} · approved by {v.approvedBy} · effective {formatDate(v.effective)}</div></div>
            {i > 0 && canRollback && <button className="btn btn-outline btn-sm" onClick={() => rollback(v)} data-testid={"rollback-v" + v.v}><RotateCcw size={12} /> Roll back</button>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "16px 0 8px" }}>
        <b>Compare</b>
        <select className="select" style={{ width: 90 }} value={a} onChange={(e) => setA(Number(e.target.value))}>{versions.map((v, i) => <option key={v.v} value={i}>v{v.v}</option>)}</select>
        <span>→</span>
        <select className="select" style={{ width: 90 }} value={b} onChange={(e) => setB(Number(e.target.value))}>{versions.map((v, i) => <option key={v.v} value={i}>v{v.v}</option>)}</select>
      </div>
      <table className="grid compact" data-testid="version-diff">
        <thead><tr><th>Setting</th><th>v{A.v}</th><th>v{B.v}</th></tr></thead>
        <tbody>{keys.map((k) => {
          const changed = A.values[k] !== B.values[k];
          return <tr key={k} className={changed ? "diff-row" : ""}><td>{k}</td><td className={changed ? "old" : ""}>{A.values[k]}</td><td className={changed ? "new" : ""}>{B.values[k]}</td></tr>;
        })}</tbody>
      </table>
    </Drawer>
  );
}
