## **<u>Recon Business Requirement Document</u>** 

|**1. Objective of the recon---------------------------------------------------------------------**|
|---|
|**2. Process stage--------------------------------------------------------------------------------**|
|**2.1.Bank statement download----------------------------------------------------------**<br>**2.2.Bank statement upload--------------------------------------------------------------**<br>**2.3.Credit MIS / Reverse feed upload-------------------------------------------------**<br>**2.4.Reconcile bank statement vs Credit MIS----------------------------------------**|
|**2.5.Credit matching between credit MIS vs purchase transaction------------**|
|**2.6.Fund utilization report---------------------------------------------------------------**|
|**2.7.Refund -----------------------------------------------------------------------------------**|
|**3. Process flow chart--------------------------------------------------------------------------**|
|**4. Reports ---------------------------------------------------------------------------------------**|
|**4.1.Unreconciled – Credit side---------------------------------------------------------**<br>**4.2.Unreconciled – Purchase side-----------------------------------------------------**<br>**4.3.Bank statement------------------------------------------------------------------------**|
|**4.4.Credit MIS report----------------------------------------------------------------------**|
|**4.5.Cheque bounce - posted / unposted (Credit MIS side) ----------------------**<br>**4.6.Cheque bounce - posted / unposted (Purchase side) ------------------------**|
|**4.7.Cross collection------------------------------------------------------------------------**|
|**4.8.Refund process ----------------------------------------------------------------**|
|**4.9.Purchase register----------------------------------------------------------------------**|
|**4.10.**<br>**Existing unit specific reports-----------------------------------------------**|
|**5. General Ledger -----------------------------------------------------------------------------**|
|**6. Bank reconciliation statement (BRS) ------------------------------------------------**|
|**7. Physical cheque bounce instruments------------------------------------------------**|
|**8. Exceptions-----------------------------------------------------------------------------------**|
|**9. Out of the scope----------------------------------------------------------------------------**|



# **Objective** 

The reconciliation of mutual fund transactions is a critical activity within financial processing. SEBI guidelines require that purchase applications be processed only after fund realization, regardless of the transaction amount. Units must therefore be allotted only after the corresponding credit is realized in the mutual fund collection account. 

The following objectives must be carefully supported in the re-architected system. 

- Ensuring Data Accuracy and Consistency (Matching Records & Identifying Discrepancies) 

- Preventing Errors and Fraud 

- Maintaining Financial Integrity and Stability 

- Ensuring Regulatory Compliance 

- Minimizing Risk 

## **Flow diagram :** 

https://app.diagrams.net/ 

## **User Persona** 

   - 1.1 ATR back-office user (Recon) 

   - 1.2 Stock Exchange (BSE & NSE) 

   - 1.3 Payment aggregator 

   - 1.4 Banks 

   - 1.5 Channel 

   - 1.6 MFU 

   - 1.7 Front office (ATR & AMC) 

   - 1.8 EDMU & CODE (Quality Check) 

   - 1.9 Transaction processing team (Posting department) 

   - 1.10 AMC operation 

- 1.1 ATR back-office user 

The ATR back-office user has the primary responsibility for carrying out the reconciliation process. The user downloads the bank statement and saves or uploads it 

into the database. The credit MIS file is then downloaded and saved or uploaded into the database. Reconciliation is subsequently performed between the bank statement and credit MIS, and also between the credit MIS and purchase transactions. The fund utilization report is shared with the AMC and the fund accountant. In addition, refunds for NIGO cases and excess credits are processed, and the relevant reports are exported on time to the appropriate stakeholders. 

## **2.1 Bank statement download** – The application shall provide a centralized 

configuration module to manage and maintain all bank statement download and processing configurations. 

- Only bank accounts that have been duly configured and authorized within the system shall be eligible for statement download and processing. 

## **2.1.1Landing Page:** 

## **Bank Statement Download Setup - Landing Page** 

The **Bank Statement Download Setup** landing page shall provide a consolidated view of all configured bank statement download setups and enable users to perform account configuration management activities. 

## **Summary Display** 

- The landing page shall display a summary of all configured bank account setups. 

- The summary section shall display key details of each configured account and provide options such as **Search** , **Add New** , and **Copy Setup** . 

- Users shall be able to view both active and inactive configurations based on the selected status filter. 

## **Status Filter** 

- A **Status Filter** dropdown shall be provided with the following options: 

   - **ALL** 

   - **ACTIVE** 

   - **INACTIVE** 

- The default value shall be **~~ALLA~~** **<u>CTIVE</u>** . 

- When **ACTIVE** is selected, only active account configurations shall be displayed. 

- When **INACTIVE** is selected, only inactive account configurations shall be displayed. 

- 

- When **ALL** is selected, both active and inactive account configurations shall be displayed. 

## **Search Functionality** 

- A **Search** icon shall be provided adjacent to the **Add New** button in the top-right corner of the screen. 

- Users shall be able to search records using either: 

   - **Account Number** , or 

   - **Bank Name** . 

- The search functionality shall operate across all configured records and shall not be limited to the records displayed on the current page. 

- Users shall be required to enter a minimum of **three (3) characters** before the search is initiated. 

- The system shall support **wildcard/partial-text search** on both the Account Number and Bank Name fields. 

- Search results shall be dynamically displayed based on the entered search criteria. 

- If no matching records are found, the system shall display the message **“No** 

## **Records Found.”** 

- <u>search functionality</u> 

##  



## **Pagination** 

- The summary grid shall support pagination. 

- A maximum of **15 records** shall be displayed per page. 

- Records exceeding the page limit shall be displayed on subsequent pages. 

- Pagination controls shall be positioned in the **top-right section above the data grid** . 

- Users shall be able to navigate through records using: 

   - **First Page** 

   - **Previous Page** 

   - **Next Page** 

   - **Last Page** 

- If no records are available for display, the system shall present the message **“No Records Found.”** 

- <u>[pagination functionality]</u> 

 



<!-- Start of picture text -->
LW Nel i<br>Recon_PRD_Paginat<br>ion.doc<br><!-- End of picture text -->

## **Add New Configuration** 

- An **Add New** icon/button shall be available in the **top-right corner** of the landing page. 

- Upon selection, the system shall navigate the user to the **Bank Statement Configuration Setup** screen. 

- Users shall be able to create and maintain a new bank account configuration from this screen. 

