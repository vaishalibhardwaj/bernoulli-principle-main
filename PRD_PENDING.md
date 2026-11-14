# PRD changes waiting to be applied

The Claude Docs service returned errors on 13 Nov 2026, so these PRD updates could not be written. Apply them to the PRD (project acce9046…, rev 107 or later), then delete this file. One earlier attempt failed with a server error and a retry answered "Not Found", which can mean the first attempt went through: check whether the two replacements below are already in the PRD before applying them.

## Central Setup › Recon sections (replaces the sentence starting "Column mapping is a short list of clean rows…")

All four sections use one list style: a row of column names, then one white row per item with the same columns, and a Show more step for long lists.

- **Accounts:** account (bank, masked number, scheme), mode, account type (Subscription, or Liability with its type), priority, status, updated, View. Filtered by search, Bank and Status.
- **Feeds (Credit MIS):** aggregator and account, mode, feed, account type, status, updated, View. Filtered by search, Aggregator and Status.
- **Column mapping:** bank and layout, file type, accounts using it, status, updated, Edit or View. Filtered by Status (Active, Inactive, Pending for approval, Rejected, Draft) and Bank.
- **Transaction type mapping:** value in bank file with who added it and when, system value, seen at, status (with "Review in To do" under it while pending), and a ⋯ menu that shows the database table and column with a Copy button. Filtered by Status and Seen at. "Add value" opens a short form. Values asked for by makers sit in their own list above.
- **Narration tags:** narration rule, text to look for, tag, bank, status, added by. Filtered by Status. "Add tag" opens a short form. Each live tag has Edit, which sends the change for approval while the approved tag stays in use. The "Try a narration" tester is removed.

## File pickups (replaces "Then Requires action (pickups that failed or did not run, with what went wrong and who fixes it),")

Then Requires action (pickups that failed or did not run: name, channel and schedule, last run, status),

## Users (new paragraph for the Users screen)

Users shows three statuses: **Active** (the ID works), **Inactive** (the ID is switched off; previously "Deactivated") and **Pending** (invited, not signed in yet; previously "Invited"). An active ID with no sign-in for 10+ days or no biometric punch-in for 7+ days stays Active, and its Last activity line says so in amber; it is no longer a separate status. The top panel shows people with a CAMS ID and the three statuses, each with a bar for its share; clicking one filters the list. The list has column names: Person (name and employee ID; the designation shows on hover), AMC access, Module and role, Status, Last activity, and a ⋯ menu (Edit roles and AMC access; Deactivate or Request reactivation for those allowed). AMC access shows "All AMCs", one AMC by name, or "3 AMCs", which opens the full list in a panel above the page. Search, a Status dropdown and Export sit above the list. The AMC and From–To date are global filters on one toolbar under the title: filters on the left, Run biometric check and Assign roles on the right, all the same height. People by module is one compact panel between the top panel and the list: a small tile per module with its number of people and a thin bar, most people first, so ten or more modules fit in two rows; the role counts are removed; clicking a tile filters the list. It counts only people who signed in recently. Sample people are seeded for CRMS, Customer Support, Purchase and MIS Reports (roles marked as samples) so every module shows a count. The list uses the full width so names, AMCs and roles are never cut off; on narrow windows each person becomes a small card with the same details stacked.

## To do (replaces the To do paragraph that starts "To do (Central Setup Team) no longer has large tiles.")

To do has one short panel with the greeting, the date, the AMC and three figures: To approve, Sent back to you and Requests from Ops. The three figures are also the switch between the lists; the separate tab row and the More lists dropdown are removed, so each count appears once. Under the panel, one line holds the type filter, the search box and the From–To dates (on To approve and Sent back). The dates open on today and list everything still pending today; changing a date filters by it. Drafts are not in To do; they stay on each setup screen.

## Today (Recon Ops; replaces the Home screens description of Today's tiles, "Today's to-do" and the Up next / Overall pending lists)

Today is one focus screen. The header has the greeting, date and AMC on the left and, on the right, three small counts (Approvals waiting, Sent back to you, Files that failed; each opens its screen) and a small Fund release cutoff indicator with a ring and the time left or "Passed". The tile subtexts are removed.

Below is one Do this next card. It shows one item at a time from a single list that combines approvals waiting (Level 1 and Level 2), the day's tasks from the KRAs, and Close the day, which is always last. The list is ordered most urgent first (overdue, then due within the hour, then later), then oldest first. The card shows the item's type, when it is due ("Was due at 10:30 am. Do it now."), its title and one line on what to do. Actions: Open it (or Review for an approval, which opens the review window), I have done this (tasks; it goes to the functional manager for review), No action required (asks for a reason and sends the call to the functional manager to check; the item leaves the list), Previous, and Skip for now. The card's top line holds the position ("1 of 10"), the From–To dates (today by default; everything still open today is shown until a date is changed) and See all, which opens the full list in a side panel. The bottom line shows tasks done today and one dot per item. The separate "Your queue, one at a time", "Where your day stands", Up next, Today's to-do and Overall pending sections are removed, and the 7 days / 30 days buttons are gone.

