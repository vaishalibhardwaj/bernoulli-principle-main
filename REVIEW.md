# CAMS Recon: critique and plan

Written 13 Nov 2026. Critique and plan only. Nothing in the prototype or the PRD was changed.

**Sources, in order of authority:** CONTEXT.md (wins on conflict), the living PRD (rev 88), `Recon_PRD_v1.md`, `Credit_MIS_PRD.md`, `CAMS_Recon_Phase1_PRD_v4.md`, and the prototype code as read today.

**Tags:** [CONTEXT] = in CONTEXT.md. [PRD] = baseline PRDs. [Proto] = what the prototype code does. [Assumption] = mine, unconfirmed. [Proposal: needs ops validation] = my proposal where every source is silent.

---

## The blunt summary

1. **The prototype is a good file-intake and setup tool and almost nothing else.** The stated flow is bank statement → Credit MIS → purchase transactions. The sources define the first leg in detail, the second leg only as setup, and the third not at all: sections 2.4 to 2.7 and 8 of `Recon_PRD_v1.md` are empty headings. The prototype matches that shape. Nobody should call it a reconciliation prototype yet.
2. **The durable parts are the weakest parts.** Your principles say the domain model, rules, audit trail and controls must outlive the UI. In the prototype the UI is polished and those four are stage scenery. Version history is invented at render time. Audit entries are optional per action and carry no before/after. Files don't record which setup or mapping version processed them.
3. **One screen is now wrong by your own ruling.** Closing balances shows "Funds not utilised = closing − paid out". You confirmed the CB doc on 13 Nov, which removes that number.
4. **There are four status vocabularies for one thing** (a statement's state), and only one of them is yours.
5. **Daily Ops has no Credit MIS presence.** Credit MIS exists as setup and as an upload type. There is no screen where Ops sees today's Credit MIS files.
6. **AI discipline is fine in Phase 1 and broken in the parked screens.** Every Phase 1 suggestion goes through a person. The parked Phase 2/3 code auto-accepts on confidence and reports an "AI accepted" count. No suggestion is logged anywhere.

---

## 1. Process model

### 1.1 Flow

| # | Step | Who | Phase | Source |
|---|---|---|---|---|
| S0 | Set up a source: bank account, Credit MIS feed, column mapping (per bank), transaction type mapping, narration tags, cutoffs, pickups | Central Setup, maker then a different checker | 1 | [CONTEXT] [PRD] |
| S1 | Receive the statement by SFTP, email, API, portal bot or hand upload, at one or more checkpoints a day | Scheduler or Ops | 1 | [CONTEXT] |
| S2 | Pick the setup that fits the file. Several setups per bank are allowed; error only if none fits | System | 1 | [CONTEXT] |
| S3 | Validate: mapping, mandatory columns, format, running balance (always on), single-account rule for bulk files. Any failure inserts nothing and is logged | System | 1 | [PRD] [CONTEXT] |
| S4 | Load rows. Duplicates stopped per row by a unique key. Count "new" and "already loaded" | System | 1 | [CONTEXT] |
| S5 | Standardise: credit/debit, transaction type, narration tags. Process payouts before pay-ins | System | 1 | [PRD] [CONTEXT] |
| S6 | Closing balance = running balance of the last row by sequence, per account and business date. Show when the data was last updated | System | 1 | [CONTEXT, CB doc] |
| S7 | Direct Match: bank row to CDT on UTR or instrument number, only for accounts with the toggle on | System | 1 | [PRD] |
| S8 | Receive and load Credit MIS (one aggregator per file; instrument status and failure reason precedence) | Scheduler or Ops | 1 for intake | [PRD] |
| S9 | Match bank statement to Credit MIS | System, then Ops | 2 | Named only. No content |
| S10 | Match Credit MIS to purchase transactions | System, then Ops | 2 | Named only. No content |
| S11 | Manual match by one person, authorised by another | Ops | 2 | [CONTEXT] |
| S12 | Exceptions: Excess Credit, CDT unposted, DTD, NIGO, cheque bounce, cross collection, refunds | Ops | 2 | Names only, except Excess Credit |
| S13 | CAMS generates the utilisation report and flags the records | CAMS system | exists today | [CONTEXT, CB doc] |
| S14 | AMC sweeps; the debit appears on the statement; Ops compares closing balance with CAMS Fund Utilised and follows up | AMC, Ops | 1 for the view | [CONTEXT, CB doc] |
| S15 | AMC utilisation file uploaded; entries matched to bank credits as Matched or Unmatched | RTR back office | open | [CONTEXT, CB doc] |
| S16 | Units allotted only after funds are realised | Posting | outside Recon | [CONTEXT] [PRD] |
| S17 | Daily tasks generated from KRAs, done by executives, allocated by supervisors | Ops, L1/L2 | 1 | [CONTEXT] |

**Blunt note:** S9 to S12 are the product's reason to exist and have no rules on paper. Everything in 1.3 for those steps is a proposal.

### 1.2 State machines

**A. Configuration record** (bank setup, Credit MIS setup, mapping, type map, narration tag, cutoff) [CONTEXT] [PRD]

`Draft → Pending approval → Active (version n)`; `Pending → Sent back → Draft`; `Active → Pending (edit creates version n+1; version n stays live until approval)`; `Active → Inactive`.
Guard: approver's login ID ≠ creator's login ID. Approver can add remarks but not edit.

**B. Statement for an account, business date and checkpoint** [CONTEXT]

`Not Uploaded → Pending → Uploaded | No Transactions | Failed`; `Failed → Pending` (reprocess, refetch, or hand upload).
"Not received yet" is not a failure. No Transactions means the file arrived with zero rows, never "missing".
[Proposal: needs ops validation] A "No Transactions" declared by a person, where no file arrived, needs a second person. The prototype already does this; no source asks for it.

**C. One intake attempt** (a file arriving once) [PRD] [CONTEXT]

`Received → Setup found → Validated → Loaded (new rows, skipped rows)`; or `Rejected (reason)` at any step; or `Held (layout changed) → Loaded` once a mapping change is approved.
A later successful attempt voids earlier error rows for the same statement. Upload status and processing status are shown separately.

**D. Mapping change proposal** [CONTEXT]

`Detected → Proposed (old, new, confidence) → Submitted by maker → Approved by checker → new mapping version → held rows load`; or `Rejected`; or `Unresolved → product report`.

**E. Balance mismatch** [CONTEXT]

`Open (two rows where the running balance breaks) → Corrected statement requested → Corrected statement loaded → Resolved`. Refetch is never offered. What counts as a mismatch is undefined (CB doc 11).

**F. Daily task** [CONTEXT]

`Generated from KRA → Due → Done | No action (reason) → Verified by supervisor`. Dismissing is never proof the work was done.

**G. Transaction** (Phase 2) [Proposal: needs ops validation]

`Loaded → Direct-matched | Unmatched → Suggested → Matched (pending authorisation) → Authorised → Realised`; or `→ Exception (type) → Resolved`. The only Phase 1 hook this needs is one status field and the unique key on the statement row.

**H. Utilisation class per credit** [CONTEXT, CB doc]

Exactly one of: AMC Utilised – Matched, AMC Utilised – Unmatched, CAMS Utilised, CAMS Not Utilised, Excess Credit. Refund Utilised is a label on top, never added again.

### 1.3 Rules catalogue

| ID | Rule | Cardinality | Status |
|---|---|---|---|
| R1 | Direct Match: bank UTR/instrument number = CDT, per-account toggle | 1:1 | [PRD] confirmed |
| R2 | Setup selection for Credit MIS: file structure → header mapping → data mapping → file name pattern | n/a | [PRD] confirmed |
| R3 | Instrument status and failure reason: the file's value wins over the setup's value | n/a | [PRD] [CONTEXT] confirmed |
| R4 | Row-level duplicate key at insert | n/a | [CONTEXT]; the key per bank is unknown |
| R5 | Processing order: IDCW → redemption → switch → purchase | n/a | [CONTEXT] confirmed |
| R6 | Closing balance = last row by sequence | n/a | [CONTEXT, CB doc] confirmed |
| R7 | Indicator: closing < CAMS utilised is green; > is red; equal shows nothing | n/a | [CONTEXT, CB doc] confirmed |
| R8 | A credit is AMC-utilised or CAMS-utilised, never both | n/a | [CONTEXT, CB doc] confirmed |
| R9 | AMC utilisation entry ↔ bank credit | not stated | [CONTEXT, CB doc]; key and phase open |
| R10 | Cheques never match on cheque number alone; use bank, account, amount and transaction identifiers | 1:1 | [CONTEXT] |
| R11 | Never auto-confirm on amount or name alone | all | [CONTEXT] |
| R12 | Probable matches are shown separately as suggestions | all | [CONTEXT] |
| R13 | Date comparison allows for weekends, holidays and delayed SIP | all | [CONTEXT]; no number of days |
| R14 | Cascade: UTR exact → instrument number + amount → fuzzy narration "with tolerance windows" | 1:1 | [PRD v4], author unknown, not confirmed by you |
| R15 | One credit covering several schemes splits into a parent row and child rows | 1:N | [PRD v4], same caveat |
| R16 | Fund position formula | n/a | Pending the Excel, cell F2 |
| R17 | Balance Does Not Match | n/a | Pending |

**Where every source is silent** [Proposal: needs ops validation]

| Topic | Proposal | Why this and not more |
|---|---|---|
| Precedence | Treat R14's order as the starting hypothesis. Store each step as a numbered, versioned rule row, so Ops can reorder without a release | It's the only order on paper |
| Amount tolerance | Zero for any automatic match. Any non-zero tolerance only produces a suggestion | Follows R11; no source gives a number |
| Date window | A number of business days per source pair, counted on the holiday calendar. Ops supplies the numbers | Follows R13; I won't invent the numbers |
| One-to-many | Allow one bank credit ↔ many Credit MIS rows only where the feed is from an aggregator that settles in bulk | Pool accounts and aggregator feeds exist [PRD]; bulk settlement is my assumption |
| Many-to-one | Allow many bank credits ↔ one purchase only as a manual match with authorisation | You said manual matching is primary; no automatic rule is described |
| Many-to-many | Manual only | Same |
| Exceptions | Do not design until Ops gives, per type: definition, owner, when the ageing clock starts, and how it closes | Only Excess Credit is defined |

### 1.4 Control points

| ID | Control | Source |
|---|---|---|
| K1 | Creator can never approve their own record, checked on login ID | [CONTEXT] |
| K2 | Approver cannot edit; remarks only | [CONTEXT] [PRD] |
| K3 | A failed validation inserts nothing | [PRD] |
| K4 | Running balance validation is always on | [CONTEXT] |
| K5 | Row-level unique key | [CONTEXT] |
| K6 | An AI-proposed mapping is never activated without maker and checker | [CONTEXT] |
| K7 | "No action" goes to a supervisor | [CONTEXT] |
| K8 | Dismissing an alert is not proof of work | [CONTEXT] |
| K9 | CAPTCHA is never bypassed | [CONTEXT] |
| K10 | Balance mismatch is fixed by a corrected bank statement, not by editing | [CONTEXT] |
| K11 | A manual match needs a second person | [CONTEXT], Phase 2 |
| K12 | Units only after realisation | [CONTEXT], outside Recon |
| K13 | Subscription and Liability never shown together; an account is one or the other | [CONTEXT] |
| K14 | Hand upload needs a second person | [Proto] only. [Assumption] No source |
| K15 | Day close needs a second person | [Proto] only. [Assumption] No source |

### 1.5 Data and audit model

**Durable entities**

| Entity | Key facts |
|---|---|
| Source | Bank or aggregator |
| Account | Bank, number, AMC, category (Subscription or Liability, exclusive), scheme or common, priority, direct match flag |
| Config version | Immutable. Entity, version number, effective from/to, full payload, maker, checker. Editing creates a new version |
| File receipt | Channel, name, content hash, received at, received by (scheduler or login ID) |
| Intake attempt | File receipt, **the setup version and mapping version used**, outcome, reason, rows new, rows skipped |
| Statement row | Unique key, sequence, dates, credit, debit, running balance, narration, intake attempt, match status (Phase 2 hook) |
| Approval request | Entity, version before, version after, maker, checker, decision, remarks, timestamps |
| Task template / task | KRA, owner, due time, day; one task per day generated from the template |
| Utilisation record | Credit, class (state H), source |
| AI suggestion | Feature, input reference, model version, output, confidence, shown or shadow, human decision, decided by, decided at |
| Audit event | See below |

**Audit event, append-only.** Fields: id, time, actor (login ID, or "scheduler", or "model:version"), action, entity type and id, version before, version after, reason, correlation id (ties an upload to its approval and its load).
Rules: no update or delete; every state change in 1.2 writes exactly one event; a denied attempt also writes one. The closing balance is derived from statement rows and is not stored as its own truth.

**What the prototype does instead** [Proto]
- `act()` overwrites the record in place. The audit entry is an optional argument, so an action can change state with no event.
- Events hold `from` and `to` labels, not the before and after values.
- `VersionsDrawer` fabricates versions 1 and 2 from the current record at render time. An approved layout change appends the text "·v2" to a fingerprint string.
- A file has no link to the setup or mapping version that processed it. Replaying or explaining an old load is impossible in this model.

For a clickable prototype that's survivable. As the reference for a 25-year system it shows the wrong thing.

---

## 2. Structural verdict

**Setup side: right.** It's organised by source (a bank or an aggregator holds its accounts, columns, type map and tags). That matches how formats change and how the six-person team works. Keep it.

**Ops side: wrong.** It's a list of screens, not a flow.

| Group today | Items | Problem |
|---|---|---|
| Home | Today, Approvals, Closing balances, File pickups, No-action review, Dashboard, Team tasks | Seven unrelated things. "Home" means nothing |
| Daily cycle | Upload files, Bank files | Bank statements only. No Credit MIS. Two ways to upload |
| Review | History | Fine |

Specific faults:
- **Three approval surfaces.** Approvals, the approve tab in Setup To do, and approve buttons inside the Bank files drawer. One decision can be taken in three places with three different amounts of evidence.
- **Two upload paths.** "Upload files" and "Upload a file by hand" inside Bank files. The second is still labelled as an exception; you ruled on 11 and 13 Nov that hand upload is a normal daily route (C6).
- **Two "Do this next" cards on Today.**
- **Column mapping is a menu and also a toggle inside each source.** You decided on the toggle (11 Nov). The menu survives only because of the "don't remove menus" rule.
- **Bank files is five screens in one** (578 lines): today's files, emails, bank connections, layout drift, learned timings.

**Proposed restructure.** It regroups and renames; it removes no screen. It needs your go-ahead because of the "don't remove menus" rule.

| Group | Screens | Process steps |
|---|---|---|
| Today | Today, Approvals | S17, all K controls |
| Files in | Bank statements (today's Bank files), Credit MIS files (new), Upload files, File pickups | S1 to S5, S8 |
| *Match* (Phase 2 slot) | *Match payments, Problem cases* | S9 to S12 |
| Money position | Closing balances, Dashboard | S6, S13, S14 |
| Team | Team tasks, No-action review | S17, K7 |
| History | History | audit |

The Phase 2 slot is the single hook: an empty position in the group order. Nothing else goes in now.

---

## 3. Two-way traceability

### 3.1 Process → screen

| Step / state / rule / control | Screen | Verdict |
|---|---|---|
| S0 setup | Bank statements, Credit MIS, Column mapping, Transaction type mapping, Narration tags, Cutoff times | Covered |
| State A config lifecycle | Wizards, Setup To do, Approvals | Covered; versions are fake |
| S1 receive | Bank files, File pickups, Upload files | Covered |
| S2 pick setup | Bank files (rejected email, "no setup") | Partly. No view of which setup was picked or why none fit |
| S3 validate | Bank files drawer | Partly. No per-check failure list for mapping failures |
| S4 load, row duplicates | Bank files | **Conflict.** Shows a file-level "Duplicate / identical content hash" status. Your rule is row-level with two counters (C2) |
| State B statement status | Bank files, checkpoints, Today | **Conflict.** Four vocabularies (see 4) |
| State C upload vs processing status | Upload files | NOT COVERED as two separate statuses |
| State D mapping proposal | Bank files drawer, Mapping editor, Approvals | Covered |
| State E balance mismatch | Bank files drawer | Partly. Logic undefined |
| S5 standardise | Setup screens only | NOT COVERED on the Ops side (no view of how a row was tagged) |
| S6 closing balance | Closing balances | **Wrong.** See 4 |
| S7 Direct Match | Setup toggle only | NOT COVERED. No result is visible anywhere |
| S8 Credit MIS intake | Upload files (type) | NOT COVERED for monitoring |
| S9 to S12 | Parked screens | Phase 2 |
| S13, S14 utilisation indicator | Closing balances | NOT COVERED (no CAMS Fund Utilised, no indicator, no updated-at) |
| S15 AMC utilisation upload | none | NOT COVERED; phase open |
| S17 tasks from KRAs | Today, Team tasks | Partly. Templates exist; KRA and supervisor allocation don't |
| K1, K2 | All approval paths | Covered |
| K6 | Mapping proposal flow | Covered |
| K7 | No-action review | Covered |
| K13 Subscription/Liability split | none | NOT COVERED |
| Audit | History | Partly. A flat log. No per-record history |
| AI suggestion log | none | NOT COVERED |

### 3.2 Screen → process

| Screen | Serves | Verdict |
|---|---|---|
| Today | S17 | Purpose |
| Approvals | K1, K2, states A and D | Purpose |
| Closing balances | S6, S14 | Purpose |
| Bank checkpoints (inside Closing balances / Bank files) | State B | Purpose |
| File pickups (Ops and Setup) | S1 | Purpose |
| No-action review | K7 | Purpose |
| Dashboard (Team overview) | Phase 1 metrics list | Purpose, but shows Phase 2 metrics: "Auto-match rate by bank", "Payments matched automatically today", "Ageing watch" |
| Team tasks | S17 | Purpose |
| Upload files | S1, S8 | Purpose |
| Bank files | S1 to S4, states B to E | Purpose |
| History | audit | Purpose |
| Setup To do | State A | Purpose |
| Bank statements, Credit MIS, Column mapping, Transaction type mapping, Narration tags, Cutoff times | S0 | Purpose |
| Users, Roles & Access | K1 | Purpose. Conflict: invite, temporary password and OTP flows, although you said users come from the ID management sync |
| Match payments, Liability match, Problem cases, Release money, Refunds, Read PDFs & emails | S9 to S12 | Phase 2/3. Hidden from menus but still reachable by URL |
| Brokerage, Posting, SIP, CRMS, Support, Purchase, MIS placeholders | none in Recon | NO PURPOSE for Recon. They show the platform shell. Kept under "don't remove menus" |
| `features/dashboard/Dashboard.js` | none | NO PURPOSE. Nothing imports it |
| "Chase bank RM" button in Bank files | none | NO PURPOSE. [Assumption] No source asks for it |
| Day close approval | K15 | NO PURPOSE until a source asks for it |

---

## 4. Per-screen verdict

| Screen | Verdict | Severity | Why |
|---|---|---|---|
| Closing balances | **REBUILD** | Blocker | Shows a number you've ruled out. Needs the CB doc layout: Last Closing Balance, CAMS Fund Utilised, indicator, last transaction date and time, Last Statement Updated At, Subscription/Liability switch, single date. No fund position until the Excel arrives |
| Bank files | **MODIFY** | Blocker | Status vocabulary is not yours. File-level duplicate status contradicts the row-level rule. Hand upload labelled an exception. Too much in one screen |
| History | **REBUILD** | Major | A flat log can't answer "what changed on this record, who, when". Needs per-record history with before and after |
| Approvals | **MODIFY** | Major | Good evidence block for layout changes and Ops checks. Other kinds show a title and a line. Every kind needs before/after, maker and time. It should be the one place decisions are taken |
| Version history drawer | **REBUILD** | Major | Invented data presented as an immutable record |
| Dashboard | **REBUILD** | Major | Shows Phase 2 metrics today. Needs your 13 Nov shape: one dashboard, Phase 1 metrics, Subscription/Liability switch. Its numbers must be checked against the "don't invent" rule |
| Upload files | **MODIFY** | Major | Needs bank, account and business date together, separate upload and processing status, and a defined duplicate check. Credit MIS monitoring is missing |
| Today | **MODIFY** | Major | Two "next" cards. Tasks aren't generated from KRAs |
| Team tasks | **MODIFY** | Major | Templates but no KRA, no supervisor-only allocation view. L1/L2 rights unconfirmed |
| Users | **MODIFY** | Major | Invite/password/OTP conflicts with the ID sync. Inactivity is 90 days in code against 10, 60 and 7 in C13 |
| Bank checkpoints | KEEP | Minor | Closest to your status list. "Processed" should read "Uploaded" |
| File pickups | KEEP | Minor | Recently rebuilt |
| No-action review | KEEP | Minor | |
| Setup To do | KEEP | Minor | Fold its approve tab into Approvals as a filter |
| Bank statements, Credit MIS (landing, wizard, profile) | KEEP | Minor | Account category (Subscription/Liability) must be mandatory and exclusive; it drives the dashboard. "No feed" option not built. Aggregator list conflict C14 |
| Column mapping editor | KEEP | Minor | The best screen in the prototype and the natural AI seam |
| Transaction type mapping, Narration tags, Cutoff times | KEEP | Minor | Cutoff source (scheme master or recon-side) still undecided |
| Roles & Access | KEEP | Minor | "Access Approver" and "Auditor" roles have no source [Assumption] |
| Parked Phase 2/3 screens | **PARK** | Blocker if shown | Invented volumes and rates in the seed (`412880 matches`, `61.2%`). Auto-accept on confidence. Don't demo them. Block the URLs, don't delete |
| `Dashboard.js` | REMOVE | Minor | Dead code |

**The four status vocabularies** (state B):

| Where | Words |
|---|---|
| Your rule [CONTEXT] | Not Uploaded, No Transactions, Uploaded, Pending, Failed |
| Bank checkpoints [Proto] | Not uploaded, No transactions, Processed, Pending, Failed |
| Bank files [Proto] | Late, Missing, Drift, Drift pending, Check failed, Retrying, Unknown, Duplicate, Discarded, Loaded, Nil |
| Bank files, plain mode [Proto] | A third set of plain phrases |

Fix: one status (yours) plus a separate reason. "Layout changed" is a reason for Pending, not a status.

---

## 5. Missing screens and states

| Missing | What it must show | Phase |
|---|---|---|
| **Credit MIS files (daily)** | Per aggregator: expected, received, loaded, failed, rows new and skipped. Same statuses as bank statements | 1 |
| **Record history** | For any setup, mapping or file: every version, a field-by-field difference, maker, checker, time, reason. Opened from the record, not from a global log | 1 |
| **Approval review, standard block** | For every kind: what changed (before/after), who, when, what it affects (which accounts and files), sample rows where relevant | 1 |
| **Mapping failure state** | Which mandatory column is missing or blank, on which row, with the raw row beside the expected layout, and one next step (propose a mapping change, or ask the bank) | 1 |
| **Partial load state** | A statement loaded in batches: rows so far, last row time, "more expected". A file where some accounts loaded and others failed | 1 |
| **Upload vs processing** | Two separate statuses on one upload: "file received" and "rows loaded" | 1 |
| **Stale balance state** | Closing balance with an old "last updated" time, visibly different from a fresh one | 1 |
| **Indicator empty states** | No CAMS utilisation yet; no statement yet; equal amounts (no indicator) | 1 |
| **No setup fits** | A file arrived and no setup matched: what was tried and why each failed | 1 |
| **Subscription/Liability switch** | Top of dashboard and closing balances | 1 |
| **Supervisor allocation** | KRAs to people, visible to L1/L2 only | 1, once rights are confirmed |
| **AMC utilisation upload and Matched/Unmatched view** | Per the CB doc | Open |
| **AI suggestion log** | Suggestion, confidence, model version, decision, who | 1 as data; a screen can wait |
| **Exception workbench** | Queue by type, owner, age, evidence, resolution with second-person closure | 2. Hook now: an exception type list in configuration and the row status field. Don't build the screen; five of six types are undefined |
| **Direct Match result** | Count and list of rows matched to CDT per account | 2 as a screen. Hook now: the match status field on the statement row |

---

## 6. AI opportunity map

**Constraint first:** the model is in-house and locally hosted, and I don't know what it can do [CONTEXT]. So every candidate below must also work with rules alone, and the model starts as a challenger in shadow mode.

### What's in the prototype today [Proto]

| Feature | Really AI? | Follows "propose, human decides"? |
|---|---|---|
| Header row and start column detection (Mapping editor) | Heuristic | Yes. The user confirms |
| Column-to-field proposal with confidence | Name and synonym rules | Yes |
| Duplicate-key suggestion from a sample | Uniqueness test | Yes |
| Layout drift proposal (old, proposed, confidence) | Presented as AI | Yes: maker submits, checker approves. **Weak point:** the maker can submit from the file drawer in one click without opening the proposal. The confidence figures and reasons are invented demo text |
| Ambiguous date guess | Rule | Yes |
| Learned upload time, late alert | Median of past times | Yes. It only alerts |
| No-action review hint ("review this event's definition") | Count | Yes |
| **Document reading with `auto: 0.95` threshold** (parked, Phase 3) | Presented as AI | **No.** Values above 95% confidence are accepted without a person |
| **"AI accepted" count on the manager data** (parked) | n/a | **No.** It reports AI acceptance as a metric, and the figure is invented |
| **Rule drafts moving from "suggest" to "auto"** (parked, Phase 2) | Rules | Acceptable only if a rule change is a versioned, approved config change. The prototype doesn't show that |

**Nothing logs a suggestion or the decision taken on it.** That is the main gap against your principles.

### Candidates

| # | Candidate | Value | Risk | Human in the loop | Shadow plan | Phase 1 hook |
|---|---|---|---|---|---|---|
| A1 | Mapping proposal when a bank's layout changes or a new format arrives | High. 15 to 18 bank formats; a format change stops a bank's files | Low. Wrong proposal is caught by maker and checker; rows are held, not loaded | Maker must open and confirm each changed field; checker approves; new mapping version | Rules propose; the model proposes in parallel; log both and which one the maker accepted | Suggestion log; mapping versions |
| A2 | Narration parsing: propose narration tags, and pull UTR or scheme code out of narration text | High later. Feeds matching and Excess Credit | Medium. A wrong tag misclassifies money | Proposed tags go through the normal tag maker-checker. Nothing is tagged live by the model | Shadow only in Phase 1: run on loaded rows, store output, compare with the tags Setup actually creates | Suggestion log; row id on every suggestion |
| A3 | Late or missing file prediction | Medium | Low | Alert only | Not needed. It's statistics, already there. Don't call it AI | None |
| A4 | Plain-English reason and next step for a failed file | Medium for low-skill staff | Low to medium. A wrong explanation misleads | Text shown beside the deterministic error code, never instead of it | Log shown text and whether the user followed the step | Reason codes on every failure |
| A5 | Probable match suggestions | High | High | Suggest only; maker confirms; checker authorises | Phase 2. Needs rules first | Row status field; suggestion log |
| A6 | Reading PDFs and email bodies | Unknown | High | Every value confirmed by a person | Phase 3 | None now |
| A7 | Scheme identification for common accounts (CAMS Not Utilised vs Excess Credit) | High | High. It sits next to accounting | Suggest only | Not before the classification source is known | None now |

### Recommendation for Phase 1

1. **Ship A1**, with rules as the working engine and the model in shadow until its acceptance rate is measured.
2. **Run A2 in shadow only.** No user sees it. It produces the labelled data Phase 2 matching will need.
3. **Build the seam once:** the suggestion log (inputs, model version, confidence, shown or shadow, decision, decider) and a switch per feature.

Everything else waits. A3 stays as plain statistics.

---

## 7. Staged plan, riskiest first

| Stage | What | Why now | Depends on |
|---|---|---|---|
| 0 | Get answers: the Excel (F2), what period CAMS Fund Utilised covers, the duplicate key, who RTR back office are, L1/L2 rights | Stages 2 and 5 can't be right without them | Ops |
| 1 | **One statement lifecycle.** A single status set and reason list used by Bank files, checkpoints, Today and Upload. Row-level duplicate counters. Hand upload as a normal route. Upload status separate from processing status | Every other screen reads this state. It's the largest conflict with your rules | Duplicate key (stage 0) for the wording only |
| 2 | **Closing balances per the CB doc.** Columns, indicator, updated-at, stale state, Subscription/Liability switch, single date. No fund position | A screen you've ruled wrong is live in the prototype | Stage 1 (updated-at); account category mandatory in setup |
| 3 | **Audit and version spine.** Every action writes an event with before/after. Real versions. Files record the setup and mapping version used. Per-record history. Standard approval review block; one place to approve | It's the durable core, and today it's faked. Doing it after more screens means redoing them | None. Can run beside stage 2 |
| 4 | **Credit MIS daily files** and the mapping-failure, partial-load and no-setup states | Completes the second leg of the flow for Phase 1 | Stages 1 and 3 |
| 5 | **Tasks from KRAs** and the supervisor allocation view. Remove the duplicate "next" card | Depends on an unanswered question | L1/L2 rights (stage 0) |
| 6 | **Ops navigation regroup** and the dashboard in your 13 Nov shape | Cheap once the screens are settled; needs your approval on menus | Stages 1, 2, 4 |
| 7 | **AI seam:** suggestion log, A1 with forced review of each field, A2 in shadow | Needs versions and audit to mean anything | Stage 3 |
| 8 | Park properly: block parked URLs, strip invented figures from parked seeds, delete dead code | Stops an accidental demo of things that break your rules | None |

Carried over from before this review: the browser check of the 11 Nov changes and the PRD update for them are still not done.

---

## 8. Open questions and low-confidence areas

### For Ops

Answers received 13 Nov are recorded in CONTEXT.md section 11. Status of each question:

| # | Question | Status after your answers |
|---|---|---|
| 1 | The accounting Excel, cell F2 | Not answered |
| 2 | Period CAMS Fund Utilised covers | Open. Not specified |
| 3 | Row key per bank; file-level duplicate check | Open. Neither is confirmed |
| 4 | Transaction sequence field | Open. Rule confirmed, field not |
| 5 | What makes a balance not match | Open. Example only |
| 6 | RTR back-office users | Partly answered: they upload **and match** AMC entries. Logins and screens open |
| 7 | Phase of AMC utilisation upload | Open. Earlier remark that "EMT utilisation" is Phase 2 |
| 8 | Matching fields, order, tolerances | **Decided: Phase 2.** No rules exist yet |
| 9 | One-to-many and many-to-one cases | Open. Phase 2 |
| 10 | Exception definitions | Open. Phase 2 |
| 11 | Second-person approval of hand upload, declared No Transactions; day close | Open. None confirmed |
| 12 | L1/L2 rights; who verifies No action | **Answered.** L1/L2 assign tasks but cannot create them. The functional manager (deputy manager, manager or senior manager) creates tasks and reviews the work |
| 13 | What Fund Accountants and Operations managers may do | Not answered |
| 14 | Users only from the ID sync | Not answered |
| 15 | Volumes | Not answered |

**What the answers change in this review**

- **Section 1.3 proposals stay proposals and move fully to Phase 2.** Nothing about precedence, tolerance or cardinality should appear in the Phase 1 prototype, not even as configuration screens. The Phase 1 hook stays as one status field on the statement row.
- **Controls K14 and K15 (second person on hand upload and day close) and the declared "No Transactions" approval remain [Assumption].** The prototype shows them as if they were rules. Options: keep them visibly marked as unconfirmed, or take them out of Approvals until Ops confirms. I recommend keeping them, because removing a control is harder to notice than questioning one, but that's your call.
- **Stage 1 can still start**, with one limit: the duplicate wording. With no confirmed key (C23), the screen should show "new rows" and "already loaded" counts without claiming how a duplicate is detected, and should drop the file-level "identical content hash" status.
- **Stage 2 can start for the layout** (columns, indicator, updated-at, stale state). The indicator's meaning stays provisional until question 2 is answered, and the screen should say which period the CAMS figure covers once known. No Balance Does Not Match logic can be built; keep the tile as a count from seeded data only.
- **Stage 5 (KRA tasks) is unblocked.** What it now has to do:
  - Take "add a task" away from Level 2. Level 1 and Level 2 keep assign (who does it) and view.
  - Give the functional manager the create-task right and the review of task work. This reverses the 9 Nov rule that the functional manager only has dashboards and approvals (C24 in CONTEXT.md).
  - Route "No action" review to the functional manager [Assumption: the transcript says they review task work, not No action by name].
  - Still unclear: whether an executive sees only their own tasks.
- **The AMC utilisation upload stays out of Phase 1** until question 7 is answered. Don't build the Matched/Unmatched view.
- **Still needed most:** the Excel (question 1) and the period (question 2).

### The three things I'm least confident about

1. **The matching model in 1.2 G and 1.3.** It rests on a v4 section with no known author and on my proposals. It's the heart of the product and could be wrong in structure, not only in numbers.
2. **Whether the durable model in 1.5 fits the legacy database.** I've designed it as if we own the tables. If statement rows, flags and versions live in 25-year-old tables we can only read, the audit and version spine has to be built beside them, and stage 3 changes shape.
3. **Whether any AI belongs in Phase 1.** A1 works with rules alone and I don't know what the in-house model can do. It may be that Phase 1 should ship only the suggestion log and shadow runs, and no visible AI feature.
