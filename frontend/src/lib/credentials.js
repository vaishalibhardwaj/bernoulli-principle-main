// Credential helpers for the prototype. NOT real security — demo only.
import { COMPANY_DOMAIN } from "./rbac";

const UP = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LO = "abcdefghijkmnopqrstuvwxyz";
const NUM = "23456789";
const SYM = "!@#$%&*?";

function pick(s) { return s[Math.floor(Math.random() * s.length)]; }

/** 14-char temporary password that always satisfies the policy. */
export function genTempPassword() {
  const req = [pick(UP), pick(LO), pick(NUM), pick(SYM)];
  const all = UP + LO + NUM + SYM;
  while (req.length < 14) req.push(pick(all));
  return req.sort(() => Math.random() - 0.5).join("");
}

export function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Tiny non-cryptographic hash so plain passwords are not kept in state (demo only). */
export function hashPw(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "h" + (h >>> 0).toString(36);
}

/** Live password-policy rules. `reused` = array of previous hashes + temp password. */
export function passwordRules(pw, { tempPassword, history = [] } = {}) {
  const v = pw || "";
  return [
    { key: "len", label: "At least 12 characters", ok: v.length >= 12 },
    { key: "upper", label: "An uppercase letter", ok: /[A-Z]/.test(v) },
    { key: "lower", label: "A lowercase letter", ok: /[a-z]/.test(v) },
    { key: "num", label: "A number", ok: /\d/.test(v) },
    { key: "sym", label: "A symbol", ok: /[^A-Za-z0-9]/.test(v) },
    { key: "reuse", label: "Not a previously used password", ok: v.length > 0 && v !== tempPassword && !history.includes(hashPw(v)) },
  ];
}

export function maskMobile(phone) {
  const d = String(phone || "").replace(/\D/g, "").slice(-10);
  if (d.length < 10) return phone || "—";
  return `+91 ••••• •${d.slice(-4)}`;
}

export function formatPhone(phone) {
  const d = String(phone || "").replace(/\D/g, "").slice(-10);
  if (d.length < 10) return phone || "—";
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

/** Normalise the 10-digit part of a mobile number. */
export function mobileDigits(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return d;
}

/**
 * Validate the Add/Edit user form. Returns { field: message }.
 * `users` is the full list; `editingId` excludes that user from uniqueness checks.
 */
export function validateUser(form, users, editingId) {
  const e = {};
  const name = (form.name || "").trim();
  const emp = (form.empNo || "").trim();
  const email = (form.email || "").trim().toLowerCase();
  const mob = mobileDigits(form.phone);
  const others = users.filter((u) => u.id !== editingId);

  if (!name) e.name = "Full name is required";
  else if (name.length < 3) e.name = "Enter the full name (at least 3 characters)";
  else if (!/^[A-Za-z][A-Za-z .'-]+$/.test(name)) e.name = "Use letters, spaces, dots, apostrophes or hyphens only";

  if (!emp) e.empNo = "Employee number is required";
  else if (!/^[A-Za-z0-9-]{4,15}$/.test(emp)) e.empNo = "Use 4–15 letters, digits or hyphens";
  else if (others.some((u) => u.empNo.toLowerCase() === emp.toLowerCase())) e.empNo = `Employee number ${emp.toUpperCase()} is already assigned to another user`;

  if (!form.phone) e.phone = "Mobile number is required";
  else if (!/^[6-9]\d{9}$/.test(mob)) e.phone = "Enter a valid 10-digit Indian mobile number (starts with 6–9)";

  if (!email) e.email = "Work email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address";
  else if (!email.endsWith("@" + COMPANY_DOMAIN)) e.email = `Use a company email ending in @${COMPANY_DOMAIN}`;
  else if (others.some((u) => u.email.toLowerCase() === email)) e.email = "This email is already used by another user";

  if (!(form.designation || "").trim()) e.designation = "Designation is required";
  if (!form.role) e.role = "Select a role";
  return e;
}
