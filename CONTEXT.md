# CAMS Recon: context that is not in the PRD

Written 13 Nov 2026, before the next round of changes. Nothing in the prototype was changed to produce this file.

## How to read this

- **[told by me]**: you said it or pasted it in one of our sessions (dates given where they matter).
- **[from PRD]**: from the baseline documents in this repo: `Recon_PRD_v1.md` (bank statement), `Credit_MIS_PRD.md`, and `CAMS_Recon_Phase1_PRD_v4.md`. Where it's v4, the line says so, because v4 has no named author and I can't tell whether you or an earlier AI session wrote its architecture section.
- **[your inference]**: my own reading. Treat it as unconfirmed.
- "The PRD" here means the living Claude Docs PRD (rev 88). It documents the prototype screen by screen. This file holds what sits outside it: the business rules behind the screens, where the sources conflict, and what nobody has told me.
- I didn't fill gaps with generic recon practice. Where something is missing, the file says so.
- **(CB doc)** marks a line from the "Closing Balance & Fund Utilisation Dashboard: Business Requirements and Functional Understanding" document you pasted on 13 Nov, after the 13 Nov change list. It's tagged [told by me] because you supplied it. It reports a stakeholder discussion, so it outranks my inferences, but where it disagrees with your earlier instructions the conflict is listed in section 9, not settled.

---

## 1. Matching rules

### What exists
- [from PRD] `Recon_PRD_v1.md` lists sections 2.4 "Reconcile bank statement vs Credit MIS", 2.5 "Credit matching between Credit MIS vs purchase transaction", 2.6 "Fund utilization report", 2.7 "Refund" and 8 "Exceptions" in its table of contents. None of these sections has any content in the file. The document stops after column mapping and status standardisation.
- [from PRD] The only matching rule written down anywhere in the baseline is **Direct Match** (a bank setup toggle). When it's on, the system matches the bank statement to CDT records on UTR / Instrument Number. Example: bank `UTR123456` = CDT `UTR123456`. Both records are tagged as reconciled, with no Reverse Feed MIS needed.
- [from PRD] Direct Match runs only for accounts where the toggle is on, to avoid slowing everything down.
- [told by me] Keep the direct-match toggle. It limits the scheduler to about 10–15 UPI accounts instead of all ~200 (22 Oct).
- [from PRD v4] Stage 3 describes a "Batch Updation Setup Screen" that sets a matching priority cascade: UTR exact match, then instrument number + amount, then fuzzy narration match "with tolerance windows". It matches RPBS (Recon Processing Bank Statement table) against the Reverse Feed. Matched rows are archived. Partial or bundled payments are split into a Parent row (the original credit) and Child rows (one per scheme).
- [from PRD v4] Fund utilisation gate: only transactions marked Reconciled & Realised are cleared for unit creation.

### What you told me about matching (22 Oct brief)
- [told by me] Deterministic matching stays the foundation.
- [told by me] Support one-to-one, one-to-many, many-to-one and many-to-many "where required".
- [told by me] Support composite matching keys, grouping, summation and configurable field-to-field comparisons.
- [told by me] For physical cheques, never match on cheque number alone. Use bank, account, amount and transaction identifiers.
- [told by me] Allow for weekends, holidays and delayed SIP processing when comparing transaction dates.
- [told by me] Manual matching is the primary workflow for the cases identified in the discussion.
- [told by me] Show probable matches separately, as system suggestions that need review.
- [told by me] Show enough evidence to tell similar transactions apart.
- [told by me] Never auto-confirm an ambiguous match on amount or name alone.
- [told by me] A match made by one Ops person is authorised by another (for example, Priya matches and Arun authorises) (9 Nov).
- [told by me] Virtual accounts or unique collection references per investor "can't happen". Banks and aggregators won't change their formats for us, so we handle it ourselves (20 Oct).
- [told by me] Liability accounts need matching and manual matching the same as subscription accounts (22 Oct).
- [told by me] Matching of AMC utilisation against Credit MIS belongs to the future reconciliation framework, not Phase 1 (11 and 13 Nov).
- [told by me] Matching rules will be configured by authorised Setup users in a future phase (12 Nov paste).
- [told by me] Match rules and Reports menus were removed because they aren't in Phase 1 (28 Oct). Ops matching screens were removed as Phase 2 (9 Nov).
- [told by me] (CB doc) AMC utilisation entries are matched against **bank statement** entries, not Credit MIS. The AMC lists the credits it utilised, back-office users upload that file, and the system tries to match each entry to its bank credit. Each one becomes AMC Utilised – Matched or AMC Utilised – Unmatched. You confirmed this over "AMC matching is future work" (C20). Which phase it belongs to is still open (CB doc 16.4).
- [told by me] (CB doc) Out of scope: automatically matching the AMC sweep debit to the CAMS utilisation report, finding the sweep from narration, and transaction-level reconciliation of the utilisation report against the statement.

### What nobody has told me
- [your inference] No precedence order has been confirmed by you. The only order on paper is v4's UTR → instrument + amount → fuzzy narration, and v4's provenance is unclear.
- [your inference] No tolerance values exist anywhere: no amount tolerance, no date window in days, no fuzzy-score threshold. "Tolerance windows" in v4 and "weekends, holidays, delayed SIP" from you are the only references, and neither gives a number.
- [your inference] No rule says which of one-to-many, many-to-one or many-to-many applies to which source pair (bank ↔ Credit MIS, Credit MIS ↔ purchase, bank ↔ CDT).
- [your inference] The match confidence percentages and "System suggested (92%)" items in the prototype seed (`mock/opsSeed.js`) were invented by me for the demo. They aren't requirements.

