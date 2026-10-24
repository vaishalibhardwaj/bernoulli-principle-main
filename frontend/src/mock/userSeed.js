// Seed data for User Management matching the specification:
// Primary seed users:
// 1. Meera Iyer (Admin)
// 2. Rohit Menon (Admin)
// 3. Priya Sharma (Operator)
// 4. Arun Mehta (Authoriser)
// 5. Sanjay Rao (Viewer, EDMU)
// 6. Kiran Das (Operator, Invited)
// 7. Neha Kapoor (Viewer, Invite expired)
//
// Org totals: Admin: 2, Operator: 41, Authoriser: 8, Viewer: 98 (Total: 149 users, incl. Kavita, functional manager).
// Pagination will read "Showing 1–15 of 148 Records" (or whichever page size is selected).

import { uid } from "../lib/format";
import { rolesForLegacy } from "../lib/access";

const now = Date.now();
const day = 86400000;
const hour = 3600000;

export const PRIMARY_USERS = [
  {
    id: "usr_meera",
    empNo: "EMP-1001",
    name: "Meera Iyer",
    email: "meera.iyer@camsonline.com",
    phone: "+91 98201 12345",
    designation: "Lead Systems Administrator",
    role: "admin",
    status: "active",
    lastLogin: new Date(now - 12 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 240 * day).toISOString(),
    createdBy: "System",
  },
  {
    id: "usr_rohit",
    empNo: "EMP-1002",
    name: "Rohit Menon",
    email: "rohit.menon@camsonline.com",
    phone: "+91 98202 23456",
    designation: "Senior IT Administrator",
    role: "admin",
    status: "active",
    lastLogin: new Date(now - 1 * day - 2 * hour).toISOString(),
    createdAt: new Date(now - 220 * day).toISOString(),
    createdBy: "Meera Iyer",
  },
  {
    id: "usr_priya",
    empNo: "EMP-2041",
    name: "Priya Sharma",
    email: "priya.sharma@camsonline.com",
    phone: "+91 98203 34567",
    designation: "Senior Recon Executive (Maker)",
    role: "operator",
    status: "active",
    lastLogin: new Date(now - 45 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 180 * day).toISOString(),
    createdBy: "Meera Iyer",
  },
  {
    id: "usr_arun",
    empNo: "EMP-3007",
    name: "Arun Mehta",
    email: "arun.mehta@camsonline.com",
    phone: "+91 98204 45678",
    designation: "Reconciliation Operations Manager (Authoriser)",
    role: "authoriser",
    status: "active",
    lastLogin: new Date(now - 2 * hour).toISOString(),
    createdAt: new Date(now - 190 * day).toISOString(),
    createdBy: "Meera Iyer",
  },
  {
    id: "usr_sanjay",
    empNo: "EMP-4098",
    name: "Sanjay Rao",
    email: "sanjay.rao@camsonline.com",
    phone: "+91 98205 56789",
    designation: "EDMU Compliance Auditor",
    role: "viewer",
    status: "active",
    lastLogin: new Date(now - 4 * day).toISOString(),
    createdAt: new Date(now - 120 * day).toISOString(),
    createdBy: "Rohit Menon",
  },
  {
    id: "usr_kiran",
    empNo: "EMP-2042",
    name: "Kiran Das",
    email: "kiran.das@camsonline.com",
    phone: "+91 98206 67890",
    designation: "Recon Operations Associate",
    role: "operator",
    status: "invited",
    lastLogin: null,
    tempPassword: "Kiran#Recon2026",
    inviteCreatedAt: new Date(now - 3 * hour).toISOString(),
    inviteExpiresAt: new Date(now + 21 * hour).toISOString(),
    createdAt: new Date(now - 3 * hour).toISOString(),
    createdBy: "Meera Iyer",
  },
  {
    id: "usr_neha",
    empNo: "EMP-4099",
    name: "Neha Kapoor",
    email: "neha.kapoor@camsonline.com",
    phone: "+91 98207 78901",
    designation: "Risk & Governance Reviewer",
    role: "viewer",
    status: "invite_expired",
    lastLogin: null,
    tempPassword: "Neha#Expired2026",
    inviteCreatedAt: new Date(now - 48 * hour).toISOString(),
    inviteExpiresAt: new Date(now - 24 * hour).toISOString(),
    createdAt: new Date(now - 48 * hour).toISOString(),
    createdBy: "Rohit Menon",
  },
  {
    id: "usr_deepa",
    empNo: "EMP-2050",
    name: "Deepa Nair",
    email: "deepa.nair@camsonline.com",
    phone: "+91 98208 11223",
    designation: "Recon Operations Executive",
    role: "operator",
    roles: ["role_recon_ops_maker"],
    status: "active",
    lastLogin: new Date(now - 20 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 150 * day).toISOString(),
    createdBy: "Meera Iyer",
  },
  {
    id: "usr_kavita",
    empNo: "EMP-3015",
    name: "Kavita Menon",
    email: "kavita.menon@camsonline.com",
    phone: "+91 98210 44556",
    designation: "Functional Manager — Reconciliation & Brokerage",
    role: "authoriser",
    roles: ["role_functional_manager"],
    status: "active",
    lastLogin: new Date(now - 30 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 300 * day).toISOString(),
    createdBy: "Meera Iyer",
  },
  {
    id: "usr_vikram",
    empNo: "EMP-6002",
    name: "Vikram Rao",
    email: "vikram.rao@camsonline.com",
    phone: "+91 98211 55667",
    designation: "IT Support — Application Monitoring",
    role: "viewer",
    roles: ["role_it_support"],
    status: "active",
    lastLogin: new Date(now - 15 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 200 * day).toISOString(),
    createdBy: "Meera Iyer",
  },
  {
    id: "usr_farhan",
    empNo: "EMP-5011",
    name: "Farhan Qureshi",
    email: "farhan.qureshi@camsonline.com",
    phone: "+91 98209 33445",
    designation: "Brokerage Operations Executive",
    role: "viewer",
    roles: ["role_brk_maker", "role_pst_viewer", "role_sip_viewer"],
    status: "active",
    lastLogin: new Date(now - 3 * hour).toISOString(),
    createdAt: new Date(now - 120 * day).toISOString(),
    createdBy: "Meera Iyer",
  },
];

