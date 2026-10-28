import React, { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import { seedBankConfigs, seedCreditConfigs, seedMappings, seedStatusMap, newMappingFor, seedCutoffs, seedNarrationTags } from "../mock/seed";
import { diffSetup, isStandard } from "../lib/setupSchema";
import { seedUsers } from "../mock/userSeed";
import { uid } from "../lib/format";
import { userAmcs } from "../lib/org";
import { seedNoAction } from "../lib/events";
import { ACTIONS, authorize, INVITE_TTL_MS } from "../lib/rbac";
import { genTempPassword } from "../lib/credentials";
import { seedRoles, permsFor, hasCap, isPrivileged, sodConflicts, SCREEN_FOR_KIND, isSimpleUser } from "../lib/access";
import { earlierFailures, seedFiles, seedMatchData, seedRules, seedExceptions, seedDocuments, seedReleases, seedRefunds, withHistory, seedEmails, seedConnections, seedSftp, seedBalances, seedJobs, seedFileTrack, seedLiability } from "../mock/opsSeed";

const KEY = "cams_recon_state_v24";
// Saved state must contain every collection this build seeds; otherwise reseed (avoids stale demo data from older builds).
const REQUIRED = ["users", "roles", "files", "emails", "connections", "refunds", "releases", "dayclose", "status_map", "sftp", "cutoffs", "narration_tags", "balances", "jobs", "liab_debits"];

/** R7 — keep the live (last approved) version on a draft/pending edit so the checker sees a diff. */
function baselineOf(prev, item) {
  if (prev && (prev.status === "active" || prev.status === "inactive")) { const { baseline, ...live } = prev; return JSON.parse(JSON.stringify(live)); }
  return (prev && prev.baseline) || item.baseline || null;
}

function buildSeed() {
  const configs = seedBankConfigs();
  const creditConfigs = seedCreditConfigs();
  const mappings = seedMappings(configs);
  const users = seedUsers();
  const roles = seedRoles();
  const { credits, purchases, suggestions } = seedMatchData();
  const files = withHistory(seedFiles());
  const audit = [
    { id: uid("au"), ts: new Date(Date.now() - 2 * 86400000).toISOString(), user: "Arun", entityType: "bank_config", entityId: configs[0].id, entityLabel: `${configs[0].bankName} · ${configs[0].accountNumber.slice(-4)}`, action: "Rejected", from: "Pending Approval", to: "Rejected", comment: configs[0].rejection.comment },
    { id: uid("au"), ts: new Date(Date.now() - 3 * 86400000).toISOString(), user: "Arun", entityType: "bank_config", entityId: configs[1].id, entityLabel: `${configs[1].bankName} · ${configs[1].accountNumber.slice(-4)}`, action: "Rejected", from: "Pending Approval", to: "Rejected", comment: configs[1].rejection.comment },
    { id: uid("au"), ts: new Date(Date.now() - 3 * 3600000).toISOString(), user: "Meera", entityType: "user", entityId: "usr_kiran", entityLabel: "Kiran Das (EMP-2042)", action: "Add User", from: null, to: "Invited", comment: "Invited as Operator" },
  ];
  return {
    collections: {
      bank_config: configs, credit_config: creditConfigs, bank_mapping: mappings, users, roles,
      access_requests: [
        { id: "acr_seed1", kind: "assign", status: "pending", userId: "usr_sanjay", roleIds: ["role_recon_checker"], requestedBy: "Meera Iyer", requestedAt: new Date(Date.now() - 2 * 3600000).toISOString(), note: "Sanjay to cover Arun's approvals during leave (21–31 Oct)" },
      ],
      files: files.map((f) => ({ ...f, histV2: true })), emails: seedEmails(files), connections: seedConnections(files), sftp: seedSftp(files), manual_uploads: [], file_uploads: [], no_action: seedNoAction(), dismissals: [], balances: seedBalances(), jobs: seedJobs(), file_track: seedFileTrack(), liab_debits: seedLiability().debits, liab_payouts: seedLiability().payouts, liab_matches: [], credits, purchases, suggestions, matches: [], rules: seedRules(), rule_drafts: [],
      exceptions: seedExceptions(), documents: seedDocuments(),
      releases: seedReleases(), refunds: seedRefunds(), dayclose: [{ id: "day_today", status: "open" }], status_map: seedStatusMap(), cutoffs: seedCutoffs(), narration_tags: seedNarrationTags(),
    },
    audit,
    persona: "usr_meera",
    simpleOverride: {},
    amcChoice: {}, // persona id → the one AMC they are working on
    vertical: "MF",
    adminNotifications: [
      { id: uid("notif"), message: "Meera added Kiran Das as Operator", ts: new Date(Date.now() - 3 * 3600000).toISOString() },
    ],
    sidebarCollapsed: false,
    bannerDismissed: false,
    sessionId: uid("ses"),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.collections && REQUIRED.every((k) => Array.isArray(parsed.collections[k])) && parsed.collections.users.length >= 100) {
        // Newer seed jobs, tracked files and role screens are merged into saved demo state (saved edits win).
        // Earlier failed scheduler runs (shown voided in file history) for saved demo state that predates them.
        parsed.collections.files = parsed.collections.files.map((f) => (f.histV2 ? f : { ...f, histV2: true, history: [...earlierFailures(f), ...(f.history || [])] }));
        // Balances are read-only daily facts in the prototype, so they always come fresh from the seed.
        parsed.collections.balances = seedBalances();
        const seeded = { jobs: seedJobs(), file_track: seedFileTrack() };
        Object.entries(seeded).forEach(([k, fresh]) => {
          const saved = new Map((parsed.collections[k] || []).map((x) => [x.id, x]));
          parsed.collections[k] = [...fresh.map((x) => ({ ...x, ...(saved.get(x.id) || {}) , amcs: x.amcs, amc: x.amc, source: x.source, fileType: x.fileType })), ...[...saved.values()].filter((x) => !fresh.some((y) => y.id === x.id))];
        });
        const seedPerms = Object.fromEntries(seedRoles().map((r) => [r.id, r.perms]));
        parsed.collections.roles = parsed.collections.roles.map((r) => (r.id === "role_platform_admin" ? { ...r, perms: seedPerms[r.id] } : r.system && seedPerms[r.id] ? { ...r, perms: { ...seedPerms[r.id], ...r.perms } } : r));
        if (!Array.isArray(parsed.collections.file_uploads)) parsed.collections.file_uploads = [];
        if (!Array.isArray(parsed.collections.no_action)) parsed.collections.no_action = seedNoAction();
        // Platform Admin was renamed to Central Setup Team; carry the rename into saved demo state.
        parsed.collections.roles = parsed.collections.roles.map((r) => (r.id === "role_platform_admin" ? { ...r, name: "Central Setup Team", description: seedRoles()[0].description } : r));
        return parsed;
      }
    }
  } catch (e) { /* ignore */ }
  return buildSeed();
}

