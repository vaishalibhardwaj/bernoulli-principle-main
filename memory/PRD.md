# PRD — CAMS Reconciliation Phase 1 Configuration Workbench (Prototype)

## Original Problem Statement
Build a clickable, high-fidelity, **front-end-only** prototype of the CAMS Recon Phase 1 Configuration Workbench
for stakeholder demos and usability testing with the reconciliation operations team. Enterprise look & feel,
no real backend. Users: mutual-fund reconciliation operators at CAMS (Indian RTA). Two roles: Maker (Priya) and
Authoriser (Arun). SEBI-regulated context → dual control + audit are central.

## Architecture / Tech
- **React (CRA + CRACO)**, **plain CSS** (CSS variables in `src/styles.css`), **lucide-react** icons, `sonner` toasts.
- State: React **context + reducer** (`src/state/store.js`), persisted to **localStorage** (`cams_recon_state_v4`).
- All data mocked in memory (`src/mock/*`) with simulated 300–600 ms latency + occasional "Network error" toast.
- Simulated sample-file auto-detection: CSV parsed with a tiny parser; XLS/XLSX/PDF faked with canned previews keyed by file name.
- No backend/DB used (FastAPI/Mongo left untouched & unused). No real auth — roles via top-bar switcher.
- Note: spec asked for Vite+TS; built on CRA for guaranteed preview reliability (same look/behaviour).

## User Personas
- **Maker (Priya):** creates/edits bank & credit MIS configs and column mappings; saves drafts; submits for approval; reworks rejected items.
- **Authoriser (Arun):** reviews the queue; approves (→ Active/Inactive) or rejects (mandatory comment ≥10 chars).

## Core Requirements (static)
- Status lifecycle (Not Started → Draft → Pending Approval → Active/Inactive, with Rejected rework loop); every transition writes an audit entry.
- Pending records view-only for Maker; drafts never in Authoriser queue; Maker cannot approve own submission.
- Consistent status pills, chips (Auto-detected/Edited/From previous mapping/Pattern match/Manual), skeleton loaders, toasts, step indicator.

## Implemented (2026-06) — v1 MVP, tested & verified (testing iterations 1 & 2, all bugs fixed)
- **App shell:** collapsible sidebar, breadcrumb top bar, role switcher, avatar menu, hidden "Reset demo data", session login banners (maker-rejected / authoriser-queue).
- **Bank Statement Setup:** landing (status filter w/ Rejected count, debounced+highlighted search, server-style pagination over ~240 records, Copy Setup exactly-one invariant, rejection tooltip) + 6-step wizard (mode cards, bank/account from Bank Master, Manual mode auto-skips Connection step, sample upload + auto-detect chips + 10-row preview, XLS/HTML mismatch warning, password eye-toggle + vault note, processing toggles, Review w/ per-step edit, draft/submit, reset confirm, rejection banner).
- **Credit MIS Summary:** six status cards + Export CSV + 6-step wizard (multi-select PA codes, aggregator/account, file auto-detect, mode-specific details incl. ZIP password, processing controls, review; API mode skips mode-specific step; Cancel w/ unsaved prompt).
- **Column Mapping:** summary w/ Bank/Credit tabs + 3-step editor (pre-loaded sample banner, confirm header w/ mismatch warning, grouped map tables w/ source chips, date-format bar w/ ambiguous-date confirm, mismatch dialog, column-in-use dialog, submit-validation + colour-coded confirmation popup).
- **Authoriser Queue:** metric cards, queue grid, right-side review drawer (changed-field highlight, credential status, prior-rejection timeline), approve/reject (comment ≥10), Maker buttons disabled.
- **Audit History:** filterable (date range/user/entity/action) + pagination; logs all transitions.
- **Seed:** 240 bank configs (8 banks, realistic mix), 60 credit MIS configs, mappings; exactly 2 rejected bank configs + 2 rejected credit configs with realistic comments; HDFC approved mapping enables the reuse path.

## Backlog / Remaining
- **P2** Dark-theme toggle (nice-to-have, deferred).
- **P2** Maker-specific dashboard view (currently Maker sees the Authoriser Queue read-only with a note).
- **P2** Credit MIS mapping dedicated field set + its own seeded mapping rows (Bank mapping fully built; Credit tab reuses shared shell).
- **P3** Resolve instrumentation-driven `<option>` hydration console warning (non-functional).

## Next Tasks
- Gather stakeholder demo feedback; prioritise dark theme and a Maker dashboard if requested.

## Changelog
- 2026-06: Bank File Config step — removed "File Type" dropdown and "File Separator" field (keeps Start Row / Start Column only). Removed all "Auto-detected"/"Edited" label badges in both wizards + review. Made Processing Options on/off switches clearly visible (darker track + border + larger knob). Credit MIS mapping-table source Chips retained (different semantics).
