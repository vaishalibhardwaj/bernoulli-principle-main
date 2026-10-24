# CAMS Reconciliation: From Modernised Legacy to World Class

**What this is:** A review of the current redesign (Recon PRD v1, Credit MIS PRD, Phase 1 PRD v4, and the prototype) against modern reconciliation products (Stripe, BlackLine, Modern Treasury, Duco, HighRadius, Ledge, Razorpay Recon). It sets out what to change and how.
**Date:** 21 Oct 2026

---

## 0. The short version

The current PRDs **modernise the screens of the 25-year-old system, but keep its operating model**. Every legacy concept, like file start row, separator, running-balance cleanup character, Direct Match toggle and per-bank tables, has been carried over one-to-one into a cleaner wizard. That will make it nicer to use. It will not make it world class.

World-class recon tools differ in five ways:

| # | Legacy mindset (what the PRDs do today) | World-class mindset |
|---|---|---|
| 1 | **Configure files.** The user tells the system the row, column, separator and format. | **Understand data.** The system fingerprints the file, proposes the mapping, and the user only confirms what it's unsure about. |
| 2 | **Match on one key.** A "Direct Match" toggle on UTR, then a batch match cascade. | **Match engine with rules, tolerances, 1:N / N:1 / N:M, confidence scores, and AI suggestions for the residue.** |
| 3 | **Exceptions are tables** (T_Refund, Reverse Feed temp table, "eyeball screen"). | **Exceptions are cases**, each with an owner, a reason code, an SLA clock, ₹ at risk, a suggested fix and an audit trail. |
| 4 | **Success = configuration speed** (10-min onboarding, 5-min approval). | **Success = recon outcomes**: auto-match %, time-to-realisation, ageing, delayed-interest ₹ paid, allotments held. |
| 5 | **Every change is equal.** The same maker–checker applies to everything. | **Controls are risk-based**: the approver sees a simulation of a rule's impact, low-risk changes are fast-tracked, and every config is versioned with rollback. |

> **The single biggest gap:** Phase 1 is scoped entirely around configuration, and the matching engine, exceptions, refunds and reporting are "Phase 2+". But that's where back-office users spend most of their manual effort. End Close, a company founded by a former Modern Treasury reconciliation lead, puts it at **"99% of the manual work"** in exception handling. A beautifully governed config layer that feeds a legacy-style matcher will not move the needle for users. **Design the target matching and exception experience now**, even if you build it later, because it changes what Phase 1 must capture.

---

## 1. What the market does (research summary)

| Product | What matters for CAMS |
|---|---|
| **Stripe**: Bank Reconciliation, Payout Reconciliation reports | Ingests your bank statement and **auto-matches payouts to deposits**, with per-payout status in a dashboard. Breaks lump-sum settlements into the charges, fees and refunds inside them. *Lesson: a settlement credit is a bundle. Decompose it before you match it.* This applies directly to payment aggregator (PA) settlements from Razorpay and CAMSPay. |
| **BlackLine**: Transaction Matching, plus **Verity Prepare** (GA July 2026) | Configurable rules for **1:1, 1:N and N:M matching**, with exceptions routed through a workflow. Verity is a multi-agent AI that matches transactions, isolates anomalies, writes variance explanations and assembles audit-ready packages. **Every recommendation shows its reasoning, a confidence score and an audit trail, and a human signs off.** |
| **Modern Treasury**: Reconciliation | The core engine is **deterministic** and only matches with certainty. AI then (a) **suggests matches** for the residue and (b) **suggests new rules** by mining unmatched items. **Rule Preview** shows "new matches vs lost matches" before a rule goes live. Rules are AND/OR conditions over field, operator and value, with one-to-one and many-to-one strategies and *partially reconciled* states. |
| **Duco** | **No-code "Natural Rule Language"**, plus (2025) an **Agentic Rule Builder**: you describe a rule in English and agents draft, validate and show it for review. It has a **Transform & Prepare** normalisation layer (buy/sell, pay/receive), and AI document extraction (IDP) for PDFs and images. Its stated build time is days, not months. |
| **HighRadius**: Cash Application | Pulls remittance data from **email, EDI, portals and PDFs** into one place, with OCR on remittances. Reports a **90–97% straight-through hit rate**, so staff "only work the exceptions". |
| **Ledge** | **Continuous reconciliation**: breaks are flagged as they happen against live bank and processor data, not at day end. |
| **Razorpay Recon**: India | AI matching plus **discrepancy trend analytics**. Recko, an Indian recon startup, was acquired by Stripe in 2021, according to a CB Insights profile not confirmed against a primary source. |

