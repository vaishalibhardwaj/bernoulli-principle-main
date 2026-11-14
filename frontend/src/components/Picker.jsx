// A dropdown that looks like the rest of the app: a pill button that opens a soft list.
// options: [{ value, label, count?, hint? }]. Keyboard: Enter or Space opens; arrows move; Enter picks; Escape closes.
import React from "react";
import { ChevronDown, Check } from "lucide-react";

export default function Picker({ value, options, onChange, label, testid, align = "left", width }) {
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const ref = React.useRef(null);
  const listId = React.useId();
  const cur = options.find((o) => o.value === value) || options[0];
  React.useEffect(() => {
    if (!open) return undefined;
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (o) => { onChange(o.value); setOpen(false); };
  const onKey = (e) => {
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(options.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(options[hi]); }
  };
  return (
    <div className={"pk" + (open ? " open" : "")} ref={ref}>
      <button type="button" className="pk-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={label} onClick={() => setOpen((o) => !o)} onKeyDown={onKey} data-testid={testid}>
        {label && <span className="pk-lbl">{label}</span>}
        <b>{cur?.label}</b>{cur?.count != null && <em className="tnum">{cur.count}</em>}
        <ChevronDown size={15} className="pk-chev" aria-hidden="true" />
      </button>
      {open && (
        <ul className={"pk-list " + align} role="listbox" id={listId} style={width ? { minWidth: width } : undefined} onKeyDown={onKey}>
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value} className={(i === hi ? "hi " : "") + (o.value === value ? "on" : "")} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(o); }} data-testid={testid ? `${testid}-${o.value}` : undefined}>
              <span className="pk-opt"><b>{o.label}</b>{o.hint && <small>{o.hint}</small>}</span>
              {o.count != null && <em className="tnum">{o.count}</em>}
              <Check size={14} className="pk-tick" aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