---

## 2. Exception types and handling

### Exception types named so far
- [from PRD] The `Recon_PRD_v1.md` contents list names these reports: Unreconciled credit side, Unreconciled purchase side, Cheque bounce (posted/unposted, on both the Credit MIS side and the purchase side), Cross collection, Refund process, and Purchase register. No definitions are given.
- [from PRD v4] Exception streams:
  - 13a: transaction rejected as NIGO at posting.
  - 13b: Fundnet failure cases.
  - 13c: unqualified transactions sent to BO under maker-checker: Excess Credit, CDT Unposted, DTD.
- [from PRD v4] Refunds:
  - T_Refund is the staging table and refund_trxn the final queue.
  - Value date SLA is 5 business days. Beyond that, the operator enters an Identification Date and delayed interest is calculated.
  - Exchange-originated refunds go to the BSE/NSE clearing corporation account.
  - Funding report goes to the AMC.
- [told by me] Exception tiles to keep: NIGO refund pending, Excess credit and Unmatched purchase. Remove the rest (23 Oct).
- [told by me] Your 22 Oct paste said to add "setup missing, excess credits, refunds" to the SVP view, because today these are chased through SQL queries. On 24 Oct you said to remove the "setup missing, excess credits and refunds" section. See contradiction C7.
- [told by me] (CB doc) **Excess Credit** now has a definition: a bank credit whose scheme code can't be identified. It is separate from CAMS Not Utilised (scheme identified, utilisation report not yet generated), and the two must never be combined.
- [told by me] Aging buckets: 0–5, 6–10, 11–20 and over 20 days, showing count and amount, and highlighting anything past the five-day threshold. The SEBI thresholds still need validating per transaction type (22 Oct).

### File and statement exceptions (Phase 1)
- [told by me] User-facing file statuses are Pending, Success and Failed, plus a Status Remarks field. "Not received yet" is tracked separately and is not a failure (22 Oct).
- [told by me] The bank statement statuses you defined are:
  - Not Uploaded
  - No Transactions (downloaded fine, but zero transactions)
  - Uploaded
  - Pending
  - Failed

  Never use No Transactions to mean "missing" (11 and 13 Nov).
- [told by me] Failure examples: format mismatch, connectivity failure, duplicate file, invalid attachment, failed authentication, balance mismatch.
- [told by me] Format drift:
  - Keep a fingerprint per bank and compare every file against it.
  - On a mismatch, show the old and proposed mapping with confidence.
  - A person approves (maker-checker). Never auto-activate an AI-suggested mapping.
  - Unknown formats go to onboarding.
  - Log cases the AI can't resolve to a product report.
- [told by me] Closing balance mismatch:
  - Show the exact two rows where the running balance breaks.
  - Offer a download of the uploaded file.
  - The fix is a corrected statement from the bank. Manual fixes happen only under the AMC's protocol (22 Oct).
- [told by me] Recovery options:
  - Reprocess (rerun the scheduler).
  - Refetch the full statement (portal bot only, and never for closing-balance errors).
  - Manual upload.
- [told by me] When a later scheduler run succeeds, earlier error rows are voided automatically, where that applies (28 Oct).
- [told by me] Repeat events such as a format error or an API failure are shown once, dated to their first occurrence, oldest at the top. Rejected emails are not deduplicated (27 Oct).
- [told by me] Every action item has a No action option. These go to the supervisor to verify and also serve as feedback on how events are defined (27 Oct).
- [told by me] Dismissing an alert never counts as proof that the underlying work is done (22 Oct).
- [told by me] Never bypass a CAPTCHA. Offer manual download instead (22 Oct).
- [told by me] "Balance Does Not Match" counts accounts with an unresolved closing-balance mismatch for a business date. The count drops when the mismatch is resolved, and each business date counts on its own. The suggested key is Bank ID + Account + Business date (11 Nov).
- [told by me] (CB doc) Balance Does Not Match is a separate requirement from the fund-utilisation indicator. It flags inconsistencies in uploaded or processed statement data. The example given: a scheduled job loads one or two rows, the rest arrive later, a row is deleted by hand and the whole statement is re-uploaded, and the system should catch the discrepancy. The comparison logic is still pending: running-balance continuity, opening-to-closing movement, or both, and whether it counts per account or per transaction.
- [from PRD] Bulk upload: if a setup names one account but the file contains several, the whole file goes to the rejected queue.
- [from PRD] When any validation fails (email, subject, attachment, mapping, format, data), nothing is inserted. The failure is logged and the file can be reprocessed.
- [from PRD] Email path: subject matched with `%like%` → bank mapping → attachment → validate → insert. No mapping means the email is rejected and logged.

---

## 3. Bank statement behaviour

### Channels and volumes
- [told by me] Channels: SFTP (the main bulk channel, with bank-specific folders), email, API, portal automation, and manual upload (22 Oct).
- [told by me] Roughly 200 accounts (22 Oct). Statements are counted per account, "for example, 265" (28 Oct). HDFC alone has about 80 accounts (11 Nov). Column mapping covers about 15–18 banks.
- [told by me] Some banks block automated download (OTP, device or token login). For these, Ops download the statement from the portal and upload it through File Upload, which is an operations screen, not a setup screen (11 and 13 Nov).
- [told by me] Statements for one bank can arrive at several checkpoints a day (morning, afternoon, evening). Task examples are uploads at 9:00 AM, 3:00 PM and 6:00 PM. Status is judged against the selected checkpoint (11 Nov).
- [told by me] Show one indicator per bank:
  - Green when every account has crossed the checkpoint.
  - Amber when one or more accounts are pending. Clicking amber previews the pending accounts.
  - Download the full pending list, and optionally the completed accounts too (11 and 13 Nov).

