# CAMS Reconciliation — Phase 1 Configuration Workbench (Prototype)

A clickable, high-fidelity **front-end-only** prototype of the CAMS Recon Phase 1 Configuration Workbench,
for stakeholder demos and usability testing with the reconciliation operations team.

> No real backend. All data is mocked in memory and persisted to `localStorage` so the demo state survives a refresh.
> Out of scope: real auth, real file ingestion, reconciliation matching, email sending, a real secrets vault.

## Tech

- **React** (Create React App + CRACO) + **plain CSS** (CSS variables), **lucide-react** icons, `sonner` toasts.
- State: a simple React **context + reducer** (no Redux), persisted to `localStorage`.
- Simulated file auto-detection: CSV parsed with a tiny parser; XLS/XLSX/PDF faked with canned previews keyed by file name.

> Note: the spec requested Vite + TypeScript. To guarantee the live preview runs reliably on this platform's
> pre-configured CRA dev server, it is built on CRA with the same look/behaviour and front-end-only logic.

## Run

```bash
cd frontend
yarn install
yarn start      # http://localhost:3000
```

The app is served by supervisor in the preview environment — no manual start needed there.

## Roles — one presenter, both sides

Use the **role switcher** in the top bar (no login):
- **Maker · Priya** — creates/edits configs & mappings, submits for approval.
- **Authoriser · Arun** — reviews the queue, approves/rejects.

Hidden **Reset demo data** lives in the avatar menu (top-right).

## Screens

- **Dashboard / Authoriser Queue** — metric cards, queue grid, right-side review drawer, approve/reject (reject comment ≥10 chars; Makers can't approve their own).
- **Bank Statement Download Setup** — landing (status filter, debounced search, server-style pagination over ~240 records, Copy Setup) + 6-step wizard (Download Mode → Bank Info → Connection → File Config → Processing → Review).
- **Credit MIS Summary** — six status cards, grid, Export CSV + 6-step wizard.
- **Column Mapping** — Bank Statement / Credit MIS tabs + 3-step mapping editor (sample → confirm header → map columns) with date-format, mismatch, and column-in-use dialogs and a colour-coded submit confirmation.
- **Audit History** — filterable log (date range, user, entity, action) with pagination.

## Demo script (works end-to-end, no dead ends)

1. As **Priya (Maker)**: login banner shows 2 rejected items → **View rejected** → open one → see the rejection banner → fix Start Row → **Submit for Approval** → the Rejected badge drops to 1.
2. **Add New** → Manual (SFTP) → South Indian Bank → pick an account → Step 3 auto-skipped (N/A) → upload the demo `south_indian_bank.xlsx` → fields auto-detected → change Start Row (chip flips to **Edited**) → **Save as Draft** → toast → find it under the Draft filter.
3. Reopen the draft → Review & Submit → **Submit** with a missing mandatory field → step shows a red error → fix → submit.
4. Switch to **Arun (Authoriser)** → banner "N items awaiting review" → open the queue → **Review** → **Reject** with a comment / **Approve** another.
5. Back as **Priya** → open a mapping for an approved HDFC account → sample pre-loaded → header pre-selected → reuse + pattern-match banner → resolve the ambiguous date → trigger the mismatch dialog → **Submit** → confirmation popup.
6. Open **Audit History** and see every step logged.

## Demo sample files (inside the drop zone → "Use demo file")

- `hdfc_statement_sep.csv` — comma-separated, header on row 12, DD/MM/YYYY (ambiguous) dates.
- `south_indian_bank.xlsx` — header on row 8, starts at column 2, +/- amounts.
- `fake_xls_actually_html.xls` — triggers the extension/content mismatch warning.

## Structure

```
src/
  components/   StepIndicator, StatusPill/Chip (bits), Pagination, FileDropZone,
                PreviewTable, Modal, Drawer, AppShell
  features/     bankConfig, creditMis, mapping, authQueue, audit
  mock/         seed data, bank master, sample files, fake API (latency)
  state/        store.js (context + reducer, localStorage)
  lib/          format + constants
```