*Note: match-rate figures are vendor- or customer-reported, not independently audited. Treat them as direction, not benchmarks.*

---

## 2. Recommendations, by area

Each item gives the **problem in the current PRD/prototype**, **what to do instead**, and **priority**: **P0** (change Phase 1 scope or data model now), **P1** (design now, build next), **P2** (later).

### 2.1 Reframe goals and success metrics: **P0**

**Problem.** PRD v4 §2.3 measures onboarding time, auto-mapping %, approval turnaround, user onboarding time and audit completeness. None of these is a reconciliation outcome. "10 minutes to onboard" also has no baseline.

**Do this.** Adopt a north-star metric and an outcomes scorecard, and baseline them from the legacy system before go-live:

| Metric | Why it matters | Indicative target |
|---|---|---|
| **Straight-through match rate** (credits auto-matched with no human touch) | The core measure of automation | ≥ 90% within 6 months; HighRadius and BlackLine customers report 90–97% |
| **Time to realisation**: credit lands in bank → marked realised → allotment cleared | Directly drives SEBI compliance and investor experience | Same day / intraday for API banks |
| **Unreconciled ageing** (count and ₹ by bucket: 0–1, 2–3, 4–5, >5 days) | Unreconciled items turn into refunds and delayed interest | Nothing > T+3 without an owner |
| **Delayed-interest ₹ paid** on refunds | A hard cost the system should prevent | Trending down month on month |
| **Manual touches per 1,000 credits** | The honest measure of manual effort | Halve vs baseline |
| **Missing / late statement incidents** | Upstream data health | 0 undetected |
| **Exception first-time-right %** (resolved without rework or rejection) | Quality of the resolution workflow | ≥ 95% |

Show these on the **Ops Command Centre** (§2.8). Keep the config metrics, but as secondary.

### 2.2 Ingestion: stop configuring files and start *understanding* them: **P0/P1**

**Problems.**
- Users hand-enter File Start Row, Start Column, Separator, File Type and Header Position (Credit MIS takes "Row,Column" as text). The prototype has already removed File Type and Separator from the bank wizard, so the PRD and prototype disagree.
- "Manual download from internet banking → upload to SFTP" is still a primary channel.
- The design assumes the file format never changes after onboarding. When a bank silently changes its format, the legacy experience is a failed load the next morning.

**Do this.**
1. **File fingerprinting.** Hash each file's *structure* (header tokens, column count, delimiter, date pattern, preamble lines) and store it with the approved mapping. On every new file:
   - **Same fingerprint** → process automatically.
   - **Drifted fingerprint** (new or renamed column) → raise a **"Format drift" case**. Pre-propose a mapping diff and send it for one-click maker approval. Don't just fail the load.
   - **Unknown** → route to onboarding.
2. **Make detection the default and fields the override.** Show detected values as read-only facts ("Header found on row 12 · comma-delimited · dates DD/MM/YYYY") with an "Adjust" link. Don't show them as form fields to fill in.
3. **Take files exactly as banks send them, and adapt on our side.** Banks and aggregators will not change their formats, channels or references for us. So every channel (portal bot, SFTP, email, the API a bank *already* offers) feeds one **adapter layer** that turns whatever arrives into the canonical record. New quirks are absorbed by a new adapter version or transform step, never by asking the bank. **Track volume and failure rate per channel**, so the team knows which adapters need hardening.
4. **Build our own deterministic match keys from what banks already give us.** Without asking banks for virtual accounts or new references, CAMS can still make most matches certain:
   - **Narration mining:** pull UTR, application number, PAN, folio and IFSC out of free-text narrations (§2.3.3).
   - **Investor-bank fingerprint:** a table learned from every past confirmed match, mapping remitter account number, IFSC and name to investor/PAN. A credit from a fingerprinted account is near-certain, even with a messy narration.
   - **TPV/remitter data**, which is already imported (Stage 2, step 5), as a second key.
   - **Composite keys** (amount + value date ± n + remitter-name similarity) for whatever is left, scored by confidence.

   This replaces the earlier suggestion to push banks for e-collect virtual accounts.
