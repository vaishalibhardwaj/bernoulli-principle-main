// Stand-in for the ID management (IDM) directory: on-prem HR identities replicated to Odin.
// The Assign Roles screen only reads it — people are never typed in by hand. Leavers are filtered out.

const NEW_JOINERS = [
  ["EMP-2201", "Aakash Patel", "aakash.patel", "Reconciliation Specialist", "+91 98765 43210"],
  ["EMP-3019", "Sunita Nambiar", "sunita.nambiar", "Recon Operations Lead", "+91 98111 22334"],
  ["EMP-4105", "Vikram Chandra", "vikram.chandra", "Internal Audit Executive", "+91 98333 44556"],
  ["EMP-1008", "Tanvi Deshmukh", "tanvi.deshmukh", "Systems & Security Admin", "+91 98444 55667"],
  ["EMP-2207", "Harini Subramanian", "harini.s", "Recon Operations Executive", "+91 97890 12345"],
  ["EMP-2212", "Rohan Kulkarni", "rohan.kulkarni", "Senior Recon Executive", "+91 99201 33445"],
  ["EMP-5120", "Meghna Iyer", "meghna.iyer", "Brokerage Analyst", "+91 98190 55667"],
  ["EMP-6030", "Faisal Khan", "faisal.khan", "Transaction Posting Associate", "+91 90040 77889"],
  ["EMP-3044", "Lavanya Rao", "lavanya.rao", "Recon Supervisor", "+91 98455 66778"],
  ["EMP-7011", "Nikhil Bose", "nikhil.bose", "Customer Support Lead", "+91 98300 11223"],
];
const LEFT = [["EMP-2150", "Rahul Menon", "rahul.menon", "Recon Operations Executive", "+91 98400 12121"]]; // inactive in IDM

const person = ([empNo, name, mail, designation, phone], active = true) => ({ empNo, name, email: `${mail}@camsonline.com`, designation, phone, active, source: "IDM" });

/** Active people from the IDM replica, including everyone who already has access to this platform. */
export function idmDirectory(users = []) {
  const existing = users.filter((u) => u.status !== "deactivated").map((u) => ({ empNo: u.empNo, name: u.name, email: u.email, designation: u.designation, phone: u.phone, active: true, source: "IDM" }));
  const all = [...existing, ...NEW_JOINERS.map((p) => person(p)), ...LEFT.map((p) => person(p, false))];
  const seen = new Set();
  return all.filter((p) => p.active && !seen.has(p.empNo.toUpperCase()) && seen.add(p.empNo.toUpperCase()));
}

export const IDM_SYNCED_AT = (() => { const d = new Date(); d.setHours(6, 0, 0, 0); return d.toISOString(); })();
