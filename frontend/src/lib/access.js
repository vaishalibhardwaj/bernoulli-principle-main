// ============================================================================
// Platform access model — shared by every CAMS module (Recon, Brokerage, Posting, Refunds…).
//   Module → Screen → Capability (view / edit = Maker / approve = Checker / export)
// Roles are admin-built permission sets; a user can hold many roles across modules.
// Effective access = union of the user's active roles. Nav is generated from it.
// ============================================================================

export const CAPS = ["view", "edit", "approve", "export"];
export const CAP_LABELS = { view: "View", edit: "Maker", approve: "Checker", export: "Export" };
export const CAP_HINTS = {
  view: "Open the screen and read data",
  edit: "Create, edit and submit for approval",
  approve: "Approve or reject what others submit",
  export: "Download data / reports",
};

/** Screen catalogue. `phase` marks when the screen lands in the re-phased roadmap. */
export const MODULES = [
  {
    key: "recon", label: "Reconciliation", color: "#4f46e5",
    screens: [
      { key: "today", label: "Today", plain: "Today", path: "/today", group: "Home", caps: ["view"] },
      { key: "inbox", label: "Approvals", plain: "Approvals", path: "/approvals", group: "Home", caps: ["view", "approve"] },
      { key: "balances", label: "Closing balances", plain: "Closing balances", path: "/closing-balances", group: "Home", caps: ["view", "edit", "export"] },
      { key: "scheduler", label: "Scheduler monitor", plain: "File pickups", path: "/scheduler", group: "Home", caps: ["view", "export"] },
      { key: "no_action_review", label: "No-action review", plain: "No-action review", path: "/no-action-review", group: "Home", caps: ["view", "approve", "export"] },
      { key: "command", label: "Dashboard", plain: "Dashboard", path: "/command", group: "Home", caps: ["view", "export"], analytics: true },
      { key: "task_templates", label: "Task templates", plain: "Team tasks", path: "/task-templates", group: "Home", caps: ["view", "edit", "approve"] },
      { key: "file_upload", label: "File upload", plain: "Upload files", path: "/upload", group: "Daily cycle", caps: ["view", "edit"] },
      { key: "ingestion", label: "Bank files", plain: "Bank files", path: "/ingestion", group: "Daily cycle", step: 1, caps: ["view", "edit", "approve"] },
      { key: "manual_upload", label: "Manual upload (exception)", plain: "Manual upload", path: "/ingestion?manual=1", group: "Daily cycle", caps: ["view", "edit"], hidden: true },
      { key: "match", label: "Match payments", plain: "Match payments", path: "/match", group: "Daily cycle", step: 2, phase: "P2", caps: ["view", "edit", "approve"] },
      { key: "extraction", label: "Documents", plain: "Read PDFs & emails", path: "/extraction", group: "Daily cycle", step: 2, phase: "P3", caps: ["view", "edit", "approve"] },
      { key: "exceptions", label: "Exceptions", plain: "Problem cases", path: "/exceptions", group: "Daily cycle", step: 3, phase: "P2", caps: ["view", "edit", "approve", "export"] },
      { key: "release", label: "Fund release", plain: "Release money", path: "/release", group: "Daily cycle", step: 4, phase: "P2", caps: ["view", "edit", "approve", "export"] },
      { key: "refunds", label: "Refunds", plain: "Refunds", path: "/refunds", group: "Daily cycle", step: 5, phase: "P2", caps: ["view", "edit", "approve", "export"] },
      { key: "approvals", label: "Setup approvals", path: "/dashboard", group: "Setup", caps: ["view", "approve"], hidden: true },
      { key: "audit", label: "Audit history", plain: "History", path: "/audit", group: "Review", caps: ["view", "export"] },
    ],
  },
  {
    key: "brokerage", label: "Brokerage", color: "#0891b2",
    screens: [
      { key: "brk_compute", label: "Brokerage Computation", path: "/m/brokerage/compute", group: "Brokerage", caps: ["view", "edit", "approve", "export"] },
      { key: "brk_payout", label: "Payout Batches", path: "/m/brokerage/payout", group: "Brokerage", caps: ["view", "edit", "approve", "export"] },
      { key: "brk_master", label: "Distributor Master", path: "/m/brokerage/master", group: "Brokerage", caps: ["view", "edit", "approve"] },
    ],
  },
  {
    key: "posting", label: "Transaction Posting", color: "#c2410c",
    screens: [
      { key: "pst_queue", label: "Posting Queue", path: "/m/posting/queue", group: "Transaction Posting", caps: ["view", "edit", "approve"] },
      { key: "pst_nigo", label: "NIGO Review", path: "/m/posting/nigo", group: "Transaction Posting", caps: ["view", "edit", "approve", "export"] },
      { key: "pst_batch", label: "Batch Posting", path: "/m/posting/batch", group: "Transaction Posting", caps: ["view", "edit", "approve"] },
      { key: "pst_redemption", label: "Redemption & switch", path: "/m/posting/redemption", group: "Transaction Posting", caps: ["view", "edit", "approve"] },
      { key: "pst_dividend", label: "Dividend / IDCW", path: "/m/posting/dividend", group: "Transaction Posting", caps: ["view", "edit", "approve"] },
    ],
  },
  {
    key: "sip", label: "SIP", color: "#7c3aed",
    screens: [
      { key: "sip_reg", label: "SIP registrations", path: "/m/sip/registrations", group: "SIP", caps: ["view", "edit", "approve", "export"] },
      { key: "sip_fail", label: "SIP debit failures", path: "/m/sip/failures", group: "SIP", caps: ["view", "edit", "approve", "export"] },
      { key: "sip_mandate", label: "Mandates", path: "/m/sip/mandates", group: "SIP", caps: ["view", "edit", "approve"] },
    ],
  },
  {
    key: "crms", label: "CRMS", color: "#db2777",
    screens: [
      { key: "crms_accounts", label: "Investor accounts", path: "/m/crms/accounts", group: "CRMS", caps: ["view", "edit", "approve"] },
      { key: "crms_changes", label: "Change requests", path: "/m/crms/changes", group: "CRMS", caps: ["view", "edit", "approve"] },
    ],
  },
  {
    key: "support", label: "Customer Support", color: "#ea580c",
    screens: [
      { key: "cs_tickets", label: "Service requests", path: "/m/support/tickets", group: "Customer Support", caps: ["view", "edit", "approve", "export"] },
      { key: "cs_complaints", label: "Complaints", path: "/m/support/complaints", group: "Customer Support", caps: ["view", "edit", "approve", "export"] },
    ],
  },
  {
    key: "purchase", label: "Purchase", color: "#16a34a",
    screens: [
      { key: "pur_applications", label: "Purchase applications", path: "/m/purchase/applications", group: "Purchase", caps: ["view", "edit", "approve"] },
      { key: "pur_nigo", label: "Purchase NIGO", path: "/m/purchase/nigo", group: "Purchase", caps: ["view", "edit", "approve", "export"] },
    ],
  },
  {
    key: "mis", label: "MIS Reports", color: "#0284c7",
    screens: [
      { key: "mis_daily", label: "Daily MIS", path: "/m/mis/daily", group: "MIS Reports", caps: ["view", "export"] },
      { key: "mis_regulatory", label: "Regulatory reports", path: "/m/mis/regulatory", group: "MIS Reports", caps: ["view", "export"] },
    ],
  },
  {
    key: "admin", label: "Administration", color: "#0f766e",
    screens: [
      { key: "users", label: "Users", path: "/admin/users", group: "Administration", caps: ["view", "edit", "approve", "export"] },
      { key: "roles", label: "Roles & Access", path: "/admin/roles", group: "Administration", caps: ["view", "edit", "approve"] },
    ],
  },
  {
    // Central Setup Team: one setup home for every module. Each module is a folder in the side menu (Recon today; others later).
    // Any role can be given these screens in Roles & Access, so operations staff can be added to setup work too.
    key: "central_setup", label: "Central Setup", color: "#7c5cff", folders: true,
    screens: [
      // Organised by file source: Bank statements holds Accounts, Column mapping, Transaction type mapping and Narration tags;
      // Credit MIS holds Feeds, Column mapping and Transaction type mapping. Those three screens keep their own permissions
      // (nav:false) and open as sections of the source screens, not as menu items.
      { key: "setup_todo", label: "To do", crumb: "To do", path: "/setup-todo", group: "Recon", caps: ["view"] },
      { key: "bank_setup", label: "Bank statements", crumb: "Bank statements", path: "/bank-setup", group: "Recon", caps: ["view", "edit", "approve", "export"] },
      { key: "credit_mis", label: "Credit MIS", crumb: "Credit MIS", path: "/credit-mis", group: "Recon", caps: ["view", "edit", "approve", "export"] },
      { key: "cutoffs", label: "Cutoff times", path: "/cutoffs", group: "Recon", caps: ["view", "edit", "approve"] },
      { key: "setup_scheduler", label: "File pickups", crumb: "File pickups", path: "/setup-scheduler", group: "Recon", caps: ["view", "export"] },
      { key: "setup_tasks", label: "Requests from Ops", crumb: "Setup to do", path: "/setup-tasks", group: "Recon", caps: ["view", "edit"], nav: false },
      { key: "mapping", label: "Column mapping", crumb: "Column mapping", path: "/mapping", group: "Recon", caps: ["view", "edit", "approve"], nav: false },
      { key: "status_std", label: "Transaction type mapping", crumb: "Transaction type mapping", path: "/status-standardisation", group: "Recon", caps: ["view", "edit", "approve"], nav: false },
      { key: "narration_tags", label: "Narration tags", path: "/narration-tags", group: "Recon", caps: ["view", "edit", "approve"], nav: false },
      { key: "setup_approvals", label: "Approvals", crumb: "Setup to do", path: "/setup-approvals", group: "Recon", caps: ["view", "approve"], nav: false },
    ],
  },
];