5. **Expected-file calendar.** Each setup declares *when* files are expected ("HDFC xxx2347 by 09:30 on business days"). Missing or late files raise alerts. Legacy systems rarely detect a statement that *didn't* arrive.
6. **Statement completeness checks**, beyond the running-balance check already specified:
   - opening balance of day N = closing balance of day N-1
   - no gaps in statement sequence numbers or dates
   - duplicate-file detection by content hash, not filename
   - running balance validated automatically, not as a toggle someone can forget
7. **PDF and unstructured inputs.** Some Credit MIS and remittance data arrives as PDF or in email bodies. Use AI document extraction with field-level confidence, as Duco and HighRadius do. Anything below the confidence threshold goes to a human. **§2.2a explains how to build it.**

### 2.2a How PDF and email extraction actually works: **P1 (pilot) / P2 (scale)**

The goal is to turn a PDF Credit MIS, a scanned deposit slip or an email body into the **same canonical rows** a CSV would produce. Every value carries a confidence score, and a person checks only the values the system is unsure about. The prototype's **Document Extraction** screen walks through this.

**Pipeline, step by step**

| # | Step | What happens | How to build it |
|---|---|---|---|
| 1 | **Capture** | Email arrives in the monitored mailbox (rules from the Credit MIS email setup: from, subject pattern, file name pattern). Attachments and the email body are both stored, with a SHA-256 hash for duplicate detection. | Existing email-mode config; mailbox listener (Graph API / IMAP) writing to object storage. |
| 2 | **Classify** | Decide what the document is (PA settlement MIS, bank advice, cheque deposit slip, NEFT remittance email, or junk) and which setup it belongs to. | Rules first (sender + subject + filename). Fall back to a small LLM classifier over the first page or body text. |
| 3 | **Read the page** | Digital PDFs: extract the text layer and table structure directly. Scans and images: OCR with layout, which gives words, positions and per-word OCR confidence. | Digital: pdfplumber / PDFBox / Camelot for tables. Scans: AWS Textract, Azure Document Intelligence or Google Document AI (on-prem: PaddleOCR / docTR). Pick per your data-residency rules. |
| 4 | **Extract to schema** | Fill the **same target schema as the column mapping** (UTR, amount, value date, application no, PAN, PA code, status, failure code), as header fields plus line items. | An LLM given the page text and layout and a JSON schema, constrained to return JSON and to **quote the source span** for every value. Recurring layouts (same aggregator every day) use a saved template, which is cheaper and more stable, and only fall back to the LLM when the template fails. |
| 5 | **Validate** | Deterministic checks catch AI mistakes: line items sum to the document total; UTR length and format per rail; PAN and IFSC formats plus IFSC master lookup; date within the expected window; amounts that parse; duplicates against already-loaded rows. | Plain code, reusing the mapping validation engine. |
| 6 | **Score confidence per field** | Combine (a) OCR word confidence, (b) whether the value appears verbatim in the quoted source span, (c) validator pass/fail, (d) agreement between two extraction passes (template vs LLM, or two prompts), and (e) the historical accuracy for this layout. | A weighted score from 0 to 1. Calibrate the weights on a labelled sample so that "0.95" really means about 95% correct. |
| 7 | **Route** | All fields ≥ **auto threshold** (e.g. 0.95) and all validators pass → load straight through. Any field below it, or any validator failure → **human review queue**. Field confidence < 0.6 or document-level failure → reject and ask for a resend. | Thresholds are configured **per document type and per field**. For example, amount and UTR need 0.98 while remitter name only needs 0.85. Changes to thresholds are maker-checker controlled. |
| 8 | **Human review** | A split screen shows the document on the left with the source span highlighted, and extracted fields on the right with low-confidence fields outlined. The reviewer can accept or correct each field, then submit. High-value documents need a second person to approve. | The prototype's Document Extraction screen. |
| 9 | **Learn** | Every correction is stored as a (document, field, wrong, right) example. Use these to refine the saved template or prompt, and to recalibrate thresholds monthly. | No model training needed at first. Templates and few-shot examples get you most of the way. |