### Duplicates
- [told by me] The same file name is re-sent through the day as a growing full-day dump (10 rows at 10 AM, 20 at 11, 30 at 12). So duplicates are stopped per row at insert, using a unique key in the database, not per file (22 Oct).
- [told by me] Only two counters: "new rows loaded" and "already loaded earlier, skipped". Identical rows within one file are legitimate, for example SIP debits after a holiday.

### Balances
- [told by me] Closing balance validation is always on, with no toggle (22 Oct).
- [told by me] Standard Chartered statements carry no closing balance (Citi now does). For these, show a closing balance computed from our database, and never call it bank-verified.
- [told by me] On 9 Nov you defined "system closing balance" as the balance on the last line item. On 13 Nov you said the EOD balance is the closing balance on the last transaction line of the selected date.
- [told by me] (CB doc) Statement data the dashboard relies on, assumed to be in the database after upload: bank, account, transaction date, time, sequence/order, credit, debit, running balance, narration. Whether the sequence field and per-bank running-balance mapping really exist is listed as open (CB doc 16.3).
- [told by me] (CB doc) Statements can arrive in several batches through the day, so the latest closing balance changes as new rows land. How multi-batch uploads are handled is open.

### Setup rules
- [told by me] Processing order is payouts first, then pay-ins: dividend/IDCW → redemption → switch → purchases. This stops a same-day purchase being swept into a "redeem all" on liquid or overnight funds (22 Oct).
- [told by me] Priority flag (high/low) per account. About 10–15 priority accounts download first within the start/end window, for example every 15 minutes (22 Oct).
- [told by me] Multiple setups can exist for one bank (for example a morning format and an EOD format with different column counts). The system picks the one that matches and errors only if none do.
- [told by me] Copy setup copies everything except the account number (Karthik asked for this).
- [told by me] SFTP is one per AMC. The path, user and password fields are parked as display-only until the client's SFTP/GCS approach is known. Uploads go to a GCS bucket.
- [told by me] File names must be unique across all file types (27 Oct). See contradiction C2.
- [told by me] For manual-SFTP accounts, learn each account's upload pattern over 10–15 days, then alert when an upload is about 15 minutes late (28 Oct).
- [told by me] Column mapping is per bank name, not per account:
  - Mandatory columns are marked with an asterisk. A blank mandatory column rejects the file.
  - Dates are split into parts. There's a 12/24-hour toggle and a custom option.
  - For an ambiguous date like 05/05, pre-fill a guess and ask the user to confirm DD/MM or MM/DD.
- [told by me] Remitter files arrive on bank-specific schedules (hourly, morning, evening). Missing and late feeds are flagged. The alert mechanism isn't defined yet (11 Nov).
- [from PRD] Processing options: Is Active, Bulk Upload, Compute Running Balance, Validate Running Balance, Running Balance Cleanup (strip a prefix or suffix such as `C`), Direct Match, Reconciliation Type, and Descending Order (validation runs bottom-to-top).
- [from PRD] Status standardisation maps bank values to CREDIT/DEBIT. Source values: C/D, CR/DR, separate credit and debit columns, SUCCESS/FAILURE (IndusInd), and positive/negative amounts (South Indian Bank).

---

## 4. Credit MIS behaviour

- [from PRD] One aggregator per file. Account Category is Scheme Account or Pool Account. Reconciliation Type is Subscription or Liability. If Liability, a category is mandatory: Redemption, Dividend, Refund or Brokerage.
- [from PRD] Instrument Status (optional) is C or D:
  - The file's own status column wins if it has one.
  - Otherwise the setting applies to the whole file.
  - C means every row is treated as a **successful** transaction, and D means every row is **failed**.
- [from PRD] Failure Reason Code comes from the Reversal Remarks table. The file's code wins if present. The field is disabled when Instrument Status is C.
- [from PRD] Feed Option comes from a master table. Its rules are "defined in a separate Functional Specification document" that isn't in this repo.
- [from PRD] When several mappings qualify, the setup is chosen by: file structure → header mapping → data mapping → file name pattern (starts with, ends with, contains, exact).
- [told by me] Instrument status values are Credit, Debit and Not selected. With Not selected, the file's status column becomes mandatory in mapping (22 Oct).
- [told by me] Reversal reason: the file comes first, and the user's selection is used only if the file is blank.
- [told by me] Add a "no feed" option for banking-channel online credits that have no feed. It copies the bank statement transaction as the feed. You asked to see the current screen to learn how it works today, and I haven't seen it.
- [told by me] Use exact aggregator identifier values, because matching depends on them. On 22 Oct the examples were Razorpay Online, Razorpay CMS, BillDesk and SAP. On 9 Nov you said only Razorpay and Cashfree are real so far.
- [told by me] An email arriving with a password-protected ZIP doesn't need a "retype password" field.

---

## 5. Closing balance, fund utilisation, dashboard

