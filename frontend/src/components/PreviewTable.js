import React from "react";
import { Table, MousePointerClick } from "lucide-react";

/**
 * Sample-file preview. Rows above the header are greyed out. With onPickRow, every row is clickable so the
 * user can choose the real header row (bank statement setup, Credit MIS setup and column mapping).
 */
export default function PreviewTable({ rows, headerIdx, startColumn = 1, caption, onPickRow, maxRows = 11 }) {
  if (!rows) return null;
  return (
    <div className="preview-wrap" data-testid="preview-table">
      <div className="pv-head"><Table size={14} /> {caption || "Detected preview — first 10 rows"}{onPickRow && <span className="pv-hint"><MousePointerClick size={12} /> Click the row that holds the column names</span>}</div>
      <div style={{ overflowX: "auto" }}>
        <table className={"pv" + (onPickRow ? " pickable" : "")}>
          <tbody>
            {rows.slice(0, maxRows).map((r, ri) => {
              const isHeader = ri === headerIdx;
              const isJunk = ri < headerIdx;
              return (
                <tr key={ri} className={`rnum ${isHeader ? "header-row" : ""} ${isJunk ? "junk" : ""}`} data-testid={"pv-row-" + ri}
                  onClick={onPickRow ? () => onPickRow(ri) : undefined} title={onPickRow ? `Use row ${ri + 1} as the header` : undefined}>
                  <td>{ri + 1}{isHeader && onPickRow ? " ★" : ""}</td>
                  {r.map((c, ci) => (
                    <td key={ci} style={ci + 1 < startColumn && !isJunk ? { opacity: 0.4 } : undefined}>{c === "" ? "·" : c}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
