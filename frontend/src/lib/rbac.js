// ============================================================================
// Authorisation gate — every mutation passes through authorize(actor, action, target).
// Permissions are no longer four hardcoded roles: they come from the platform access
// model in lib/access.js (Module → Screen → Capability, admin-built roles, many per user).
// Hiding a button is a UX nicety, not enforcement.
// ============================================================================
import { SCREENS, CAP_LABELS, hasCap } from "./access";

/** Company email domain — work emails must end with "@" + this. */
export const COMPANY_DOMAIN = "camsonline.com";

/** Invite / account lifecycle constants. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;          // temp password valid 24h, single use
export const INACTIVITY_DEACTIVATE_DAYS = 90;              // auto-deactivate after 90 days unused
export const MAX_PASSWORD_ATTEMPTS = 5;                    // lock after 5 failed temp-password attempts
export const OTP_TTL_MS = 5 * 60 * 1000;                   // OTP valid 5 minutes
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RESEND_AFTER_MS = 60 * 1000;

export const USER_STATUS = {
  invited: { label: "Invited", cls: "us-invited" },
  active: { label: "Active", cls: "us-active" },
  invite_expired: { label: "Invite expired", cls: "us-expired" },
  deactivated: { label: "Deactivated", cls: "us-deactivated" },
};

/** Named actions → the screen capability they require. */
export const ACTIONS = {
  USER_CREATE: "user.create",
  USER_EDIT: "user.edit",
  USER_CHANGE_ROLE: "user.changeRole",
  USER_DEACTIVATE: "user.deactivate",
  USER_REACTIVATE: "user.reactivate",
  USER_RESEND_INVITE: "user.resendInvite",
  USER_EXPORT: "user.export",
  ROLE_EDIT: "role.edit",
  ACCESS_APPROVE: "access.approve",
};

const REQUIRES = {
  "user.create": ["users", "edit"],
  "user.edit": ["users", "edit"],
  "user.changeRole": ["users", "edit"],
  "user.deactivate": ["users", "edit"],
  "user.reactivate": ["users", "edit"],
  "user.resendInvite": ["users", "edit"],
  "user.export": ["users", "export"],
  "role.edit": ["roles", "edit"],
  "access.approve": ["roles", "approve"],
};

const ok = () => ({ ok: true });
const deny = (reason) => ({ ok: false, reason });

/**
 * The single authorisation gate.
 * @param actor  { id, name, status, perms }  perms = { screenKey: Set(caps) }
 * @param action a named ACTION, or { screen, cap } for any module screen
 * @param target optional record the action is applied to
 */
export function authorize(actor, action, target) {
  if (!actor) return deny("No signed-in user");
  if (actor.status !== "active") return deny("Your account is not active");

  const [screen, cap] = typeof action === "string" ? (REQUIRES[action] || []) : [action.screen, action.cap];
  if (!screen || !hasCap(actor.perms, screen, cap)) {
    return deny(`You do not have ${CAP_LABELS[cap] || cap} access on ${SCREENS[screen]?.label || screen}`);
  }

  // ---- contextual rules ----
  const self = target && target.id && target.id === actor.id;
  if (self && (action === ACTIONS.USER_CHANGE_ROLE || action === ACTIONS.USER_DEACTIVATE)) {
    return deny(action === ACTIONS.USER_CHANGE_ROLE ? "Admins cannot change their own roles" : "Admins cannot deactivate themselves");
  }
  if (action === ACTIONS.USER_DEACTIVATE && target && target.status === "deactivated") return deny("User is already deactivated");
  if (action === ACTIONS.USER_REACTIVATE && target && target.status !== "deactivated") return deny("Only deactivated users can be reactivated");
  if (action === ACTIONS.USER_RESEND_INVITE && target && !(target.status === "invited" || target.status === "invite_expired")) {
    return deny("Invites can only be resent to users who have not activated");
  }

  // Maker–checker: nobody approves their own work, on any screen.
  if (cap === "approve" && target) {
    const first = (actor.name || "").split(" ")[0];
    const authors = [target.owner, target.createdBy, target.editedBy, target.requestedBy].filter(Boolean);
    if (authors.includes(actor.name) || authors.includes(first)) {
      return deny("You cannot approve something you created or edited");
    }
  }
  return ok();
}

/** Non-logging convenience check for rendering decisions (NOT enforcement). */
export function can(actor, action, target) {
  return authorize(actor, action, target).ok;
}
