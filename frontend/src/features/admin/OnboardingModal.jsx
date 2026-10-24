import React, { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { useStore } from "@/state/store";
import { maskMobile } from "@/lib/credentials";
import {
  Mail, KeyRound, Smartphone, CheckCircle2, XCircle, ArrowRight,
  ShieldCheck, Lock, Sparkles, Copy, Check, Clock, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

export default function OnboardingModal({ user, isOpen, onClose, onUserActivated }) {
  const { roles } = useStore();
  // Step 1 = Invite Email, Step 2 = Set Password, Step 3 = Mobile OTP
  const [step, setStep] = useState(1);

  // Step 2 Form
  const [tempPw, setTempPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwAttempts, setPwAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  // Step 3 OTP Form
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 mins
  const [resendCooldown, setResendCooldown] = useState(60); // 60s
  const [canResend, setCanResend] = useState(false);
  const [copied, setCopied] = useState(false);

  const defaultTempPassword = user?.tempPassword || "Temp#Recon2026!";
  const sampleCompliantPw = "Secure#Pass2026!";
  const sampleOtp = "849201";

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTempPw("");
      setNewPw("");
      setConfirmPw("");
      setPwAttempts(0);
      setIsLocked(false);
      setOtp(["", "", "", "", "", ""]);
      setOtpAttempts(0);
      setTimerSeconds(300);
      setResendCooldown(60);
      setCanResend(false);
      setCopied(false);
    }
  }, [isOpen, user]);

  // Countdown timer for OTP
  useEffect(() => {
    if (step === 3 && timerSeconds > 0) {
      const interval = setInterval(() => setTimerSeconds((s) => s - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [step, timerSeconds]);

  // Resend cooldown timer
  useEffect(() => {
    if (step === 3 && resendCooldown > 0) {
      const interval = setInterval(() => setResendCooldown((s) => s - 1), 1000);
      return () => clearInterval(interval);
    } else if (resendCooldown === 0) {
      setCanResend(true);
    }
  }, [step, resendCooldown]);

  if (!isOpen || !user) return null;

  const roleObj = { label: (user.roles || []).map((rid) => roles.find((r) => r.id === rid)?.name).filter(Boolean).join(" + ") || "pending access" };
  const inviter = user.createdBy || "Meera Iyer";

  // Password rules validation
  const rules = [
    { key: "len", label: "At least 12 characters", ok: newPw.length >= 12 },
    { key: "upper", label: "Upper and lower case", ok: /[A-Z]/.test(newPw) && /[a-z]/.test(newPw) },
    { key: "num", label: "At least one number", ok: /\d/.test(newPw) },
    { key: "sym", label: "At least one symbol (!@#$%&*)", ok: /[^A-Za-z0-9]/.test(newPw) },
    { key: "notReused", label: "Not reused / matches temp password", ok: newPw.length > 0 && newPw !== defaultTempPassword },
  ];
  const allRulesPass = rules.every((r) => r.ok);
  const passwordsMatch = newPw && confirmPw && newPw === confirmPw;

  // Auto-fill helpers for Step 2
  const autoFillPasswordStep = () => {
    setTempPw(defaultTempPassword);
    setNewPw(sampleCompliantPw);
    setConfirmPw(sampleCompliantPw);
    toast.success("Populated temporary password & compliant new password!");
  };

  // Auto-fill helpers for Step 3
  const autoFillOtp = () => {
    setOtp(sampleOtp.split(""));
    toast.success("Populated valid 6-digit OTP (849201)!");
  };

  const handleCopyPassword = () => {
    navigator.clipboard?.writeText(defaultTempPassword);
    setCopied(true);
    toast.success("Temporary password copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle password submit (Step 2)
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (isLocked) {
      toast.error("Account locked due to 5 failed attempts. Contact admin.");
      return;
    }
    if (tempPw !== defaultTempPassword) {
      const nextAtt = pwAttempts + 1;
      setPwAttempts(nextAtt);
      if (nextAtt >= 5) {
        setIsLocked(true);
        toast.error("Account locked! 5 failed temporary password attempts.");
      } else {
        toast.error(`Invalid temporary password. Attempt ${nextAtt} of 5.`);
      }
      return;
    }
    if (!allRulesPass) {
      toast.error("New password does not meet all security policy requirements.");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Confirm password does not match new password.");
      return;
    }

    toast.success("Password set successfully! Verifying mobile number...");
    setStep(3);
  };

  // Handle OTP digit change
  const handleOtpChange = (index, val) => {
    const digit = val.slice(-1);
    if (!/^\d*$/.test(digit)) return;
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    if (digit && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  // Handle OTP Submit (Step 3)
  const handleOtpSubmit = (e) => {
    e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP code.");
      return;
    }
    if (fullOtp !== sampleOtp) {
      const nextAtt = otpAttempts + 1;
      setOtpAttempts(nextAtt);
      if (nextAtt >= 3) {
        toast.error("Maximum 3 OTP attempts exceeded. Please request a new code.");
        setOtp(["", "", "", "", "", ""]);
      } else {
        toast.error(`Invalid OTP code. Attempt ${nextAtt} of 3.`);
      }
      return;
    }

    toast.success(`🎉 Onboarding complete! ${user.name} is now Active.`);
    if (onUserActivated) {
      onUserActivated(user.id);
    }
    onClose();
  };

  const minutesLeft = Math.floor(timerSeconds / 60);
  const secondsLeft = String(timerSeconds % 60).padStart(2, "0");

  return (
    <Modal
      id="onboarding-flow-modal"
      title={`Onboarding Flow — ${user.name} (${roleObj.label})`}
      onClose={onClose}
      size="lg"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "hsl(var(--muted))" }}>
            Step {step} of 3: {step === 1 ? "Invite Email" : step === 2 ? "First Login: Set Password" : "First Login: Mobile OTP"}
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose} data-testid="onboarding-close-btn">
            Close Preview
          </button>
        </div>
      }
    >
      {/* Step Tabs indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          className={`btn btn-sm ${step === 1 ? "btn-primary" : "btn-outline"}`}
          onClick={() => setStep(1)}
          data-testid="tab-step-1"
        >
          <Mail size={14} /> 1. Invite Email
        </button>
        <button
          type="button"
          className={`btn btn-sm ${step === 2 ? "btn-primary" : "btn-outline"}`}
          onClick={() => setStep(2)}
          data-testid="tab-step-2"
        >
          <KeyRound size={14} /> 2. Set Password
        </button>
        <button
          type="button"
          className={`btn btn-sm ${step === 3 ? "btn-primary" : "btn-outline"}`}
          onClick={() => setStep(3)}
          data-testid="tab-step-3"
        >
          <Smartphone size={14} /> 3. Mobile OTP
        </button>
      </div>

      {/* ============================================================== */}
      {/* SCREEN 1: INVITE EMAIL                                         */}
      {/* ============================================================== */}
      {step === 1 && (
        <div className="email-card" data-testid="screen-invite-email">
          <div className="email-head">
            <div className="eh-brand">
              <ShieldCheck size={18} /> CAMS Reconciliation Platform
            </div>
          </div>
          <div className="email-body">
            <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 15 }}>
              Hello {user.name},
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <b>{inviter}</b> has granted you access to CAMS Operations with <b>{roleObj.label}</b>.
            </p>
            <p style={{ margin: "0 0 14px", color: "#475569" }}>
              Please use the temporary credentials below to sign in and set up your permanent password.
            </p>

            <div className="email-cred-box">
              <div className="email-cred-row">
                <span style={{ color: "#64748b" }}>Username / Work Email:</span>
                <b>{user.email}</b>
              </div>
              <div className="email-cred-row">
                <span style={{ color: "#64748b" }}>Temporary Password:</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <b>{defaultTempPassword}</b>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={handleCopyPassword}
                    title="Copy Temporary Password"
                    data-testid="btn-copy-temp-pw"
                  >
                    {copied ? <Check size={14} color="#047857" /> : <Copy size={14} />}
                  </button>
                </span>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <span className="pill pill-pending" style={{ fontSize: 10.5 }}>
                  <Clock size={11} /> Single use • Expires in 24 hours
                </span>
              </div>
            </div>

            <div style={{ textAlign: "center", margin: "24px 0" }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "10px 24px", fontSize: 14 }}
                onClick={() => setStep(2)}
                data-testid="email-btn-signin"
              >
                Sign in to Activate Account <ArrowRight size={15} />
              </button>
            </div>

            <div className="email-foot-note">
              Did not expect this? Contact your administrator at <b>admin.recon@camsonline.com</b> immediately.
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SCREEN 2: FIRST LOGIN, STEP 1: PASSWORD CREATION               */}
      {/* ============================================================== */}
      {step === 2 && (
        <div data-testid="screen-first-login-step1" style={{ maxWidth: 560, margin: "0 auto" }}>
          {/* Quick populate banner */}
          <div className="quick-fill-bar">
            <div className="qfb-title">
              <Sparkles size={14} /> ⚡ Click any field below or click here to auto-fill compliant password:
            </div>
            <div>
              <button
                type="button"
                className="btn btn-sm btn-fill"
                onClick={autoFillPasswordStep}
                data-testid="btn-autofill-passwords"
              >
                Auto-fill Compliant Password & Temp Password
              </button>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isLocked && (
              <div className="note warn">
                <AlertTriangle size={18} />
                <div><b>Account Locked:</b> Too many failed temporary password attempts (5/5). Contact administrator.</div>
              </div>
            )}

            {/* Temporary password */}
            <div className="field">
              <label className="field-label" htmlFor="temp-pw-input">
                Temporary Password <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
              </label>
              <input
                id="temp-pw-input"
                data-testid="temp-pw-input"
                type="text"
                className="input tnum"
                placeholder={`Click to auto-fill (${defaultTempPassword})`}
                value={tempPw}
                disabled={isLocked}
                onClick={() => { if (!tempPw) setTempPw(defaultTempPassword); }}
                onFocus={() => { if (!tempPw) setTempPw(defaultTempPassword); }}
                onChange={(e) => setTempPw(e.target.value)}
              />
              {!tempPw && <span className="click-hint">⚡ Click to auto-fill temporary password</span>}
            </div>

            {/* New Password */}
            <div className="field">
              <label className="field-label" htmlFor="new-pw-input">
                New Permanent Password <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
              </label>
              <input
                id="new-pw-input"
                data-testid="new-pw-input"
                type="text"
                className="input tnum"
                placeholder="Click to auto-fill compliant password"
                value={newPw}
                disabled={isLocked}
                onClick={() => { if (!newPw) setNewPw(sampleCompliantPw); }}
                onFocus={() => { if (!newPw) setNewPw(sampleCompliantPw); }}
                onChange={(e) => setNewPw(e.target.value)}
              />
              {!newPw && <span className="click-hint">⚡ Click to auto-fill strong password (Secure#Pass2026!)</span>}
            </div>

            {/* Confirm New Password */}
            <div className="field">
              <label className="field-label" htmlFor="confirm-pw-input">
                Confirm New Password <span style={{ color: "hsl(var(--st-rejected))" }}>*</span>
              </label>
              <input
                id="confirm-pw-input"
                data-testid="confirm-pw-input"
                type="text"
                className="input tnum"
                placeholder="Click to auto-fill matching password"
                value={confirmPw}
                disabled={isLocked}
                onClick={() => { if (!confirmPw) setConfirmPw(newPw || sampleCompliantPw); }}
                onFocus={() => { if (!confirmPw) setConfirmPw(newPw || sampleCompliantPw); }}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
              {!confirmPw && <span className="click-hint">⚡ Click to auto-fill matching confirm password</span>}
            </div>

            {/* Live Security Policy Checklist */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                Password Policy Checklist:
              </div>
              <div className="rules-checklist">
                {rules.map((r) => (
                  <div key={r.key} className={`rule-item ${r.ok ? "ok" : ""}`} data-testid={`rule-${r.key}`}>
                    {r.ok ? <CheckCircle2 size={14} color="#047857" /> : <XCircle size={14} color="#94a3b8" />}
                    <span>{r.label}</span>
                  </div>
                ))}
              </div>
              {passwordsMatch && (
                <div style={{ fontSize: 11.5, color: "#047857", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  <CheckCircle2 size={13} /> Passwords match
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLocked || !allRulesPass || !passwordsMatch || !tempPw}
              style={{ marginTop: 8 }}
              data-testid="btn-proceed-otp"
            >
              Continue to Step 2: Mobile OTP Verification <ArrowRight size={15} />
            </button>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* SCREEN 3: FIRST LOGIN, STEP 2: 6-DIGIT OTP VERIFICATION        */}
      {/* ============================================================== */}
      {step === 3 && (
        <div data-testid="screen-first-login-step2" style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          {/* Quick populate banner */}
          <div className="quick-fill-bar" style={{ textAlign: "left" }}>
            <div className="qfb-title">
              <Sparkles size={14} /> ⚡ Click OTP boxes below or click here to fill demo OTP:
            </div>
            <div>
              <button
                type="button"
                className="btn btn-sm btn-fill"
                onClick={autoFillOtp}
                data-testid="btn-autofill-otp"
              >
                Auto-fill 6-Digit OTP (849201)
              </button>
            </div>
          </div>

          <div style={{ margin: "20px 0 10px" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdfa", color: "#0f766e", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
              <Smartphone size={24} />
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>Enter 6-Digit Mobile OTP</h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              Sent to registered mobile number: <b>{maskMobile(user.phone)}</b>
            </p>
          </div>

          <form onSubmit={handleOtpSubmit}>
            {/* 6 Digit OTP inputs */}
            <div className="otp-boxes" onClick={() => { if (otp.every(d => !d)) autoFillOtp(); }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-input-${idx}`}
                  data-testid={`otp-input-${idx}`}
                  type="text"
                  maxLength={1}
                  className="otp-digit"
                  value={digit}
                  onClick={() => { if (otp.every(d => !d)) autoFillOtp(); }}
                  onFocus={() => { if (otp.every(d => !d)) autoFillOtp(); }}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                />
              ))}
            </div>
            {otp.every(d => !d) && (
              <span className="click-hint" style={{ justifyContent: "center", marginBottom: 12 }}>
                ⚡ Click OTP box to auto-fill demo OTP code
              </span>
            )}

            {/* Timer & Expiry info */}
            <div style={{ fontSize: 12.5, color: "#64748b", margin: "14px 0" }}>
              <span>Code expires in </span>
              <b style={{ color: timerSeconds < 60 ? "#b91c1c" : "#0f172a" }}>
                {minutesLeft}:{secondsLeft}
              </b>
              <span> • Attempt {otpAttempts + 1} of 3</span>
            </div>

            {/* Resend button */}
            <div style={{ margin: "12px 0 20px" }}>
              <button
                type="button"
                className="link"
                disabled={!canResend}
                onClick={() => {
                  setTimerSeconds(300);
                  setResendCooldown(60);
                  setCanResend(false);
                  toast.success("New OTP code dispatched to mobile.");
                }}
                data-testid="btn-resend-otp"
              >
                {canResend ? "Resend OTP code" : `Resend code in ${resendCooldown}s`}
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "10px", fontSize: 14 }}
              data-testid="btn-verify-otp"
            >
              Verify OTP & Activate Account
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