## **Copy Setup Functionality** 

- A **Copy Setup** icon/action shall be available against each configured bank statement setup record. 

- The system shall allow users to create a new bank statement configuration by copying an existing setup. 

- Upon selecting the **Copy Setup** option, all configuration details from the selected setup shall be duplicated into a new configuration record. 

- Users shall be required to modify only the **Account Number** before saving the new setup. 

- All other configuration parameters shall be retained from the source configuration. 

- The system shall validate that the newly entered Account Number does not already exist in the configuration repository before allowing the record to be saved. 

- This functionality shall minimize manual configuration effort and improve efficiency where multiple bank accounts share the same bank statement download and processing setup. 

## **Example:** 

An existing **HDFC Bank** configuration for **Account 1** may be copied to create a new setup for **Account 2** . In such cases, only the **Account Number** needs to be updated, while all other configuration details, including download mode, file type, processing configurations, and bank-related settings, shall remain unchanged. 

- 2.1.2 The summary screen shall display the configured bank statement setups in a tabular format with the following columns: 

   - **Setup Name** shall display the unique name assigned to the configured bank statement setup. 

   - **File Type** shall indicate the type of file configured for the setup, such as **Bank Statement** or **Reverse Feed** . 

   - **Download Mode** shall display the configured file retrieval method used for the setup, such as **Email** , **Auto Download** , or **API** . 

   - **Bank Name** shall display the name of the bank associated with the configured setup. 

   - **Account Number** shall display the bank account number linked to the configured setup. 

   - **Status** shall display the current status of the setup as **Active** or **Inactive** . The status shall be visually represented using color indicators, where **Green** denotes an Active setup and **Red** denotes an Inactive setup. 

   - **Actions** Provides the following actions for each setup: 

**View** – Opens the selected setup in **read-only mode** , enabling users to review all configured details without the ability to modify any information. **Edit** – Opens the selected setup in **edit mode** for users with **Maker** privileges. Upon saving the changes, the updated setup will be routed through the **Maker–Authorizer approval workflow** . The modifications shall become effective only after they have been reviewed and approved by an authorized **Authorizer** . 



<!-- Start of picture text -->
SETUPNAME FILE TYPE IMPORT VIA. BANK NAME ACCOUNT NO ACTIVE) ACTH<br>OUMMY_8S Bank Statement API HDFC BANK LTD 987654321 @ 7B<br>HOFC.8888 Bank Statement SFTP HOFC BANK LTD ssse55555 a) #8<br>1c1c1_9999 Bank Statement SFTP {CIC BANK LTD 999999999 a) 2<br>‘TRXN_ETF__ Transaction SFTP @ Pacey<br>CHOICE_M. Transaction sete @ 2a<br>ICICLSTMT_.Bank Statement SFTP {CIC BANK LTD 00405164557 a7 4B<br>HOFC_STM_ Bank Statement SFTP HOFC BANK LTD 00132320002347 a7} 4a<br>BANKING _ Bank Statement SFTP 1C1C! BANK LTD: 000405165109 «g 7B<br>YES.4023 Bonk Statement SFTP YES BANK 026881300004023 a) 7B<br>HOFC_E776 Bank Statement SFTP HDFC BANK LTD S7S000017S8776 @ 4B<br>HOFC_837 Bank Statement SFTP HDFC BANK LTD s7S00007758571 @o 28<br>$31 236 Bank Statement SFTP STATE BANK OF INDIA 44127504516 a 7B<br><!-- End of picture text -->

## **Bank Configuration Setup** 

- The **Bank Configuration Setup** screen shall be displayed when the user selects the **"Add New"** option from the landing page. 

- The first tab in the setup process will be **Download Mode** . This tab allows the user to select the mode through which transaction data for the specified bank account number will be received and processed by the system. The selected download mode will determine the mechanism used for importing account data into the application. 



<!-- Start of picture text -->
‘ey DownloadSelect how bark Mode statementfes are delvered tothe sytem<br>wana ewan aa<br>Scheduled auto-dowoload via URL& Files uploaded manually— no URL Files detivered via emall—<br>or credential configuration needed configure mailbox and attachment «configuration required ony<br>credential. Direct AP integration— URL<br>rules.<br><!-- End of picture text -->

The screen shall present four selectable card options, allowing users to choose the preferred file retrieval method: 

1. **Auto Download** – Enables automated file retrieval using a configured URL and authentication credentials. 

2. **Manual Upload** – Allows users to upload files manually. No additional configuration is required for this option. 

3. **Email** – Supports file delivery through a designated email channel. 

4. **API** – Enables direct file integration through API-based connectivity. 

## **Auto Download Configuration** 

When the **Auto Download** option is selected, the system shall automatically navigate the user to the **Bank Information** tab. The **URL and Configuration** section shall be enabled, allowing the user to provide the required endpoint details, authentication credentials, and other configuration parameters necessary for automated file retrieval. 

## **Bank Information Tab:** 



<!-- Start of picture text -->
Bank Information<br>*" Core bank account identification and scheme linkage<br>BANK NAME* © BANK ACCOUNT NUMBER* ©<br>Select bank from master. . Select account from master. .<br>SCHEME<br>/ COMMON ACCOUNT* SCHEME CODE / SUB FUND<br>Select account nature...<br>Defaults to ALL<br>ASSET CLASS © MASK ACCOUNT NUMBER ©<br>Defaults to ALL<br><!-- End of picture text -->

- **Bank Name** – The system shall provide a **Bank Name** dropdown populated with values maintained in the **Bank Master** . This field shall be **mandatory** . 

- **Bank Account Number** – The system shall retrieve and display the **Bank Account Number** from the master data corresponding to the selected bank. This field shall be **mandatory only when the Bulk toggle option is enabled** . 

- **Scheme / Collection Account** – The system shall provide a dropdown that enables the user to classify the selected bank account as either **Scheme** or **Collection** . This field shall be **mandatory** . 

- **Scheme Code / Sub-Fund Code** – The system shall automatically retrieve the **Scheme Code / Sub-Fund Code** from the **Scheme Master** based on the selected account. The value shall be displayed as a **read-only label** and shall not be editable by the user. 

- **Asset Class** – The system shall automatically retrieve the **Asset Class** from the **Scheme Master** based on the selected account. The value shall be displayed as a **read-only label** and shall not be editable by the user. 