export const SCREENS = {};
MODULES.forEach((m) => m.screens.forEach((s) => { SCREENS[s.key] = { ...s, module: m.key, moduleLabel: m.label }; }));
export const MODULE_BY_KEY = Object.fromEntries(MODULES.map((m) => [m.key, m]));

/** Which screen governs a store collection (used by approve/reject). */
export const SCREEN_FOR_KIND = { bank_config: "bank_setup", credit_config: "credit_mis", bank_mapping: "mapping" };

const all = (module, caps) => Object.fromEntries(MODULE_BY_KEY[module].screens.map((s) => [s.key, caps.filter((c) => s.caps.includes(c))]));

/** Seed role templates. Admins can edit these or build new ones in Roles & Access. */
export function seedRoles() {
  const at = new Date(Date.now() - 200 * 86400000).toISOString();
  const r = (id, name, module, description, perms, extra = {}) => ({ id, name, module, description, perms, status: "active", system: true, createdBy: "System", createdAt: at, ...extra });
  return [
    // Central Setup Team: one role, six peers. No separate maker and checker: whoever created a record cannot authorise it;
    // anyone else in the team can (checked on the login ID in rbac.authorize).
    r("role_platform_admin", "Central Setup Team", "admin", "One role for the six-person team. Creates roles across modules, gives screen and AMC access, and does every setup (bank statement, Credit MIS, column mapping, cutoff times, status standardisation, narration tags). Whoever creates a record cannot authorise it; anyone else in the team can. Does not run the daily cycle or manage IDs (ID management does).",
      { users: ["view", "edit", "approve", "export"], roles: ["view", "edit", "approve"], setup_todo: ["view"], setup_tasks: ["view", "edit"], bank_setup: ["view", "edit", "approve", "export"], credit_mis: ["view", "edit", "approve", "export"], mapping: ["view", "edit", "approve"], cutoffs: ["view", "edit", "approve"], status_std: ["view", "edit", "approve"], narration_tags: ["view", "edit", "approve"], setup_approvals: ["view", "approve"], setup_scheduler: ["view", "export"] }, { peer: true }),
    r("role_cst_recon_setup", "Central Setup · Recon setup", "central_setup", "Recon setup work for people outside the Central Setup Team: pending tasks, bank statement, Credit MIS, column mapping, cutoff times, status standardisation and narration tags. Whoever creates a record cannot authorise it; any other holder can.",
      { setup_todo: ["view"], setup_tasks: ["view", "edit"], bank_setup: ["view", "edit", "approve", "export"], credit_mis: ["view", "edit", "approve", "export"], mapping: ["view", "edit", "approve"], cutoffs: ["view", "edit", "approve"], status_std: ["view", "edit", "approve"], narration_tags: ["view", "edit", "approve"], setup_approvals: ["view", "approve"], setup_scheduler: ["view"] }, { peer: true }),
    r("role_access_approver", "Access Approver", "admin", "Second-admin approval of role changes and privileged role grants.",
      { users: ["view", "approve"], roles: ["view", "approve"] }),
    // Recon Ops: one role for the back-office team. Every member is both maker and checker; whoever did the work cannot authorise it.
    r("role_recon_ops", "Recon · Ops", "recon", "One role for the recon back-office (BO) team: uploads and reprocesses files, watches closing balances, and raises setup requests to the Central Setup Team. Every member is maker and checker: whoever did the work cannot authorise it; anyone else in the team can.",
      { today: ["view"], command: ["view", "export"], inbox: ["view", "approve"], balances: ["view", "edit", "export"], file_upload: ["view", "edit"], ingestion: ["view", "edit", "approve"], manual_upload: ["view", "edit"], audit: ["view", "export"], task_templates: ["view"] }, { peer: true }),
    // Level 1 and Level 2: added on top of Recon · Ops for senior team members. They see the team's tasks and assign them
    // to people. They cannot create a task or change when it is due: the functional manager (the team leader) does that
    // and reviews the work (confirmed 13 Nov). On Team tasks, "edit" = assign and "approve" = create and manage.
    r("role_recon_l1", "Recon · Level 1", "recon", "For senior Ops members. Sees the team's tasks and assigns them to people. Cannot create a task or change when it is due.",
      { today: ["view"], task_templates: ["view", "edit"] }),
    r("role_recon_l2", "Recon · Level 2", "recon", "For senior Ops members. Sees the team's tasks and assigns them to people. Cannot create a task or change when it is due.",
      { today: ["view"], task_templates: ["view", "edit"] }),
    r("role_recon_auditor", "Recon · Auditor", "recon", "Read-only access to every recon screen, with export.", Object.fromEntries(Object.entries(all("recon", ["view", "export"])).filter(([k]) => !SCREENS[k].phase))),
    r("role_functional_manager", "Recon · Functional Manager", "recon", "The team leader (a deputy manager, manager or senior manager). Creates the team's tasks and reviews the team's work: the team dashboard, closing balances, approvals and the No-action review. Does not do the daily Ops work; no setup screens.",
      { task_templates: ["view", "edit", "approve"], command: ["view", "export"], balances: ["view", "export"], inbox: ["view", "approve"], no_action_review: ["view", "approve", "export"], brk_compute: ["view", "approve"], brk_payout: ["view", "approve"] }),
    r("role_it_support", "IT Support · Monitoring", "recon", "Scheduler monitor only: checks that scheduler jobs ran. Read-only; no business data.",
      { scheduler: ["view", "export"] }),
    r("role_sip_viewer", "SIP · Viewer", "sip", "Read-only view of SIP registrations, failures and mandates.", all("sip", ["view"])),
    // Sample roles for modules that are not built yet, so screens that count people by module show every module. Synthetic.
    r("role_crms_agent", "CRMS · Agent", "crms", "Sample role: works investor accounts and change requests.", all("crms", ["view", "edit"])),
    r("role_cs_agent", "Customer Support · Agent", "support", "Sample role: handles service requests and complaints.", all("support", ["view", "edit"])),
    r("role_pur_maker", "Purchase · Maker", "purchase", "Sample role: processes purchase applications.", all("purchase", ["view", "edit"])),
    r("role_mis_viewer", "MIS Reports · Viewer", "mis", "Sample role: reads daily and regulatory MIS.", all("mis", ["view", "export"])),
    r("role_brk_maker", "Brokerage · Maker", "brokerage", "Computes brokerage and prepares payout batches.", all("brokerage", ["view", "edit", "export"])),
    r("role_brk_checker", "Brokerage · Checker", "brokerage", "Approves brokerage computations and payouts.", all("brokerage", ["view", "approve", "export"])),
    r("role_pst_maker", "Posting · Maker", "posting", "Posts realised transactions and reviews NIGO cases.", all("posting", ["view", "edit"])),
    r("role_pst_viewer", "Posting · Viewer", "posting", "Read-only view of posting queues.", all("posting", ["view"])),
  ];
}

