import React from "react";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

export default function Pagination({ total, page, pageSize, onPage, onPageSize, idPrefix = "pager" }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  // window of 5 page numbers
  let from = Math.max(1, page - 2);
  let to = Math.min(pages, from + 4);
  from = Math.max(1, to - 4);
  const nums = [];
  for (let i = from; i <= to; i++) nums.push(i);
  const [goto, setGoto] = React.useState("");

  const go = () => {
    const n = parseInt(goto, 10);
    if (!isNaN(n) && n >= 1 && n <= pages) onPage(n);
    setGoto("");
  };

  return (
    <div className="pager">
      <span className="showing tnum" data-testid={idPrefix + "-showing"}>
        Showing {start}–{end} of {total.toLocaleString("en-IN")} Records
      </span>
      <div className="pager-right">
        <select className="pg-select" value={pageSize} data-testid={idPrefix + "-pagesize"}
          onChange={(e) => onPageSize(parseInt(e.target.value, 10))}>
          {[15, 25, 50, 100, 250].map((s) => <option key={s} value={s}>{`${s} / page`}</option>)}
        </select>
        <button className="pg-btn" disabled={page === 1} onClick={() => onPage(1)} data-testid={idPrefix + "-first"} aria-label="First"><ChevronsLeft size={15} /></button>
        <button className="pg-btn" disabled={page === 1} onClick={() => onPage(page - 1)} data-testid={idPrefix + "-prev"} aria-label="Previous"><ChevronLeft size={15} /></button>
        {nums.map((n) => (
          <button key={n} className={`pg-btn ${n === page ? "on" : ""}`} onClick={() => onPage(n)} data-testid={idPrefix + "-page-" + n}>{n}</button>
        ))}
        <button className="pg-btn" disabled={page === pages} onClick={() => onPage(page + 1)} data-testid={idPrefix + "-next"} aria-label="Next"><ChevronRight size={15} /></button>
        <button className="pg-btn" disabled={page === pages} onClick={() => onPage(pages)} data-testid={idPrefix + "-last"} aria-label="Last"><ChevronsRight size={15} /></button>
        <input className="pg-goto tnum" placeholder="Go" value={goto} data-testid={idPrefix + "-goto"}
          onChange={(e) => setGoto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      </div>
    </div>
  );
}