- **Masked Account Number** – The system shall provide an option for users to configure a **masked account number pattern** to support scenarios where the account number received in the bank statement is partially masked. The 

configured pattern shall be used by the system to identify and map the corresponding bank account during file processing. 

- Users will enter the masked account number exactly as it appears in the bank statement (for example, XXXXXX1234). During file processing, if the system detects an account number matching the configured masked pattern, it shall identify the corresponding account and replace the masked value with the actual account number maintained in the system setup. This ensures that transactions are correctly mapped even when bank statements contain masked account numbers. 

- When a user selects the **Copy** option for an existing bank statement setup, all fields **except Bank Name** shall remain unpopulated. The user shall be required to provide only the **Bank Account Number** and select the appropriate **Scheme/Collection Account** . The remaining account-related details shall be automatically derived and populated by the system based on the values entered or selected by the user. 

## **URL and Credentials:** 



<!-- Start of picture text -->
@ URL& Credentials<br>~ 4 f<br>uRL*<br>FILE DOWNLOAD PATH*<br>CORPORATE ID LOGIN1D<br>PASSWORD RE-ENTER PASSWORD<br><!-- End of picture text -->

- **URL and Authentication Configuration** 

- **URL** – The **URL** field shall be enabled only when the **Auto Download** or **API** option is selected. The field shall remain disabled when the **Email** option is selected. 

- **File Download Path** – The system shall provide a **File Download Path** field that allows users to specify the directory location where downloaded files will be stored. 

- **Corporate ID** – The system shall provide a **mandatory Corporate ID** field for users to enter the corporate identifier required for authentication. 

- **Login ID** – The system shall provide a **mandatory Login ID** field for users to enter the user identifier required for authentication. 

- **Password** – The system shall provide a **mandatory Password** field. All characters entered in this field shall be masked to ensure confidentiality. 

- **Re-enter Password** – The system shall provide a **mandatory Re-enter Password** field to allow users to confirm the password entered in the Password field. 

- **Password Validation** – During validation, the system shall verify that the value entered in the **Re-enter Password** field matches the value entered in the **Password** field. If the values do not match, the system shall display the following error message: 

- **“The Password and Re-enter Password fields do not match. Please enter matching values and try again.”** 

**Email download: Although email download could be back up option in some cases,** **<u>the actual file or format received via portal or API will be different from what we receive from email, in that case for a same bank account number, there will be multiple setups possible, there should be provision for the same.</u>** 

## **Functional Requirements** 

1. **Email Monitoring** 

   - The system should monitor the designated email inbox for incoming bank statement emails. 

   - It should identify bank statement emails based on the configured email subject pattern. 

## 2. **Subject Line Processing** 

- Read and parse the email subject line. 

- Extract the relevant bank identifier or other required information from the subject. 

- Use this information to identify the corresponding bank configuration from the mapping setup. 

- <u>%like% operator may be put to use here as date or some other serial number may be appended daily with the actual flei</u> 

## 3. **Attachment Download** 

- Retrieve the attachment from the identified bank statement email. 

- Download and store the attachment for further processing. 

- Validate that the expected attachment is present and in the supported format. 

## 4. **Bank Mapping** 

- Match the bank identified from the email subject against the configured bank mapping. 

- Retrieve the processing rules, expected file format, and target database table associated with the mapped bank. 

- If no valid mapping exists, the statement should be rejected and logged for further review. 

## 5. **File and Data Validation** 

- Validate the attachment format against the bank-specific configuration. 

- Perform all configured validations, including: 

   - File format and structure 

   - Required columns/fields 

   - Data types and formats 

   - Mandatory field validation 

   - Duplicate statement/transaction validation 

   - Bank-specific business rules 

   - Any additional validation rules configured for the bank 

## 6. **Database Processing** 

- Once all validations are successfully completed, transform the statement data into the required database structure. 

- Insert the validated data into the respective bank-specific database table(s). 

<u>`o`</u> Maintain processing status and audit information for each statement. 

- <u>There is a possibility or split or merge multiple columns basis pre-defined patterns are to be considered</u> 

## 7. **Exception Handling** 

- If the email, subject, attachment, bank mapping, file format, or data fails validation, the system should not insert the invalid data into the database. 

- Capture the failure reason and processing status in the appropriate logging/audit mechanism. 

- Failed statements should be available for investigation and reprocessing where applicable. 

## **End-to-End Flow** 

**Email Received → Read Subject → Identify Bank → Retrieve Bank Mapping → Download Attachment → Validate File & Data → Transform Data → Insert into Respective DB Table → Update Processing/Audit Status** 

## **<u>emaildownload prd</u>** 



<!-- Start of picture text -->
emaildownload<br>«docx<br><!-- End of picture text -->

## **File Configuration:** 



<!-- Start of picture text -->
File Configuration<br>FILE TYPE* © FILE SEPARATOR<br>Select format. ¥ ¥<br>FILE START ROW NO. FILE START COLUMN NO<br>1 1<br>FILE UPLOAD PATH* ©<br>/mnt/bank-uploads/statements/<br>FILE UPLOAD USERNAME FILE UPLOAD PASSWORD<br><!-- End of picture text -->

- **File Type** – The system shall provide a **File Type** dropdown list containing the following supported options: **DBF, XLS, XLSX, PSV, CSV, PDF, TXT, XXD** , and any other file formats supported by the application. 

- **File Separator** – The system shall provide a **File Separator** field to enable users to define the delimiter used within the file. The field shall accept only **special characters** , including but not limited to **pipe (|), hyphen (-), comma (,), slash (/), space, tab (vbTab), dollar sign ($), tilde (~), and circumflex accent (^)** . 

- **File Start Row** – The system shall provide a **File Start Row** field to specify the row number from which file processing should commence. The value entered shall be a positive integer **greater than or equal to 1** . 

- **File Start Column** – The system shall provide a **File Start Column** field to specify the column number from which file processing should commence. The value entered shall be a positive integer **greater than or equal to 1** . 

- **File Upload Path** – The system shall provide a **mandatory File Upload Path** field that allows users to specify the directory location from which files will be uploaded. This field shall not be left blank. 

- **File Upload Username** – The system shall provide a **File Upload Username** field to allow users to enter the credentials required to access the automated file upload location (e.g., SFTP server). 

- **File Upload Password** – The system shall provide a **File Upload Password** field to allow users to enter the password required to access the automated file upload location. The password entered shall be masked to ensure confidentiality. 

