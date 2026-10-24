// Organisation-level rules shared by user management, Today and the daily dashboard.
import { AMC_BREAKDOWN } from "../mock/opsSeed";
import { BANKS, ACCOUNTS } from "../mock/bankMaster";

export const AMCS = AMC_BREAKDOWN.map((a) => a.amc);
export const ALL_AMCS = "ALL";
/** A user's AMC scope; "ALL" (or nothing set) means every AMC their roles cover. */
export const userAmcs = (u) => (!u?.amcs || u.amcs.includes(ALL_AMCS) ? AMCS : u.amcs);
export const amcLabel = (u) => (!u?.amcs || u.amcs.includes(ALL_AMCS) ? "All AMCs" : u.amcs.length === 1 ? u.amcs[0] : `${u.amcs.length} AMCs`);
export const inScope = (u, amc) => !amc || userAmcs(u).includes(amc);

// Existing CAMS policy: ID disabled after 10 consecutive days without a biometric punch-in.
// To be confirmed with the identity management team before production.
export const BIOMETRIC_LIMIT_DAYS = 10;
// Prolonged inactivity (no login) is tracked separately from the biometric rule; limit set to 10 days.
export const DORMANT_DAYS = 10;
const DAY = 86400000;
export const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);
export const isDormant = (u) => u.status === "active" && (u.lastLogin ? daysSince(u.lastLogin) >= DORMANT_DAYS : daysSince(u.createdAt) >= DORMANT_DAYS);
export const biometricBreach = (u) => u.status === "active" && u.lastBiometric && daysSince(u.lastBiometric) >= BIOMETRIC_LIMIT_DAYS;

/** Daily-cycle steps a person can be assigned. Small AMCs: one person does several; large AMCs split them across teams. */
export const CYCLE_STEPS = [["files", "Bank files"], ["match", "Match payments"], ["cases", "Problem cases"], ["release", "Release money"], ["refunds", "Send refunds"], ["close", "Close the day"]];

// Which AMC owns each collection account (same assignment the demo balances use).
const AMC_ORDER = ["HDFC Mutual Fund", "ICICI Prudential MF", "Aditya Birla Sun Life MF", "Kotak Mahindra MF", "Nippon India MF", "DSP Mutual Fund"];
const ACCT_AMC = {};
let _n = 0;
BANKS.forEach((b) => (ACCOUNTS[b.name] || []).forEach((a) => { _n++; ACCT_AMC[a.accountNumber] = AMC_ORDER[_n % AMC_ORDER.length]; }));
export const amcOfAccount = (acct) => ACCT_AMC[acct] || null;
