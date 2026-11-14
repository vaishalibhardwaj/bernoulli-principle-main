# CAMS Recon: data requirements for the architecture team

Written 13 Nov 2026. Draft for review.

**What this is.** The business fields Recon needs from each data source, what each one means, the flags involved and what the screens use them for.

**What this is not.** It names no database tables or physical columns. The architect decides those, the legacy-to-new mapping and how the data is brought in.

**Where each line comes from**
- **[List]**: the field list you gave on 13 Nov.
- **[CB doc]**: the Closing Balance & Fund Utilisation requirements document.
- **[PRD]**: the bank statement and Credit MIS baseline PRDs.
- **[To confirm]**: needed by a screen or rule, but nobody has confirmed it exists. I have not invented fields beyond these sources.

---

## 1. Bank statement

**Used for:** statement upload status, closing balance by account, the sweep indicator, total credit amount, Balance Does Not Match.

| Business field | What it means | Source |
|---|---|---|
| Bank name | The bank the statement is from | [CB doc] |
| Account number | The collection account | [List] |
| Transaction date | Date of the transaction | [List] |
| Transaction time | Time of the transaction | [CB doc] |
| Transaction sequence / order | The order of rows in the statement. Decides which row is "last" | [CB doc] [To confirm] |
| Debit amount | Money out, including AMC sweeps | [List] |
| Credit amount | Money in | [List] |
| Closing balance (running balance) | Balance after this row. The account's closing balance is this value on the last row of the business date | [List] [CB doc] |
| Narration | The bank's description of the transaction | [List] |
| UTR / instrument number | Reference used by Direct Match against CDT | [PRD] |
| Business date | The date the statement is for | [CB doc] |
| Last statement updated at | When the latest statement data for the account was loaded | [CB doc] |

**Flags and statuses**
- Statement status per account, business date and checkpoint: Not Uploaded, No Transactions, Uploaded, Pending, Failed. No Transactions means a statement arrived with no rows, never a missing statement.
- Credit or debit direction, standardised from each bank's own values [PRD].
- Transaction type and narration tag, applied from setup [PRD].

**Open points**
- Does the stored data hold a transaction sequence? Without it, "last row" can't be found as defined.
- Which field holds the running balance for each bank? Standard Chartered statements carry none.
- How are statements that arrive in several batches in a day stored?
- What makes a row unique? No row key is confirmed, and no file-level duplicate check is confirmed.
- What exactly is checked for Balance Does Not Match, and is it counted per account or per row?

---

## 2. Credit MIS

**Used for:** Credit MIS upload and monitoring in Phase 1. Matching against bank statements and purchases in Phase 2.

| Business field | What it means | Source |
|---|---|---|
| Application number | The purchase application the payment is for | [List] |
| Transaction amount | Amount paid | [List] |
| Payment mechanism | How it was paid | [List] |
| Transaction status | Successful or failed | [List] |
| Aggregator | The payment aggregator the file is from. One aggregator per file | [PRD] |
| Failure reason code | Why a failed transaction failed | [PRD] |
| Account category | Scheme account or pool account | [PRD] |
| Reconciliation type | Subscription or Liability. If Liability: Redemption, Dividend, Refund or Brokerage | [PRD] |

**Flags**
- Instrument status: the file's own status column wins; otherwise the setup's value applies to the whole file [PRD].

**Open points**
- The matching keys between Credit MIS, bank statement and purchase are not defined. Matching is Phase 2.
- The "Feed Option" rules sit in a separate functional specification that isn't available to us.

---

## 3. Remitter

**Used for:** remitter file upload, and the remitter schedules on the dashboard and File pickups.

| Business field | What it means | Source |
|---|---|---|
| Remitter reference | The reference identifying the remitter record | [List] |
| Amount | Amount remitted | [List] |
| Date | Date of the remittance | [List] |
| Account | The account the money came into | [List] |
| Bank | The bank the remitter file is from. Files arrive on each bank's own schedule | [To confirm] |

**Open points**
- How a missed or late remitter file is flagged is not defined.

---

## 4. Refund

**Used for:** refund reporting (Phase 2). In Phase 1 only the Refund Utilised breakdown in the fund position needs it.