## **Processing Options** 

The system shall provide the following **Processing Options** as toggle switches to enable users to configure the file processing behavior. The configured settings shall be applicable to the selected bank account configuration and shall be considered during file processing. 

- **Processing Options** – The system shall display all available processing options as toggle controls, allowing users to enable or disable specific processing rules as required. 

- The selected processing option values shall be saved as part of the bank statement setup configuration. 

- During file processing, the system shall apply the configured processing options associated with the relevant bank account configuration. 

- Any changes made to the processing options shall be effective only after the configuration has been successfully saved and approved through the applicable **Maker–Authorizer workflow** , where required. 

- The system shall maintain the configured processing option settings and use them consistently for all files processed under the associated bank account setup. 



<!-- Start of picture text -->
a Processing Options<br>on/ Off switches for statement processing behaviou<br>running Balance Cleanup<br><!-- End of picture text -->



<!-- Start of picture text -->
Reconciliation Type [ subscrston  t<br>Desc Order — Convert to Ascending<br>Mode: AUTO Bank: - Account: - FileType: ~ Bulk: N SEE Configuration]Save<br><!-- End of picture text -->

##  **Is Active** 

   - Enables or disables the current configuration. 

   - When disabled, the configuration shall remain available in the system; however, any files uploaded using this configuration shall be ignored and no processing shall be performed. 

- **Bulk Upload** 

   - When enabled, the system shall allow a single bank statement file to contain transactions for multiple bank accounts. 

   - In this mode, the **Bank Account Number** field in the setup shall become optional. 

   - During processing, the system shall derive the account number from the uploaded file instead of the configured bank account in the master setup. 

   - <u>During processing, if user has setup a file with bank account number while during import, system realises that multiple bank account numbers are present, entire fle will be moved to rejected queue stating error as:i</u> “Multiple bank account numbers are present in the file whereas setup is <u>mapped to a single bank account, update setup”</u> 

- **Compute Running Balance** 

   - When enabled, the system shall calculate the running (closing) balance for each transaction using the mapped **Closing Balance** column. 

   - The computation shall be performed sequentially for each transaction as follows: 

      - **Credit (C):** Current Running Balance = Previous Running Balance + Transaction Amount 

      - **Debit (D):** Current Running Balance = Previous Running Balance − Transaction Amount 

   - The computed balance shall be updated against each transaction during import. 

- **Validate Running Balance** 

   - When enabled, the system shall validate the running balance calculated during import against the closing balance available in the uploaded file. 

   - Validation shall be performed using the previous closing balance and transaction amount: 

      - **Credit (C):** Previous Closing Balance + Transaction Amount 

      - **Debit (D):** Previous Closing Balance − Transaction Amount 

   - If the calculated balance does not match the balance provided in the uploaded file, the system shall raise a **"Running Balance Mismatch"** validation error. 

- **Running Balance Cleanup – where is setup to defne what all characters cani** **<u>come either in pre-fx & sufi</u> fix for each bank account number or flei** **<u>combination & what needs to be truncated, in the setup screen this functionality is just enable or disable?</u>** 

   - When enabled, the system shall remove predefined prefix or suffix characters from the closing balance value before processing. 

   - A text box shall be provided for users to specify the character(s) to be removed. 

   - **Example:** If the closing balance value in the uploaded file is **C12345** and the configured cleanup character is **C** , the system shall remove the character and process the balance as **12345** . 

- **Direct Match** 

   - When enabled, the system shall automatically perform two-way reconciliation between the uploaded bank statement and CDT records using the **UTR/Instrument Number** . 

   - This configuration shall act as the trigger for the Direct Match Scheduler. 

   - **Example:** If the bank statement Instrument Number is **UTR123456** and a matching record with Instrument Number **UTR123456** exists in the CDT table, the system shall automatically reconcile and tag both records without requiring Reverse Feed MIS processing. 

   - To avoid performance degradation, the Direct Match process shall be executed only for bank accounts where this option is enabled. 

- **Reconciliation Type** 

   - A mandatory field shall be provided to configure the reconciliation type. 

   - The available options shall include: 

      - Subscription 

      - Liability 

   - Based on the selected reconciliation type, the system shall use the corresponding downstream processing tables. 

- **Descending Order** 

   - When enabled, the uploaded file shall be processed from the last record to the first record. 

   - Running balance computation and validation shall also be performed in reverse order (bottom-to-top), applying the same calculation logic sequentially in the selected processing direction. Even validation of <u>closing balance will happen from bottom to top in this case. By default, the fle must be imported into the system in ascending order only.i</u> 

## **Setup Summary** 

The system shall provide a **Setup Summary** section at the bottom of the screen to present a consolidated view of all configuration details entered by the user. The summary shall include, but not be limited to, the following information: 

- Processing Mode 

- Bank Account 

- File Type 

- Bulk Upload Status 

- Processing Options 

- Reconciliation Type 

- URL / Integration Method 

- File Upload Path 

- Bank Classification (Scheme / Collection) 

- Any other configuration parameters entered by the user 

The Setup Summary shall enable users to review the complete configuration before saving the setup for approval. 

## **Actions** 

## **Save Configuration** 

- The system shall provide a **Save Configuration** action to save the configured setup. 

- Upon selecting **Save Configuration** , the setup shall be submitted to the configured **Maker–Authorizer workflow** for approval. 

- The configuration shall become active and available for processing only after approval by an authorized **Authorizer** . 

## **Reset** 

- The system shall provide a **Reset** button. Throw a prompt on reset, re-confirming <u>if user really wants to reset everything that they would have entered.</u> 

- Upon selection, all entered values and user selections shall be cleared, and the screen shall be restored to its default state. 

- Any unsaved changes shall be discarded. 

## **Workflow approval screen by authorizer** 

## **Maker** 

The **Maker** shall be authorized to perform the following actions: 

- Create new bank statement configurations. 

- Edit existing bank statement configurations. 

- Copy existing configurations to create new setups. 

- Save newly created or modified configurations. 

Configurations saved by the Maker shall be assigned a **Pending Approval** status and shall remain unavailable for processing until they have been reviewed and approved by an authorized **Authorizer** . 

## **Authorization Queue** 

