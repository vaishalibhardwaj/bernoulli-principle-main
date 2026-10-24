# Prototype changes: re-phased recon + platform access model

**Date:** 21 Oct 2026 · **Full line-level diff:** [`PROTOTYPE_DIFF.patch`](PROTOTYPE_DIFF.patch) (against the prototype as it was before this change)
**Run it:** `cd frontend && yarn start` → http://localhost:3000 (or the `cams-recon-prototype` entry in `.claude/launch.json`)

The prototype is still front-end only. Data is mocked and saved in `localStorage` (key `cams_recon_state_v7`; old saved state is ignored and the app reseeds itself).

---

## 1. What changed, at a glance

| Area | Before | After |
|---|---|---|
| **User access** | 4 hard-coded roles (Admin / Operator / Authoriser / Viewer), one per user, Recon only. Every Operator sees every Operator screen. | **Module → Screen → Capability** model (View / Maker / Checker / Export) covering **Recon, Brokerage, Transaction Posting, Refunds, Administration**. Admins **build roles** in a permission matrix, users hold **several roles across modules**, and the **side nav shows only permitted screens**. |
| **Dual control on access** | Admin changes applied instantly, with no second approval. | Creating or editing a role, and granting any privileged role (Checker or Admin rights), goes to a **second admin** (Access Approver). |
| **Segregation of duties** | Only "can't approve own work". | Also **blocks any user from being Maker and Checker on the same screen**, checked both when saving the user and when approving. |
| **Demo personas** | 3 buttons (Maker / Authoriser / Admin). | Persona dropdown with 7 real seeded users and different role mixes. Navigation changes per persona. |
| **Home screen** | Config-status dashboard. | **Ops Command Centre** (P1). The old dashboard is kept as "Config Approvals". |
| **Phase-1 additions** | None. | **File Inbox & Drift** (fingerprints, format-drift cases with proposed mapping diff, expected-file calendar, completeness checks). **Version history** with diff and rollback on Bank Setup. |
| **Phase-2 screens** | None. | **Match Rules** (rules as data, tolerances, 30-day simulation attached to approval, rule suggestions), **Match Workbench** (AI suggestions with reasons, N:M split-pane with live Δ, "why not matched?", risk-tiered fast-track), **Exceptions** (cases with ₹, interest clock, owner, root cause, bulk assign, maker–checker closure, trends). |
| **Phase-3 screen** | None. | **Document Extraction**: a 9-step pipeline, PDF/email/scan preview with low-confidence highlights, field-level confidence, validators, human review of flagged values only, ≥ ₹1 Cr goes to a checker. |
| **Other modules** | Not represented. | Brokerage, Posting and Refunds screens exist as placeholders. They show that one access model serves every module. |

The "banks won't change anything" constraint is reflected throughout. There are no virtual-account or bank-change assumptions; drift is absorbed on CAMS's side, and match keys come from narration, remitter fingerprints and TPV.

---

## 2. Files

### New (13 files, ~2,170 lines)
| File | Purpose |
|---|---|
| `src/lib/access.js` | Screen catalogue for all modules, seed role templates, `permsFor`, `hasCap`, `sodConflicts`, `isPrivileged`, `navFor`, `homePath`, personas. |
| `src/features/admin/RolesAccess.jsx` | Roles & Access: role tiles per module, **role builder** drawer, **Access approvals** with permission diff, **Screen catalogue**. |
| `src/features/admin/PermissionMatrix.jsx` | Reusable screen × capability grid (editable or read-only). |
| `src/features/command/CommandCentre.jsx` | P1 home: STP rate, realised vs held for allotment, late files, interest-risk, funnel, arrival board, ageing heatmap, per-bank trend, My queue. |
| `src/features/ingestion/FileInbox.jsx` | P1 file inbox, drift drawer (old vs new columns, proposed mapping with confidence, held rows), maker submit → checker release. |
| `src/features/bankConfig/VersionsDrawer.jsx` | P1 immutable, effective-dated versions with compare and rollback (rollback goes through maker–checker). |
| `src/features/rules/MatchRules.jsx` | P2 rule cascade, tolerance editor, simulation (new / lost / FP risk / sample), approval of impact, rule suggestions. |
| `src/features/match/MatchWorkbench.jsx` | P2/P3 AI suggestions, N:M selection with Δ bar, "why not matched" explainer, checker queue, fast-track tier. |
| `src/features/exceptions/Exceptions.jsx` | P2 case workbench, views, bulk assign, case drawer, suggested resolution, root-cause closure + checker, trends. |
| `src/features/extraction/DocumentExtraction.jsx` | P3 extraction pipeline and review UI. |
| `src/features/modules/ModulePlaceholder.jsx` | Brokerage / Posting / Refunds screens showing the user's capabilities. |
| `src/features/ops/ui.js` | Shared ops widgets (₹ formatting, confidence meter, stat tile, phase badge). |
| `src/mock/opsSeed.js` | Deterministic seed: files, drift, credits, purchases, AI suggestions, rules + simulator, exceptions, documents, day aggregates. |
| `src/ops.css` | Styles for all of the above. |

### Changed (12 files)
| File | +/− | What changed |
|---|---|---|
| `src/lib/rbac.js` | +35 −163 | Removed the 4 fixed `ROLE_PERMS`. `authorize(actor, action, target)` now checks **screen capabilities** (named actions map to screen + capability, or pass `{screen, cap}`). Self-approval block now applies to every screen. |
| `src/state/store.js` | +155 −76 | Persona = real user id; `perms` derived from roles. Legacy `role` is derived so the original config screens keep working. Multi-role `addUser`/`updateUser` with SoD + privileged-grant queue. New `submitRole`, `decideAccess`, generic `act()` (authorised mutation + audit), `upsert`. Seeds roles, access requests and ops data. |
| `src/components/AppShell.js` | +102 −132 | Nav generated from permissions, grouped by module, with phase tags and live badges. Persona dropdown. **Route guard** shows "no access" for screens outside the user's roles. Removed the "Admin sees only User Management" hard-code. |
| `src/features/admin/UserManagement.jsx` | +78 −74 | Module strip replaces the 4 role cards. Role filter grouped by module, plus a module filter. Multi-role chips with *pending* grants. Edit actions only for users with Maker on Users. |
| `src/features/admin/AddEditUserDrawer.jsx` | +84 −56 | Single role select → **multi-role picker by module**, SoD conflict alert (blocks save), "needs 2nd admin" notice, **Effective access** preview matrix. |
| `src/features/admin/RolePermissionsDrawer.jsx` | +22 −68 | Now lists every role in a module with its matrix and "Show these users". |
| `src/features/admin/OnboardingModal.jsx` | +4 −3 | Invite email names all granted roles. |
| `src/features/bankConfig/BankConfigLanding.js` | +5 −1 | "Version history" row action. |
| `src/mock/userSeed.js` | +32 | Every user gets `roles[]`. Two new personas: Deepa Nair (Recon Ops Maker) and Farhan Qureshi (Brokerage Maker + Posting Viewer). |
| `src/App.js` | +19 −2 | Routes for the new screens, `/m/:module/:screen`, permission-based home redirect. |
| `src/index.js` | +1 | Imports `ops.css`. |
| `Recon_World_Class_Recommendations.md` | +45 −3 | Removed the virtual-account ask. Added "adapt on our side" match keys, **§2.2a: how PDF/email extraction works**, **§2.11: platform-wide access model**, and new PRD-hygiene item 10. |