Addition to Today: the list now also includes the work items for everyone who has them, not only for people without approval rights: files that failed or changed layout, rejected statement emails, failing bank connections, late or missing statements, and balances that do not match. A fourth header count, Done today, opens a side panel listing everything the person did today (from History), newest first, with each ticked task's review status (Waiting for review, Reviewed by…, Sent back by…).

Addition to Today (file problems): Recon Ops now also see a bank's layout change in their list, not only the Central Setup Team. The item reads "HDFC Bank changed its file layout" with the account, how many columns changed, the lowest column confidence and how many rows are held (for example "3 columns changed · lowest confidence 90% · 2,184 rows held"), and "See what changed" opens the file in Bank files with the structure fingerprint, the completeness checks, the old and new columns side by side, and each column's proposed mapping with its confidence. Central Setup confirms the new mapping and a checker approves it; while it waits the item reads "layout change is waiting for approval". Files that landed in SFTP or were uploaded on screen but failed when picked up (for example "Format mismatch (11 vs 10 columns)") also appear, as "<file name> was not loaded". Statements whose balances do not add up, missing or late statements, unrecognised files and rejected emails stay as before.

## Today: where each button goes (new section)

Every item on Today has one main button with a fixed destination. A button is shown only if the person may open that screen.

| Item | Button | Goes to |
|---|---|---|
| Task: Upload bank statements | Upload the statement | File upload, Bank statement selected |
| Task: Upload Credit MIS files | Upload the Credit MIS file | File upload, Credit MIS selected |
| Task: Upload remitter file (bank) | Upload the remitter file | File upload, Remitter selected, bank filled in |
| Task: Check the statement checkpoint (morning, afternoon, evening) | Open the checkpoint | Bank files, with that checkpoint selected |
| Task: Check Credit MIS processing status | See today's Credit MIS files | File upload, today's list with upload and processing status |
| Task: Chase statements not uploaded | See statements not uploaded | Bank files (checkpoint lights and today's files) |
| Task: Review closing balances that don't match | See balances that don't match | Closing balances, filtered to Balance does not match |
| Task: Review funds not utilised | See accounts where a sweep may be pending | Closing balances, filtered to Sweep may be pending |
| Task: Follow up late remitter feeds | See remitter schedules | Dashboard, scrolled to Remitter schedules |
| Statement not received (arrives by hand) | Upload the statement | File upload, Bank statement selected, bank and account filled in |
| Statement not received (scheduler, API or bot) | Get the file | Bank files, that file open |
| Statement balances don't add up | See the mismatch | Bank files, that file open (ask the bank for a corrected statement, upload it, or reprocess) |
| Layout changed | See what changed | Bank files, that file open in the layout-change panel |
| File that failed at pickup | Upload it again | File upload, that file type selected, today's list shown |
| Rejected email | See the email | Bank files, Emails, that email open |
| Bank connection failing | See the connection | Bank files, Bank connections |
| Approval waiting | Review | The review window |
| Close the day | Close the day | The day-close window |

Every item also has I have done this (tasks only), No action required (reason sent to the functional manager) and Skip for now.

## Bank files: rejected email (replaces the email actions)

A rejected email offers only: Use this attachment for <account> (when the system can tell which missing statement it is), Upload the statement by hand instead, and Discard. Wait for a corrected email and Dismiss alert are removed. Discard asks for a reason (not a statement, duplicate, wrong account or AMC, loaded another way, or other with a note), marks the email discarded, and sends the call to the person's functional manager, in the same list as No action calls.

## Bank files: layout change panel (replaces the drift section of the file panel)

A statement whose layout changed opens a panel in three parts. What happened: the bank, a one-line summary, and three figures (columns changed, lowest confidence, rows held, not lost). What changed: the approved columns next to today's columns, removed ones struck through and new ones highlighted, then the proposed mapping for each changed field (was, proposed, confidence bar and percentage, and the reason). Checks (structure fingerprint, completeness checks, and which setup matched) and Processing history are folded and open on click. At the bottom, "What do you want to do?" offers, by role: Fix it in Column mapping and Use the proposed mapping (Central Setup), Ask Central Setup to fix it (Recon Ops; raises a setup request with the proposal, and the Today item then reads "layout change is with Central Setup"), Leave it held (anyone who can act; asks for a reason and sends the call to the functional manager), and Approve and load the held rows (a checker, once a mapping change is waiting). Rows are never lost; they load when the new mapping is approved.

Additions to "Today: where each button goes":
- Tasks added in Task templates go to the screen for their area: Upload → File upload; Monitor → Bank files; Missing files → Bank files; Balances → Closing balances; Funds → Closing balances filtered to Sweep may be pending; Matching and Problem cases → their screens (Phase 2, so the button is hidden until those screens exist).
- A task whose screen the person cannot open (Match transactions, Resolve excess credits, Process refunds in Phase 1) shows only I have done this and No action required.
- Upload AMC utilisation file opens File upload without a type picked, because the utilisation file type is still to be confirmed.
- Late manual SFTP uploads go to Bank files, SFTP folders.
- A layout change shows when it was first detected and no repeat count (it happens once; only file format errors repeat with each pickup).

## Today: size (addition)

Today is compact: a smaller greeting, small header counts and cutoff indicator, and a Do this next card sized to its content (title in the size of a section heading, regular buttons). Previous and Skip for now sit on the same line as the actions.