- The system shall provide an **Authorization Queue Dashboard** to facilitate the review, approval, and rejection of configuration changes submitted by Makers. The dashboard shall provide a consolidated view of the status of all configuration requests and enable Authorizers to perform approval-related activities. 

## **Dashboard Summary** 

- The Authorization Queue Dashboard shall display the following key metrics: 

- **Total Submissions** – Total number of configuration requests submitted for authorization. 

- **Awaiting Review** – Number of configuration requests currently pending Authorizer review. 

- **Approved** – Number of configuration requests that have been approved. 

- **Rejected** – Number of configuration requests that have been rejected. 

## **Authorizer Dashboard** 

- The system shall provide a dedicated **Authorizer Dashboard** displaying all configurations awaiting approval. The dashboard shall allow the Authorizer to review submitted requests and perform the necessary authorization actions. 

- The Authorizer shall be able to: 

- **View Configuration** – Review all configuration details submitted by the Maker in a read-only mode. 

- **Approve** – Approve a configuration request. 

- **Reject** – Reject a configuration request. 

- **Enter Comments** – Provide a dropdown containing predefined/default remarks from which the authorizer can select the appropriate comment. Include an **“Others”** option in the dropdown. When **“Others”** is selected, display a text box allowing the authorizer to enter a custom/free-text comment. This is mandatory <u>when authorizer rejects any file; be it setup or mapping.</u> 

<u>When authorizer rejects the setup or mapping, Will these be visible to maker in separate menu for action or as part of same menu, these re-work has to be highlighted & shown separately to the maker for quick action as it has got returned back to the maker, will there be In-App alerts for all stakeholders for action as & when they login.</u> 

## **Authorizer Restrictions** 

- The Authorizer shall not be permitted to create, edit, or modify any configuration details. 

- All configuration fields shall be displayed in **read-only mode** during the authorization process. 

- The Authorizer's responsibility shall be limited to verifying the details submitted by the Maker and determining whether the request should be approved or rejected. 

- If any corrections or modifications are required, the Authorizer shall reject the request and provide appropriate comments outlining the required changes. 

- The rejected configuration shall be returned to the Maker for review and resubmission. 

## **Approval and Rejection Workflow** 

- Upon approval, the configuration status shall be updated to **Approved** and the configuration shall become **Active** . 

- Upon rejection, the configuration status shall be updated to **Rejected** and returned to the Maker for modification and resubmission. 

- Only configurations that have been approved by an authorized Authorizer shall become available for processing and operational use. All other pending or <u>rejected queues will be ‘Deactive’ by default.</u> 

## **Notifications** 

- Upon approval or rejection of a configuration request, the system shall generate and send email notifications to both the **Maker** and the **Authorizer** . 

- The notification shall include the configuration reference, action performed (Approved/Rejected), status, date and time of action, and any comments entered by the Authorizer. 



<!-- Start of picture text -->
Authorization Queue<br>4 4 oO to)<br><!-- End of picture text -->

<u>recon process data 2026\prd documentation\Authorizer Workflow for Configuration Approval.docx</u> 



<!-- Start of picture text -->
ot<br>Authorizer<br>Workflow for Confic<br><!-- End of picture text -->

## **2.2 Recon Bank Statement Mapping** 

Bank Statement Mapping is an extension of the Bank Statement Configuration process. It enables users to map bank statement file columns to predefined system fields for reconciliation and downstream processing. 

**Requirements:** Bank statement mapping screen. 

The landing page must provide six sub menus that allow users to switch between different mapping modules. The options are mentioned below: 



<!-- Start of picture text -->
SETUP CONFIGURE /<br>File Configure Setup ><br>e Mat g Configure<br><!-- End of picture text -->

## **Application Layout** 

## **Left Sidebar** 

Width: 280px 

## **Behavior** 

- Expand/Collapse Menu 

- Hover Expansion 

- Active State Highlight 

- Color-coded Modules 

- Submenu Auto Expand 

- Collapsible Sidebar 

## **Top Header** 

Contains: 

## **Breadcrumb** 

SETUP Configure 

> 

## **DB to File Mapping** 

> 

Bank Statement Mapping 

## **Environment Indicator** 

Chip 

ENV : PROD 

## **Selected sub-menu on the left side navigation bar to be highlighted in some color basis the right side screen that is loaded to the user.** 

## **Bank Statement Mapping** 

Upon navigating to the Bank Statement Mapping page, the user must be able to access the Bank Configuration section. 

## **Landing Page Notes:** 

- The term Bank statement file mapping summary must be present above the details at the top left corner. 

- Refer the document for pagination - Recon_PRD_Pagination.doc 

- The search option to enable the user to search for the details must be present at the top- middle section.  – Refer the document for search and filter option - <u>Search Functionality .docx</u> 

- Upon successful completion of bank statement configuration, the mapping summary must be updated in real time. 



<!-- Start of picture text -->
Bank Statement File Mapping Summary<br>Showing 1-15 of 238 Reco<br>sho ak ane fan ecu No Fletype sous een<br>1 HDFC Bank Led 237509812370928 nx © Active 2 eat<br>2 Kotak Mahindra Bank 7991042496012 cv © inactive 2 et<br>3 reicrBank utd 9992450072445 aK 7 2 eat<br>4 haisBank Ltd 24500214249673 ot © Pending 2 eat<br><!-- End of picture text -->

## **Edit/Update Section:** 

- This option must be enabled for all four possible statuses (Active, Inactive, Partially Saved and Pending). 

- This option is present under the action tab in the summary. 

- The user must press the pencil icon to enable this option. 

- Upon clicking the option, the user must be redirected to a new page for mapping the bank statement. 

- This edits page must enable the user to upload their bank mapping statement, the user can either drag & drop the file or browse from their device to upload the statement. – Ability to drag & drop files to be mentioned in the figma as well otherwise user will not know this feature exists. Wording to be changed – Upload bank statement (OR) Drag & drop files from your system here 

- The bank statements vary in format and file type, with different banks. The acceptable file types include DBF, XLS, XLSX, PSV, CSV, PDF, TXT, and XXD. 



<!-- Start of picture text -->
@ BankRecon Statement Mapping mei<br>@ SAMPLE STATEMENT UPLOAD @ Upload Pick Header Map Columns<br>fa<br>Drop your bank statement here<br>4% rio map ° sono<br><!-- End of picture text -->

- Once it is uploaded, the file will be read, and the bank details will be fetched. 