Also added: `.claude/launch.json` (dev-server entry for the in-app browser).

---

## 3. Demo script (≈ 10 minutes)

1. **Meera · Platform Admin** → Users. Five module cards show user counts. Click **Add user** → "+ Ops Maker (Aakash)" → also tick **Recon · Checker**. A *segregation-of-duties* error blocks save. Untick it and tick **Brokerage · Checker**: it shows "needs 2nd admin". Check the **Effective access** matrix, then save.
2. **Rohit · Access Approver** → Roles & Access › Access approvals. Approve Aakash's Brokerage Checker grant and Sanjay's leave-cover request. Meera can't approve her own requests, and Rohit can't edit users.
3. **Priya · Recon Setup Maker**: the nav shows only Setup + Command Centre + File Inbox (no Match/Exceptions).
   - File Inbox: open **HDFC (drift)** → *Submit mapping change*.
   - Match Rules: rule 6 → date window 3 → *Simulate* → *Submit with simulation*.
   - Bank Setup: History icon → compare versions → *Roll back*.
4. **Arun · Recon Checker**:
   - File Inbox: *Approve & release 2,184 rows*.
   - Match Rules: approve the change. The checker sees new / lost / FP risk.
5. **Deepa · Recon Ops Maker**: the nav shows only Operate screens.
   - Match Workbench: accept the 94% suggestion (fast-track) and the 78% one (goes to the checker). Select a credit and a purchase to see the Δ bar. Click **?** on a credit for "why not matched".
   - Exceptions › *Interest clock < 24h*: bulk-assign, open a case, then request closure with a root cause.
   - Document Extraction: fix the flagged UTR and reason code → load. On the ₹2.5 Cr email, confirm the PAN → it goes to the checker.
6. **Arun** approves the match, the case closure and the ₹2.5 Cr document.
7. **Sanjay · Auditor**: everything is read-only, and /admin/users shows "no access".
8. **Farhan · Brokerage + Posting**: sees only the Brokerage and Posting modules.

---

## 4. Verified in the browser
All of the above was clicked through in the running app. The audit log records each action under the right persona, and the production build compiles with no warnings.

Remaining known issue (pre-existing, cosmetic): the editor's instrumentation logs a hydration warning for dynamic `<option>` labels.

## 5. Not done / out of scope
- No real backend or authorisation server. `authorize()` runs in the browser and stands in for the server-side gate.
- Brokerage / Posting / Refunds have placeholder screens only, to demonstrate access.
- Rule simulation, AI suggestions and extraction confidence are **simulated deterministically**. They are not real models.
- Phase-4 items (agentic investigation, audit evidence packs, GL, BRS) are in the recommendations doc but not in the prototype.

---

# Round 2: Simple view for daily users

**Date:** 21 Oct 2026 · **Diff for this round only:** [`SIMPLE_VIEW_DIFF.patch`](SIMPLE_VIEW_DIFF.patch) · `PROTOTYPE_DIFF.patch` now covers both rounds against the original.

## Who gets it
- A role can be flagged **"Daily user: simple view"** in Roles & Access › role builder.
- **Recon · Operations Maker** has the flag, so **Deepa** opens in simple view automatically.
- Checkers, setup makers and admins keep the full view.
- Anyone can switch views from the avatar menu ("Switch to simple view" / "Switch to full view"). This is remembered per user.

## What changes in simple view

| Area | Full view | Simple view |
|---|---|---|
| Home screen | Ops Command Centre (stat tiles, funnel, heatmap, trends) | **My Work**: one numbered list, red → amber → green, one big button per row, "N done today", and a separate "Waiting for your team lead" box |
| Menu | Ops Command Centre, File Inbox & Drift, Match Workbench, Exceptions, Document Extraction, Audit History, with P2/P3 tags | My Work, Bank files today, Match payments, Problem cases, Read PDFs & emails, History. **No phase tags, no analytics screen** |
| Confidence | "78%" bars | **High** / **Check needed** / **Low — check carefully** traffic lights |
| Time pressure | "1d 4h", "Interest clock" | "Only 9 hours left", "Late — penalty interest is already running" |
| Exception types | "Unmatched credit", "NIGO rejection", "Cross collection"… | "Money received, no matching purchase", "Application rejected — refund needed", "Money meant for another AMC"… |
| Case statuses | Open / In progress / Closure pending checker / Closed | To do / Working on it / Waiting for approval / Done |
| Problem cases screen | 6 views, type filter, stats strip, priority score, trends panel, export | 3 views (My cases · Nobody working on these · Done), plain columns ("What happened", "Time left", "Who") |
| Case drawer | "Suggested resolution 64%", "Root cause (required)", "Request closure" | "What to do", "Finished? Tell us why it happened", **"Mark as done"** |
| Match screen | Strategy chips (1:1, N:M), "fast-track", Accept/Dismiss, split-pane always shown | "Is this a match?", "no approval needed", **Yes, match / Not a match**. Reasons in plain words ("Paid from the investor's own bank account"). Match-by-hand is hidden behind a button, and the bar reads "Amounts are equal ✓" |
| Documents | 9-step pipeline strip, "auto-load threshold", "Approve & load rows" | No pipeline. "Check only the values marked in orange", "This is correct", **"Looks right — save"**. Plain field names ("Payment reference"), plain checks ("PAN looks wrong — … Probably: …") |
| Bank files | Fingerprint, "Format drift", "Completeness checks" | "Bank changed its file layout", "Balances don't add up", "Checks". No fingerprint |
| Read-only notice | "your roles don't include the Maker capability" | "You can look at this page. Changes here are made by your team lead." |
| Text size | Standard | Slightly larger type and bigger buttons |

