# Gap analysis: original PRDs vs. the current prototype

**Date:** 21 Oct 2026 (re-verified against the code after round 4)
**PRDs:** `Recon_PRD_v1.md` (v1), `Credit_MIS_PRD.md` (CMIS), `CAMS_Recon_Phase1_PRD_v4.md` (v4)
**Prototype:** `frontend/src` as running on localhost:3000

**Legend**

| Mark | Meaning |
|---|---|
| ✅ | Built as specified |
| 🔁 | Deliberately changed (reason given) |
| ❌ | **Contradicts the PRD**, needs a fix or a PRD decision |
| ⚠️ | **Not built**, a gap |
| ➕ | Added; not in the Phase-1 PRD scope |

The **"Origin"** column says when the gap appeared:
- **P0** = it was already in the original prototype before this work;
- **R1–R4** = introduced in my redesign rounds.

---

> **Round 7 update (21 Oct 2026).** The Phase-1 setup screens were rebuilt to the PRDs. Contradictions 1–6 in section D are fixed; so are gap 8 (the status standardisation admin screen) and A-6 (Re-enter Password restored, alongside show/hide). Item 7 (bank setup list: Setup Name and File Type columns, and the 3-character search minimum) is **still open**. The additions from `PHASE1_SETUP_RESEARCH.md` all sit inside PRD fields. See `PROTOTYPE_CHANGES.md` Round 7.

## A. The PRDs themselves: v1 / Credit MIS → v4

PRD v4 already changed the original PRDs. Its change log has items 1–19. These are the ones that matter when reading v1/CMIS:

| # | v1 / CMIS said | v4 says |
|---|---|---|
| 1 | "Save Configuration" submits for approval | Separate **Save as Draft** and **Submit for Approval**; new **Draft** status |
| 2 | Rejected items handling unclear | Rejected items appear on the **same landing page** under a Rejected filter, with a badge and login alert |
| 3 | Reset clears everything | Reset **restores the last saved state**; clears only if never saved |
| 6 | Password + Re-enter Password | Re-enter removed; **show/hide toggle** instead |
| 7 | Credentials stored in config | Credentials go to a **secrets vault**; UI shows only "Credential set" |
| 8 | Credit MIS mapping unclear | **Credit MIS column mapping in scope**, reusing the bank mapping framework |
| 10 | Regex auto-mapping | Auto-mapping first **reuses the last approved mapping**, regex as fallback |
| 12 | — | Accounts with no Credit MIS are always **Direct Match only** |
| 13 | One setup per account | **Several setups per account** allowed; duplicate key = Bank + Account + Download Mode |
| 15 | Bulk option in Credit MIS | **No Bulk in Credit MIS**; account number always mandatory there |
| 16 | Receiver email `@atronline.com` | `@camsonline.com` |
| 17–18 | — | Target-state 6-stage architecture (§2.4) and the Phase-1 flow (§4.2.1) added |
| 19 | — | User management: **4 fixed roles**, one per user, immediate provisioning, 3-screen onboarding |

Two points about v4 as a document:
- **v4 §5.1–5.6, §6, §7, §8 and the Appendix are placeholders** ("retained in full from v3"). The detailed rules therefore still live in v1 and CMIS, and that is what the prototype is checked against below.
- **v1 has a typo on Bank Account Number.** It says the field is "mandatory only when Bulk is enabled", but its own Bulk section says it becomes optional with Bulk. The prototype follows the Bulk section, which is the correct reading.

---

## B. Phase-1 scope: prototype vs PRD