**Controls you must have**
- **The source document is retained**, linked to every row it produced. An auditor can click a row and see the PDF and highlighted span.
- **AI provenance on every value:** model and prompt version, confidence, auto vs human, and who corrected it.
- **PII:** narrations and MIS contain PAN and names. Use a VPC/on-prem model or a provider with no-retention terms, and mask PAN in logs.
- **Fallback:** if the extraction service is down, documents queue up for manual entry. Nothing is lost.

**What to measure:** straight-through rate per document type, field-level accuracy (sampled QA), average review time per document, and corrections per 100 documents. Start with **the one or two aggregators that only send PDFs**, prove ≥ 90% straight-through, then expand.

### 2.3 Mapping and normalisation: AI-assisted, confidence-scored: **P1**

**Problems.**
- Auto-mapping is regex plus "reuse last approved". Narration parsing ("Pattern Match / Split Logic Screen") is regex-based.
- The rule "minimum three incremental flags" is unexplained.
- Running Balance Cleanup is a single character in a text box.

**Do this.**
1. **Mapping cascade:** (a) exact fingerprint match → (b) reuse last approved → (c) regex dictionary → (d) **LLM suggestion that uses column names *and* sample values**, with a confidence score per field. Show *why*: "Mapped `Txn Ref` → UTR_NUMBER (92%): 18/20 sample values match the UTR pattern `^[A-Z]{4}\d{12,}`."
2. **Validate on values, not just names.** The mismatch dialog is good, but drive it from actual data profiling: % parseable as date or amount, cardinality, pattern. Show a live **"what will load" preview** of 20 parsed rows in system format before submit.
3. **Narration extraction as a model, not regexes.** Extract investor name, PAN, UTR, folio, IFSC and virtual account from narrations with an LLM or extraction model plus validators (PAN checksum format, IFSC master lookup, UTR length by rail). Store a **confidence and provenance per extracted field**. Learn from corrections: every time an operator fixes an extraction, that becomes a training or rule-suggestion signal.
4. **Normalisation layer as configurable transforms, not toggles.** Replace "cleanup character", "descending order" and "C/D standardisation" with an ordered **transform pipeline**: strip prefix/suffix (regex), sign from indicator column, reverse order, split or merge columns, map values. Show each step's before/after on sample rows, Duco "Transform & Prepare" style. The admin-managed Transaction Status Standardisation table fits naturally here.
5. **Explain "incremental flags" as a "Duplicate detection key"**: "Which columns together uniquely identify a transaction?" Have the system suggest the key by testing uniqueness on the sample file.

### 2.4 The matching engine: design it now: **P0 (design) / P1 (build)**

**Problem.** Matching today is a **"Direct Match" toggle** (UTR = Instrument No vs CDT) plus a future "Batch Updation Setup Screen" with a priority cascade. There's no tolerance model, no confidence, no explicit 1:N or N:1 handling (the parent/child split is described only as an outcome), and no rule testing.

**Do this.**
1. **Canonical model.** Every source (bank credit, Credit MIS line, reverse feed/purchase txn, CDT) becomes a typed record in one ledger, with links between them. Don't use per-bank tables, which the email PRD mentions ("insert into bank-specific table"). Match states: `Unmatched → Proposed → Matched (auto / manual) → Partially matched → Reversed`.
2. **Rules as data.** A rule is a set of conditions (field, operator, value or tolerance), combined with AND/OR. It has:
   - a strategy: 1:1, 1:N (one credit for many applications, e.g. SIP bundles), N:1 (multiple credits for one application), N:M (PA settlement vs MIS lines)
   - a priority
   - a scope (bank, account, PA, channel)
   - tolerances: amount ± ₹ or %, date window ± n business days, fuzzy name similarity ≥ x