### Dashboard
- [told by me] There is one dashboard, which grows by phase. Don't build a dashboard per phase (11 and 13 Nov).
- [told by me] Phase 1 dashboard contents:
  - Total credit amount
  - Reconciled and unreconciled amount, where available
  - Bank statement count and upload status
  - Closing balance by account
  - Fund utilisation
  - Remitter schedules
- [told by me] Phase 2 adds transaction counts, ageing, matching status and exception metrics (13 Nov).
- [told by me] A prominent Subscription / Liability toggle at the top. Never combine both categories in one view. Show only accounts in the selected category (13 Nov).
- [told by me] (CB doc) Each bank account is either Subscription or Liability, never both. The dashboard keeps this classification.
- [told by me] A single business date, defaulting to today. For closing balances, allow the last five calendar days (13 Nov).
- [told by me] The date filter applies to the closing balance view, not automatically to every dashboard section (13 Nov).

### Closing balance by bank
- [told by me] Show each account with its own closing balance. Never show a total across accounts, because summing independent accounts means nothing operationally (11 and 13 Nov).
- [told by me] Remove the Matches / Does Not Match labels from the closing-balance-by-bank section (13 Nov). **Superseded:** you confirmed the CB doc is correct (13 Nov). The CB doc's green/red indicator applies instead (C18).

### Fund utilisation
- [told by me] **Superseded:** you confirmed the CB doc is correct (13 Nov). The formula below is replaced by the Excel F2 formula (C16), and the comparison uses CAMS Fund Utilised, not CAMS + AMC (C17). Kept for the record. Three separate values (13 Nov, marked critical):
  - **Last Closing Balance**: the balance on the last transaction line.
  - **Total Fund Utilised**: CAMS utilisation + AMC utilisation.
  - **Fund Not Utilised**: Last Closing Balance − Total Fund Utilised.
- [told by me] Fund Not Utilised is the prominent metric. It can be negative, shown in a different colour, and is never blocked or rejected.
- [told by me] Never call the utilisation amount "System Closing Balance".
- [told by me] AMC utilisation must not be counted twice.
- [told by me] The dashboard is informational, not transaction-level matching.
- [told by me] CAMS utilisation (9 Nov): generating a disbursement report flags those transactions, and fund utilised is the sum of the flagged transactions.
- [told by me] AMC utilisation file workflow:
  1. The AMC emails the file.
  2. Ops downloads it and uploads it.
  3. The system validates it.
  4. The utilisation flags are updated.
  5. It adds to the total.

  Whether the upload screen is Phase 1 or 2 is still to confirm (13 Nov).
- [your inference] The prototype's current "Funds not utilised" (closing − paid out) covers only the CAMS part. It has no AMC utilisation and no negative styling yet.
- [told by me] (CB doc) The formula above must **not** be assumed for every account. The real calculation depends on how each entry is classified and must follow the stakeholder's accounting Excel, specifically the formula in cell F2. Product and Ops supply the formula; Architecture must not invent it. See C16.

### Closing Balance & Fund Utilisation requirements (CB doc, 13 Nov)

**Purpose**
- [told by me] (CB doc) Users: Reconciliation Operations, Operations managers and Fund Accountants.
- [told by me] (CB doc) It replaces today's routine of checking the recon system, CAMS utilisation records and bank statements separately, then emailing and phoning the AMC to ask whether funds were swept.
- [told by me] (CB doc) It's an informational monitoring view. It is not a fund-availability dashboard and not transaction-level reconciliation.

**Closing balance**
- [told by me] (CB doc) Closing balance = the running balance on the last transaction row for that account and business date. It's not tied to 3 PM or any other checkpoint.
- [told by me] (CB doc) "Last row" is decided by the transaction sequence in the statement, not by upload time.
- [told by me] (CB doc) Example, HDFC account ending 1066: ₹55,71,73,049.20 at 6:26 PM before the sweep, ₹6,95,64,880 after the sweep debit, then ₹6,43,45,000 at 6:46 PM after a further credit. Checked at 6:46 PM, the dashboard shows ₹6,43,45,000. It must not pick the pre-sweep balance.
- [told by me] (CB doc) Per account it shows: bank, account number, business date, last transaction sequence, last transaction date, last transaction time, closing balance, and **Last Statement Updated At** (when the latest statement data was loaded). The timestamp is "recommended", so users can tell a stale balance from a current one.
- [told by me] (CB doc) If the AMC has swept but the statement showing the debit hasn't arrived, the dashboard keeps showing the last available balance. That's expected.

**CAMS utilisation and the AMC sweep**
- [told by me] (CB doc) CAMS generates a fund utilisation report, sends it to the AMC, and sets a utilisation flag (for example Y) on the records. CAMS Fund Utilised is the total of those flagged amounts.
- [told by me] (CB doc) Generating the report and the AMC's sweep are two separate events. The report is not proof of the debit. The sweep appears as a debit on the collection account, which lowers the running balance.
- [told by me] (CB doc) The AMC usually sweeps within about 30 minutes. That's an expectation, not a system SLA, and nothing is auto-failed after 30 minutes.
- [told by me] (CB doc) Narrations like "Transfer from cash collection account 1066 to operative account" can help a person investigate, but aren't used by the indicator.

**Indicator (account level)**
- [told by me] (CB doc) Compares Last Closing Balance with CAMS Fund Utilised:
  - Closing < Utilised: **green** (sweep has probably happened).
  - Closing > Utilised: **red** (sweep may not have happened).
  - Equal: no indicator.
