import React, { useState } from "react";
import { Modal } from "@/components/Modal";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function DeactivateUserModal({ user, isOpen, onClose, onConfirmDeactivate }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!isOpen || !user) return null;

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError("Please provide a reason for deactivation.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Reason must be at least 5 characters.");
      return;
    }
    onConfirmDeactivate(user.id, reason.trim());
    toast.success(`User ${user.name} has been deactivated. Active sessions terminated.`);
    setReason("");
    setError("");
    onClose();
  };

  return (
    <Modal
      id="deactivate-user-modal"
      title={`Deactivate User — ${user.name}`}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-outline" onClick={onClose} data-testid="cancel-deactivate">
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={handleConfirm} data-testid="confirm-deactivate">
            Deactivate User Immediately
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="note warn">
          <AlertTriangle size={18} />
          <div>
            <b>Immediate Effect:</b> Deactivating <b>{user.name}</b> ({user.empNo}) will immediately terminate all their active sessions and revoke system access.
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="deactivate-reason">
            Reason for Deactivation <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
          </label>
          <textarea
            id="deactivate-reason"
            data-testid="deactivate-reason"
            className={`textarea ${error ? "invalid" : ""}`}
            placeholder="e.g. Employee offboarding / role transition / security policy compliance..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
          />
          {error && <span className="field-error">{error}</span>}
        </div>
      </div>
    </Modal>
  );
}