/** Map a legacy fixed role (v4 PRD) to the new role templates. */
export function rolesForLegacy(legacy, i = 0) {
  switch (legacy) {
    case "admin": return ["role_platform_admin"];
    case "operator": return ["role_recon_ops"];
    case "authoriser": return ["role_recon_ops"];
    case "viewer":
      if (i % 7 === 0) return ["role_brk_maker"];
      if (i % 11 === 0) return ["role_pst_maker", "role_recon_auditor"];
      return ["role_recon_auditor"];
    default: return [];
  }
}

/** Effective permissions: { screenKey: Set(caps) } — union of active roles. */
export function permsFor(user, roles) {
  const out = {};
  if (!user) return out;
  (user.roles || []).forEach((rid) => {
    const role = roles.find((r) => r.id === rid);
    if (!role || role.status !== "active") return;
    Object.entries(role.perms || {}).forEach(([screen, caps]) => {
      out[screen] = out[screen] || new Set();
      caps.forEach((c) => out[screen].add(c));
    });
  });
  return out;
}

export const hasCap = (perms, screen, cap = "view") => Boolean(perms && perms[screen] && perms[screen].has(cap));

/** Segregation of duties: same person cannot be Maker and Checker on the same screen. */
export function sodConflicts(roleIds, roles) {
  // Peer roles hold both submit and approve on purpose: members check each other, and a record can never be approved by its own author.
  const peer = new Set(roles.filter((r) => r.peer).map((r) => r.id));
  const fake = { roles: roleIds.filter((id) => !peer.has(id)) };
  const p = permsFor(fake, roles.map((r) => ({ ...r, status: "active" })));
  return Object.entries(p).filter(([, caps]) => caps.has("edit") && caps.has("approve")).map(([k]) => SCREENS[k]?.label || k);
}