- [told by me] (CB doc) It's a simple arithmetic signal and a starting point for investigation. Green doesn't prove the AMC swept, and red doesn't prove it didn't, because credits keep landing (a ₹55 crore sweep can be followed by a ₹300 crore credit).
- [told by me] (CB doc) Proposed columns: S. No., Bank Name, Bank Account Number, Business Date, Last Closing Balance, CAMS Fund Utilised, Last Transaction Date, Last Transaction Time, Last Statement Updated At, Indicative Status. There is no Fund Not Utilised column and no AMC column in this layout. You confirmed this layout is correct (C16, C17).

**Classifying each credit (no double counting)**
- [told by me] (CB doc) One transaction can't be both AMC Utilised and CAMS Utilised.

  | Scenario | Classification |
  |---|---|
  | AMC reports utilisation and the bank entry is matched | AMC Utilised – Matched |
  | AMC reports utilisation and the bank entry isn't matched | AMC Utilised – Unmatched |
  | CAMS report generated and flag set | CAMS Utilised |
  | Scheme identified, CAMS report not generated | CAMS Not Utilised |
  | Scheme can't be identified | Excess Credit |

- [told by me] (CB doc) Matched and Unmatched are both AMC utilisation. "Unmatched" is a back-office identification gap, not a sign the AMC didn't utilise.
- [told by me] (CB doc) Scheme accounts belong to one scheme, so the scheme is known from the account. Common accounts take money for several schemes, so each credit's scheme code must be identified first. That's where CAMS Not Utilised vs Excess Credit matters most.
- [told by me] (CB doc) **Refund Utilised** is informational. The amount is already counted elsewhere, so it must not be added again.
- [told by me] (CB doc) **Refund Not Utilised**: when a refund isn't utilised, the amount may have to come from a different account. The treatment depends on the Excel.

**The accounting Excel**
- [told by me] (CB doc) Columns shown: Serial Number, Bank Account Number, Bank Name, Opening Balance, AMC Utilised, AMC Utilised – Matched, AMC Utilised – Unmatched, CAMS Utilised, CAMS Not Utilised, Refund Utilised, Refund Not Utilised, Excess Credit, Closing Balance. Signs and which columns are included come from the Excel, not from us.
- [told by me] (CB doc) Pending: get the Excel, check F2, confirm signs, Refund Not Utilised, and how the final closing balance relates to the fund position.

**Who owns what**
- [told by me] (CB doc) Product with Recon Ops defines each column and the classification rules, and signs off the formula and UAT. Architecture maps source tables and columns and designs retrieval. Development builds the queries, flags, indicator and screen.

**Open points the CB doc lists**
- [told by me] (CB doc) Statement data: does the sequence field exist, the per-bank running-balance mapping, multi-batch uploads, and which refresh timestamp is available.
- [told by me] (CB doc) AMC utilisation: source and field for matched/unmatched, how unmatched is handled, and the upload's scope and phase.
- [told by me] (CB doc) CAMS utilisation: the exact flag and report field, which records count in the total, and how CAMS records relate to later sweep debits.
- [your inference] The CB doc doesn't say whether CAMS Fund Utilised covers the business date only or is cumulative. The indicator only makes sense if both sides cover the same period, so this decides whether green and red mean anything.
- [your inference] "RTR back-office users" (the people who upload the AMC file) isn't defined anywhere else. I don't know whether they are Recon Ops or a different team.

### Earlier closing-balance instructions
- [told by me] 3 PM matters because same-day NAV depends on it. Accounts not uploaded before 3 PM were to be highlighted, and after 3 PM they could be ignored for that day (22 Oct).
- [told by me] On 26 Oct: "all the statements before 3 PM should be there in my system… you will download only after 3 PM."
- [told by me] **Superseded:** you confirmed the CB doc is correct (13 Nov). The closing balance is the last row of the business date, not the last before 3 PM (C19). On 28 Oct: take the last transaction before 3 PM and compare it with the system closing balance (green if they match, orange if not). Show fund utilisation completion % at 3 PM and 4 PM.
- [told by me] Asset-class filters: Equity/Debt/Cash, liquid vs non-liquid, and index vs non-index from the SEBI category, plus scheme vs common collection account (28 Oct). Later: remove liquid and index, and add SEBI asset class and account type (3 Nov).

---

## 6. Who does what

- [told by me] **Central Setup Team**:
  - Six peers. Meera and Anil stand in for them in the prototype.
  - One role, with no separate maker and checker. The creator can never authorise their own record; anyone else on the team can. Checked on login ID (3 and 9 Nov).
  - Sets up a new bank or feed once and never does daily uploads (11 Nov).
- [told by me] **Recon Ops**:
  - Priya and Arun. One role, and the whole team is both maker and checker under the same rule.
  - Handles daily bank statement, remitter and Credit MIS uploads, monitoring, and operational exceptions.
  - Works one AMC at a time.
  - Raises setup requests to Central Setup when a new feed appears.
- [told by me] **Senior Ops, team leaders and supervisors (Level 1 and Level 2)**:
  - Allocate tasks and assign KRAs.
  - Ordinary executives never see the allocation screen.
  - Recurring tasks repeat across the applicable days (13 Nov).
  - Open question: can L1/L2 create brand-new tasks, or only edit templates? (11 Nov) **Answered 13 Nov, from a call transcript you pasted:**
