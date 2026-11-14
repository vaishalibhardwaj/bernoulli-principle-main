// A small panel anchored to a button, drawn above everything so a list or card can never clip it.
// Closes on outside click, Escape and scroll.
import React from "react";
import { createPortal } from "react-dom";

export function usePopover() {
  const [rect, setRect] = React.useState(null);
  const btn = React.useRef(null);
  const pop = React.useRef(null);
  const toggle = () => setRect((r) => (r ? null : btn.current?.getBoundingClientRect() || null));
  const close = React.useCallback(() => setRect(null), []);
  React.useEffect(() => {
    if (!rect) return undefined;
    const out = (e) => { if (!pop.current?.contains(e.target) && !btn.current?.contains(e.target)) close(); };
    const key = (e) => e.key === "Escape" && close();
    window.addEventListener("mousedown", out); window.addEventListener("keydown", key); window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("mousedown", out); window.removeEventListener("keydown", key); window.removeEventListener("scroll", close, true); };
  }, [rect, close]);
  return { rect, btn, pop, toggle, close, open: Boolean(rect) };
}

/** align: "left" | "right" (edge of the button the panel lines up with). */
export function PopoverPanel({ state, align = "left", width = 280, className = "", children, label }) {
  if (!state.rect) return null;
  const r = state.rect;
  const left = align === "right" ? Math.max(8, r.right - width) : Math.min(r.left, window.innerWidth - width - 8);
  const below = r.bottom + 8 + 260 < window.innerHeight;
  const style = { position: "fixed", left, width, ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) };
  return createPortal(<div ref={state.pop} className={"apop " + className} style={style} role="dialog" aria-label={label}>{children}</div>, document.body);
}
