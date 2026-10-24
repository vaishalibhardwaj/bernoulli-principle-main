import React from "react";
import { X } from "lucide-react";

export function Drawer({ title, subtitle, onClose, children, footer, id }) {
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" id={id} data-testid={id}>
        <div className="drawer-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div style={{ fontSize: 12.5, color: "hsl(var(--muted))", marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="x" onClick={onClose} aria-label="Close" data-testid={(id || "drawer") + "-close"}><X size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}