// Procedural generator for the remaining 141 users to total 148
const FIRST_NAMES = [
  "Aakash", "Aditi", "Amit", "Ananya", "Deepak", "Divya", "Gaurav", "Isha",
  "Kavita", "Manish", "Naveen", "Pooja", "Rahul", "Rakesh", "Ritu", "Sameer",
  "Shweta", "Siddharth", "Sneha", "Tanvi", "Varun", "Vikas", "Yash", "Zoya"
];
const LAST_NAMES = [
  "Agarwal", "Bansal", "Bhatia", "Chopra", "Deshmukh", "Gupta", "Jain", "Joshi",
  "Kulkarni", "Malhotra", "Nair", "Pandey", "Patel", "Reddy", "Saxena", "Sen",
  "Shah", "Singh", "Soni", "Trivedi", "Varma", "Verma", "Vyas", "Yadav"
];

export function seedUsers() {
  const users = [...PRIMARY_USERS];

  // We already have:
  // Admin: 2
  // Operator: 2 (Priya, Kiran) -> Need 39 more to reach 41
  // Authoriser: 1 (Arun) -> Need 6 more to reach 7
  // Viewer: 2 (Sanjay, Neha) -> Need 96 more to reach 98
  // Total: 148

  const needed = [
    { role: "operator", count: 39, prefix: "EMP-2", title: "Recon Operations Executive" },
    { role: "authoriser", count: 6, prefix: "EMP-3", title: "Recon Supervisor" },
    { role: "viewer", count: 96, prefix: "EMP-4", title: "Financial Analyst" },
  ];

  let seq = 100;
  needed.forEach(({ role, count, prefix, title }) => {
    for (let i = 0; i < count; i++) {
      seq++;
      const fn = FIRST_NAMES[(seq + i) % FIRST_NAMES.length];
      const ln = LAST_NAMES[(seq * 3 + i) % LAST_NAMES.length];
      const name = `${fn} ${ln}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${seq % 10 ? "" : seq}@camsonline.com`;
      const empNo = `${prefix}${String(seq).padStart(3, "0")}`;
      const phone = `+91 98${String(20000000 + seq).slice(0, 8)}`;
      
      // Status distribution for generated users: mostly active, few deactivated or invited
      let status = "active";
      if (i === 1) status = "deactivated";
      else if (i === 4 && role === "operator") status = "invited";

      users.push({
        id: uid("usr"),
        empNo,
        name,
        email,
        phone,
        designation: title,
        role,
        status,
        lastLogin: status === "active" ? new Date(now - ((i % 30) + (i % 37 === 0 ? 80 : 1)) * day).toISOString() : null,
        createdAt: new Date(now - (90 + i) * day).toISOString(),
        createdBy: "Meera Iyer",
        tempPassword: status === "invited" ? "Temp#Pass2026!" : undefined,
        inviteCreatedAt: status === "invited" ? new Date(now - 5 * hour).toISOString() : undefined,
        inviteExpiresAt: status === "invited" ? new Date(now + 19 * hour).toISOString() : undefined,
      });
    }
  });

  // Platform access model: every user holds one or more module roles.
  const explicit = { usr_meera: ["role_platform_admin"], usr_rohit: ["role_access_approver"], usr_priya: ["role_recon_setup_maker"], usr_arun: ["role_recon_checker"], usr_sanjay: ["role_recon_auditor"] };
  users.forEach((u, i) => { if (!u.roles) u.roles = explicit[u.id] || rolesForLegacy(u.role, i); });

  // AMC scope, daily-cycle assignment and biometric punch-in (for the 10-day auto-deactivation policy).
  const AMC = ["HDFC Mutual Fund", "ICICI Prudential MF", "Aditya Birla Sun Life MF", "Kotak Mahindra MF", "Nippon India MF", "DSP Mutual Fund"];
  const scope = { usr_priya: ["ALL"], usr_arun: ["HDFC Mutual Fund", "ICICI Prudential MF", "Kotak Mahindra MF"], usr_deepa: ["HDFC Mutual Fund", "ICICI Prudential MF"], usr_kavita: ["ALL"], usr_vikram: ["ALL"], usr_sanjay: ["ALL"], usr_meera: ["ALL"], usr_rohit: ["ALL"], usr_farhan: ["DSP Mutual Fund"] };
  // Deepa works a large AMC desk: files, matching and refunds. Problem cases and fund release sit with other teams.
  const steps = { usr_deepa: ["files", "match", "refunds", "close"] };
  users.forEach((u, i) => {
    u.amcs = scope[u.id] || (i % 5 === 0 ? ["ALL"] : [AMC[i % AMC.length], AMC[(i + 2) % AMC.length]]);
    if (steps[u.id]) u.workflowSteps = steps[u.id];
    if (u.status === "active") u.lastBiometric = new Date(now - (PRIMARY_USERS.some((p) => p.id === u.id) ? 0.3 : i % 9) * day).toISOString();
  });
  // Auto-deactivated by the biometric rule (no punch-in for 10+ consecutive days).
  users.filter((u) => u.status === "active" && !PRIMARY_USERS.some((p) => p.id === u.id)).slice(3, 7).forEach((u, k) => {
    Object.assign(u, { status: "deactivated", autoDeactivated: true, deactivatedBy: "System (biometric rule)", deactivatedAt: new Date(now - (k + 1) * day).toISOString(),
      lastBiometric: new Date(now - (11 + k * 3) * day).toISOString(), deactivationReason: `No biometric punch-in for ${10 + k * 3 + 1} consecutive days` });
  });
  // One active user who is about to cross the biometric limit, and the dormant (60+ days no login) users stay as generated.
  const near = users.find((u) => u.status === "active" && !PRIMARY_USERS.some((p) => p.id === u.id) && u.role === "operator");
  if (near) near.lastBiometric = new Date(now - 9 * day).toISOString();
  return users;
}