The underlying rules haven't changed: the same maker–checker approvals, segregation-of-duties checks, audit entries and fast-track tiers apply in both views.

## Files (round 2)
New:
- `src/features/mywork/MyWork.jsx` (156 lines): the single queue.
- `src/lib/plain.js` (71 lines): all plain-language wording in one place, so business users can review and edit it.
- `src/features/match/matchActions.js` (40 lines): match accept/propose logic, now shared by My Work and Match payments.

Changed:

| File | +/− |
|---|---|
| `lib/access.js` | +19 −12 |
| `state/store.js` | +9 −2 |
| `components/AppShell.js` | +16 −11 |
| `App.js` | +4 −2 |
| `features/ops/ui.js` | +18 −1 |
| `features/exceptions/Exceptions.jsx` | +44 −37 |
| `features/match/MatchWorkbench.jsx` | +31 −40 |
| `features/extraction/DocumentExtraction.jsx` | +24 −20 |
| `features/ingestion/FileInbox.jsx` | +12 −10 |
| `features/admin/RolesAccess.jsx` | +3 |
| `ops.css` | +51 |

## Verified in the browser
As Deepa I checked:
- she lands on My Work with the plain menu;
- "Yes, match" on a likely match completes it and the queue shrinks;
- "Take this case" assigns the case to her;
- "Open case" shows the plain drawer;
- the Match and Read-PDF screens use plain wording;
- a non-fast-track match appears under "Waiting for your team lead";
- the avatar-menu toggle switches views both ways.

Arun (checker) still sees the full view. The production build compiles cleanly.

## Suggested next step
Run a 30-minute test with 5 real back-office users on 5 tasks: match a payment, take a case, close a case, check a PDF, find a late bank file. Then edit `lib/plain.js` with the words *they* use.

---

# Round 3: Connected daily journey, dashboards, world-class UI

**Date:** 21 Oct 2026 · **Diff for this round:** [`JOURNEYS_DIFF.patch`](JOURNEYS_DIFF.patch) · **PRD deviation analysis:** [`PRD_ALIGNMENT.md`](PRD_ALIGNMENT.md)

## The journey

Every user now starts on **Today**, which answers two questions:

1. **"What should I do first?"** A single *Do this next* card at the top, with one button. It is worked out from live data and the user's permissions:
   - **Deepa (ops):** "Step 2 · Match payments — 7 likely matches to confirm"
   - **Arun (checker):** "Approve N items your team sent you"
   - **Priya (setup):** "Step 1 · Check today's bank files — 7 files need attention"
2. **"Where does the day stand?"** The **daily reconciliation cycle**, based on the PRD v4 §4.1 day-in-the-life and §2.4 stages. It has 6 steps with deadlines, each marked done / in progress / waiting for approval / late:
   - ① Bank files (10:30)
   - ② Match payments (1:00)
   - ③ Problem cases (2:00)
   - ④ Release money for unit allotment (3:00 cut-off)
   - ⑤ Refunds (3:30)
   - ⑥ Close the day (4:30)

Then:
- **personal numbers**: done today, on my list, waiting for approval, realised today;
- **Your list** (makers) or **Waiting for your approval** (checkers);
- **Close the day**: checklist, carry-forward note, maker submits, checker signs off, day-summary CSV.

Every daily-cycle screen has a **journey bar** at the top showing all 6 steps, where you are, and a **"Next: …"** button once your step is done. Finishing fund release offers "Next: Send refunds"; finishing refunds offers "Next: Close the day".

A case's **"Create refund"** action now creates a real refund linked to the case, which then flows to Refunds → Approvals → NEFT batch.

## New screens
| Screen | Who | What it does |
|---|---|---|
| **Today** (`/today`) | Everyone (home) | Next action, daily cycle, KPIs, work list, day close. Replaces "My Work" |
| **Approvals** (`/approvals`) | Checkers | One inbox for every submission type: fund release, layout changes, refunds, matches, case closures, documents, rules, setups, access, day close. Most business-critical first; inline Approve / Send back; bulk approve; your own items locked |
| **Fund release** (`/release`) | Ops maker → checker | SEBI gate: realised vs held, by AMC, maker prepares → checker releases before 3 PM, fund utilisation report |
| **Refunds** (`/refunds`) | Ops maker → checker | 5-day SLA, penny-drop bank check, delayed interest (15% p.a.) calculated automatically, approval, NEFT batch CSV |
| **Reports** (`/reports`) | All with access | The PRD v1 §4–6 report list (each tagged with its PRD reference) built from live data, plus daily-email toggles |
| **Dashboard** (`/command`) | Team leads | KPI cards with trend + delta; today's cycle; auto-match trend chart with target line and hover values; payment-matching breakdown; team workload; case-age heatmap; per-bank match table |

## World-class UI pass
- **Theme layer** (`theme.css`):
  - Inter typeface with tabular numbers, a calmer palette and tighter borders.
  - Stripe-style sidebar: white active item, no heavy accents.
  - Clean table headers, 6px status badges, segmented controls.
- **⌘K command palette:** jump to any screen you can open, find a case (EXC-…) or refund (RF-…), switch demo persona.
- **Notification bell:** late steps, approvals waiting, sent-back setups, bank-file problems. Each links straight to the place to act.
- **Navigation reorganised** into *Home · Daily cycle (numbered 1–5) · Setup · Review*. Roadmap P2/P3 tags removed from the nav.
- **Charts** follow one method:
  - one hue, one axis, thin 2px lines;
  - hover tooltips and a dashed target line;
  - status colours only for status.
- **Fixed a long-standing bug:** Tailwind's `.grid` utility was turning every `table.grid` into a CSS grid, so tables did not span the card.