### B1. Bank statement setup (v1 §2.1 · v4 §5.1)
| PRD requirement | Prototype | Status | Origin |
|---|---|---|---|
| Status filter ALL / ACTIVE / INACTIVE, default ACTIVE | ALL / ACTIVE / INACTIVE / DRAFT / PENDING / REJECTED, default ACTIVE | ✅ (v4 adds Draft/Rejected) | P0 |
| List columns: **Setup Name**, **File Type**, Download Mode, Bank, Account, Status, Actions | S.No, Download Mode, Bank, Account, Status, Last Updated, Actions | ❌ **Setup Name and File Type columns missing** | P0 |
| Search on Account No / Bank Name, **minimum 3 characters**, wildcard | Search works from 1 character | ❌ 3-character minimum not enforced | P0 |
| 15 rows/page, First / Prev / Next / Last | Present | ✅ | P0 |
| Copy Setup (only account number changes, duplicate check) | Present | ✅ | P0 |
| 4 download modes; Manual skips the connection step | Present | ✅ | P0 |
| Bank Name / Account from Bank Master; Scheme Code & Asset Class read-only | Present | ✅ | P0 |
| **Masked account number = a pattern the user enters** (e.g. `XXXXXX1234`), used during file processing to find the real account | Read-only "Masked Account Preview" of the selected account | ❌ **Behaviour missing**: the user can't enter a pattern | P0 |
| URL, File Download Path, Corporate ID, Login ID, Password (vault) | Present (password show/hide, "Credential set") | ✅ | P0 |
| Email mode: subject `%like%` pattern, attachment rules | Present (sender / receiver / subject pattern) | ✅ | P0 |
| **File Type** dropdown (DBF, XLS, XLSX, PSV, CSV, PDF, TXT, XXD) and **File Separator** | Removed from step 4 (start row/column kept; type and separator auto-detected from the sample) | ❌ **Contradicts v1 and CMIS** | P0 (earlier prototype changelog) |
| Processing toggles: Is Active, Bulk, Compute / Validate Running Balance, Direct Match, Descending Order | Present | ✅ | P0 |
| **Running Balance Cleanup = toggle plus a text box for the prefix/suffix characters to strip** | Toggle only | ❌ **Character box missing** | P0 |
| **Reconciliation Type = Subscription / Liability** | Subscription / Redemption / Both | ❌ **Wrong options** | P0 |
| Bulk on → account optional; multiple accounts in a non-bulk file → reject whole file | Account optional with Bulk ✅. The file-rejection rule is runtime, not built | ✅ / ⚠️ | P0 |
| Setup summary before save; draft / submit; reset with confirmation | Present (review step) | ✅ | P0 |
| — | **Version history: compare versions + roll back via maker–checker** | ➕ | R1 |