- [told by me] **Level 1 and Level 2 cannot create tasks.** They can see tasks and assign them to people.
- [told by me] **Only the team leader creates tasks.** The team leader is the functional manager. That isn't one fixed title: it can be a deputy manager, manager or senior manager.
- [told by me] **Task work done by Level 1 or Level 2 is reviewed and approved by their functional manager**, not within the Ops team.
- [your inference] The transcript also says "team leader only can see the task". I read that as "only the team leader has the full task view", but it could mean executives see only their own tasks. Unconfirmed.
- [your inference] This means "No action" items are verified by the functional manager. The transcript doesn't name No action specifically.
- [told by me] **Functional Manager** (Kavita): dashboards and approval screens only, with no Central Setup access (9 Nov).
- [told by me] **IT Support** (Vikram):
  - Sees the Scheduler Monitor only. "Didn't execute" failures belong to IT.
  - "Ran but no data, wrong format, bad data" failures belong to Setup or Ops (9 Nov).
- [told by me] **AMC**: sends the utilisation file by email.
- [told by me] (CB doc) **Fund Accountants** and **Operations managers** use the closing balance dashboard alongside Recon Ops. Neither is a persona in the prototype.
- [told by me] (CB doc) **RTR back-office users** upload the AMC utilisation file. You confirmed this over the 13 Nov list, which said Ops (C22).
- [told by me] (CB doc) Ops follows up with the AMC by email or phone when a sweep looks missing.
- [told by me] Example KRAs: bank statement download and upload, channel feed upload, transaction matching, excess credit monitoring, refund processing.
- [told by me] People named who aren't personas: **Karthik/Kartik** (asked for copy setup and for fund utilisation to be compared with closing balance) and **Arun**, asked to provide the full list of Recon roles and which ones can't be combined (27 Oct).
- [your inference] I can't tell whether the "Arun" asked for the roles list is the same person as the persona Arun Mehta.
- [from PRD v4] Lists a separate Team Lead / Authoriser persona and a System Administrator. Your later instructions replace both. See contradiction C5.
- [from PRD] The authoriser only verifies and approves or rejects, and cannot edit. Approve or reject emails go to both maker and authoriser. There's a predefined remarks dropdown with "Others".
- [told by me] The authoriser can add remarks only, not edit rows (22 Oct).

---

## 7. Constraints

- [told by me] Revamping a legacy system with legacy databases and code. You've called it 25 years old (20 Oct) and 30 years old (11 Nov).
- [told by me] AI has to be your in-house, locally hosted model. Nothing may be "made up". It has to be genuinely engineerable on that legacy stack (11 Nov).
- [told by me] SEBI requires that units are allotted only after funds are realised. [from PRD] says the same.
- [told by me] Users are low-paid back-office staff of average skill. Every screen needs one obvious next step (20 Oct and 11 Nov).
- [told by me] Light mode only, calm, built to last 10–15 years. Phase 1 of 3.
- [told by me] All data is synthetic. Don't invent names, volumes, savings or accuracy figures.
- [told by me] Don't remove menus unless told to. Commit only when asked. The `recon/` folder is never committed.
- [told by me] The user directory comes from the ID management sync (on-prem, replicated to Odin, active users only).
- [told by me] Auto-deactivation after 10 days without a biometric punch-in is subject to the identity team. Inactivity of 60+ days without login is tracked separately (22 Oct).
- [told by me] Modules: about 8–9 (CRMS, Customer Support, Purchase, Recon, SIP, Brokerage, Posting, MIS). Verticals: MF (default), AIF, GIFT City, SIF, with KRA later.
- [told by me] Cutoffs by asset class or scheme: reuse the scheme master if it already holds cutoffs, otherwise build a recon-side setup.
- [told by me] The whole project ships to Recon users only once the planned functionality is complete, not phase by phase (11 Nov).

---

## 8. Decisions you've made (not repeated above)

- [told by me] Strict Phase 1: v4 Phase-1 screens only, with extras hidden behind an off switch (21 Oct). Later you added Ops screens. See C1.
- [told by me] Column mapping sits inside both Bank statement and Credit MIS setup, as a toggle (11 Nov). Transaction type and narration tags stay as their own screens.
- [told by me] Button labels just say "Add" (11 Nov).
- [told by me] No keyboard shortcuts anywhere (11 Nov).
- [told by me] Central Setup home has no "Files that failed" and no "Fund release cutoff" (11 Nov).
- [told by me] Remove "Balances we computed" entirely (11 Nov).
- [told by me] "Expected by" was removed from the scheduler monitor because an average arrival time can't work for schedulers that run every 15–30 minutes (9 Nov).

---

## 9. Contradictions