## Files (round 3)
New:
- `lib/journey.js`
- `features/today/Today.jsx`
- `features/today/Cycle.jsx`
- `features/approvals/Approvals.jsx`
- `features/approvals/useApprovals.js`
- `features/release/FundRelease.jsx`
- `features/refunds/Refunds.jsx`
- `features/reports/Reports.jsx`
- `features/reports/csv.js`
- `features/ops/charts.jsx`
- `components/CommandPalette.jsx`
- `theme.css`

Rewritten: `features/command/CommandCentre.jsx` (Dashboard).

Changed:
- `lib/access.js`: new screens; the Refunds module is folded into Recon (PRD Stage 6).
- `components/AppShell.js`: search, bell, step numbers.
- `mock/opsSeed.js`: release + refunds seed.
- `state/store.js`
- `App.js`
- `Exceptions.jsx`: create-refund link and journey bar.
- The Match, Documents and Bank files screens: journey bar.
- `index.css` / `index.js`: Inter font and theme.

Removed: `features/mywork/MyWork.jsx` (folded into Today).

## Verified in the browser
I walked through a full day:
1. **Deepa:** confirmed all suggested matches → prepared fund release → verified and submitted a refund → submitted day close.
2. **Arun:** Today showed "Approve N items" → in the Approvals inbox he approved the fund release, refunds, matches, case closures and day close (13 items). The release moved to *Released*, the day to *Closed*, and the cycle and Dashboard updated.
3. **Priya:** Today showed "Step 1 · Check today's bank files", and her list held the late, missing and changed-layout files.

⌘K search works, there are no console errors, and the production build compiles cleanly.

---

# Round 4: Futuristic CAMS "Command Deck" UI + contained UX

**Date:** 21 Oct 2026 · **Diff for this round:** [`FUTURISTIC_UI_DIFF.patch`](FUTURISTIC_UI_DIFF.patch)

## Look and feel
- **Brand anchor:** the CAMS logo blue `#0b509d` and logo greys `#929497` / `#808184`, taken from the logo on camsonline.com. On dark backgrounds the blue is lifted to `#2f8cf0`, with a cyan glow accent `#39d0ff`. Status colours are kept for status only.
- **Dark "command deck"** (`future.css`, loaded last):
  - deep-navy background with soft CAMS-blue light fields and a faint grid;
  - frosted-glass cards with edge highlights;
  - glowing primary buttons;
  - Space Grotesk for headings and numbers, Inter for text.
- **Depth and motion** (`features/viz/Viz.jsx`, SVG + CSS 3D + framer-motion, no WebGL):
  - **Tilt cards** that lean toward the pointer, with a moving glare.
  - **Reconciliation core**: a glowing ring gauge with a target tick and orbiting particles.
  - **Money flow**: animated streams from bank statements, PA settlements and PDF MIS → matching engine → released / held / problem cases / refunds. Hover isolates a stream.
  - **3D bank towers**: isometric towers per bank, height = auto-match rate, red when it dropped today. The scene tilts with the pointer.
  - **Module orbit** (admin): modules circle the CAMS core, node size = users with access; click to filter.
  - Count-up numbers, a glowing trend line and a glowing heatmap.

## UX: one thing at a time, no endless lists
| Screen | Before | Now |
|---|---|---|
| **Today** | Hero + 6 boxes + KPIs + a long list + a close-day section (endless scroll) | Fits one screen. **One focus task** ("1 of 31") with its action, *Skip for now* and back. A **day-progress ring**. A **cycle track** (6 stations, "You're here" follows the focused task). **Up next: 3 items only**. The full queue opens in a drawer on request. Close the day is a modal. Checkers' focus card approves or sends back inline. |
| **Approvals** | Long list of 38 rows | **Split view**: a contained, grouped list on the left; one item in detail on the right with *why it matters*. Approve with **A**, send back with **S**, move with **J/K**. The next item opens automatically, with a "done this session" counter. |
| **Match payments** | 7 cards in a grid | **One suggestion in focus** ("1 of 7") with Yes / Not a match; "Also waiting" shows up to 6 compact rows. |
| **Dashboard** | Flat charts | Command deck: core gauge, money flow, glass KPI cards, 3D towers, glowing trend, team workload, age heatmap |
| **User management (admin)** | 5 module cards | **Module orbit** plus 4 access-health tiles (active, invites pending, access changes to approve, dormant 60+ days) |

## Verified in the browser
- **Arun (checker):** Today, then Approvals. Keyboard **A** approved a refund and the next item opened.
- **Deepa (ops):** Today shows her focus task. In Match payments, accepting moved her from 1 of 7 to the next item.
- **Meera (admin):** the module orbit filters the user list.
- **Dashboard:** gauge, flow, towers and trend all render. I fixed SVG labels that the editor's code instrumentation was hiding.
- The production build compiles cleanly.

---

# Round 5: Channel handling in Bank files

**Date:** 21 Oct 2026 · **Diff for this round:** [`CHANNELS_DIFF.patch`](CHANNELS_DIFF.patch)

Bank files now has **three tabs**. Every file row shows **how it arrives** and **the next step** for that channel.