### B2. Bank statement mapping (v1 §2.2 · v4 §5.2)
| PRD requirement | Prototype | Status | Origin |
|---|---|---|---|
| Upload sample → detect header row (weighted score) → user confirms | Present | ✅ | P0 |
| Auto-map: reuse last approved → regex; never overwrite user mappings | Present | ✅ | P0 |
| **System fields: 15 input fields** (INSTRM_AMOUNT, INSTRM_AMOUNT_CREDIT, INSTRM_AMOUNT_DEBIT, INSTRM_STATUS, VALUE_DATE, BANK_DESCRIPTION, BANK_NARRATION, BANK_STMT_DATE, INSTRM_NO, UTR_NUMBER, LOCATION_CODE, BANK_AC_NO, BANK_NAME, CLOSING_BALANCE, BANK_CREDIT_TIME) **plus 10 narration-split fields** (EXTRACT_FOLIO_NO … EXTRACT_PAN) | About 9 fields with different names (VALUE_DATE, TXN_DATE, TXN_AMOUNT, DEBIT_AMOUNT, NARRATION, CHEQUE_NO, UTR_NUMBER, RUNNING_BALANCE, PA_REF). **No narration-split group** | ❌ **Field set doesn't match the PRD** | P0 |
| **INSTRM_AMOUNT mapped → auto-disable INSTRM_AMOUNT_CREDIT / DEBIT, with an explanation** | Not present (those fields don't exist) | ⚠️ | P0 |
| "Potential Mapping Mismatch" dialog; "Column already in use" dialog | Present | ✅ | P0 |
| Date format + include time / 12-24h / seconds + preview | Date format bar present | ✅ (partial) | P0 |
| Mandatory and Incremental toggles; **minimum 3 incremental flags**; Value date, amount and narration required | Enforced at submit | ✅ | P0 |
| Colour-coded save confirmation (green / yellow / purple / grey) | Present | ✅ | P0 |
| "A bank may provide 1–2 file formats" | One mapping per setup | ⚠️ | P0 |

### B3. Credit MIS (CMIS · v4 §5.4–5.5)
| PRD requirement | Prototype | Status | Origin |
|---|---|---|---|
| **4 summary cards**: All, Active, Inactive, Waiting for Approval | **6 cards**: All, Active, Inactive, Draft, Pending Approval, Rejected | 🔁 Follows v4 change log #1–2, not CMIS | P0 |
| Mode, Feed, PA code, Payment Mechanism, Bank, Account (always mandatory), Account Category, Scheme Code, Asset Class | Present | ✅ | P0 |
| Header Position "row,column" validation | Present | ✅ | P0 |
| **Instrument Status = C (Credit) / D (Debit), optional; applied to every row if the file has no status** | Options are **SUCCESS / FAILURE / PENDING / ALL** | ❌ **Wrong values** | P0 |
| **Failure Reason Code = dropdown from the Reversal Remarks table**, active codes only; **disabled and cleared when Instrument Status = C** | **Free-text box**, no dependency on Instrument Status | ❌ | P0 |
| **Reconciliation Type Subscription / Liability; Liability → mandatory category (Redemption / Dividend / Refund / Brokerage)** | Subscription / Redemption / Both, no category | ❌ | P0 |
| Email mode: From, Receiver (`@camsonline.com`), Subject, File Name Pattern | Present | ✅ | P0 |
| ZIP: none / no password / password; invalid password handling | ZIP fields present | ✅ (partial) | P0 |
| Credit MIS column mapping with **its own field set** | Reuses the bank mapping shell | ⚠️ | P0 (backlog) |
| Export to CSV respects card + search | Present | ✅ | P0 |

### B4. Transaction status standardisation (v1 §2.2 note · v4 §5.3)
| PRD requirement | Prototype | Status | Origin |
|---|---|---|---|
| Admin-only table mapping bank values (C/D, CR/DR, SUCCESS/FAILURE, ±amount) → CREDIT / DEBIT, with target table/column | **Not built** | ⚠️ | P0 |

### B5. Authorisation (v1 "Workflow approval" · v4 §5.6)
| PRD requirement | Prototype | Status | Origin |
|---|---|---|---|
| Authoriser sees configs read-only; approve / reject; can't edit; can't approve own | **Merged into the Approvals inbox** (round 6): setup summary, connection, file config and rejection history shown read-only in the detail panel; the separate "Setup approvals" screen was removed and `/dashboard` redirects there | ✅ | P0 → R6 |
| **Reject comment = dropdown of predefined remarks + "Others" free text** (v1) | Free text, **mandatory, minimum 10 characters** for setups (matches the v4 diagram) | 🔁 v1 dropdown not built | P0 |
| Metrics: Total / Awaiting / Approved / Rejected | Shown at the top of Approvals | ✅ | R6 |
| **Email notification to maker and authoriser on approve/reject** (v1) | In-app only (toasts, bell) | ⚠️ | P0 |
| — | **One Approvals inbox for every kind of submission**: split view, keyboard A / S / J / K, auto-advance | ➕ | R3–R4 |

### B6. User management (v4 §5.7)
| PRD requirement | Prototype | Status | Origin |
|---|---|---|---|
| **Exactly 4 fixed roles, one role per user, no role builder** | Module → screen → View / Maker / Checker / Export. Admin-built roles; **several roles per user** across Recon, Brokerage, Posting, Administration | 🔁 **On your instruction** | R1 |
| **User provisioning takes effect immediately, no dual control** | **Granting any Checker or Admin role needs a second admin** | 🔁 Stronger control; needs Compliance sign-off | R1 |
| Admin sees only User Management | Admin sees Users + Roles & Access | 🔁 | R1 |
| Role cards (Admin 2 / Operator 41 / Authoriser 7 / Viewer 98) | Module orbit + access-health tiles | 🔁 | R1, R4 |
| Self-role-change and self-deactivation blocked | Present | ✅ | P0 |
| Add/Edit: name, emp no, +91 mobile, `@camsonline.com` email, designation | Present | ✅ | P0 |
| Invite (24 h) → set password (6-point rules, 5-attempt lock) → mobile OTP (5 min, 60 s resend, 3 attempts) | Present | ✅ | P0 |
| Deactivate with a mandatory reason (≥5 characters), sessions killed | Present | ✅ | P0 |
| **Auto-deactivate after 90 days with no login** | Constant defined, **never applied**. Dashboard only shows "Dormant 60+ days" | ⚠️ | P0 |
| Every mutation and denied attempt audited | Present | ✅ | P0 |
| — | Segregation of duties: same person can't be Maker and Checker on one screen | ➕ | R1 |

### B7. Cross-cutting (v4 §6)
| PRD requirement | Prototype | Status | Origin |
|---|---|---|---|
| Audit trail 100% | Present on old and new screens | ✅ | P0/R1 |
| Server-side pagination (15 rows) | Kept on setup lists and audit. New queues use **focus mode** (one item + "up next 3") instead | 🔁 | R3–R4 |
| In-app alerts at login | Bell with direct links; old banners only on their own screens | 🔁 | R3 |
| v4 §2.3 success metrics (onboard 10 min, approve 5 min…) | Not measured. Dashboard shows **outcome** metrics instead | 🔁 | R3 |

---

## C. Beyond Phase 1: v4 §2.4 target-state stages

Everything below is **outside Phase-1 scope** (v4 §2.2 non-goals) but **inside the PRD's own target architecture**.

| v4 stage / step | Prototype | Status | Origin |
|---|---|---|---|
| 2 · Ingestion 3a manual / 3b bot / 3c API + validation | **Bank files** (round 5):
- **manual upload** with 6 checks against the setup: type, layout, account, date, duplicate, balance continuity;
- **email intake log** with rejection reasons (no setup, bad type, ZIP password, no attachment, duplicate) and fixes (assign to setup, retry with the vault password, ask the bank to resend, discard);
- **bank connections** for API, portal bot and SFTP (health, last/next pull, response time, token expiry, pull now, renew token, pause);
- **reprocess** with a mandatory reason and a full processing history;
- layout-change cases held for approval. | ➕ | R1, R5 |
| v1 email flow: subject → setup → attachment → validate → load; no setup → reject and log; failed items can be investigated and reprocessed | Email intake log does this, but it's simulated (no real mailbox) | ✅ (simulated) | R5 |
| v4 Operator "Reprocess failed statement files" | **Reprocess** action with reason and history; same failure repeats until the file is corrected | ✅ | R5 |
| 2 · Step 4: Pattern match / narration split **setup screen** | Narration values used in matching and the explainer; **no setup screen** | ⚠️ | — |
| 2 · Step 5: **Remitter details import (TPV)** | **Not built** | ⚠️ | — |
| 3 · Step 6: **Reverse feed upload setup** | **Not built** | ⚠️ | — |
| 3 · Step 7: Batch updation / match logic | **Match rules**: 1:1, 1:N, N:1, N:M, tolerances, 30-day simulation, approval | ➕ | R1 |
| 3 · Step 8: Match engine; archive; **parent/child split** | **Match payments** (suggestions, by-hand N:M, "why no match"). **Parent/child split records and archival are not modelled** | ➕ / ⚠️ | R1 |
| 4 · 13a NIGO, 13b Fundnet failures, 13c unqualified (excess / CDT unposted / DTD) | **Problem cases** cover NIGO, Fundnet, excess, short, duplicate, cross-collection. **CDT unposted and DTD are not separate types** | ➕ / ⚠️ | R1 |
| 5 · Fund utilisation & allotment gate | **Fund release** (maker prepares → checker releases before 3 PM, by AMC) + fund utilisation report | ➕ | R3 |
| 6 · T_Refund, eyeball screen, 5-day SLA, delayed interest | **Refunds**: penny-drop check, interest (15% p.a. **assumed**, confirm the SEBI rate), approval, NEFT batch file | ➕ | R3 |
| 6 · 13e **Exchange refund override** (BSE/NSE) | **Not built** | ⚠️ | — |
| 6 · 14 **Investpay setup + AMC funding report** | **Not built** | ⚠️ | — |
| — | **Document extraction** (PDF / email MIS with confidence + human review) | ➕ | R1 |
| — | **Today** (daily cycle, focus task), **Day close** sign-off, **Dashboard**, **Reports** page | ➕ | R3–R4 |

### Recon PRD v1 §4–§7 reports and finance
| v1 item | Prototype | Status |
|---|---|---|
| §4.1–4.4 Unreconciled credit / purchase, bank statement, Credit MIS reports | CSV from live data | ➕ |
| §4.5–4.6 Cheque bounce posted / unposted | **Placeholder CSV only** ("No bounces today") | ⚠️ |
| §4.7 Cross collection, §4.8 Refund, §4.9 Purchase register | CSV from live data | ➕ |
| §4.10 Existing unit-specific reports | Not listed | ⚠️ |
| §5 **General Ledger posting** | **Not built** | ⚠️ |
| §6 BRS | **Stub**: book balance = bank balance, difference always 0 | ⚠️ |
| §7 **Physical cheque bounce instruments** | **Not built** | ⚠️ |

---

## D. Prioritised gap list

### Fix in the prototype: it contradicts a PRD rule (all were already in the original prototype)
1. ✅ *Fixed in Round 7.* **Reconciliation Type**: change to Subscription / Liability. For Credit MIS, add the mandatory Liability category (Redemption / Dividend / Refund / Brokerage).
2. ✅ *Fixed in Round 7.* **Credit MIS Instrument Status**: change to C / D. **Failure Reason Code** becomes a dropdown from the Reversal Remarks table, disabled and cleared when the status is C.
3. ✅ *Fixed in Round 7.* **Mapping field set**: use the PRD's 15 input fields + 10 narration-split fields, and the **INSTRM_AMOUNT → disable credit/debit** rule.
4. ✅ *Fixed in Round 7.* **Masked account number**: an editable pattern used at processing time, not a read-only preview.
5. ✅ *Fixed in Round 7.* **Running Balance Cleanup**: add the character text box.
6. ✅ *Fixed in Round 7.* **File Type and File Separator**: restore them, or get a PRD decision that auto-detection replaces them.
7. **Bank setup list**: add the Setup Name and File Type columns, and the 3-character search minimum.

### Build: in the PRD, not in the prototype
8. ✅ *Fixed in Round 7.* Transaction status standardisation admin screen (v4 §5.3).
9. Credit MIS mapping with its own field set (v4 §5.5).
10. Reject-remarks dropdown + "Others" (v1).
11. Email notifications on approve/reject (v1).
12. 90-day inactivity auto-deactivation (v4 §5.7.6).
13. Target state: TPV import, reverse feed setup, narration split setup, parent/child split, CDT unposted / DTD types, exchange refund override, Investpay + AMC funding report, GL posting, real BRS, cheque bounce, unit-specific reports.

### Decide: deliberate changes that need PRD sign-off
14. Configurable multi-module roles instead of 4 fixed roles (v4 §5.7) — Product + InfoSec.
15. Second-admin approval for privileged grants — Compliance.
16. Phase-2+ screens prototyped now: re-baseline the phases with Engineering.
17. Simple view, focus-mode queues, Day close step, dark "command deck" UI — Ops + Brand. Note the cyan accent is not an official CAMS colour.
18. Delayed-interest rate (15% p.a. is my assumption) — Compliance to confirm.