- These details will be displayed below the upload section for the user. 

- The system detects and displays the possible header for the statement. 

- This header will be highlighted in blue. 

- The column names from the header row will be listed below the details section, along with the row number. 

- The user must be provided with the option to either confirm the detected header or select an alternative header row as required. 



## **Field Mapping:** 

- Once the header is confirmed: 

- The system must identify the available columns. 

- Automatic mapping must be performed wherever applicable. –Refer the auto mapping logic column list 



<!-- Start of picture text -->
ot<br>Bank_statement_col<br>umn_auto_map.xls<br><!-- End of picture text -->

- Users must be allowed to modify auto-mapped fields. 

- Successfully mapped columns must be highlighted in green. 

- The screen must display: 

- Number of mapped fields 

- Number of unmapped fields 

## **Header Row Detection** 

## **Business Requirement** 

The system shall intelligently identify the most probable header row within the uploaded statement file to reduce manual effort and improve onboarding efficiency. Since statements received from banks often contain metadata, bank details, or report information before the actual transaction table, the solution must support automatic detection while allowing the user to override the recommendation. 

## **Functional Behavior** 

The application shall evaluate the uploaded rows using a weighted scoring mechanism. The scoring algorithm shall consider the density of textual values within the row, the presence of recognized banking keywords, the number of populated columns, and the row position within the file. 

Keywords that contribute to header identification include common banking and reconciliation terms such as Date, Amount, Narration, Description, Credit, Debit, Balance, UTR, Account, Bank, Reference Number, Instrument Number, and related variants. 

The row receiving the highest score shall be automatically highlighted as the recommended header row. 

The user shall retain full control and may select a different row if the recommendation is not accurate. The mapping process shall not proceed until the user explicitly confirms the selected header row. 

## **Acceptance Criteria** 

The system-detected header row shall be visually highlighted. Users shall be able to override the recommended row selection. The system shall require explicit user confirmation before proceeding to the mapping stage. 

## **Auto Mapping Engine** 

## **Business Requirement** 

To reduce manual configuration effort, the solution shall automatically suggest mappings between uploaded statement columns and predefined system fields. 

## **Functional Behavior** 

The auto-mapping engine shall use predefined regular expression patterns to identify likely matches between source columns and system fields. Examples include mapping "Credit Amount" to the credit amount field, "Value Date" to the transaction date field, or "UTR No" to the UTR reference field. 

The system shall prioritize mandatory fields during the auto-mapping process. Where multiple matches are possible, the engine shall attempt to establish a one-to-one mapping and avoid assigning a source column to multiple destination fields. 

Existing user-defined mappings shall never be overwritten by the auto-mapping process. 

## **Acceptance Criteria** 

Mandatory fields shall receive priority during auto mapping. The system shall prefer unique mappings whenever possible. Existing mappings created by the user shall remain unchanged after an auto-map operation. 

## **Manual Field Mapping** 

## **Business Requirement** 

Users must be able to manually create, modify, or remove mappings when automatic suggestions are not appropriate. 

## **Functional Behavior** 

For each system field, the user shall be presented with a list of available source columns extracted from the uploaded statement. The user may assign a source column, clear an existing mapping, or replace an automatically generated mapping with a manually selected value. 

The system shall immediately reflect any changes and update mapping statistics in real time. 

## **Acceptance Criteria** 

Users shall be able to select source columns for any configurable field, clear existing mappings, and override automatically generated mappings without restrictions. 

## **Field Group Management** 

## **Business Requirement** 

To improve usability and support logical configuration management, system fields shall be organized into business-oriented groups. 

## **Functional Behavior** 

The first group, Bank Statement Input, shall contain all core fields required for statement processing, including amount fields, transaction dates, narrations, descriptions, UTR references, account information, balances, and bank details. 

The second group, Bank Narration / Description Split, shall contain extracted or derived information generated from narration parsing processes. This group includes Investor Name, Investor Bank Name, PAN Number, Folio Number, Scheme Code, and similar extracted attributes. 

Grouping shall improve navigation and provide users with a clear separation between direct statement fields and derived fields. 

## **Conditional Field Dependency** 

## **Business Requirement** 

The application shall prevent conflicting mappings that could result in duplicate transaction amount processing. 

## **Functional Behavior** 

If the consolidated amount field, INSTRM_AMOUNT, has been mapped, the system shall automatically disable the INSTRM_AMOUNT_CREDIT and INSTRM_AMOUNT_DEBIT fields. 

This rule ensures that a transaction amount is not interpreted simultaneously as both a combined amount and separate credit/debit values. 

The user shall be informed of the reason for the automatic disablement through contextual messaging. 

## **Acceptance Criteria** 

When INSTRM_AMOUNT is mapped, both credit and debit amount fields shall become unavailable for mapping. The system shall display an explanatory message describing the dependency. 

## **Mapping Validation Engine** 

## **Business Requirement** 

The solution must safeguard data quality by preventing obvious mapping errors. 

## **Functional Behavior** 

Whenever a source column is assigned to a system field, the system shall validate whether the selected column appears appropriate for the expected data type. 

For example, amount-related fields shall not accept columns that appear to contain dates or times. Date-related fields shall not accept amount or balance fields. Description and narration fields shall not be associated with UTR numbers, transaction references, or numeric identifier columns. 

Validation rules shall be executed immediately upon mapping selection. 

## **Acceptance Criteria** 

The system shall evaluate every mapping assignment against predefined validation rules and generate warnings when anomalous mappings are detected. 





<!-- Start of picture text -->
Datefomat onmrrer ~ — incadetine QO) Tinetormat hv EEE SomYY Ham<br><!-- End of picture text -->

**Bank Narration/Description Split                      Disabled – enable to configure extract columns** 



|**System Field**|**Attribute**|**Map to**<br>**Column**|**Mandatory**<br>**Flag**|**Incremen**<br>**tal Flag**|**Status**|
|---|---|---|---|---|---|
|INSTRM_AMOUNT|Bank credit/debit<br>amount|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|INSTRM_AMOUNT_C<br>REDIT|Bank credit<br>amount|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|INSTRM_AMOUNT_D<br>EBIT|Bank debit<br>amount|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|INSTRM_STATUS|Bank credit/debit<br>status (C/D,<br>CR/DR)|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|VALUE_DATE|Bank<br>credit/value date|Confirm<br>ed<br>header|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|