| # | One source says | Another says |
|---|---|---|
| C1 | Strict Phase 1 is v4 config screens only (you, 21 Oct; v4 says Phase 1 is "strictly configuration, mapping, user admin, maker-checker") | Ops screens are Phase 1: File Upload, closing balances, Today to-do, dashboard (you, 27 Oct–13 Nov) |
| C2 | File names must be unique across all file types (27 Oct). The 22 Oct brief listed SHA-256 file-level duplicate detection | The same file name is legitimately re-sent all day as a growing dump, and file-level duplicate checks were dropped (22 Oct, later paste). The 13 Nov upload spec says "validate duplicates" without saying at which level |
| C3 | **Resolved by C19: last row of the business date.** The closing balance snapshot is the last transaction **before 3 PM**, downloaded after 3 PM (26 and 28 Oct) | EOD: the last transaction line **of the selected date** (13 Nov) |
| C4 | **Partly resolved by C18 and C21:** green/red against CAMS Fund Utilised; Balance Does Not Match is a separate statement check whose logic is still open. Compare closing balance with the system balance and show green/orange. Fund utilisation is used for the "balance does not match" flag (28 Oct, 9 Nov). The "Balance Does Not Match" tile stays (11 Nov) | Remove Matches / Does Not Match from closing balance and fund utilisation. "Do not call utilisation System Closing Balance" (13 Nov) |
| C5 | Separate Team Lead / Authoriser persona (v4). Baseline PRDs have maker and authoriser roles. Role-conflict check: one person can't be both Recon maker and checker (27 Oct) | One team role, where everyone is maker and checker and only the creator is blocked (3 and 9 Nov) |
| C6 | Manual upload is a restricted exception screen for selected users (22 Oct) | File Upload is the normal daily route for OTP or device-locked banks, done by Ops (11 and 13 Nov) |
| C7 | Add setup missing, excess credits and refunds to the SVP view (22 Oct) | Remove that section (24 Oct). Keep NIGO refund pending, excess credit and unmatched purchase (23 Oct) |
| C8 | Closing balances use a from–to date range (27 Oct, user-management filters; 28 Oct dashboard) | Single date, last five calendar days (13 Nov) |
| C9 | Remove the dashboard from Ops (9 Nov). Remove the fund-utilisation check (23 Oct) | One extensible dashboard for Ops (11 and 13 Nov). Fund utilisation is the critical metric (13 Nov) |
| C10 | **Resolved by C17: CAMS Fund Utilised is the flagged total; AMC utilisation is a separate, exclusive category.** Fund utilised = sum of transactions flagged by the disbursement report (9 Nov) | Total utilised = CAMS + AMC utilisation (13 Nov), and the AMC upload's phase is unconfirmed (11 and 13 Nov) |
| C11 | Credit MIS: C/D mean successful/failed transactions (PRD) | Bank statements: C/D mean credit/debit direction. Status standardisation maps SUCCESS→CREDIT and FAILURE→DEBIT, mixing status and direction [your inference that this is a real conflict] |
| C12 | **Partly resolved by C20:** the AMC flow matches entries to the bank statement; matching against Credit MIS stays future. AMC utilisation workflow step 5 is "Reconciliation: compare with Credit MIS" (11 Nov paste) | The same paste and 13 Nov both say that matching is Phase 2 / future |
| C13 | Inactivity is 10 days without biometric (22 Oct). Also 60+ days without login | One common status for "no punch-in 7+ days" and "no login 10+ days" (28 Oct) |
| C14 | Aggregators: Razorpay Online, Razorpay CMS, BillDesk, SAP (22 Oct) | Only Razorpay and Cashfree are real so far (9 Nov) |
| C15 | Phase 1 of 3, with phase-wise build | Not released to users in partial phases (11 Nov). [your inference] This is a release decision rather than a build one, so it may not conflict |
| C23 | Duplicates are stopped per row at insert with a unique key; two counters only (you, 22 Oct) | No row-level unique key or file-level duplicate check has been confirmed (your answer 3, 13 Nov) |
| C24 | Functional Manager has dashboards and approval screens only and is never a maker (9 Nov). Level 2 can add new tasks (prototype role, built while the question was open) | The functional manager creates tasks and reviews task work; L1 and L2 only assign (13 Nov transcript). The transcript is the later instruction |

### Resolved 13 Nov: you said the CB doc is correct for all of these

| # | Was | Now (CB doc) |
|---|---|---|
| C16 | Fund Not Utilised = Last Closing Balance − Total Fund Utilised, and it's the prominent metric (13 Nov list, SIB example −₹6,64,700) | **Use this.** That simple formula must not be assumed; the Excel's F2 governs. The CB doc's proposed layout has no Fund Not Utilised column at all (CB doc 10, 14.1) |
| C17 | Total Fund Utilised = CAMS + AMC utilisation (13 Nov list) | **Use this.** The indicator compares closing balance with **CAMS Fund Utilised** only. AMC and CAMS utilisation are exclusive per transaction and appear as separate Excel columns (CB doc 5, 7, 14) |
| C18 | Remove Matches / Does Not Match; the view is informational with no comparison labels (13 Nov list) | **Use this.** A green/red indicator comparing closing balance with CAMS Fund Utilised (CB doc 5). Also differs from 28 Oct's green/orange, which compared against the system balance |
| C19 | The closing balance is the last transaction before 3 PM (26 and 28 Oct) | **Use this.** Last row by sequence for the business date, not tied to 3 PM or any checkpoint; marked "Confirmed" (CB doc 2, rule 2). This also resolves C3 |
| C20 | Matching AMC utilisation is future work (11 and 13 Nov) | **Use this.** The AMC flow already includes matching AMC entries to bank statement entries, producing Matched / Unmatched (CB doc 7.1). The CB doc keeps the phase open |
| C21 | Fund utilisation feeds the Balance Does Not Match flag (28 Oct, 9 Nov) | **Use this.** Balance Does Not Match is a separate statement-data check, unrelated to the utilisation indicator (CB doc 11) |
| C22 | Ops downloads and uploads the AMC file (13 Nov list) | **Use this.** RTR back-office users upload it (CB doc 7.1) |

---

## 10. The 10 things I don't know that would most change the design