function reducer(state, action) {
  switch (action.type) {
    case "SET": return { ...state, ...action.payload };
    case "SET_SIMPLE": return { ...state, simpleOverride: { ...(state.simpleOverride || {}), [action.id]: action.on } };
    case "SET_VERTICAL": return { ...state, vertical: action.vertical };
    case "SET_AMC": return { ...state, amcChoice: { ...(state.amcChoice || {}), [state.persona]: action.amc } };
    case "SWITCH_PERSONA": return { ...state, persona: action.id, bannerDismissed: false, sessionId: uid("ses") };
    case "TOGGLE_SIDEBAR": return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "DISMISS_BANNER": return { ...state, bannerDismissed: true };
    case "RESET": return buildSeed();
    case "UPSERT": {
      const { kind, item } = action;
      const list = state.collections[kind] || [];
      const exists = list.some((x) => x.id === item.id);
      const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [{ ...item }, ...list];
      return { ...state, collections: { ...state.collections, [kind]: next } };
    }
    case "AUDIT": return { ...state, audit: [action.entry, ...state.audit] };
    case "ADD_ADMIN_NOTIF": return { ...state, adminNotifications: [action.notif, ...state.adminNotifications] };
    default: return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, [state]);

  const roles = React.useMemo(() => state.collections.roles || [], [state.collections.roles]);
  const personaUser = (state.collections.users || []).find((u) => u.id === state.persona) || state.collections.users[0];
  // The AMC this person is working on right now (picked at sign-in, switchable in the header). Drives every list.
  // One AMC at a time: a user with several AMCs works on the one they picked (there is no "all my AMCs" view).
  const myAmcList = userAmcs(personaUser);
  const choice = (state.amcChoice || {})[state.persona];
  const activeAmc = myAmcList.includes(choice) ? choice : null;
  const workingAmc = activeAmc || myAmcList[0];
  const amcUser = React.useMemo(() => (myAmcList.length > 1 ? { ...personaUser, amcs: [workingAmc] } : personaUser), [personaUser, workingAmc, myAmcList.length]);
  const setAmc = useCallback((amc) => dispatch({ type: "SET_AMC", amc }), []);
  const vertical = state.vertical || "MF";
  const setVertical = useCallback((v) => dispatch({ type: "SET_VERTICAL", vertical: v }), []);
  const perms = React.useMemo(() => permsFor(personaUser, roles), [personaUser, roles]);
  // Short name ("Priya") is what records store as owner — keeps the existing screens' maker–checker checks working.
  const activePersona = { id: personaUser.id, name: personaUser.name.split(" ")[0], fullName: personaUser.name };
  const currentUser = activePersona.name;
  // Simple view: on by default for daily users (role flag); anyone can switch it from the avatar menu.
  const override = (state.simpleOverride || {})[personaUser.id];
  const simple = override !== undefined ? override : isSimpleUser(personaUser, roles);
  const roleNames = (personaUser.roles || []).map((rid) => roles.find((r) => r.id === rid)?.name).filter(Boolean);
  const currentRole = roleNames.join(" + ") || "No roles";
  // Legacy persona key for the original Phase-1 config screens (derived from screen permissions).
  const legacyRole = hasCap(perms, "approvals", "approve") || hasCap(perms, "bank_setup", "approve") ? "auth"
    : hasCap(perms, "bank_setup", "edit") || hasCap(perms, "credit_mis", "edit") || hasCap(perms, "mapping", "edit") ? "maker"
    : hasCap(perms, "users", "view") ? "admin" : "viewer";

  // Actor record used for RBAC checks
  const actor = React.useMemo(() => ({
    id: personaUser.id,
    name: personaUser.name.split(" ")[0],
    status: personaUser.status === "active" ? "active" : personaUser.status,
    perms,
  }), [personaUser, perms]);

  const addAudit = useCallback((entry) => {
    dispatch({
      type: "AUDIT",
      entry: {
        id: uid("au"),
        ts: new Date().toISOString(),
        user: activePersona.name,
        actorId: activePersona.id,
        actorRole: currentRole,
        ...entry,
      },
    });
  }, [activePersona.name, activePersona.id, currentRole]);

  const statusLabel = (s) => ({ not_started: "Not Started", draft: "Draft", pending: "Pending Approval", rejected: "Rejected", active: "Active", inactive: "Inactive", invited: "Invited", invite_expired: "Invite expired", deactivated: "Deactivated" }[s] || s);

  const get = useCallback((kind, id) => (state.collections[kind] || []).find((x) => x.id === id), [state.collections]);

  // Operations actions
  const saveDraft = useCallback((kind, item, label) => {
    const prev = get(kind, item.id);
    const from = prev ? prev.status : "new";
    const saved = { ...item, baseline: baselineOf(prev, item), status: "draft", lastUpdated: new Date().toISOString(), owner: activePersona.name };
    dispatch({ type: "UPSERT", kind, item: saved });
    addAudit({ entityType: kind, entityId: saved.id, entityLabel: label, action: "Save as Draft", from: statusLabel(from), to: "Draft" });
    return saved;
  }, [get, addAudit, activePersona.name]);

  const submit = useCallback((kind, item, label) => {
    const prev = get(kind, item.id);
    const from = prev ? prev.status : "new";
    const saved = { ...item, baseline: baselineOf(prev, item), status: "pending", lastUpdated: new Date().toISOString(), owner: activePersona.name };
    dispatch({ type: "UPSERT", kind, item: saved });
    // R7 — log whether this is a new setup or an edit, and which fields changed.
    const diff = diffSetup(saved.baseline, { ...saved, kind });
    addAudit({ entityType: kind, entityId: saved.id, entityLabel: label, action: diff ? "Submit edit for Approval" : "Submit new setup for Approval", from: statusLabel(from), to: "Pending Approval", comment: diff ? (diff.length ? "Changed: " + diff.map((d) => d.field).join(", ") : "No field changes") : undefined });
    return saved;
  }, [get, addAudit, activePersona.name]);

  const approve = useCallback((kind, id, label) => {
    const item = get(kind, id);
    if (!item) return;
    const authCheck = authorize(actor, { screen: SCREEN_FOR_KIND[kind], cap: "approve" }, item);
    if (!authCheck.ok) {
      addAudit({ entityType: kind, entityId: id, entityLabel: label, action: "Approve (Denied)", denied: true, reason: authCheck.reason });
      throw new Error(authCheck.reason);
    }
    const active = item.processing ? item.processing.isActive !== false : true;
    const to = active ? "active" : "inactive";
    const saved = { ...item, status: to, lastUpdated: new Date().toISOString(), rejection: null, approved: true, baseline: null, effectiveFrom: new Date().toISOString() };
    dispatch({ type: "UPSERT", kind, item: saved });
    addAudit({ entityType: kind, entityId: id, entityLabel: label, action: "Approve", from: "Pending Approval", to: statusLabel(to), comment: "Effective from the next file; already-loaded files not re-processed" });
    // A newly approved bank setup gets its column-mapping record (standard formats need none — pre-built parser).
    // Mapping is per bank (and format) — a new account at a bank that already has one reuses it.
    if (kind === "bank_config" && !(state.collections.bank_mapping || []).some((m) => m.type === "bank" && m.bankName === saved.bankName && (m.formatName || "") === (saved.formatName || ""))) {
      const m = newMappingFor(saved, (state.collections.bank_mapping || []).length + 1);
      dispatch({ type: "UPSERT", kind: "bank_mapping", item: m });
      addAudit({ entityType: "bank_mapping", entityId: m.id, entityLabel: `${saved.bankName} mapping`, action: isStandard(saved.fileConfig?.fileType) ? "Standard format — no mapping needed" : "Mapping created", from: null, to: isStandard(saved.fileConfig?.fileType) ? "Active" : "Not Started" });
    }
  }, [get, addAudit, actor, state.collections.bank_mapping]);

  const reject = useCallback((kind, id, comment, label) => {
    const item = get(kind, id);
    if (!item) return;
    const authCheck = authorize(actor, { screen: SCREEN_FOR_KIND[kind], cap: "approve" }, item);
    if (!authCheck.ok) {
      addAudit({ entityType: kind, entityId: id, entityLabel: label, action: "Reject (Denied)", denied: true, reason: authCheck.reason });
      throw new Error(authCheck.reason);
    }
    const saved = { ...item, status: "rejected", lastUpdated: new Date().toISOString(), rejection: { by: activePersona.name, date: new Date().toISOString(), comment } };
    dispatch({ type: "UPSERT", kind, item: saved });
    addAudit({ entityType: kind, entityId: id, entityLabel: label, action: "Reject", from: "Pending Approval", to: "Rejected", comment });
  }, [get, addAudit, activePersona.name, actor]);

  // =========================================================================
  // USER MANAGEMENT ACTIONS (RBAC enforced through authorize)
  // =========================================================================
  const roleName = useCallback((rid) => roles.find((r) => r.id === rid)?.name || rid, [roles]);

  // Privileged grants (any Checker or Admin capability) wait for a second admin.
  const splitGrants = useCallback((roleIds, before = []) => {
    const added = roleIds.filter((r) => !before.includes(r));
    const privileged = added.filter((r) => isPrivileged(roles.find((x) => x.id === r)));
    const immediate = roleIds.filter((r) => !privileged.includes(r));
    return { immediate, privileged, added };
  }, [roles]);

  const queueAccessRequest = useCallback((req) => {
    const item = { id: uid("acr"), status: "pending", requestedBy: personaUser.name, requestedAt: new Date().toISOString(), ...req };
    dispatch({ type: "UPSERT", kind: "access_requests", item });
    return item;
  }, [personaUser.name]);

  const addUser = useCallback((form) => {
    const authCheck = authorize(actor, ACTIONS.USER_CREATE);
    if (!authCheck.ok) {
      addAudit({ entityType: "user", entityLabel: form.name, action: "Add User (Denied)", denied: true, reason: authCheck.reason });
      return { ok: false, error: authCheck.reason };
    }
    const conflicts = sodConflicts(form.roles || [], roles);
    if (conflicts.length) return { ok: false, error: `Segregation of duties: Maker and Checker on ${conflicts.join(", ")}` };

    const { immediate, privileged } = splitGrants(form.roles || []);
    const tempPassword = genTempPassword();
    const now = Date.now();
    const newUser = {
      id: uid("usr"),
      empNo: form.empNo.trim().toUpperCase(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      designation: form.designation.trim(),
      roles: immediate,
      amcs: form.amcs && form.amcs.length ? form.amcs : ["ALL"],
      workflowSteps: form.workflowSteps && form.workflowSteps.length ? form.workflowSteps : undefined,
      status: "invited",
      lastLogin: null,
      tempPassword,
      inviteCreatedAt: new Date(now).toISOString(),
      inviteExpiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
      createdBy: personaUser.name,
    };
    dispatch({ type: "UPSERT", kind: "users", item: newUser });
    if (privileged.length) queueAccessRequest({ kind: "assign", userId: newUser.id, roleIds: privileged, note: "Privileged role on a new user" });

    const names = (form.roles || []).map(roleName).join(", ") || "no roles";
    dispatch({ type: "ADD_ADMIN_NOTIF", notif: { id: uid("notif"), message: `${activePersona.name} added ${newUser.name} with ${names}`, ts: new Date().toISOString(), targetId: newUser.id } });
    addAudit({
      entityType: "user", entityId: newUser.id, entityLabel: `${newUser.name} (${newUser.empNo})`, action: "Add User", from: null, to: "Invited",
      comment: `Roles granted: ${immediate.map(roleName).join(", ") || "—"}${privileged.length ? `. Awaiting second-admin approval: ${privileged.map(roleName).join(", ")}` : ""}.`,
    });
    return { ok: true, user: newUser, tempPassword, pending: privileged.length };
  }, [actor, activePersona.name, personaUser.name, addAudit, roles, splitGrants, queueAccessRequest, roleName]);

  const updateUser = useCallback((id, form) => {
    const existing = (state.collections.users || []).find((u) => u.id === id);
    if (!existing) return { ok: false, error: "User not found" };
    const nextRoles = form.roles || existing.roles || [];
    const rolesChanged = JSON.stringify([...nextRoles].sort()) !== JSON.stringify([...(existing.roles || [])].sort());
    const authCheck = authorize(actor, rolesChanged ? ACTIONS.USER_CHANGE_ROLE : ACTIONS.USER_EDIT, existing);
    if (!authCheck.ok) {
      addAudit({ entityType: "user", entityId: id, entityLabel: existing.name, action: "Edit User (Denied)", denied: true, reason: authCheck.reason });
      return { ok: false, error: authCheck.reason };
    }
    const conflicts = sodConflicts(nextRoles, roles);
    if (conflicts.length) return { ok: false, error: `Segregation of duties: Maker and Checker on ${conflicts.join(", ")}` };

    const { immediate, privileged } = splitGrants(nextRoles, existing.roles || []);
    const updated = {
      ...existing,
      name: form.name.trim(), empNo: form.empNo.trim().toUpperCase(), email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(), designation: form.designation.trim(),
      roles: immediate, lastUpdated: new Date().toISOString(),
      amcs: form.amcs && form.amcs.length ? form.amcs : existing.amcs || ["ALL"],
      workflowSteps: form.workflowSteps && form.workflowSteps.length ? form.workflowSteps : undefined,
    };
    dispatch({ type: "UPSERT", kind: "users", item: updated });
    if (privileged.length) queueAccessRequest({ kind: "assign", userId: id, roleIds: privileged, note: "Privileged role added" });

    if (rolesChanged) {
      const removed = (existing.roles || []).filter((r) => !nextRoles.includes(r));
      const msg = `${activePersona.name} changed ${updated.name}'s roles`;
      dispatch({ type: "ADD_ADMIN_NOTIF", notif: { id: uid("notif"), message: msg, ts: new Date().toISOString(), targetId: id } });
      addAudit({
        entityType: "user", entityId: id, entityLabel: `${updated.name} (${updated.empNo})`, action: "Change Roles",
        from: (existing.roles || []).map(roleName).join(", "), to: immediate.map(roleName).join(", "),
        comment: `${removed.length ? `Removed: ${removed.map(roleName).join(", ")}. ` : ""}${privileged.length ? `Awaiting second-admin approval: ${privileged.map(roleName).join(", ")}.` : ""}`,
      });
    } else {
      addAudit({ entityType: "user", entityId: id, entityLabel: `${updated.name} (${updated.empNo})`, action: "Edit User", from: null, to: null, comment: `Profile details updated by ${activePersona.name}` });
    }
    return { ok: true, user: updated, pending: privileged.length };
  }, [actor, activePersona.name, addAudit, state.collections.users, roles, splitGrants, queueAccessRequest, roleName]);

  // ---- Roles & access requests (dual control on access itself) ----
  const submitRole = useCallback((role) => {
    const authCheck = authorize(actor, ACTIONS.ROLE_EDIT);
    if (!authCheck.ok) return { ok: false, error: authCheck.reason };
    const isNew = !roles.some((r) => r.id === role.id);
    const id = role.id || uid("role");
    if (isNew) dispatch({ type: "UPSERT", kind: "roles", item: { ...role, id, status: "pending", system: false, createdBy: personaUser.name, createdAt: new Date().toISOString() } });
    const req = queueAccessRequest({ kind: isNew ? "role_new" : "role_edit", roleId: id, draft: { ...role, id }, note: role.changeNote || "" });
    addAudit({ entityType: "role", entityId: id, entityLabel: role.name, action: isNew ? "Create Role" : "Edit Role", from: null, to: "Pending Approval", comment: "Sent to second admin for approval" });
    return { ok: true, request: req };
  }, [actor, roles, personaUser.name, queueAccessRequest, addAudit]);

  const decideAccess = useCallback((reqId, approveIt, comment) => {
    const req = (state.collections.access_requests || []).find((r) => r.id === reqId);
    if (!req) return { ok: false, error: "Request not found" };
    const authCheck = authorize(actor, ACTIONS.ACCESS_APPROVE, req);
    if (!authCheck.ok) {
      addAudit({ entityType: "access", entityId: reqId, entityLabel: req.kind, action: "Access Decision (Denied)", denied: true, reason: authCheck.reason });
      return { ok: false, error: authCheck.reason };
    }
    if (approveIt && req.kind === "assign") {
      const u = state.collections.users.find((x) => x.id === req.userId);
      if (u && sodConflicts(Array.from(new Set([...(u.roles || []), ...req.roleIds])), roles).length) {
        return { ok: false, error: "Approving would make this user Maker and Checker on the same screen. Reject it, or remove the user's maker role first." };
      }
    }
    dispatch({ type: "UPSERT", kind: "access_requests", item: { ...req, status: approveIt ? "approved" : "rejected", decidedBy: personaUser.name, decidedAt: new Date().toISOString(), comment } });
    let label = req.kind;
    if (req.kind === "reactivate") {
      const u = state.collections.users.find((x) => x.id === req.userId);
      if (u && approveIt) dispatch({ type: "UPSERT", kind: "users", item: { ...u, status: "active", autoDeactivated: false, deactivationReason: null, reactivatedAt: new Date().toISOString(), reactivatedBy: `${req.requestedBy} (approved by ${personaUser.name})`, lastBiometric: req.biometricConfirmed ? new Date().toISOString() : u.lastBiometric } });
      label = `Reactivate ${u?.name || req.userId}`;
    } else if (approveIt) {
      if (req.kind === "assign") {
        const u = state.collections.users.find((x) => x.id === req.userId);
        if (u) {
          const merged = Array.from(new Set([...(u.roles || []), ...req.roleIds]));
          dispatch({ type: "UPSERT", kind: "users", item: { ...u, roles: merged } });
          label = `${u.name}: ${req.roleIds.map(roleName).join(", ")}`;
        }
      } else {
        dispatch({ type: "UPSERT", kind: "roles", item: { ...req.draft, status: "active", system: req.draft.system || false, approvedBy: personaUser.name, updatedAt: new Date().toISOString() } });
        label = req.draft.name;
      }
    } else if (req.kind === "role_new") {
      dispatch({ type: "UPSERT", kind: "roles", item: { ...req.draft, status: "rejected" } });
      label = req.draft.name;
    }
    addAudit({ entityType: "access", entityId: reqId, entityLabel: label, action: approveIt ? "Approve Access" : "Reject Access", from: "Pending Approval", to: approveIt ? "Active" : "Rejected", comment });
    return { ok: true };
  }, [actor, state.collections.access_requests, state.collections.users, roles, personaUser.name, addAudit, roleName]);

  // ---- Generic operational action (match, exceptions, files, rules, documents) ----
  // Every mutation names the screen + capability it needs; authorize() enforces it.
  const act = useCallback(({ screen, cap, kind, id, patch, target, audit: entry }) => {
    const item = id ? (state.collections[kind] || []).find((x) => x.id === id) : null;
    const authCheck = authorize(actor, { screen, cap }, target || item);
    if (!authCheck.ok) {
      addAudit({ entityType: kind, entityId: id, entityLabel: entry?.entityLabel || id, action: `${entry?.action || cap} (Denied)`, denied: true, reason: authCheck.reason });
      return { ok: false, error: authCheck.reason };
    }
    if (kind && patch) {
      const next = typeof patch === "function" ? patch(item) : { ...item, ...patch };
      dispatch({ type: "UPSERT", kind, item: { ...next, lastUpdated: new Date().toISOString() } });
    }
    if (entry) addAudit({ entityType: kind, entityId: id, ...entry });
    return { ok: true };
  }, [actor, state.collections, addAudit]);

  const deactivateUser = useCallback((id, reason) => {
    const existing = (state.collections.users || []).find((u) => u.id === id);
    if (!existing) return { ok: false, error: "User not found" };

    const authCheck = authorize(actor, ACTIONS.USER_DEACTIVATE, existing);
    if (!authCheck.ok) {
      addAudit({ entityType: "user", entityId: id, entityLabel: existing.name, action: "Deactivate (Denied)", denied: true, reason: authCheck.reason });
      return { ok: false, error: authCheck.reason };
    }

    const updated = {
      ...existing,
      status: "deactivated",
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: activePersona.name,
      deactivationReason: reason,
    };
    dispatch({ type: "UPSERT", kind: "users", item: updated });

    addAudit({
      entityType: "user",
      entityId: id,
      entityLabel: `${existing.name} (${existing.empNo})`,
      action: "Deactivate User",
      from: statusLabel(existing.status),
      to: "Deactivated",
      comment: reason ? `Reason: ${reason}` : "Deactivated by admin",
    });

    return { ok: true, user: updated };
  }, [actor, activePersona.name, addAudit, state.collections.users]);

  /** Controlled reactivation: a reason (and IDM ticket for biometric cases) goes to a second admin. */
  const requestReactivation = useCallback((id, reason, ticket, biometricConfirmed) => {
    const existing = (state.collections.users || []).find((u) => u.id === id);
    if (!existing) return { ok: false, error: "User not found" };
    const authCheck = authorize(actor, ACTIONS.USER_REACTIVATE, existing);
    if (!authCheck.ok) return { ok: false, error: authCheck.reason };
    if ((state.collections.access_requests || []).some((r) => r.kind === "reactivate" && r.userId === id && r.status === "pending")) return { ok: false, error: "A reactivation request for this user is already waiting" };
    queueAccessRequest({ kind: "reactivate", userId: id, note: `${reason}${ticket ? ` · IDM ticket ${ticket}` : ""}`, biometricConfirmed });
    addAudit({ entityType: "user", entityId: id, entityLabel: `${existing.name} (${existing.empNo})`, action: "Request reactivation", from: "Deactivated", to: "Reactivation pending", comment: `${reason}${ticket ? ` · IDM ${ticket}` : ""}` });
    return { ok: true };
  }, [actor, state.collections.users, state.collections.access_requests, queueAccessRequest, addAudit]);

  /** Scheduled job (run on demand in the demo): disable IDs with no biometric punch-in for 10 consecutive days. */
  const runBiometricCheck = useCallback(() => {
    const limit = 10 * 86400000;
    const hit = (state.collections.users || []).filter((u) => u.status === "active" && u.lastBiometric && Date.now() - new Date(u.lastBiometric).getTime() >= limit);
    hit.forEach((u) => {
      const days = Math.floor((Date.now() - new Date(u.lastBiometric).getTime()) / 86400000);
      dispatch({ type: "UPSERT", kind: "users", item: { ...u, status: "deactivated", autoDeactivated: true, deactivatedBy: "System (biometric rule)", deactivatedAt: new Date().toISOString(), deactivationReason: `No biometric punch-in for ${days} consecutive days` } });
      addAudit({ entityType: "user", entityId: u.id, entityLabel: `${u.name} (${u.empNo})`, action: "Auto-deactivate (biometric)", from: "Active", to: "Deactivated", comment: `No biometric punch-in for ${days} consecutive days` });
    });
    return hit.length;
  }, [state.collections.users, addAudit]);

  const reactivateUser = useCallback((id) => {
    const existing = (state.collections.users || []).find((u) => u.id === id);
    if (!existing) return { ok: false, error: "User not found" };

    const authCheck = authorize(actor, ACTIONS.USER_REACTIVATE, existing);
    if (!authCheck.ok) {
      addAudit({ entityType: "user", entityId: id, entityLabel: existing.name, action: "Reactivate (Denied)", denied: true, reason: authCheck.reason });
      return { ok: false, error: authCheck.reason };
    }

    const updated = {
      ...existing,
      status: "active",
      reactivatedAt: new Date().toISOString(),
      reactivatedBy: activePersona.name,
      deactivationReason: null,
    };
    dispatch({ type: "UPSERT", kind: "users", item: updated });

    addAudit({
      entityType: "user",
      entityId: id,
      entityLabel: `${existing.name} (${existing.empNo})`,
      action: "Reactivate User",
      from: "Deactivated",
      to: "Active",
      comment: `Reactivated by ${activePersona.name}`,
    });

    return { ok: true, user: updated };
  }, [actor, activePersona.name, addAudit, state.collections.users]);

  const resendInvite = useCallback((id) => {
    const existing = (state.collections.users || []).find((u) => u.id === id);
    if (!existing) return { ok: false, error: "User not found" };

    const authCheck = authorize(actor, ACTIONS.USER_RESEND_INVITE, existing);
    if (!authCheck.ok) {
      addAudit({ entityType: "user", entityId: id, entityLabel: existing.name, action: "Resend Invite (Denied)", denied: true, reason: authCheck.reason });
      return { ok: false, error: authCheck.reason };
    }

    const freshTemp = genTempPassword();
    const now = Date.now();
    const updated = {
      ...existing,
      status: "invited",
      tempPassword: freshTemp,
      inviteCreatedAt: new Date(now).toISOString(),
      inviteExpiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
    };
    dispatch({ type: "UPSERT", kind: "users", item: updated });

    addAudit({
      entityType: "user",
      entityId: id,
      entityLabel: `${existing.name} (${existing.empNo})`,
      action: "Resend Invite",
      from: statusLabel(existing.status),
      to: "Invited",
      comment: `Fresh temporary password generated by ${activePersona.name}. Valid for 24 hours.`,
    });

    return { ok: true, user: updated, tempPassword: freshTemp };
  }, [actor, activePersona.name, addAudit, state.collections.users]);

  const activateOnboardedUser = useCallback((id) => {
    const existing = (state.collections.users || []).find((u) => u.id === id);
    if (!existing) return;
    const updated = {
      ...existing,
      status: "active",
      tempPassword: null,
      lastLogin: new Date().toISOString(),
    };
    dispatch({ type: "UPSERT", kind: "users", item: updated });
    addAudit({
      entityType: "user",
      entityId: id,
      entityLabel: `${existing.name} (${existing.empNo})`,
      action: "Complete Onboarding",
      from: statusLabel(existing.status),
      to: "Active",
      comment: "First login completed: password set and OTP verified.",
    });
  }, [state.collections.users, addAudit]);

  const value = {
    state,
    currentUser,
    currentRole,
    role: legacyRole,
    persona: state.persona,
    personaUser,
    amcUser,
    activeAmc,
    setAmc,
    vertical,
    setVertical,
    perms,
    roles,
    roleNames,
    simple,
    setSimple: (on) => dispatch({ type: "SET_SIMPLE", id: personaUser.id, on }),
    actor,
    collections: state.collections,
    users: state.collections.users || [],
    audit: state.audit,
    adminNotifications: state.adminNotifications || [],
    switchPersona: (id) => dispatch({ type: "SWITCH_PERSONA", id }),
    upsert: (kind, item) => dispatch({ type: "UPSERT", kind, item }),
    toggleSidebar: () => dispatch({ type: "TOGGLE_SIDEBAR" }),
    dismissBanner: () => dispatch({ type: "DISMISS_BANNER" }),
    resetDemo: () => dispatch({ type: "RESET" }),
    get,
    saveDraft,
    submit,
    approve,
    reject,
    statusLabel,
    addUser,
    updateUser,
    deactivateUser,
    reactivateUser,
    requestReactivation,
    runBiometricCheck,
    resendInvite,
    activateOnboardedUser,
    submitRole,
    decideAccess,
    act,
    addAudit,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}