|BANK_DESCRIPTION|Bank statement<br>description/narr<br>ation|to be<br>dropped<br>down<br>here<br>Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|---|---|---|---|---|---|
|BANK_NARRATION|Bank statement<br>narration|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|BANK_STMT_DATE|Bank transaction<br>date|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|INSTRM_NO|Cheque/<br>instrument<br>number|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|UTR_NUMBER|UTR/transaction<br>reference<br>number|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|LOCATION_CODE|Entry received<br>location date|Confirm<br>ed<br>header<br>to be<br>dropped<br>down|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|



|||here||||
|---|---|---|---|---|---|
|BANK_AC_NO|MF Bank<br>account number|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|BANK_NAME|MF bank name|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|CLOSING_BALANCE|Running balance|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|
|BANK_CREDIT_TIME|Bank credit<br>time/value date|Confirm<br>ed<br>header<br>to be<br>dropped<br>down<br>here|Required/<br>Optional|Toggled<br>On/Off|Mapped/Disabled/<br>Pending|



The following columns are mandatory in the bank statement column mapping process. The list of columns: Value_date, Instrm amount / (Instrm debit amount & Instrm credit amount), Instrm status (when selected instrm amount column only), running balance and instrm no. 

|EXTRACT_FOLIO_NO|Extracted<br>folio<br>number|Confirmed<br>header to<br>be dropped<br>down here<br>i|Required/Optional|Toggled<br>On/Off|Mapped/Disabled/Pending|
|---|---|---|---|---|---|
|EXTRACT_SCHEME_C<br>ODE|Extracted<br>scheme<br>code|Confirmed<br>header to<br>be dropped<br>down here|Required/Optional|Toggled<br>On/Off|Mapped/Disabled/Pending|
|EXTRACT_INSTRUME|Extracted|Confirmed|Required/Optional|Toggled|Mapped/Disabled/Pending|



|NT_DATE|instrument<br>date|header to<br>be dropped<br>down here<br>i||On/Off||
|---|---|---|---|---|---|
|EXTRACT_INVESTOR_<br>ACCOUNT_NUMBER|Extracted<br>investment<br>account<br>number|Confirmed<br>header to<br>be dropped<br>down here|Required/Optional|Toggled<br>On/Off|Mapped/Disabled/Pending|
|EXTRACT_INVESTOR_<br>BANK_NAME|Extracted<br>investor<br>bank name|Confirmed<br>header to<br>be dropped<br>down here<br>i|Required/Optional|Toggled<br>On/Off|Mapped/Disabled/Pending|
|EXTRACT_INVESTOR_<br>NAME|Extracted<br>investor<br>name|Confirmed<br>header to<br>be dropped<br>down here|Required/Optional|Toggled<br>On/Off|Mapped/Disabled/Pending|
|EXTRACT_INVESTOR_I<br>FSC|Extracted<br>investor<br>IFSC|Confirmed<br>header to<br>be dropped<br>down here|Required/Optional|Toggled<br>On/Off|Mapped/Disabled/Pending|
|EXTRACT_INVESTOR_<br>AC_TYPE|Extracted<br>investor<br>account<br>type|Confirmed<br>header to<br>be dropped<br>down here|Required/Optional|Toggled<br>On/Off|Mapped/Disabled/Pending|
|EXTRACT_NARRATIO<br>N_UTR_NUMBER|Extracted<br>UTR<br>number<br>from<br>narration|Confirmed<br>header to<br>be dropped<br>down here|Required/Optional|Toggled<br>On/Off|Mapped/Disabled/Pending|
|EXTRACT_PAN|Extracted<br>PAN from<br>narration|Confirmed<br>header to<br>be dropped<br>down here|Required/Optional|Toggled<br>On/Off|Mapped/Disabled/Pending|



## **System Field:** 

- Only the list of fields mentioned above must be incorporated into the statement mapping screen. 

## **Attribute:** 

- Users must be able to modify the attribute associated with each system field. 

## **Map to Column:** 

- The column title extracted from the statement upon auto mapping must be displayed here. 

- The system should recognize cases if the mapped column varies from the system field. 

   - If the selected column does not align with the expected data type of the system field, an error alert must pop up – titled “Potential Mapping Mismatch”, and a brief note mentioning that the selected column does not 

match with the expected data type must be present. – what content to be given on the brief note should be mentioned for each field listed above 

   - Both attribute is show as per the below sample when the column mismatch cases. 

   - The system field and the mapped column must also be highlighted. 

   - It must also state that the expected value from the system field does not align with the column selected. (Eg; If INSTRM_STATUS is the system field column and the mapped column is Transaction date, the message must indicate that the expected values must look like C/D, Credit/Debit etc.) 

   - The user must also be provided with the option of either re-mapping the column or proceeding with the process. 

   - The “Do not continue – Re-map” option must be highlighted in bold to ensure that the user notices the option with ease. 

- **Mapping Mismatch Warning** 

- **Business Requirement** 

- The system shall provide users with sufficient information to make informed decisions whenever a potentially incorrect mapping is detected. 

- **Functional Behavior** 

- If a mapping violates validation rules, a warning dialog shall be displayed. The warning shall identify the selected source column, the target system field, the reason for the suspected mismatch, and examples of more suitable column names. 

- The user may either revise the mapping or deliberately proceed with the mapping if they determine that the warning is not applicable. 

- All override actions shall be visually identified within the mapping screen. 

- **Acceptance Criteria** 

- Users shall receive a warning before a suspicious mapping is accepted. The warning shall include contextual guidance and provide options to either re-map the field or continue despite the warning. 