/** A role is privileged if it can approve anything or administer users/roles. */
export const isPrivileged = (role) => Boolean(role) && (role.module === "admin" || Object.values(role.perms || {}).some((c) => c.includes("approve")));

/** Daily users get the simple view: plain words, one queue, no analytics. */
export function isSimpleUser(user, roles) {
  return (user?.roles || []).some((rid) => roles.find((r) => r.id === rid)?.simple);
}

/** Screen label for the current mode. */
export const screenLabel = (s, simple) => (simple && s.plain) || s.label;

/** Screens visible to a user, grouped by module → group, for the side nav. */
export function navFor(perms, simple = false) {
  return MODULES.map((m) => {
    const screens = m.screens.filter((s) => hasCap(perms, s.key, "view") && !s.hidden && s.nav !== false && (simple ? !s.analytics : true));
    const groups = [];
    screens.forEach((s) => {
      let g = groups.find((x) => x.name === s.group);
      if (!g) { g = { name: s.group, screens: [] }; groups.push(g); }
      g.screens.push(s);
    });
    return { ...m, groups, count: screens.length };
  }).filter((m) => m.count > 0).sort((a, b) => (a.key === "admin") - (b.key === "admin"));
}

/** Home route: the "what needs you now" screen when the user has one (Today for Ops, To do for the Central Setup Team), else the first visible screen. */
export function homePath(perms, simple = false) {
  if (hasCap(perms, "today")) return "/today";
  if (hasCap(perms, "setup_todo")) return "/setup-todo";
  const nav = navFor(perms, simple);
  return nav[0]?.groups[0]?.screens[0]?.path || "/no-access";
}