| Business field | What it means | Source |
|---|---|---|
| Refund reference | The refund's own reference | [List] |
| Original transaction reference | The transaction being refunded | [List] |
| Amount | Refund amount | [List] |
| Status | Where the refund stands | [List] |

**Flags**
- Refund Utilised: shown for information. The amount is already counted elsewhere and must not be added again [CB doc].
- Refund Not Utilised: treatment depends on the accounting sheet [CB doc] [To confirm].

---

## 5. AMC refund

| Business field | What it means | Source |
|---|---|---|
| AMC reference | The AMC's reference for the refund | [List] |
| Refund amount | Amount | [List] |
| Status | Where it stands | [List] |

**Open point:** how an AMC refund relates to a Refund record in section 4 is not described.

---

## 6. AMC utilisation

**Used for:** the AMC Utilised columns of the fund position. The upload screen's phase is not confirmed.

| Business field | What it means | Source |
|---|---|---|
| Account | The collection account | [List] |
| Utilisation amount | Amount the AMC reports as utilised | [List] |
| Utilisation date | Date of utilisation | [List] |
| Credit entry reference | The bank credit the AMC says it utilised. Needed to match the entry to the bank statement | [To confirm] |

**Flags**
- Matched or Unmatched: whether the back office found the bank statement entry for the AMC's entry. Both count as AMC utilisation [CB doc].
- An entry counted as AMC utilised must never also be counted as CAMS utilised [CB doc].

**Open points**
- Where the Matched / Unmatched result is stored.
- Which field ties an AMC entry to a bank credit.
- Whether the upload and matching are Phase 1 or Phase 2.

---

## 7. CAMS utilisation

**Used for:** CAMS Fund Utilised on Closing balances and the dashboard, and the green/red indicator.

| Business field | What it means | Source |
|---|---|---|
| Account | The collection account | [List] |
| Utilised amount | Amount covered by a generated utilisation report | [List] |
| Utilisation date | Date the report was generated | [List] |
| Scheme code | The scheme the credit belongs to. Decides CAMS Not Utilised or Excess Credit on common accounts | [CB doc] |

**Flags**
- Utilisation flag (for example Y): set when CAMS generates the utilisation report for the record [CB doc].
- Classification per credit: CAMS Utilised, CAMS Not Utilised (scheme known, report not generated), Excess Credit (scheme not identified) [CB doc].

**Open points**
- The exact flag and report-generation field.
- Which records are included in the total.
- What period the total covers: the business date, a running total, or since the last sweep. The indicator has no meaning until this is fixed.

---

## 8. RCDT / RPBS

**Used for:** Direct Match in Phase 1 (bank statement to CDT on UTR or instrument number). The reconciliation engine in Phase 2.

| Business field | What it means | Source |
|---|---|---|
| Transaction identifiers | The references that identify a transaction, including UTR and instrument number | [List] [PRD] |
| Amounts | Transaction amount | [List] |
| Status | Reconciled or not | [List] |

**Open point:** I have only the names RCDT and RPBS and the three field groups above. The architect and Ops need to describe what each table holds.

---

## 9. Bank setup

**Used for:** deciding which accounts appear under Subscription or Liability, and how each statement is read.

| Business field | What it means | Source |
|---|---|---|
| Bank ID | The bank | [List] |
| Account number | The collection account | [List] |
| Subscription / Liability classification | Each account is one or the other, never both | [List] [CB doc] |
| Liability type | Redemption, Dividend, Refund or Brokerage, when the account is Liability | [PRD] |
| Account type | Scheme account or common account | [CB doc] |
| AMC | The AMC the account belongs to | [To confirm] |

**Flags** [PRD]: Is Active, Direct Match, Validate Running Balance, Compute Running Balance, Bulk Upload, Descending Order, Priority.

---

## The fund position (accounting sheet)

The sheet shown by the stakeholder has these columns per account: Opening Balance, AMC Utilised, AMC Utilised – Matched, AMC Utilised – Unmatched, CAMS Utilised, CAMS Not Utilised, Refund Utilised, Refund Not Utilised, Excess Credit, Closing Balance [CB doc].

The formula, signs and which columns count come from that sheet (cell F2). Product and Ops supply it; architecture should not derive it. It is not available yet, so no screen calculates a fund position.