Updated after the CB doc. It answered part of the old list:
- Closing balance: answered. It's the last row by sequence for the business date (C19).
- Subscription vs Liability: answered. An account is one or the other, never both.
- AMC/CAMS double counting: the rule is answered (exclusive per transaction), but not the data source.
- The headline comparison: answered. Last Closing Balance vs CAMS Fund Utilised with a green/red indicator. Fund position follows the Excel, not Closing − (CAMS + AMC) (C16–C18).
- Who uploads the AMC file: answered. RTR back-office users (C22).
- Balance Does Not Match: answered that it's separate from utilisation. The logic is still open.

1. **The accounting Excel and the F2 formula.** Every fund-position number depends on it: signs, which columns count, and how Opening Balance, Refund Not Utilised and Excess Credit enter. Until we have it, the prototype shouldn't show a computed fund position (C16).
2. **Who RTR back-office users are, and where the AMC upload lives.** Are they Recon Ops under another name or a separate team with their own login and screens? This decides whether the AMC upload and the Matched/Unmatched view sit in the Ops menu or somewhere else.
3. **What period CAMS Fund Utilised covers.** Is it the business date, cumulative, or since the last sweep? It's compared against a point-in-time balance, so the wrong period makes green and red meaningless.
4. **What Balance Does Not Match compares.** Is it running-balance continuity, opening-to-closing movement, or both? Is it per account or per transaction? It's still one tile with no rule behind it.
5. **Where the data physically lives.** Does the statement table hold a transaction sequence and a refresh timestamp? Where are the CAMS utilisation flag and the AMC matched/unmatched field? If the sequence field is missing, "last row" can't be computed as defined.
6. **The phase of the AMC utilisation upload and its bank-statement matching.** The CB doc keeps this open (16.4). It decides whether a Matched/Unmatched view exists in Phase 1.
7. **Matching precedence, tolerances and cardinality per source pair.** No numbers exist for amount tolerance, the holiday/SIP date window, or which pairs allow one-to-many. This decides the Phase 2 match screens and what "probable" means.
8. **What the legacy system does today for each exception.** Excess Credit now has a definition. CDT unposted, DTD, NIGO, cheque bounce and cross collection still have no definition, owner, ageing start or resolution path.
9. **Volumes and duplicates at upload.** Is it ~200 accounts or 265 statements? How many checkpoints and batches per bank per day? Is the duplicate rule a file name, a hash or a row key (C2)? This drives the bank-indicator view, the upload validation and its error messages.
10. **Roles around the dashboard and tasks.** Fund Accountants and Operations managers are new users. What can they see and do? L1/L2 rights are now answered (assign only; the functional manager creates and reviews). This decides navigation, permissions and task allocation.

Also still open, but less likely to reshape screens: what the in-house AI can run on (old #9). That limits drift mapping and "probable match" to rules-only or AI-assisted.

---

## 11. Answers to the REVIEW.md questions (13 Nov)

You pasted these against questions 2 to 12 of REVIEW.md section 8. Questions 1 (the Excel) and 13 to 15 weren't in the paste. Most answers confirm that the point is still open; they are recorded so nobody treats it as decided.

| Q | Topic | Answer | Tag |
|---|---|---|---|
| 2 | Period CAMS Fund Utilised covers | Based on CAMS records where the report was generated and the flag set. The aggregation period has not been specified | [told by me] still open |
| 3 | Row key and file-level duplicates | No row-level unique key and no file-level duplicate validation has been confirmed | [told by me] still open |
| 4 | Transaction sequence in the table | The rule stands: last row per account and business date, using its running balance. The actual sequence field, and how "last" is found technically, are not confirmed | [told by me] still open |
| 5 | Balance Does Not Match | Only the example exists (incomplete earlier upload, a hand-deleted row, re-upload). The formula and the counting level are not confirmed | [told by me] still open |
| 6 | RTR back-office users | They upload AMC utilisation files **and match** AMC-reported entries to bank statement entries. Separate logins, roles or screens have not been discussed | [told by me] partly new |
| 7 | Phase of AMC utilisation upload | The workflow was discussed, but the stakeholder earlier said "EMT utilisation" would be Phase 2. The phase is unconfirmed | [told by me] still open |
| 8 | Matching rules, both pairs | No confirmed fields, precedence, amount tolerance or date window. **Matching-rule configuration and the reconciliation engine are explicitly Phase 2** | [told by me] decided: Phase 2 |
| 9 | One-to-many, many-to-one | No confirmed scenarios | [told by me] still open |
| 10 | CDT Unposted, DTD, NIGO, cheque bounce, cross collection | Names only. No definitions, owners, ageing start or resolution | [told by me] still open |
| 11 | Second-person approval of hand upload, declared No Transactions, day close | Hand upload by Ops was discussed. Second-person approval, user-declared No Transactions, day close and its sign-off are **not confirmed** | [told by me] still open |
| 12 | L1/L2 rights, No action verification | Supervisors allocate; executives execute. **Answered later on 13 Nov (see section 6):** L1/L2 assign but cannot create; the functional manager (deputy manager, manager or senior manager) creates tasks and reviews the work | [told by me] answered |

What follows from these:
- [your inference] "EMT utilisation" isn't defined anywhere else. I can't tell whether it means AMC utilisation or something different.
- [your inference] Three things the prototype does have no confirmed source: second-person approval of a hand upload, second-person approval of a declared "No transactions", and day close. They were built from your 11 Nov request for Ops approvals with sample data, but the business rule behind them is unconfirmed.
- [your inference] The row-level duplicate rule in section 3 (your 22 Oct instruction) and answer 3 now disagree on how settled it is. Logged as C23.
