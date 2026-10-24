# Phase 1 (setup, connections, mapping): how leading recon products do it, and how CAMS should revamp it

**Date:** 21 Oct 2026
**Scope:** the PRD v4 Phase-1 core:
- Bank statement setup (v1 §2.1, v4 §5.1)
- Credit MIS setup (CMIS PRD, v4 §5.4)
- Column mapping (v1 §2.2, v4 §5.2/§5.5)
- Transaction status standardisation (v4 §5.3)
- Maker–checker on all of the above (v4 §5.6)

The four delivery channels the PRDs define: **Auto download, Manual upload (SFTP), Email, API**.

**Method:** only what each vendor's own documentation, or a clearly labelled third-party source, says. Each finding is marked:
- **[Doc]** the vendor's own docs or site
- **[3rd]** a third-party source
- **[Gap]** nothing found

My own recommendations are marked **(inference)** where no vendor evidence backs them.

---

## 1. What the vendors actually do

### 1.1 How a "source" is modelled
| Vendor | What they set up | Evidence |
|---|---|---|
| **Modern Treasury** | A **Connection** to a bank, with **Internal Accounts** on it. Connection types: *managed money movement* (pull data + push payments), *managed read-only* (pull transactions and balances), *self-managed* (you send data via "the API or other interfaces"). Production connections are provisioned by their Bank Integrations team; "the bank accounts must be opened and ready for direct transmission". | [Doc] [Banks & connections](https://docs.moderntreasury.com/docs/banks), [Internal accounts](https://docs.moderntreasury.com/payments/docs/internal-accounts-overview) |
| **Ledge** | A **Source** (bank, PSP, ERP or custom system) holding one or more **datasets**, each typed *Transaction*, *Balance* or *Other*, each with a schema. Add-source flow: choose source type → enter connection details and credentials → set ingestion schedule, schema and transformations. "Ledge will automatically fetch and ingest data on a scheduled cadence", as often as every 10 minutes. | [Doc] [Sources overview](https://docs.ledge.co/sources/overview.md), [Data ingestion](https://docs.ledge.co/sources/data-ingestion.md) |
| **Duco** | A **Data source** = a name + a **file-name pattern** (Java regex, case-sensitive), attached to one input of a reconciliation process. Without a pattern, files must use exact names, "which could result in the need for manual intervention when a system produces variable names". | [Doc, via search index] [SFTP submissions](https://support.du.co/hc/en-us/articles/360034011893-Automated-file-submissions-via-SFTP), [File name patterns](https://support.du.co/hc/en-us/articles/360033492914-File-name-patterns-for-submissions) |
| **BlackLine** | An **Import Definition** feeding a **Matching Data Source**. A third-party guide says column names and order must match the definition exactly, or the import fails with "400 Bad Request". BlackLine's own material mentions a Data Import Utility that performs "look-ups, concatenation, parsing or custom data manipulation" on import. | [Doc] [Transaction Matching API](https://developer.blackline.com/docs/matching/1/routes/dataingestion/data-sources/%7BimportDefinitionName%7D/put); [3rd] [DataBlend guide](https://lp.datablend.com/knowledge/blackline-data-targets) |
| **HighRadius** | Bank files (BAI2, MT940) plus "20+ remittance formats (CSV, Excel, JPEG)" from emails, AP portals, EDI and lockbox. | [Doc] [Cash application](https://www.highradius.com/product/cash-application-automation/enterprise/) |
| **Razorpay** | For settlement data, **an API instead of a file**: `GET /v1/settlements/recon/combined?year&month[&day]` returns payments, refunds, transfers and adjustments settled. | [Doc] [Settlement recon API](https://razorpay.com/docs/api/settlements/fetch-recon.md) |

**Pattern:** every product separates **the connection** (how data arrives, credentials, schedule) from **the dataset / format** (what the file looks like) and from **the accounts** it covers. CAMS's PRD bundles all three into one record per bank account, which is why it needs "Copy Setup" to avoid re-typing.

### 1.2 Channels
| Channel | What the evidence shows |
|---|---|
| **SFTP / host-to-host** | Ledge: connect an SFTP server with encrypted credentials for continuous ingestion [Doc] ([SFTP](https://www.ledge.co/integrations/sftp)). Duco: credentials and upload location supplied by Duco, files routed by name pattern [Doc]. Bank SFTP setups typically take **4–6 weeks** and need a bank technical contact and a test file [3rd] ([Numeric](https://help.numeric.io/articles/1673913596-setting-up-sftp-bank-connections-in-numeric-cash-management)). SFTP "does require a unique connection to each bank" [3rd] ([Atlar](https://www.atlar.com/learn/secure-file-transfer-protocol-sftp)). |
| **Manual upload** | Modern Treasury: in the UI (Admin role), "Upload Bank Files", **pick the Connection, attach one or more files with their file type** (BAI2 previous-day or intraday). Processing is asynchronous and "results typically appear within a few minutes". Re-uploads are **de-duplicated at transaction level**; API uploads should send an **idempotency key per file**. [Doc] ([BAI2 import](https://docs.moderntreasury.com/payments/docs/import-transactions-via-bai2-files)). Ledge: "Upload CSV files directly… or connect automated file drops through shared folders or pipelines" [Doc] ([CSV upload](https://www.ledge.co/integrations/csv-upload)). |
| **API** | Ledge: REST, JDBC, data warehouses, credentials stored encrypted [Doc]. India: **ICICI's Corporate API Suite** lists account balance and **bank statement retrieval**, and Corporate Net Banking supports ERP connection via APIs or **Host-to-Host** [Doc] ([ICICI API banking](https://www.icici.bank.in/blogs/current-account/api-banking-icici), [ICICI CNB](https://www.icici.bank.in/business-banking/ways-to-bank/corporate-digital-banking)). HDFC: MT940 via its Cash Management Services over SFTP or REST is claimed **only by a vendor blog** [3rd, unverified] ([Terra Insight](https://www.terra-insight.com/insights/hdfc-bank-reconciliation-india)). |
| **Email** | **[Gap]** No evidence that Modern Treasury, Ledge or BlackLine ingest **bank statements** by email. HighRadius aggregates **remittances** from email [Doc]. Duco's AIDP extracts data from PDFs, scans and **emails** using supervised models trained on the client's documents [3rd] ([press](https://financialit.net/news/data-management/duco-launches-reconciliation-unstructured-data)). Per-source dedicated inbound addresses appear in **invoice** tools, not bank recon [3rd] ([LayerNext](https://www.layernext.ai/post/invoice-reconciliation-software)). **So email is a CAMS-specific need (it's in the PRDs), not an industry pattern.** Design it as a controlled fallback. |
| **Account Aggregator (India)** | **[Gap]** Sources confirm AA scale and that RTAs like CAMS participate, but I found **no confirmation that corporate current-account statements** are shareable via AA ([Sahamati](https://sahamati.org.in/), [guide](https://casparser.in/blog/state-of-account-aggregator-2026/)). Don't plan on it for Phase 1. |

### 1.3 File formats and column mapping
| Vendor | Approach | Evidence |
|---|---|---|
| **Ledge** | **Standard schemas** for NACHA, **MT940/942, BAI2** and major processors, banks and ERPs. For anything else, **upload a sample (CSV, Excel, JSON) and define a custom schema** (field mappings, transformations, data types). Duplicates: pick **a subset of key columns** for uniqueness; same identifier → the record is overridden, not duplicated. | [Doc] ([Data ingestion](https://docs.ledge.co/sources/data-ingestion.md)) |
| **Duco** | *Generic* format: "provide Duco with sample data from which it can identify the file's type and structure". **SWIFT MT uses stored templates.** Map file headers to standard field names from a dropdown; "until you have mapped all of the fields required… you will not be able to proceed". **Field-name parsing** makes processes "more resilient to changes in file structure". Excel inputs limited to 2 MB. | [Doc, via search index] ([Data Prep](https://support.du.co/hc/en-us/articles/360012946058-Data-Prep-Quick-Start-Guide)) |
| **BlackLine** | Bank files requested as **BAI2, MT940 or CAMT.053**. Import definitions are strict on column names and order (third-party). Transformations during import. | [Doc] ([bank recs overview](https://cloud.kapostcontent.net/pub/d661e1b1-48f8-4ced-9900-a0ccfccd7c8d/blackline-bank-reconciliations-overview?kui=6lVReVUHa4m2dxTuaZu43w)); [3rd] |
| **Modern Treasury** | Uses "industry-standard file formats" (BAI2 carries "hundreds of codes" for balances, deposits and payments) and acts as the layer that handles bank-specific formats so customers don't have to. **MT940 is prior-day only**; BAI2 and MT942 can arrive intraday. | [Doc] ([How banks report](https://moderntreasury.com/journal/how-do-banks-report-balances-and-transactions)) |

**Pattern:** **use standard bank formats with pre-built parsers wherever the bank offers them. Map columns only for custom CSV/XLS files, and derive the mapping from a sample.**

### 1.4 Monitoring a source after setup
Ledge shows, per source: **connection status (active / failed / disconnected) with the error message**, **last successful connection**, and **daily row counts** "to spot missing or delayed data" [Doc]. Modern Treasury's monitoring docs weren't found **[Gap]**. Duco reports when a file "did not match the pattern of any of the Data Sources" [Doc].

### 1.5 Approvals and roles on setup changes
Modern Treasury: approval rules = **conditions + reviewers** (e.g. "two users from Finance"). A user **can't review what they created**. Rule create, edit and delete are **logged in the Audit Trail** and **not retroactive**. **A user can hold many roles**, with permissions set per resource to Manage/Edit, View Only or No Access [Doc] ([Approval rules](https://docs.moderntreasury.com/payments/docs/approval-rules-overview), [Roles](https://docs.moderntreasury.com/platform/docs/roles-and-permissions-overview)).

---

## 2. CAMS PRD Phase 1 against this evidence

| PRD Phase-1 element | Industry evidence | Verdict |
|---|---|---|
| One setup per bank account; Copy Setup to reuse (v1 §2.1.1) | All vendors separate connection, format and accounts (§1.1) | **Legacy pattern.** Copy Setup is a workaround for the missing split. |
| Manual mode = upload to an SFTP path; "no additional configuration" (v1, v4 3a) | MT: upload in the UI against a connection, async, deduped, idempotent. Ledge: direct upload **or** automated file drop | Keep the SFTP path **and** add in-app upload into the same pipeline |
| Auto/API mode: URL, Corporate ID, Login ID, Password (v1 URL & Credentials) | Ledge: credentials **+ schedule + status / last success / row counts**. ICICI offers a statement API | Missing: **schedule, test connection, status** |
| Email: subject pattern `%like%`, attachment, reject + log (v1 email; CMIS §Email) | No vendor uses email for bank statements (§1.2) | Keep (PRD requires it), but design as a **fallback** with strict routing and a log |
| File Type list DBF/XLS/XLSX/PSV/CSV/PDF/TXT/XXD (v1); "any other file formats supported" | Ledge, Duco, BlackLine and MT all centre on **MT940/942, BAI2, CAMT.053** | **Add standard formats.** The PRD wording already allows "any other formats" |
| Start row / start column / separator entered by hand (v1) | Duco infers type and structure from a sample. Ledge defines a schema from a sample | PRD's sample auto-detection (v4 change #5) is right; **make detection primary** |
| Header scoring + regex auto-map + reuse last approved (v1 §2.2, v4 #10) | Same idea as Duco's sample inference plus required-field mapping | ✅ Aligned |
| Mapping by column position (start row/column) | Duco: **field-name parsing** for resilience to structure changes | Add **match-by-header-name** |
| "Minimum 3 incremental flags" (v1 §2.2) | Ledge: choose **key columns for uniqueness** | Same concept. **Rename it "Duplicate key"** and explain it |
| File-name rules only in Credit MIS (CMIS §File Name Pattern) | Duco: **every** data source has a file-name pattern; unmatched files reported | **Add a file-name pattern to bank SFTP/manual setups** |
| Transaction status standardisation table (v4 §5.3) | Standard formats carry debit/credit codes (BAI2 type codes; MT940 D/C mark) | Keep the table, but **only custom CSV/XLS needs it** |
| Maker–checker on setups (v4 §5.6) | MT: conditions + reviewers, no self-review, audited, **not retroactive** | ✅ Aligned. Add **"effective from next file"** explicitly |
| 4 fixed roles, one per user (v4 §5.7) | MT: **many roles per user**, per-resource permission levels | Evidence supports the multi-role model you asked for earlier |

---

## 3. Recommended Phase-1 revamp

Each item is marked **[Fits PRD]** (wording or fields the PRD already allows) or **[Changes PRD — needs sign-off]**.

### R1. Split setup into Connection → Accounts → Format **[Changes PRD — needs sign-off]**
- **Connection:** bank + channel (Auto bot / SFTP / Email / API) + credentials (vault) + schedule + **Test connection**. Created once per bank channel.
- **Accounts:** pick one or many accounts from Bank Master that arrive on this connection (replaces "Copy Setup").
- **Format:** a standard format, or a custom layout from a sample (R2), with its mapping.

The UI can still show a per-account view, so every PRD field survives; only the grouping changes.
*Evidence:* MT Connection→Internal Accounts; Ledge Source→Datasets; Duco data source; BlackLine import definition.

### R2. Standard formats first, sample-based custom formats second **[Fits PRD]** ("any other file formats supported")
- Add **MT940, MT942, CAMT.053, BAI2** with pre-built parsers. Picking one skips manual column mapping, because fields are defined by the standard.
- Keep the bank-flavour quirks per bank (e.g. narration prefixes), since "individual banks… implement their own versions" [3rd] ([MT940](https://en.wikipedia.org/wiki/MT940)).
- For CSV/XLS/TXT/DBF: **upload a sample → detect type, separator, header row, date format** (PRD v4 #5) → mapping editor (PRD §5.2).
*Evidence:* Ledge standard vs custom schemas; Duco templates vs generic inference.

### R3. Mapping by header name, with a duplicate key **[Fits PRD]**
- Default to **matching columns by header name**; position is the fallback. A renamed column then becomes a visible mapping change instead of a silent mis-read.
- Rename "Incremental flags (min 3)" to **"Duplicate key: which columns identify one transaction?"** and pre-suggest it by testing uniqueness on the sample.
*Evidence:* Duco field-name parsing; Ledge key-column uniqueness.

### R4. Manual upload: both the PRD's SFTP path and an in-app upload **[SFTP: Fits PRD · in-app: Changes PRD — needs sign-off]**
- Setup asks for the **SFTP upload path** (PRD) **and a file-name pattern** (regex, e.g. `SBIN_3313_\d{8}\.xlsx`) so any dropped file routes to the right setup. Unmatched files go to an "unrouted files" list.
- Optional **in-app upload**: pick the setup, drop one or more files. Same pipeline, **file-level idempotency** (content hash) plus **transaction-level duplicate check** via the duplicate key (R3).
*Evidence:* MT UI upload against a connection, async, deduped, idempotency key; Duco file-name patterns and unmatched-file error; Ledge direct upload or file drop.

### R5. API and Auto download: schedule, test, status **[Setup fields: Fits PRD (extends §URL & Credentials) · status screen: Phase 2]**
- Add **schedule** (e.g. every 30 min, or a daily time) and **Test connection** to the setup wizard, showing a sample of rows pulled.
- At runtime (Phase 2) show **status (active/failed/disconnected) + last success + error + daily row count** per connection.
- For India, check bank by bank which offer statement APIs or H2H: ICICI's corporate API suite does [Doc]; HDFC's offering needs confirming with the RM.
*Evidence:* Ledge source configuration and monitoring; ICICI API banking.

### R6. Email as a governed fallback **[Fits PRD]**
- Keep the PRD fields: sender, receiver (`@camsonline.com`), subject `%like%` pattern, file-name pattern, ZIP password (vault).
- Add **attachment-type allow-list** and **what happens to non-matching email** (the PRD already says "rejected and logged"). Show the log in Phase 2.
- **(inference)** A *dedicated inbound address per setup* (e.g. `hdfc-0000@recon.camsonline.com`) would make routing exact instead of pattern-based. No bank-recon vendor documents this; only invoice tools do. Treat it as an option to validate with InfoSec and the banks.
- Track email-delivered accounts as candidates to move to SFTP/API (R5).
*Evidence:* gap noted in §1.2; PRD v1 email flow; CMIS email rules.

### R7. Approvals: impact, not just fields **[Fits PRD]**
- Keep maker–checker (PRD §5.6) and show what changed (diff).
- State **"effective from the next file; already-loaded data is not re-processed"**, mirroring MT's "not retroactive".
- Log create, edit and delete of setups, mappings and connections.
*Evidence:* MT approval rules and audit.

### R8. Status standardisation only where needed **[Fits PRD]**
Standard formats bring their own debit/credit indicators. The §5.3 admin table applies to custom CSV/XLS sources and is pre-filled from the sample's distinct values.

---

## 4. What stays out of Phase 1 (per PRD v4 §2.2)
Runtime screens (Bank files, Email intake log, Connection health, Reprocess) are **Phase 2** (the "ingestion engine" is a non-goal for Phase 1). Phase 1 should only **capture everything they will need**: schedule, file-name pattern, duplicate key, test result, effective date. The current prototype's Bank files screen is therefore Phase-2 design, not Phase-1 scope.

## 5. Open items to verify with vendors and banks (not found publicly)
- BlackLine's UI flow for file-based data sources and column mapping (only API and third-party evidence found).
- Modern Treasury's SFTP and file-reporting setup, and connection monitoring.
- Duco: details behind "field-name parsing" (support pages block direct reading; summary from search index).
- Per Indian bank: which offer MT940/CAMT.053 over SFTP/H2H, which offer a statement API, intraday availability, and onboarding time.
- Whether corporate current-account statements are available via Account Aggregator.

## Sources
- Modern Treasury: [BAI2 import](https://docs.moderntreasury.com/payments/docs/import-transactions-via-bai2-files) · [Banks & connections](https://docs.moderntreasury.com/docs/banks) · [Internal accounts](https://docs.moderntreasury.com/payments/docs/internal-accounts-overview) · [How banks report](https://moderntreasury.com/journal/how-do-banks-report-balances-and-transactions) · [Approval rules](https://docs.moderntreasury.com/payments/docs/approval-rules-overview) · [Roles](https://docs.moderntreasury.com/platform/docs/roles-and-permissions-overview) · [Reconciliation overview](https://docs.moderntreasury.com/reconciliation/docs)
- Ledge: [Data ingestion](https://docs.ledge.co/sources/data-ingestion.md) · [Sources overview](https://docs.ledge.co/sources/overview.md) · [CSV upload](https://www.ledge.co/integrations/csv-upload) · [SFTP](https://www.ledge.co/integrations/sftp)
- Duco: [SFTP submissions](https://support.du.co/hc/en-us/articles/360034011893-Automated-file-submissions-via-SFTP) · [File name patterns](https://support.du.co/hc/en-us/articles/360033492914-File-name-patterns-for-submissions) · [Data Prep quick start](https://support.du.co/hc/en-us/articles/360012946058-Data-Prep-Quick-Start-Guide) · [Unmatched data source](https://support.du.co/hc/en-us/articles/360013614658-No-processes-were-run-as-no-matching-data-sources-were-configured) · [Unstructured data launch](https://financialit.net/news/data-management/duco-launches-reconciliation-unstructured-data)
- BlackLine: [Transaction Matching API](https://developer.blackline.com/docs/matching/1/routes/dataingestion/data-sources/%7BimportDefinitionName%7D/put) · [Bank reconciliations overview](https://cloud.kapostcontent.net/pub/d661e1b1-48f8-4ced-9900-a0ccfccd7c8d/blackline-bank-reconciliations-overview?kui=6lVReVUHa4m2dxTuaZu43w) · [DataBlend guide (3rd)](https://lp.datablend.com/knowledge/blackline-data-targets)
- HighRadius: [Cash application (enterprise)](https://www.highradius.com/product/cash-application-automation/enterprise/)
- Razorpay: [Settlement recon API](https://razorpay.com/docs/api/settlements/fetch-recon.md)
- India: [ICICI API banking](https://www.icici.bank.in/blogs/current-account/api-banking-icici) · [ICICI corporate digital banking](https://www.icici.bank.in/business-banking/ways-to-bank/corporate-digital-banking) · [HDFC claims (3rd, unverified)](https://www.terra-insight.com/insights/hdfc-bank-reconciliation-india) · [Sahamati](https://sahamati.org.in/) · [AA 2026 guide (3rd)](https://casparser.in/blog/state-of-account-aggregator-2026/)
- General: [Numeric SFTP setup (3rd)](https://help.numeric.io/articles/1673913596-setting-up-sftp-bank-connections-in-numeric-cash-management) · [Atlar on SFTP (3rd)](https://www.atlar.com/learn/secure-file-transfer-protocol-sftp) · [MT940](https://en.wikipedia.org/wiki/MT940) · [LayerNext (3rd)](https://www.layernext.ai/post/invoice-reconciliation-software)