3. **Settlement decomposition first.** PA settlement credits = Σ MIS lines − fees − GST − refunds/chargebacks. Reconcile the *bundle* (bank credit ↔ settlement file total), then the *lines* (MIS ↔ purchase). This is how Stripe treats payouts, and it is the Credit MIS recon described in Recon PRD v1 §2.4–2.5.
4. **Deterministic first, AI second.** Follow Modern Treasury's pattern: rules auto-match only with certainty. For the residue, an AI layer proposes candidates ranked by confidence, with reasoning ("Amount equal, value date +1, remitter name 'R KUMAR' ≈ investor 'RAJESH KUMAR' 0.86, same IFSC as registered bank"). A human accepts with one click and maker-checker applies.
5. **Rule simulation / back-testing.** Before a rule is submitted, run it against the last 30–90 days. Show **new matches, lost matches, and false-positive risk**, as in Modern Treasury's Rule Preview. **Attach the simulation to the approval request**, so the authoriser approves an *impact*, not a form.
6. **Rule suggestions.** Mine resolved exceptions weekly: "Operators manually matched 312 ICICI credits where UTR was in narration chars 14–30. Create rule?" (Modern Treasury rule suggestions; Duco Agentic Rule Builder.)
7. **Always-on, event-driven matching.** Match when data arrives, not in batches. Every new statement or MIS file triggers matching for the affected accounts. This gives you Ledge-style continuous recon and **intraday realisation**, which feeds the allotment gate faster.
8. **"Why not matched?" explainer.** On any unmatched item, show the closest candidates and which condition failed: "Amount matches; UTR differs by 1 char; date outside window by 1 day." This alone removes a lot of investigation time.

### 2.5 Exceptions as cases, not tables: **P1**

**Problem.** Exceptions live in T_Refund, NIGO feeds, Fundnet failures and an "eyeball screen". There's no ownership, no SLA clock, no reason taxonomy and no prioritisation.

**Do this.**
1. **One Exceptions Workbench** across all types: unmatched credit, unmatched purchase, excess or short credit, duplicate credit, NIGO, Fundnet failure, cross-collection, cheque return, format drift, missing statement.
2. **Each case has:** type, **₹ amount**, **age and SLA clock** (with the SEBI refund and delayed-interest clock visible: "Interest starts accruing in 1d 4h"), owner and queue, priority score (₹ × age × regulatory risk), **suggested resolution**, linked records, a comments thread and attachments.
3. **Smart routing and auto-assignment** by bank, AMC or exception type. Bulk actions on similar cases ("Mark these 48 as cross-collection → AMC X").
4. **Mandatory root-cause codes** on closure. Feed them into a **trends view** ("ICICI narration format changed → 400 exceptions this week"), as Razorpay Recon does with discrepancy trend analytics.
5. **Refund prevention, not just processing.** Today the 5-day value-date rule is a *branch* in the refund flow. Make it a *countdown* on every unmatched credit, so the team works the cases where interest is about to start first.
6. **Agentic investigation** (later, BlackLine Verity style). An agent pre-investigates each case by pulling the investor's registered bank, past transactions, similar historical resolutions and remitter data, then drafts a resolution and rationale for the operator to accept. Every AI output must carry **confidence, reasoning and an audit record, and a human approves**.

### 2.6 Governance: smarter dual control, not more of it: **P0/P1**

**Problems.**
- Every change goes through the same maker → checker flow with a 5-minute approval SLA target, which is unrealistic and not risk-based.
- The authoriser sees the form, not the impact.
- Admin user provisioning is immediate with *no* second approval, so role changes (e.g. someone becoming an Authoriser) are not dual-controlled in a SEBI context.

**Do this.**
1. **Version every config and mapping.** Use immutable versions, **effective-dated** (go live at next file / from date X), with **side-by-side diff** and **one-click rollback** (rollback itself is maker-checker). The prototype's "changed-field highlight" is a start. Make it a real diff across versions.
2. **Risk-tier the approvals.** Cosmetic change (setup name) → single approval or auto. Matching rule, tolerance or credential change → approval **plus simulation**. A tolerance widened past a threshold → **two authorisers**.
3. **Dual-control privileged access.** Granting Authoriser or Admin, and reactivating dormant accounts, should need a second Admin. Add **periodic access recertification** (quarterly "confirm these 7 authorisers still need access") and SoD conflict detection.
4. **SSO / MFA.** The PRD rules out SSO and builds a custom password-plus-OTP onboarding. For an internal enterprise tool, **SSO with the corporate IdP** (AD/Azure AD/Okta) is the world-class default and removes password and lockout support load. Reconsider this non-goal.
5. **Audit evidence packs.** Generate a one-click, auditor-ready pack per period or per account: configs in force, approvals, rule simulations, exceptions and resolutions, statement completeness proofs. BlackLine sells this as "audit-ready reconciliations".

### 2.7 UX for back-office power users: **P1**