| Channel | What happens now |
|---|---|
| **Manual upload** (PRD v4 Stage 2, 3a) | **"Upload a statement (n waiting)"** button, plus *Upload statement* on any late or missing manual file. The upload pop-up shows what's expected (bank, account, date, deadline, where to download it), then runs **6 checks against the approved setup**: file type, layout, account number, statement date is today, not a duplicate, opening balance = yesterday's closing. A wrong file is **not loaded**, and the attempt goes into the file's history and the audit trail. The right file loads straight into matching. |
| **Email** (v1 email PRD) | **Email intake** tab: mailbox status (checked every 5 min) and every email received today, with its result: *matched to a setup*, *rejected* or *ignored*. Rejection reasons: no matching setup, attachment type not allowed, ZIP password failed, no attachment, duplicate. Each has a fix: **use this attachment for setup X** (e.g. SBI's emailed statement fills its missing manual upload), **retry with the vault password** (works only after the setup maker updates it), **ask the bank to resend**, **create an email setup**, **discard**. Each email shows the 4 steps the mailbox uses to decide. |
| **API** (3c) | **Bank connections** tab: health (Healthy / Slow / Failing / Paused), endpoint, last successful and next pull, response time, records today, last 7 pulls, token expiry, error. **Pull now** loads a late file. An expired token fails until the **setup maker renews it**. **Pause / Resume**. |
| **Portal bot** (3b) | Same connection cards. A bot blocked by a **CAPTCHA** says so and offers **Download by hand & upload**. |
| **Reprocess** (v4 Operator) | **Reprocess** on failed, re-fetched, unrecognised or loaded files, with a **mandatory reason** (audited) and an attempt counter. Reprocessing the *same* broken file **fails again** and explains why. Re-fetch (or upload a corrected file) first, then reprocess. A **processing history** timeline shows every step and attempt. |

Also changed:
- **Ops makers (Deepa) can now upload and reprocess files.** Confirming a bank's new file layout stays with the setup maker.
- **Today** includes upload, reprocess, rejected-email and failing-connection items.
- Step 1 of the day cycle counts files, rejected emails and failing connections.
- **Fixed:** drawer and pop-up bodies were near-white in the dark theme (unreadable). Pop-ups now open above drawers.
- **Fixed:** this browser held stale demo data from older builds under an old save key, so new data never loaded. The app now reseeds automatically if saved data lacks anything this build needs.

**Verified in the browser:**
- **Deepa:** uploaded SBI with the wrong account (rejected and logged), then with the right file (loaded). Pulling Yes Bank's API failed on the expired token.
- **Priya:** renewed the token, then pulled, and Yes Bank's late file loaded.
- **Axis:** re-fetch was blocked by the CAPTCHA and reprocess failed again; the corrected file uploaded by hand loaded, and reprocess on the loaded file passed.
- **ZIP email:** retry failed, then Priya updated the password, then retry matched.

The production build compiles cleanly. It's all simulated: there's no real mailbox, bank API or bot behind it.

---

# Round 6: One approvals place, linked setup and files, no white surfaces

- **"Setup approvals" merged into Approvals.** Approvals already listed setup items but sent checkers to the old screen to review them. Now the detail panel shows the setup summary, connection, file configuration and rejection history. **Send back requires a comment of at least 10 characters** (the PRD rule). The PRD's queue counts (total / awaiting / approved / rejected) sit at the top. The nav item is gone. `/dashboard` redirects checkers to Approvals (filtered to bank setups) and makers to their pending setups.
- **Bank files ↔ Bank statement setup** are explained and linked. Each page says what it's for and links to the other, and a file's drawer has *Open this bank's setup* (opens the setup list filtered to that account).
- **Dark theme sweep:** I scanned every route, wizard step, drawer, pop-up and toast for light backgrounds and fixed about 40 leftover light-theme rules. These included review-card headers, wizard footers, mapping selects, preview tables, the OTP boxes, quick-fill chips, pagination buttons, roadmap badges, demo-file links and toast notifications.
- **About the white drawer in your screenshot:** that was an older cached build in your browser. Port 3000 serves the fixed version; a hard refresh (Cmd+Shift+R) loads it.

---

# Round 7: Phase-1 setup screens rebuilt to the PRDs (+ researched [Fits PRD] improvements)

**Date:** 21 Oct 2026 · **Diff for this round:** [`PHASE1_SETUP_DIFF.patch`](PHASE1_SETUP_DIFF.patch) · **Research:** [`PHASE1_SETUP_RESEARCH.md`](PHASE1_SETUP_RESEARCH.md)

Only recommendations tagged **[Fits PRD]** were built. Every one sits inside a field or rule the PRDs already define.

### PRD rules the prototype had wrong, now fixed
| Screen | PRD rule | Before → now |
|---|---|---|
| Bank setup, Credit MIS | Reconciliation Type = **Subscription / Liability** | Subscription/Redemption/Both → Subscription/Liability. Credit MIS adds the **mandatory Liability category** (Redemption / Dividend / Refund / Brokerage). |
| Credit MIS | Instrument Status **C / D, optional**; Failure Reason Code = **dropdown from the Reversal Remarks table**, active codes only, **disabled and cleared when C** | SUCCESS/FAILURE/PENDING/ALL and free text → C/D (optional) and a reversal-code dropdown, with the C rule enforced. |
| Bank setup | **Masked account number** = a pattern the user types (e.g. `XXXXXX4512`) | Read-only preview → editable pattern with format validation and a "matches account ending 4512" check. |
| Bank setup | **Running Balance Cleanup** = toggle + **text box for the characters** | Toggle only → toggle + character box (required when on) + a live example. |
| Bank setup | **File Type** (DBF, XLS, XLSX, PSV, CSV, PDF, TXT, XXD) + **File Separator** (special characters only); start row/column ≥ 1 | Restored. Detection now **pre-fills** them (marked "Auto-detected") instead of hiding them. |
| Bank setup | **File Upload Path mandatory**; **Corporate ID mandatory**; **Re-enter Password** must match, with the PRD's error text | All enforced. |
| Column mapping | **Only the PRD field list**: 15 input fields + 10 `EXTRACT_*` narration-split fields; Mandatory toggle shows **Required / Optional**; status **Mapped / Disabled / Pending**; **INSTRM_AMOUNT mapped → credit/debit fields disabled** with an explanation; narration split "Disabled – enable to configure extract columns"; Save and Reset at **top and bottom**; bank account number required when bulk upload is on | Was 9 invented fields (TXN_AMOUNT, PA_REF…). Now exactly the PRD set and rules. |
| Admin | **Transaction status standardisation** table (v1 note · v4 §5.3), **admin only**, not the recon team | Did not exist → new screen under Administration. |

### Researched improvements built ([Fits PRD] only)
- **R2 — standard formats + sample-first.** File Type now has a "Bank standard formats" group: **MT940, MT942, CAMT.053, BAI2**. Dropping `sbin_3313_20261020.sta` is recognised as MT940 and shows what the pre-built parser read. Start row/column are hidden, and approving the setup creates **no mapping work** (the mapping record is marked standard). Custom files (CSV/XLS/TXT/DBF…) are analysed for type, separator, start row and column.
- **R3 — map by header name; duplicate key.** *Auto-map by header name* matches column names (synonyms such as "Tran Date", "Dr/Cr", "Ref No"). A column the last approved mapping used that **is missing from this file is flagged**, never silently re-used by position. *Suggest from sample* runs a uniqueness test on the sample rows and switches on the **Incremental flags** (PRD name kept, explained as "which columns make a row unique"). The PRD minimum of 3 still applies. On the IDBI sample it picks VALUE_DATE + INSTRM_AMOUNT + UTR_NUMBER + BANK_DESCRIPTION, because a reversal row repeats date, amount and reference.
- **R4 — SFTP file-name pattern.** The Upload Destination section has a **file-name pattern** (e.g. `SIBL_8855_\d{8}\.csv`) with a live check against names seen in the folder (picked up / ignored).
- **R5 — schedule + Test connection** (Auto / API, and Credit MIS Auto): every N minutes within a window, or once a day. *Test connection* calls once and shows the first rows, and the result is recorded on the review.
- **R6 — email as a governed backup channel.** Bank setup email mode has: sender; receiver (must be `@camsonline.com`); subject with **`%like%`** and a live check against recent subjects; attachment name pattern; ZIP / ZIP + password (vault); accepted attachment types derived from the File Type; and a fixed statement that **anything else is rejected and logged**. A note explains the PRD point that the same account may need a separate email setup because the emailed file differs. Credit MIS email/manual get the same checks for subject and file name (Prefix/Suffix/Contains/Exact).
- **R7 — what changes, from when.** Opening a live setup for edit captures the live version. The wizard review and the checker's Approvals panel show **"N changes against the live version"** (live → after approval) and **"Takes effect from the next file received after approval. Files already loaded are not re-processed."** The audit records *Submit new setup* vs *Submit edit* with the changed field names, and Approve records the effective-from note. A seeded HDFC edit (5 changes) demonstrates it.
- **R8 — status standardisation in the mapping.** When INSTRM_STATUS is mapped, the mapping lists each **distinct value in the sample** and how the admin table converts it (IDBI: CR → CREDIT, DR → DEBIT, **REV → not in the table, rows would be held**). A maker can only **ask an admin to add it**. The admin picks CREDIT/DEBIT, and a **second admin approves** (the Access Approver, on the same screen). Sign-based files (+/−) show Positive/Negative Amount. Separate credit/debit columns need no status values.

### Also
- Approving a bank setup now **creates its column-mapping record** (Not started, using the setup's sample), or marks it standard for MT940-type formats.
- **Fixed:** the bank setup *Submit* pop-up referenced a component that was not imported.
- **Fixed:** the info note was dark-blue-on-dark in the theme.
- Saved-data key bumped to v13 so the browser reseeds with the new fields.

### Verified in the browser
- **Priya** built an Auto setup: filled bank and connection, ran Test connection (passed), dropped the IDBI sample (CSV / comma / row 4 detected), tried the MT940 sample (standard; no start row), set the file-name pattern (2 of 5 example names picked up), turned on cleanup "Cr", reviewed and submitted.
- **Arun** saw the seeded HDFC edit with its 5-change diff, then approved Priya's setup. A mapping record with 25 PRD fields was created.
- **Priya** auto-mapped by header name (7 fields), got the INSTRM_AMOUNT → credit/debit disabled rule, used Suggest from sample, saw REV flagged, asked an admin, and submitted the mapping.
- **Meera** converted REV → DEBIT. **Rohit** approved it, and it is active.
- **Credit MIS:** C disables and clears the failure code; Liability without a category blocks submit; subject and file-name checks work.
- **Editing a live email setup:** "No changes" until the subject changed, then "1 change".

The production build compiles cleanly. Connections, mail and parsers are simulated.

**Still open:** bank setup list columns (Setup Name, File Type) and the 3-character search minimum (PRD_ALIGNMENT item 7).

---

# Round 8: Access, role-specific day, ingestion controls, matching evidence

**Date:** 22 Oct 2026 · **Diff for this round:** [`ROUND8_DIFF.patch`](ROUND8_DIFF.patch)

**Dropped on request:** the separate daily operations dashboard (point 4). Aging (point 5) lives in **Problem cases** instead.

| # | Requirement | What changed |
|---|---|---|
| 1 | Multiple roles, multi-AMC | Users carry **AMC access** (All, or a list), chosen in the user drawer. Today, Bank files, Problem cases and Approvals show only that person's AMCs. Multiple roles and maker–checker segregation were already in place. |
| 1 | Functional manager | New role **Recon · Functional Manager** and persona **Kavita**. She sees every Recon and Brokerage process but can only view, approve or export — never act as a maker. |
| 1 | Auto-deactivation (biometric) | **Last punch-in** shown for every user. **Run biometric check** disables IDs with no punch-in for 10 consecutive days, as "System (biometric rule)". The policy is marked as needing confirmation with the identity management team. |
| 1 | Inactivity 60+ days | A separate filter and tile (not logged in 60+ days), kept apart from the biometric rule. Also filters for auto-deactivated users and for no punch-in in 7+ days. |
| 1 | Reactivation | No longer instant. It needs a reason; biometric cases also need an identity-management ticket and confirmation that punch-ins resumed. A **second admin approves** it in Roles & Access. |
| 2 | Global search | Results are grouped by module (Reconciliation, Brokerage, Posting, **SIP** — a new placeholder module). A **"Do something"** group lists functions (manual upload, approve, new setup, reactivate…). Only permitted destinations show, and each screen appears once even when several roles grant it. |
| 3 | Role-specific stepper | Shows **only the person's steps**: the ones their roles let them act on, narrowed to the steps an admin assigned them (new "daily-cycle steps" field in the user drawer; Deepa is assigned 4). Steps are renumbered, with done/pending counts and "Other teams handle: …". Their queue holds only those steps' work. Checkers see the steps where they approve. Also: **Your focus for today**, and a **Welcome back** banner showing what's new since the last visit. |
| 5 | Aging | Configurable bands (default 0–5, 6–10, 11–20, over 20 days) with **count and ₹** in Problem cases. Bands past 5 days are red; clicking a band lists cases oldest and largest first; high-value and age tags appear on rows. Managers get a **breach summary**. For unidentified credits: *Ask bank for remittance details*, *Ask AMC / distributor*, and *Return to source account*. A note says the thresholds must be validated against SEBI rules. |
| 6 | Ingestion channels and completeness | **SFTP is the primary channel**, with a new **SFTP folders** tab (bank folder → account sub-folder, Completed / In progress / Error, Scan now). There's a strip for **Expected / Received / Not received yet**. Not-received files are **not failures**: they say the statement may not be out yet or there may be no transactions, show the reminder that went out, and offer "Bank confirmed: no transactions today". |
| 7 | Statuses | User-facing **Pending / Success / Failed** plus a **Status remarks** column (format mismatch, balance mismatch, duplicate, connectivity, unknown format). History keeps every attempt. |
| 8 | Fingerprints | The drift view explains what is compared, including a data-type change. **Review proposal in Column mapping** opens the mapping with the old, proposed and confidence values and a *Pre-fill* button. Nothing activates until a checker approves. Unknown formats go to onboarding. |
| 9 | Duplicates | **Level 1:** SHA-256 of the content, with the original file's time, source and name. **Level 2:** a composite key, with counts of skipped overlap rows, reversals kept, and repeats held for a person to confirm. The text states it is enforced by a unique database index. |
| 10 | Email | Plain-English reasons (e.g. "appears to be a file already loaded at 8:52 AM"). Fixes offered: upload by hand, **wait for a corrected email**, dismiss (who, when, why — and it says this does not complete the process). Alerts leave the focus list once the statement is loaded another way. ZIP is re-opened with the vault password; it's not called an API retry. |
| 11 | API / portal | A **job lock**: if a pull is already running, its progress shows instead of a second run. Each connection shows its last run (status, time, who). **Ask IT to run it** where users can't trigger directly. Errors are in plain language with the technical detail hidden. Alerts can be dismissed. CAPTCHA is never bypassed. |
| 12 | Manual upload | A separate **Manual upload (exception)** flow behind a new restricted capability: the ops maker has it, the setup maker doesn't. It needs a reason, handles **several accounts at once**, warns when SFTP would deliver the file anyway, and keeps the duplicate, completeness and balance checks. A log records who, when, why, which accounts and the outcome. |
| 13 | Balances | Files are either **validated** (bank supplies the closing balance) or **computed** (bank doesn't). Computed balances are labelled "not bank-verified". Continuity with yesterday's closing is kept, and setup help text explains both options. |
| 14 | Matching | **Manual matching is the main section**; system suggestions sit separately and say they need review. Matches backed only by amount and name are flagged and **never fast-tracked**. Similar purchases are shown side by side. Date gaps count **business days** (weekends and holidays excluded), with a SIP settlement allowance. A **cheque** rule needs number + drawee bank + account + amount; the seed has two cheques with the same number at different banks. Picking items by hand shows a field-by-field comparison. |

**Verified in the browser:**
- Stepper for Deepa (4 assigned steps), Arun (checker) and Kavita (approval steps only).
- Bank files as Deepa: status strip, SFTP tab, manual upload (logged), job lock with last run, and "Ask IT" on Kotak.
- Problem cases: aging bands and breach summary.
- Match: manual first, ambiguous suggestion flagged, cheque explainer.
- Users: Meera requested reactivation of an auto-deactivated user and Rohit approved it.
- Search as Farhan: Brokerage, Posting and SIP only.
- Priya: HDFC format change → mapping proposal pre-filled.

**Assumptions to confirm:**
- The biometric rule, with the identity management team.
- The 5-day threshold and how age is counted, against SEBI rules.
- The holiday list is a sample.
- Hashing, the database index and the IT run requests are simulated in the prototype.

---

# Round 9: Monitoring dashboards, processing rules, setup and mapping changes

**Date:** 22 Oct 2026 · **Diff for this round:** [`ROUND9_DIFF.patch`](ROUND9_DIFF.patch)

### Dashboards and monitoring
- **Closing balances** (new, Home): bank, account, last upload time and last closing balance for every account in the user's AMC.
  - An account with no statement yet is **highlighted until its cutoff**; after the cutoff it is greyed out, because it no longer affects today's NAV. A "Now / 12:00 / 3:30 PM" switch shows both states.
  - **Fund-utilisation check:** the closing balance either dropped after the debit, or it didn't and needs a call to the bank.
  - **Standard Chartered** shows a balance **computed from our data**; Citi now sends its own.
- **Scheduler monitor** (new; also given to a new **IT Support** role and persona, Vikram):
  - One view per topic (bank statements, Credit MIS, other pickups), split into SFTP, API and portal bot.
  - For each job: last completed run, last file received, next expected run (overdue shown in red), Success/Failure and remarks.
  - The job list can be exported.
- **File tracking (live)** tab: counts of files placed, picked up and processed, plus success, failed and pending — from the moment a file lands in SFTP. It also shows files **removed before pickup** and **missed scheduler slots**.
- **SVP view:** the existing dashboard keeps its top section. Below it are new panels for **setup missing** (accounts with no approved setup, banks with no active mapping), **excess credits** and **refunds by stage**.

### Bank statement processing
- **Duplicates:**
  - The file-level duplicate check is removed.
  - Duplicates are stopped per row at insert by a unique key in the database.
  - Only two counters remain: *New rows loaded* and *Already loaded earlier — skipped*.
  - Kotak shows the same file name received three times as a growing full-day dump.
  - Identical rows inside one file are loaded, since they are legitimate (e.g. SIP debits after a holiday).
  - The "no date gap" check is removed.
- **Format drift:** the remark names the error (e.g. HDFC 11 vs 10 columns). The file then shows the previous vs proposed mapping with confidence; the user can submit it directly or edit it in Column mapping, and a checker approves either way.
- **Closing balance mismatch:**
  - Shows **the exact two rows** where the balance breaks (row 11 → row 12), with the expected and actual figures.
  - **Download the uploaded file.**
  - Validation is **always on** (the toggle is removed). The fix is a corrected statement from the bank.
- **Recovery options:**
  - **Reprocess (rerun scheduler)**, **refetch full statement** (portal bot only, never for balance errors) and **manual upload** — an exception, for selected users, using the same format as SFTP.
  - "Not received yet" prompts a manual upload; it is not treated as a failure.
- **Processing order** is shown on Bank files and the scheduler monitor: Dividend/IDCW → Redemption → Switch → Purchases.

### Bank statement setup
- **Download priority** High/Low per account. High accounts (~13) are fetched first within the window, the rest after.
- **Liability type:** a single-select (Redemption, Dividend, Refund, Brokerage) appears when Liability is chosen. Liability matching is added to Match payments (*Liability — payouts out*), with UTR suggestions, manual N:M matching and checker approval.
- **Direct match** is off by default; its help text explains it limits the scheduler to the ~10–15 UPI accounts.
- **Copy setup** copies everything except the account number, for both bank statement and Credit MIS setups.
- **Several setups per bank:** a *Format name* field (e.g. Morning 10 columns / EOD 12 columns). The system uses whichever setup matches each file, and errors only if none match; the file drawer shows which setup was used.
- **Account counts per bank** on the list, with a bank filter, plus Format and Priority columns.
- **SFTP path / user / password** are display-only (one per AMC, to be moved to a central table).
- **Read the account from the sample:** the bank name printed in the sample is fuzzy-matched to the Bank Master (e.g. "HDFC BANK LTD" → HDFC Bank, account ·3337), with a *Use these* button.

### Column mapping
- **One mapping per bank** (and per layout when a bank has several), with a bank filter. Columns: bank, layout, file type, accounts using it, status, action. The editor header says **"Used by N accounts"**.
- **The whole sample is shown with a clickable header row** — in mapping and in both setup wizards.
- **Auto-map** shows a **confidence %** per column; a person reviews it and submits.
- The optional toggle is gone: **★ marks a mandatory column**, set per column, and a blank mandatory column rejects the file.
- **Date/time builder:**
  - Date order DD/MM/YYYY, YY or YYYY, and a separator.
  - Optional time part, 12- or 24-hour, seconds, and an AM/PM field.
  - A custom format option.
  - **Ambiguous dates** (e.g. 03/04) are pre-filled as a guess, with *Day first / Month first* buttons to confirm.

### Credit MIS
- **One payment aggregator per file**, as a dropdown with subtypes (Razorpay Online, Razorpay CMS, BillDesk, SAP…). *The codes are placeholders until the exact identifiers from the Credit MIS document are loaded.*
- A **Feed option** step at the end, including **No feed**: the bank-statement credit is copied as the feed (to be confirmed against today's screen). Feed options are placeholders for the Feed Option master.
- **Instrument status** is Credit only / Debit only / Not selected. If it's not selected, the file's status column becomes mandatory in mapping.
- A **reversal code** field. Reversal reason order: the file's value first, the selected default only if the file is blank.
- **View** (read-only) and **Copy** modes. The email ZIP password has no retype field, and the accepted/ignored previews are kept.
- **Narration tags** (new Setup screen) for bank charges, GST, interest and similar, with maker–checker on the same screen and a "try a narration" tester.

### Platform-wide
- **AMC in the header on every screen.** Multi-AMC users **pick the AMC at sign-in** and can switch from the header. All lists follow the chosen AMC.
- **Status filters** are the same everywhere: All, Active, Inactive, Draft, Pending for approval, Rejected. Not-started mappings count as Draft.
- **Authorisers add remarks, never edit:** an *Add remark only* button in Approvals, remarks shown to the maker, and edit buttons hidden for anyone without Maker rights.
- **Modules:** added CRMS, Customer Support, Purchase and MIS Reports, plus Posting → Redemption & switch and Dividend/IDCW. The role builder has **"Start from default menus"** (Maker / Checker / Viewer), which can then be adjusted by hand.
- The **inactivity limit is 10 days**, the same as the biometric limit.
- **Cutoff times** (new Setup screen) reuse scheme-master cutoffs read-only (Liquid/Overnight 1:30 PM). Asset-class times are set on the recon side with maker–checker. Closing balances uses them.

### Assumptions to confirm
- The Credit MIS aggregator identifiers and feed option values.
- How "No feed" works on today's screen.
- Cutoffs: whether the scheme master already holds them.
- The SFTP/GCS approach.
- The IT audience for the scheduler monitor.

The production build compiles. All the flows above were checked in the browser as Meera, Deepa, Priya and Arun.

---

# Round 9b: Scheduler monitor and Closing balances as visual dashboards

- **Scheduler monitor:**
  - **Overview** shows a job-health donut, the file pipeline (placed → picked up → processed → loaded) with problem chips, and four key numbers (jobs failing, runs overdue, average wait to pickup, next run).
  - A **Needs attention** list shows only failing or missed jobs, with their recent runs.
  - Every job appears as a card with a recent-runs strip.
  - **Advanced** (switch in the header, remembered) adds a day timeline of every run per job, a success split by channel (SFTP / API / portal bot), wait-to-pickup bars, and the live file flow.
- **Closing balances:**
  - A statements-in donut, a next-cutoff countdown with the accounts still awaited, and total closing balance vs the previous statement.
  - An arrival timeline with the cutoff lines, balance by bank, and a clean account list (Received / time left / Missed cutoff).
  - **The fund-utilisation check is removed.**
- **Fixed:** job, file and upload times were frozen at the day the data was seeded, so everything looked "overdue" and was dated 22 Oct. They're now calculated from the current time.

---

# Round 10: Bank statement setup — work queue page and sample-first "Add account"

- **Setup list:**
  - Shows a work queue first (needs fix / waiting for checker / drafts), with sent-back setups inline next to the checker's comment.
  - One line per bank, with problems opened automatically.
  - Short rows that tag only non-default settings.
  - A side panel with the key settings and labelled actions.
  - Follows the selected AMC; keyboard shortcuts `/` (search) and `N` (new).
- **Bank connections:** one per bank (channel, portal/API details, schedule, SFTP folder), set once and inherited by every account. Changes to it go through a checker. Open it from the chip on each bank line.
- **Add account in 3 steps (`/bank-setup/new`):**
  1. Drop a sample statement.
  2. Confirm what was found. The analyser reads the bank and account, layout, column mapping (with confidence), date format, closing-balance presence, credit/debit marks and any matching existing layout, and the connection is inherited from the bank. Only the uncertain items are flagged ("needs you").
  3. Review and send for approval.
- **Same rules as before:** every PRD field is still filled and stored, and maker–checker is unchanged.
- **More accounts in one go:** "Add more accounts like this" creates several setups from one sample. A new bank's column mapping is submitted in the same pass.
- **The six-step wizard** stays for edit, view and copy, and as "Set up by hand" (`/bank-setup/new/manual`). The prototype tip and its extra menu are removed.
- **Demo data:** about 200 accounts with one setup each; about 1 in 9 have no setup yet, so new accounts can be added.
