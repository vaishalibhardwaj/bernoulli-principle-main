import React from "react";
import { X } from "lucide-react";

export function Modal({ title, onClose, children, footer, size, id }) {
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className={`modal ${size === "lg" ? "lg" : ""}`} role="dialog" aria-modal="true" id={id} data-testid={id}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Close" data-testid={(id || "modal") + "-close"}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = "Confirm", danger, onConfirm, onClose, id }) {
  return (
    <Modal title={title} onClose={onClose} id={id}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} data-testid={(id || "confirm") + "-cancel"}>Cancel</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} data-testid={(id || "confirm") + "-ok"}
          onClick={() => { onConfirm(); onClose(); }} autoFocus
          onKeyDown={(e) => e.key === "Enter" && (onConfirm(), onClose())}>{confirmLabel}</button>
      </>}>
      <p>{message}</p>
    </Modal>
  );
}