The prototype is polished, but it's optimised for *setup* flows that users run rarely. Daily work is high-volume triage, so design for that:

- **Keyboard-first grids:** j/k navigation, `a` accept suggestion, `x` select, `e` assign, command palette (⌘K).
- **Saved views and filters** per user ("My HDFC exceptions > ₹1L, age > 2d"), plus shareable links.
- **Split-pane match workspace:** bank credits on the left, candidate purchases or MIS lines on the right. Select N on the left and M on the right; the live difference ("Δ ₹0.00 ✓") updates as you go. Matching is done by selecting, not by filling forms.
- **Bulk everything** with preview ("This will match 212 pairs totalling ₹4.3 Cr").
- **Notifications that matter:** "Missing statement", "Format drift", "Interest clock < 24h", "Rule simulation ready". Not every approval.
- **Server-side pagination at 15 rows** (PRD) is legacy thinking for triage. Use virtualised grids with thousands of rows, column choosers and sticky totals, and keep pagination for audit lists.
- **"Copy setup" → templates.** Create "HDFC Corporate Statement Template v3" once and stamp it onto N accounts. Template updates propagate to linked setups through one approval.

### 2.8 Ops Command Centre (replaces the config-status dashboard): **P1**

The current dashboard shows counts of drafts, pending and active *configs*. The daily home screen should answer *"Is today's money reconciled, and what's at risk?"*:

- **File arrival board:** expected vs received vs failed files by bank/account and time, with red for late.
- **Recon funnel:** credits received → auto-matched → AI-proposed → manually matched → open, in ₹ and count, with a live update.
- **Allotment gate status:** ₹ realised and cleared for allotment vs held, and the cut-off countdown.
- **Ageing and interest-risk heatmap** by bank × age bucket.
- **Match-rate trend per bank/PA**, so drops point to a format change or a bad rule.
- **My queue:** cases assigned to me, sorted by priority score.

### 2.9 Downstream: realisation, refunds, GL and reporting: **P2, but design the interfaces now**

- **Realisation as an API/event** to the transaction processing (posting) system, not a "Fund Utilisation Report" file. Each realised credit emits an event, and allotment can start intraday.
- **Refunds:** pre-validate investor bank details with **penny-drop / bank account verification** before payout, auto-compute delayed interest from the case's SLA clock, and generate NEFT/RTGS batches with maker-checker.
- **GL:** auto-generate journal entries from match outcomes (suspense in/out), with a sub-ledger to GL tie-out.
- **BRS:** generate automatically every day from the canonical ledger, not as a month-end exercise.
- **Self-serve reporting:** a semantic layer and governed dataset that ops and AMCs can query, plus "ask in plain English" analytics over recon data (read-only, permissioned).

### 2.10 Platform and data architecture: **P0**

- **One canonical, immutable, event-sourced ledger** for all recon records and state changes. Make corrections reversal entries; never update in place. This makes audit, replay and "what did we know at 11:00?" trivial.
- **Configs, rules and mappings as versioned data**, executed by one engine. No per-bank code paths.
- **Idempotent ingestion:** re-sending a file is always safe.
- **Observability:** per-file processing trace, from received through parsed, validated, loaded and matched, viewable by ops, not just engineering.
- **AI governance:** model or prompt version, input, output, confidence and the human decision logged for every AI suggestion. Allow PII redaction or on-prem/VPC model hosting, since narrations contain PAN and names. Decide the data-residency stance early.

### 2.11 Platform-wide user and access management: **P0**

**Problems.**
- PRD v4 §5.7 hard-codes **four roles** for **one module** (Recon).
- Every Operator sees every Operator screen, even if that person only ever works exceptions.
- CAMS also needs Brokerage, Transaction Posting, Refunds and other modules under the same identity and access layer.