export function screenForPath(pathname) {
  let best = null;
  Object.values(SCREENS).forEach((s) => {
    if (pathname === s.path || pathname.startsWith(s.path + "/")) {
      if (!best || s.path.length > best.path.length) best = s;
    }
  });
  return best;
}

/** Business verticals the platform serves. KRA is planned but not live yet. */
export const VERTICALS = [
  { key: "MF", label: "MF" },
  { key: "AIF", label: "AIF" },
  { key: "GIFT", label: "GIFT City" },
  { key: "SIF", label: "SIF" },
  { key: "KRA", label: "KRA", later: true },
];

/** Demo personas — real seeded users with different role mixes. */
export const PERSONAS = [
  { id: "usr_meera", label: "Meera · Central Setup Team" },
  { id: "usr_anil", label: "Anil · Central Setup Team" },
  { id: "usr_priya", label: "Priya · Recon Ops, Level 2" },
  { id: "usr_arun", label: "Arun · Recon Ops, Level 1" },
  { id: "usr_kavita", label: "Kavita · Functional Manager" },
  { id: "usr_vikram", label: "Vikram · IT Support" },
];

/** Functions (actions) the global search can jump to. Each needs a capability, so nobody sees a function they can't use. */
export const FUNCTIONS = [
  { label: "Upload a statement by hand (exception)", screen: "manual_upload", cap: "edit", path: "/ingestion?manual=1", words: "manual upload statement outage" },
  { label: "Upload a bank statement, Credit MIS or remitter file", screen: "file_upload", cap: "edit", path: "/upload", words: "upload file drag drop gcs bank statement credit mis remitter" },
  { label: "Review items your team marked No action", screen: "no_action_review", cap: "view", path: "/no-action-review", words: "no action supervisor review feedback event definition" },
  { label: "Check SFTP folders", screen: "ingestion", cap: "view", path: "/ingestion?tab=sftp", words: "sftp folder bulk ingestion" },
  { label: "Rejected emails", screen: "ingestion", cap: "view", path: "/ingestion?tab=email", words: "email intake rejected attachment" },
  { label: "Bank API & portal connections", screen: "ingestion", cap: "view", path: "/ingestion?tab=conns", words: "api portal bot pull" },
  { label: "Match a payment by hand", screen: "match", cap: "edit", path: "/match", words: "manual match credit purchase" },
  { label: "Problem cases older than 5 days", screen: "exceptions", cap: "view", path: "/exceptions?age=over5", words: "aging ageing breach unidentified credit" },
  { label: "Prepare today's fund release", screen: "release", cap: "edit", path: "/release", words: "fund release allotment" },
  { label: "Approve waiting items", screen: "inbox", cap: "approve", path: "/approvals", words: "approve checker authorise" },
  { label: "New bank statement setup", screen: "bank_setup", cap: "edit", path: "/bank-setup/new", words: "onboard bank account setup" },
  { label: "New Credit MIS setup", screen: "credit_mis", cap: "edit", path: "/credit-mis/new", words: "payment aggregator mis" },
  { label: "Add a user", screen: "users", cap: "edit", path: "/admin/users", words: "user create invite" },
  { label: "Reactivate a disabled ID", screen: "users", cap: "edit", path: "/admin/users", words: "reactivate deactivated biometric" },
  { label: "Transaction status standardisation", screen: "status_std", cap: "view", path: "/status-standardisation", words: "credit debit cr dr status" },
  { label: "SIP debit failures", screen: "sip_fail", cap: "view", path: "/m/sip/failures", words: "sip failure mandate" },
  { label: "Brokerage payout batches", screen: "brk_payout", cap: "view", path: "/m/brokerage/payout", words: "brokerage payout distributor" },
];

/** Default menus per role type, so a new role starts from a sensible set and the admin only adjusts it. */
export const ROLE_DEFAULTS = {
  maker: { label: "Maker (does the work)", caps: ["view", "edit", "export"] },
  checker: { label: "Checker (approves)", caps: ["view", "approve", "export"] },
  viewer: { label: "Viewer (read-only)", caps: ["view"] },
};
export function defaultPerms(moduleKey, kind) {
  const want = ROLE_DEFAULTS[kind]?.caps || [];
  return Object.fromEntries((MODULE_BY_KEY[moduleKey]?.screens || []).filter((s) => !s.hidden).map((s) => [s.key, want.filter((c) => s.caps.includes(c))]).filter(([, c]) => c.length));
}