<!-- Start of picture text -->
[ 1<br>iN Potential Mapping Mismatch<br>The selected column may not match the expected data type.<br>SYSTEM FIELD SELECTED COLUMN<br>INSTRM_STATUS Transaction Date<br>Bank credit / debit status (C/D, From uploaded statement<br>CR/DR)<br>© “Transaction Date” doesn't look like a status column.<br>INSTRM_STATUS expects values like C/D, CR/DR, or Credit/Debit.<br>@® Expected columns: Status, Type, C/D, CR/DR, Credit/Debit, Dr/Cr<br>Would you like to re-map, or continue with this selection?<br>Don't Continue — Re-map Continue Anyway<br><!-- End of picture text -->

- An error message must also pop-up if the same column is mapped to multiple columns. 

   - A single source column must not be mapped to multiple system fields. 

   - If the mapping is attempted, an error alert must pop up – titled “column already in use”, and a brief note mentioning that the column is mapped to another field, along with its name. The message must also specify that this would mean both fields will point to the same source column. 

   - The note must hence mention that both fields will share the column. 

   - The user can hence cancel this mapping or proceed with mapping for both fields. 

   - The “Cancel” option must be highlighted in bold to ensure that the user notices the option with ease. 

   - A few banks are providing multiple file format structure, the system should be allowed to map one or two file formats configure. 

## **Duplicate Mapping Validation** 

- **Business Requirement** 

- The platform shall identify situations where the same source column is assigned to multiple system fields and allow the user to confirm that decision. 

- **Functional Behaviour** 

- Whenever a column that has already been mapped is selected for another field, the application shall display a confirmation dialog. The dialog shall identify the field already using the column and explain the implications of sharing the same source value across multiple destination fields. 

- The user may cancel the action and choose a different column or explicitly confirm that the source column should be mapped to both fields. 

- **Acceptance Criteria** 

- A confirmation dialogue shall appear whenever duplicate mappings are detected. Users shall be able to cancel the action or confirm the shared mapping. Upon confirmation, both system fields shall reference the same source column while retaining their individual configurations. 



<!-- Start of picture text -->
Tea Column Already In Use<br>This column is already mapped to another system field.<br>ALREADY MAPPED TO ALSO MAPPING TO<br>INSTRM_AMOUNT > INSTRM_STATUS |<br>© Column "Transaction Amount" is already used by<br>INSTRM_AMOUNT. Mapping it here will keep both fields pointing to<br>the same source column.<br>© The existing mapping on INSTRM_AMOUNT will not be removed.<br>Both fields will share this column.<br>to Both Fields<br>Cancel | Mapes es |<br><!-- End of picture text -->

## **Date and Time format** 

- There must be a toggle for the date format present. That bar should have a date format option, option to enable time, including seconds and a preview. 

- The date format must allow for various options to be accepted. 

- The user can choose any of these options and the format shall be adjusted accordingly. 

- The user can also decide if the time must be included as well. An option called “Include Time” must be available for the user to enable or disable depending on their preference. 

- The time format can either be 12 hours or 24 hours. The seconds can also be enabled by the user. 

- For date-based system fields, date must be mandatorily mapped to any of the columns present. 

- Based on the options being enabled, a preview bar must be present in the righthand corner of the bar, showing how the formatting would be. 



## **Mandatory flag** 

- The mandatory flag can be enabled or disabled for each system field depending on the requirement, if the toggle is switched on, the term “Required” must be present under the toggle. If switched off, the term “Optional” will be shown. 

## **Incremental Flag** 

- This flag must be enabled to upload incremental details during upload. This is to identify the unique columns to be considered. 

## **Status** 

- The Status field indicates whether the mapping has been completed or is still pending. 

- If mapping is completed a green checkmark will be present along with the word mapped. 

- If the mapping is incomplete, a grey hyphen must be displayed along with the label "Pending". 

## **Transaction Status Standardization Configuration (instrm status)** 

## **Purpose** 

Different banks provide transaction indicators in different formats. The reconciliation engine requires a common standardized transaction type. 

The application shall provide configuration capability to transform bank-specific transaction indicators into standard system values. 

## **Example Bank Formats** 

**<mark>Bank Transaction Value</mark>** 

|HDFC Bank|C / D|
|---|---|
|IDBI Bank|CR / DR|
|ICICI Bank|Separate Credit and Debit Amount Columns|
|IndusInd Bank|SUCCESS / FAILURE|
|South Indian Bank|Positive / Negative Amount Values|



## **Standardized System Values** 

|**Source Value**|**System Value**|
|---|---|
|C|CREDIT|
|CR|CREDIT|
|SUCCESS|CREDIT|
|Positive Amount|CREDIT|
|D|DEBIT|
|DR|DEBIT|
|FAILURE|DEBIT|
|Negative Amount|DEBIT|



Should this be part of DB mapping for system to resolve & pick up right value; if yes, then we will need admin screen to update or edit or add such values & indicate in this setup this value is mapped in which table column. For e.g. D | DEBIT | <New DB Table name> | <New column name>. This setup to be available only for Admin users like PMG or process owners & not to recon team, this will be handled in RBAC setup. 

Also mention how much such combinations may be required, all of this will be resolved in the above setup that I have written above. 

When **INSTRM_AMOUNT** is mapped to a source column: 

- INSTRM_AMOUNT_CREDIT shall be automatically disabled. 

- INSTRM_AMOUNT_DEBIT shall be automatically disabled. 

- Existing mappings, if any, shall be removed. 

##  The status indicator shall display **Disabled** . 

## **UI Behaviour** 

INSTRM_AMOUNT ✓ Mapped 

INSTRM_AMOUNT_CREDIT Disabled 

INSTRM_AMOUNT_DEBIT Disabled 

## **Swimlane** 

|**User Action**|**System Action**|
|---|---|
|Map INSTRM_AMOUNT|Validate dependency rules|
||Disable INSTRM_AMOUNT_CREDIT|
||Disable INSTRM_AMOUNT_DEBIT|



## **Reset** 

- If the reset option is used for these options: In case of active, inactive and partially saved cases, the memory should be replaced with pre-existing information from the previously saved data. 

- The reset button should be present at both the top and at the bottom of the mapping page. 

## **Save Mapping for Maker – Draft** 

## **This entire section needs to be descriptive with examples as developers will not understand what you have in mind.** 

- The save mapping option must also be present at the top and bottom of the page. 

- The save option must not proceed if any of the mandatory fields are not filled. If the user tries to proceed, an error message must be displayed. 

- Likewise, an error message must be displayed if the user tries to proceed without enabling a minimum of three incremental flags. 

- Value date, amount and narration must have also been mapped before the save option is used. 

- Bank account number must be mapped if bulk upload is enabled in the file configuration setup. 

- If the user clicks save, a popup must emerge showing the list of the mapped columns against the system setup. 

- In this popup, mapped cases must be shown in green, mapped but mismatch cases must be shown in yellow, auto-extracted cases must be highlighted in purple. 

- Pending columns must be highlighted in grey when the user confirms the first popup. 

## **Authorization flow :** 

Refer the document of approval dashboard 