**Do this** (the prototype implements it):
1. **Module → Screen → Capability catalogue.** Every module (Reconciliation, Brokerage, Transaction Posting, Refunds, Administration) registers its screens. Each screen exposes capabilities: **View, Maker (create/edit), Checker (approve), Export**. A new module plugs in by registering its screens. No user-management code changes.
2. **Roles are permission sets that admins build.** An admin creates a role ("Recon · Exceptions Maker") by ticking capabilities in a screen × capability matrix. The defaults are templates, not hard limits.
3. **A user can hold many roles across modules**, e.g. "Recon · Exceptions Maker" + "Posting · Viewer". Effective access is the union, and **the side navigation shows only the screens the person can open**.
4. **Maker vs Checker is per screen, not per person.** Someone can be a maker on Exceptions and a checker on Bank Setup. **Segregation-of-duties check:** the system blocks any user from holding both Maker and Checker on the *same* screen, and still blocks approving one's own work.
5. **Dual control on access itself.** Creating or editing a role, and granting any role that contains Checker or Admin capabilities, goes to a **second admin** for approval.
6. **The same `authorize(actor, screen, capability, target)` gate** is enforced server-side for every module. Every denial is audited.
7. Later: optional **data scope** per assignment (e.g. only certain AMCs or banks), periodic access recertification, and SSO group → role mapping.

---

## 3. Migration strategy: de-risk the cut-over

1. **Mine the legacy system for hidden rules.** After 25 years, much of the real matching logic lives in stored procedures, scheduled jobs and tribal knowledge, not in documents. Run a structured extraction of stored procedures, job schedules and lookup tables. If parts exist only as compiled executables, **this is where a reverse-engineering tool such as REA is actually useful**: it can decompile the legacy binaries to recover matching and parsing rules. Point me at the legacy binaries or DB scripts if you want that done.
2. **Baseline** the metrics in §2.1 from legacy data for 3 months before go-live.
3. **Shadow / parallel run.** Feed the same files to both systems and diff outcomes daily (matched set, exceptions, realisation time). Go live per bank only when parity or improvement is proven.
4. **Phase by bank and channel, not by screen.** Take one or two high-volume banks end to end (ingest → match → exceptions → realisation) first. Don't ship all config screens for every bank with no new matching behind them.

---

## 4. Proposed re-phasing

| Phase | Scope | User-visible win |
|---|---|---|
| **1 (revised)** | Config + mapping (as now) **plus** fingerprinting, drift detection, expected-file calendar, versioned configs with diff and rollback, canonical ledger, and rule model design | Missing or changed files get caught automatically. Onboarding takes minutes. |
| **2** | Deterministic match engine (1:1, 1:N, N:1, settlement decomposition), rule simulation, Exceptions Workbench with SLA clocks, Command Centre, for 2 pilot banks + 1 PA, in parallel run | Most credits auto-match. Ops works a prioritised queue. |
| **3** | AI match suggestions, narration extraction model, rule suggestions, realisation event API to posting, refund pre-validation and interest automation | Intraday realisation. Exception volume falls each month. |
| **4** | Agentic investigation, audit evidence packs, GL automation, daily BRS, NL analytics | Close and audit become push-button. |

---

## 5. PRD hygiene issues found during the review

Fix these before baseline sign-off:

