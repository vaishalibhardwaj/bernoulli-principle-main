// Shared by Bank statements and Credit MIS: everything about one file source (a bank or an aggregator) in one place.
//  • sourceHealth: what is done and what is left, per part (accounts, columns, codes, tags).
//  • HealthTabs: the part tabs on a source page; each tab says its own state, so the tabs double as a checklist.
//  • ColumnsTab: the column mapping(s) for one source.
import React from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Eye, Check, Landmark, FileSpreadsheet } from "lucide-react";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { inScope, amcOfAccount } from "@/lib/org";
import { formatDate } from "@/lib/format";
import { normPa } from "@/lib/setupSchema";
import { Avatar } from "@/components/au";

export const paOfMapping = (m) => normPa(m.paCode || (m.paCodes || [])[0]);
const MAP_WORD = { active: "Active", pending: "Pending approval", draft: "Draft", rejected: "Sent back", inactive: "Inactive", not_started: "Not started" };

/** State of each part for one source. type: "bank" | "credit"; key: bank name or aggregator code; configs: that source's account setups (already AMC-scoped). */
export function sourceHealth(collections, type, key, configs) {
  const maps = (collections.bank_mapping || []).filter((m) => m.type === type && (type === "bank" ? m.bankName === key : paOfMapping(m) === key));
  const codes = (collections.status_map || []).filter((r) => (r.kind || "bank") === type && r.seenAt === key);
  const tags = type === "bank" ? (collections.narration_tags || []).filter((r) => r.bank === key) : [];
  const n = (list, st) => list.filter((x) => x.status === st).length;
  const part = (todo, waiting, done, words) => ({ state: todo ? "todo" : waiting ? "waiting" : done ? "ok" : "empty", todo, waiting, done, words });
  return {
    accounts: part(n(configs, "rejected") + n(configs, "draft"), n(configs, "pending"), n(configs, "active"), configs.length),
    columns: part(maps.filter((m) => ["rejected", "draft", "not_started"].includes(m.status)).length, n(maps, "pending"), n(maps, "active"), maps.length),
    codes: part(n(codes, "requested"), n(codes, "pending"), n(codes, "active"), codes.length),
    tags: part(0, n(tags, "pending"), n(tags, "active"), tags.length),
    maps,
  };
}

/** Short state text for a part, written for someone in a hurry. */
export function partNote(p, { emptyOk } = {}) {
  if (p.todo) return { tone: "todo", text: `${p.todo} to do` };
  if (p.waiting) return { tone: "waiting", text: `${p.waiting} waiting` };
  if (p.done) return { tone: "ok", text: String(p.done) };
  return { tone: emptyOk ? "none" : "todo", text: emptyOk ? "None" : "Not set" };
}

/** The checklist strip on a source card: one chip per part. */
export function HealthStrip({ parts }) {
  return (
    <span className="src-strip">
      {parts.map(([label, p, opts]) => {
        const note = partNote(p, opts);
        return <span key={label} className={"src-chip " + note.tone}>{note.tone === "ok" ? <Check size={12} /> : <i />}{label}<b>{note.text}</b></span>;
      })}
    </span>
  );
}

/** Part tabs on a source page. */
export function HealthTabs({ tabs, value, onChange }) {
  return (
    <div className="src-views src-ptabs" role="tablist">
      {tabs.map(([key, label]) => (
        <button key={key} role="tab" aria-selected={value === key} className={value === key ? "on" : ""} onClick={() => onChange(key)} data-testid={"src-tab-" + key}>{label}</button>
      ))}
    </div>
  );
}

/** The column mapping(s) for one source: usually one, more when the source sends more than one layout. */
export function ColumnsTab({ type, maps }) {
  const { collections, perms, amcUser } = useStore();
  const nav = useNavigate();
  const canEdit = hasCap(perms, "mapping", "edit");
  const configs = type === "credit" ? collections.credit_config || [] : collections.bank_config || [];
  const accountsFor = (m) => new Set(configs.filter((c) => c.bankName === m.bankName && (c.formatName || "") === (m.formatName || "") && inScope(amcUser, amcOfAccount(c.accountNumber))).map((c) => c.accountNumber)).size;
  return (
    <div>
      <div className="au-list">
        {maps.length === 0 && <div className="bs-empty">No column mapping yet. It is created when the first {type === "credit" ? "feed" : "account"} setup is approved.</div>}
        {maps.map((m) => {
          const view = m.status === "pending" || !canEdit; const n = accountsFor(m);
          return (
            <div key={m.id} className="au-row mp2-row" role="button" tabIndex={0} onClick={() => nav(`/mapping/${type}/${m.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/mapping/${type}/${m.id}`)} data-testid={"mapping-row-" + m.id}>
              <span className="au-who"><Avatar name="file" icon={FileSpreadsheet} size={38} color="#5b606b" /><span><b>{m.formatName || "Standard layout"}</b><em>{m.fileType}{m.standard ? " · standard layout, nothing to map" : ""}</em></span></span>
              <span className="au-meta"><Landmark size={14} /> {n} account{n !== 1 ? "s" : ""}</span>
              <span className={"au-st " + (m.status === "not_started" ? "draft" : m.status)}>{MAP_WORD[m.status] || m.status}</span>
              <span className="au-when">Updated {formatDate(m.lastUpdated)}</span>
              <button type="button" className="au-round" title={view ? "View" : "Edit columns"} onClick={(e) => { e.stopPropagation(); nav(`/mapping/${type}/${m.id}`); }}>{view ? <Eye size={16} /> : <Pencil size={16} />}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
