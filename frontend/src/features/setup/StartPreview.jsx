// Shows a checker (or a maker) where a file's data starts: the first rows of the sample, with the row that holds
// the column names and the first data column marked. Without this, "Start row 3, start column 2" has no meaning.
// The rows come from the sample the maker attached to the setup. Synthetic in the prototype.
import React from "react";
import { Maximize2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { maskAccount } from "@/lib/format";
import { isStandard } from "@/lib/setupSchema";

const colLetter = (i) => String.fromCharCode(65 + i);

export const BANK_HEAD = ["Txn Date", "Value Date", "Narration", "Ref No", "Debit", "Credit", "Balance"];
export const BANK_ROWS = [
  ["11/11/2026", "11/11/2026", "NEFT CR-N3152611-APPLICANT 1", "N3152611", "", "25,000.00", "4,25,000.00"],
  ["11/11/2026", "11/11/2026", "UPI/CR/631500112/APPLICANT 2", "631500112", "", "5,000.00", "4,30,000.00"],
  ["11/11/2026", "11/11/2026", "RTGS CR-R8840112-APPLICANT 3", "R8840112", "", "2,00,000.00", "6,30,000.00"],
  ["11/11/2026", "11/11/2026", "CHRG REV 000112", "000112", "150.00", "", "6,29,850.00"],
  ["11/11/2026", "11/11/2026", "IMPS CR-631511890-APPLICANT 4", "631511890", "", "10,000.00", "6,39,850.00"],
];
const MIS_HEAD = ["Txn ID", "Txn Date", "Amount", "Status", "UTR", "Payment Mode"];
const MIS_ROWS = [
  ["TXN000101", "11/11/2026 09:12", "5000.00", "C", "UTR631500101", "UPI"],
  ["TXN000102", "11/11/2026 09:14", "25000.00", "C", "UTR631500102", "Net banking"],
  ["TXN000103", "11/11/2026 09:20", "1000.00", "D", "UTR631500103", "UPI"],
  ["TXN000104", "11/11/2026 09:31", "10000.00", "C", "UTR631500104", "Debit card"],
  ["TXN000105", "11/11/2026 09:40", "2500.00", "C", "UTR631500105", "UPI"],
];

/** Start row and column of a setup record, or null when the format has a fixed layout. */
export function startOf(x) {
  if (!x) return null;
  const kind = x._kind || x.kind;
  if (kind === "bank_mapping") return { row: Number(x.headerRow) || 1, col: 1 };
  const fc = x.fileConfig || {};
  const type = fc.fileType || fc.fileFormat;
  if (isStandard(type) || type === "PDF") return null;
  return { row: Number(fc.startRow) || 1, col: Number(fc.startColumn) || 1 };
}

/** The first rows of the sample for this record, laid out to its start row and column. */
function sampleRows(x, at) {
  const credit = (x._kind || x.kind) === "credit_config" || x.type === "credit";
  const head = credit ? MIS_HEAD : BANK_HEAD;
  const data = credit ? MIS_ROWS : BANK_ROWS;
  const pad = Array(at.col - 1).fill("");
  const top = [
    [x.bankName || "Bank"],
    [credit ? "Settlement report" : "Statement of account"],
    [x.accountNumber ? `Account: ${maskAccount(x.accountNumber)}` : "Account: several"],
    ["Period: 11/11/2026 to 11/11/2026"],
  ];
  const above = Array.from({ length: at.row - 1 }, (_, i) => top[i] || [""]);
  return [...above, [...pad, ...head], ...data.map((r) => [...pad, ...r])];
}

function Sheet({ rows, at, was, from, to }) {
  const width = Math.max(...rows.map((r) => r.length));
  return (
    <div className="sp-scroll">
      <table className="sp">
        <thead><tr><th />{Array.from({ length: width }, (_, i) => <th key={i} className={i + 1 === at.col ? "on" : ""}>{colLetter(i)}</th>)}</tr></thead>
        <tbody>
          {from > 0 && <tr className="sp-gap"><td>…</td><td colSpan={width}>{from} earlier {from === 1 ? "row" : "rows"} not shown</td></tr>}
          {rows.slice(from, to).map((r, k) => {
            const n = from + k + 1;
            const cls = n === at.row ? "head" : n < at.row ? "above" : "";
            return (
              <tr key={n} className={cls + (was && was.row === n && n !== at.row ? " was" : "")}>
                <td>{n}</td>
                {Array.from({ length: width }, (_, i) => <td key={i} className={i + 1 < at.col && n >= at.row ? "skip" : ""}>{r[i] || ""}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StartPreview({ x }) {
  const [open, setOpen] = React.useState(false);
  const at = startOf(x);
  if (!at) return null;
  const was = x.baseline ? startOf({ ...x.baseline, _kind: x._kind || x.kind }) : null;
  const moved = was && (was.row !== at.row || was.col !== at.col);
  const rows = sampleRows(x, at);
  const from = Math.max(0, at.row - 4);
  return (
    <div className="rev-card sp-card" data-testid="start-preview">
      <div className="rc-head">
        <h4>Where the data starts</h4>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} data-testid="start-preview-open"><Maximize2 size={13} /> Open sample file</button>
      </div>
      <div className="rc-body">
        <p className="sp-say">Column names are in <b>row {at.row}</b>, starting at <b>column {colLetter(at.col - 1)}</b> (column {at.col}). Everything below that row is read as transactions.</p>
        {moved && <p className="sp-was">Before this change: row {was.row}, column {colLetter(was.col - 1)}.</p>}
        <Sheet rows={rows} at={at} was={moved ? was : null} from={from} to={at.row + 3} />
        <div className="sp-key"><span><i className="k-head" />Column names</span><span><i className="k-above" />Ignored (above the column names)</span>{at.col > 1 && <span><i className="k-skip" />Ignored (before the start column)</span>}</div>
      </div>
      {open && (
        <Modal title="Sample file" size="lg" id="start-preview-modal" onClose={() => setOpen(false)}>
          <p className="sp-say">Column names are in <b>row {at.row}</b>, starting at <b>column {colLetter(at.col - 1)}</b>.</p>
          <Sheet rows={rows} at={at} was={moved ? was : null} from={0} to={rows.length} />
        </Modal>
      )}
    </div>
  );
}