1. **PRD v4 §5.1–5.6, §6, §7, §8 and the Appendix are placeholders** ("retained in full from v3"). The v4 document doesn't actually contain the core capability specs. Merge them in, or the file can't be reviewed or handed to developers on its own.
2. **Bank Account Number mandatory logic is inverted** in Recon PRD v1 ("mandatory only when Bulk toggle is enabled"). It should be *optional* when Bulk is on (v1's own Bulk Upload section says so).
3. **The PRD and prototype disagree.** The prototype removed File Type and File Separator from the bank wizard, but the PRDs still specify them. Credit MIS has **4 status cards** in the PRD vs **6** in the prototype.
4. **Credit MIS "Instrument Status" conflates Debit with Failure** ("D = failed transactions"). Separate *direction* (credit/debit) from *outcome* (success/failure/reversal). Applying one status to a whole file is also risky, so require a confirmation and flag it in audit.
5. **"Minimum three incremental flags"** has no stated rationale. Replace it with the duplicate-key concept (§2.3.5).
6. **The approval SLA of 5 minutes and onboarding in 10 minutes have no baseline.** Measure legacy first.
7. Recon PRD v1 still has **open questions written inline** (e.g. the Running Balance Cleanup setup, rework visibility, "this section needs to be descriptive with examples"). Track them in an open-questions log with owners.
8. **Persona naming is inconsistent:** "ATR back-office user" (v1) vs "CAMS Back-Office User" (v4), and the email domain changed from @atronline.com to @camsonline.com. Standardise.
9. **The SSO non-goal** (see §2.6.4) is worth revisiting with InfoSec.
10. **"Four fixed roles, one role per user, no custom roles"** (PRD v4 §5.7.1) conflicts with the requirement that user management serve Brokerage, Posting and other modules, with screen-level access. Replace it with §2.11.

> **Constraint adopted (21 Oct 2026):** banks and payment aggregators will not change their files, channels or references for CAMS. Every recommendation in this document now assumes CAMS adapts on its own side (§2.2.3–2.2.4).
>
> **Prototype:** the re-phased prototype (Phases 1–3 screens + platform access model) is described in `PROTOTYPE_CHANGES.md`.

---

## 6. Top 10 changes, if you only do ten

1. Replace config-centric success metrics with **straight-through match rate, time-to-realisation, ageing and interest paid**.
2. **File fingerprinting + format-drift cases + expected-file calendar**.
3. **Canonical, immutable recon ledger.** No per-bank tables.
4. **Rule-based match engine** with tolerances, 1:N / N:1 / N:M and settlement decomposition. Design it now.
5. **Rule simulation attached to every approval** (approve impact, not forms).
6. **Exceptions Workbench**: cases with owner, ₹, SLA and interest clock, reason codes and bulk actions.
7. **AI suggestions for the residue** (matches, mappings, narration extraction) with confidence, reasoning, audit and human sign-off.
8. **Versioned, effective-dated configs** with diff and rollback, and **risk-tiered** approvals.
9. **Ops Command Centre** as the home screen.
10. **Shadow-run against legacy**, rolling out per bank, after mining the legacy rules.

---

## Sources

- Stripe: [Bank reconciliation](https://docs.stripe.com/reconciliation/bank-reconciliation), [Payout reconciliation report](https://edge-docs.stripe.com/reports/payout-reconciliation), [Automatic reconciliation (invoicing)](https://stripe.com/br/docs/invoicing/reconciliation)
- BlackLine: [Verity Prepare GA press release](https://investors.blackline.com/news-releases/news-release-details/blackline-advances-governed-ai-finance-general-availability), [Verity Prepare coverage (CPA Practice Advisor)](https://www.cpapracticeadvisor.com/?p=187516), [Transaction Matching analysis (Airframe)](https://www.airframe.ai/product/blackline-com-solutions-transaction-matching/analysis), [Transaction Matching glossary (Hyperbots)](https://www.hyperbots.com/glossary/blackline-transaction-matching)
- Modern Treasury: [Reconciliation rules](https://docs.moderntreasury.com/reconciliation/docs/defining-your-reconciliation-rules), [Preview reconciliation rules](https://docs.moderntreasury.com/reconciliation/docs/preview-reconciliation-rules), [AI overview](https://docs.moderntreasury.com/platform/docs/ai-overview), [AI-assisted reconciliation announcement](https://moderntreasury.com/journal/announcing-new-features-for-real-time-ai-assisted-reconciliation), [Adding AI to reconciliation](https://www.moderntreasury.com/journal/adding-ai-to-modern-treasury-reconciliation)
- Duco: [Next-gen AI automation at SIBOS (Business Wire)](https://www.businesswire.com/news/home/20250929875030/en/Duco-Launches-Next-Gen-AI-Automation-at-SIBOS), [ERPResearch profile](https://erpresearch.com/erp-add-ons/reconciliation/duco), [rfp.wiki reviews](https://www.rfp.wiki/vendors/duco)
- HighRadius: [Cash application automation](https://www.highradius.com/product/cash-application-automation/), [95% straight-through processing](https://www.highradius.com/resources/Radiance/fixing-cash-application-to-achieve-95-straight-through-processing-2/)
- Ledge: [Account reconciliation](https://www.ledge.co/solutions/account-reconciliation) · End Close: [YC profile](https://www.ycombinator.com/companies/end-close)
- Razorpay: [Razorpay Recon](https://razorpay.com/blog/revolutionizing-financial-reconciliation-with-razorpay-recon/) · [Recko vs Simetrik (CB Insights)](https://www.cbinsights.com/compare/recko-vs-simetrik)
- Benchmarks aggregator (treat with caution): [Stealth Agents: AI bank reconciliation statistics 2026](https://stealthagents.com/research/ai-bank-reconciliation-automation-statistics-2026)
