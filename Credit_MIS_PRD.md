# **Product Title** 

# **Credit MIS Summary** 

# **Objective** 

To provide users with a consolidated Credit MIS Summary screen that enables efficient searching, browsing, Addition and exporting of credit-related MIS records. 

# **Business Requirement** 

**Location:** Top of the screen 

Four selectable summary cards shall be displayed: 

**1. All** 

**2. Active** 

**3. Inactive** 

**4. Waiting for Approval** 

# **Behaviour** 

- By default, the **All** card will be selected. 

- Each card will display the respective record count. 

- Users can select any card to filter the Credit MIS records. 

- Upon card selection: 

   - The summary grid must refresh and display only relevant records. 

   - Search results must be filtered based on the selected card. 

   - Pagination must be recalculated based on the filtered dataset. 

   - CSV export must export only the records belonging to the selected card and applied search filters. 

- 

- Selected card should be visually highlighted. 

# **Acceptance Criteria** 

- Four cards are displayed at the top of the page. 

- Only one card can be selected at a time. 

- Default selection is "All". 

- Data grid refreshes based on selected card. 

- Counts are displayed correctly. 

- Search, pagination, Add Configuration and export functionalities respect the selected card. 

# **Functional Requirements** 

# **Search Functionality** 

**Location:** Left-hand side panel 

# **Description:** 

- A search section will be displayed on the left side of the screen. 

- Search behaviour and filters should be implemented as per the specifications defined in the **Search Document** . 

- Filter columns - Bank name and account number. 

- Users can enter search criteria and retrieve matching Credit MIS records. 

# **Acceptance Criteria:** 

- Search panel is visible on page load. 

- Search results are displayed based on selected criteria. 

- Search results refresh dynamically upon search execution. 

- Validation rules follow the Search Document specifications. 

# **Pagination Functionality** 

**Location:** Right-hand side of the data grid 

# **Description:** 

- Pagination controls will be displayed on the right side of the screen/grid. 

- Pagination behaviour should follow the specifications defined in the **Pagination Document** . **Acceptance Criteria:** 

- Users can navigate between pages. 

- Correct number of records is displayed per page. 

- Pagination updates based on search results. 

- Total record count is displayed. 

# **Export to CSV** 

**Location:** Above the Pagination Section 

# **Description:** 

- An **Export CSV** button shall be available above the pagination controls. 

- Users can export the Credit MIS Summary data into CSV format. 

# **Export Rules:** 

- Export should include all columns displayed in the grid. 

- Export should respect applied search filters. 

- File should download in .csv format. 

- Downloaded file name format: 

- Credit_MIS_Summary_YYYYMMDD_HHMMSS.csv 

# **Acceptance Criteria:** 

- Export button is visible and enabled when data is available. 

- CSV file downloads successfully. 

- Exported data matches the records returned by the applied search criteria. 

- Special characters and commas are handled correctly in the CSV output. 

# **Credit MIS Summary Grid** 

# **Description** 

The Credit MIS Summary records shall be displayed in a tabular grid format based on the selected status card and applied search filters. 

Grid Columns 

|**Sl. N**|**o Column Name**|**Description**|
|---|---|---|
|**1**|**Sl. No**|**Auto-generated sequential number for each record displayed**<br>**in the grid.**|
|**2**|**Bank Name**|**Name of the Bank associated with the record.**|
|**3**|**Account**<br>**Number**|**Account Number configured for the bank feed.**|
|**4**|**Feed Option**|**Selected feed option for the account.**|
|**5**|**File Format**|**File format configured for the feed (e.g., CSV, TXT, XLS, XML,**<br>**etc.).**|
|**6**|**Status**|**Current status of the record (Active, Inactive, Waiting for**<br>**Approval).**|
|**7**|**Edit**|**Action icon/button to modify the selected record details.**|



# **Behaviour** 

- Grid data shall be filtered based on the selected card: 

   - All 

   - Active 

   - Inactive 

   - Waiting for Approval 

- Grid data shall further be filtered based on search criteria. 

- Sl. No should be generated dynamically based on the displayed page. 

- Status should reflect the latest status of the record. 

- Edit action shall open the corresponding record in edit mode. 

# **Acceptance Criteria** 

- All seven columns are displayed in the specified order (Ascending). 

- Grid refreshes based on card selection and search criteria. 

- Account Number is displayed in the configured format. 

- Status values are displayed correctly. 

- Edit action is enabled for authorized users. 

- Exported CSV contains all columns except the Edit action column. 

- Pagination works on the filtered dataset and maintains column consistency across pages. 

# **Addition Functionality:** 

# **Description** 

Users shall be able to create a new Credit MIS Configuration from the Credit MIS Summary screen. 

Add the following section to the PRD under **Configuration Management** : 

# **Add Credit MIS Configuration** 

# **Description** 

Users shall be able to create a new Credit MIS Configuration from the Credit MIS Summary screen. 

# **Components** 

- **Add (+) Button** displayed on the Credit MIS Summary page. 

- Credit MIS Configuration screen. 

- Save button. 

- Cancel button. 

# **Behaviour** 

# **Add Configuration** 

1. User navigates to the **Credit MIS Summary** page. 

2. User clicks the **Add (+)** button. 

3. The Credit MIS Summary page closes/hides. 

4. The system opens the **Credit MIS Configuration** screen. 

5. User enters the required configuration details. 

# **Save Configuration** 

1. User completes the configuration details. 

2. User clicks the **Save** / cancel button. 

3. System validates the entered data. 

4. Upon successful validation: 

   - Configuration record is saved. 

   - Success message is displayed. 

   - Configuration screen closes. 

   - User is redirected back to the **Credit MIS Summary** page. 

5. Newly created record should be displayed in the summary grid based on the selected filters. 

# **Cancel Configuration** 

1. User clicks the **Cancel** button. 

2. No data is saved. 

3. Configuration screen closes. 

4. User is redirected back to the **Credit MIS Summary** page. 

# **Acceptance Criteria** 

# **Add Button** 

- Add (+) button is visible on the Credit MIS Summary page. 

- Clicking the Add button opens the Credit MIS Configuration screen. 

# **Save Functionality** 

- Mandatory fields are validated. 

- Configuration is saved successfully. 

- Success confirmation message is displayed. 

- User is redirected to the Credit MIS Summary page. 

- Newly created configuration appears in the summary grid. 

# **Cancel Functionality** 

- No data is saved. 

- User is redirected to the Credit MIS Summary page. 

# **Business Rules** 

1. Only authorized users can create a Credit MIS Configuration. 

2. Save button shall be enabled only after mandatory fields are populated. 

3. Duplicate configurations shall be validated as per business rules. 

4. After successful save, the summary grid must refresh automatically. 

5. The newly created record should inherit the default status as defined by the business process (e.g., Waiting for Approval, if applicable). 

# **Credit MIS Configuration** 

# **Objective** 

The Credit MIS Configuration screen allows users to create and maintain Credit MIS configurations based on the selected processing mode, feed option, and payment aggregator code. 

# **<u>Mode</u>** 

# **Description** 

The user shall be able to select the processing mode from a dropdown list. 

# **Available Options** 

- Manual 

- Auto 

- API 

- Email 

# **Behaviour** 

The system shall dynamically display or hide fields based on the selected Mode. 

# **Manual Mode** 

- User manually uploads or manages Credit MIS files. 

- Relevant fields for manual processing are displayed. 

- Auto-processing fields are hidden. 

# **Auto Mode** 

- System automatically processes Credit MIS files. 

- Auto-processing configuration fields are displayed. 

- Manual-specific fields are hidden. 

# **API Mode** 

- System receives files through API or SFTP integration. 

- API/SFTP configuration fields are displayed. 

- Manual and Auto-specific fields are hidden. 

# **Email Mode** 

- **Credit MIS files are received through a configured email mailbox.** 

- **Email-related configuration fields are displayed.** 

- **Manual, Auto, and API/SFTP specific fields are hidden.** 

# **Acceptance Criteria** 

- Mode field is mandatory. 

- User can select only one mode. 

- Fields are dynamically displayed based on the selected mode. 

- Hidden fields should not be validated or saved. 

# **<u>Feed Option</u>** 

# **Description** 

The user shall be able to select a Feed Option from a dropdown list. 

# **Data Source** 

- Feed Options will be maintained in a separate master configuration menu. 

- The **Feed Option** field shall be displayed as a **single-select dropdown** . 

- Configuration records will be stored in the Feed Option master table. 

- Only active Feed Options shall be available for selection. 

# **Behaviour** 

- Feed Option dropdown is populated from the Feed Option master. 

- User can select only one Feed Option for a configuration. 

- Feed Option configurations and business rules will be defined in a separate Functional Specification document. 

# **Acceptance Criteria** 

- Feed Option is populated from the master table. 

- Only active Feed Options are displayed. 

- Selected Feed Option is saved against the Credit MIS Configuration. 

# **<u>Payment Aggregator Code</u>** 

# **Description** 

Multiple payment aggregators participate in Credit MIS processing for Mutual Fund business transactions. Therefore, identifying the Payment Aggregator Code is mandatory for each configuration. 

# **Data Source** 

- Payment Aggregator Codes shall be maintained through a separate master configuration menu. 

- The **Payment Aggregator** field shall be displayed as a **single-select dropdown** . 

- Codes will be stored in the Payment Aggregator master table. 

- Users can only select configured and active Payment Aggregator Codes. 

# **Behaviour** 

- Payment Aggregator Code shall be displayed as a dropdown field. 

- User can select one or more Payment Aggregator Codes (if business permits multiple mappings). 

- User is not allowed to manually enter a code. 

- The dropdown values shall be fetched from the Payment Aggregator master. 

# **Validation** 

- Payment Aggregator Code is mandatory. 

- Save operation should not proceed without selecting a valid Payment Aggregator Code. 

# **Acceptance Criteria** 

- Payment Aggregator dropdown is populated from the master table. 

- Only active Payment Aggregator Codes are available for selection. 

- User cannot enter free-text values. 

- Selected Payment Aggregator Code is saved successfully with the configuration. 

# **Payment Mechanism** 

# Data Source 

- The Payment Mechanism dropdown values shall be populated from the Payment Mechanism Master Table, using the **Payment Mechanism** column.. 

- The field represents the Credit MIS associated with the purchase transaction. 

- Only active records from the Payment Mechanism Master Table shall be displayed in the dropdown. 

- The system shall retrieve the latest values from the source table during page load or based on the configured refresh mechanism. 

# Behaviour 

- The Payment Mechanism field shall be presented as a multi-select dropdown. 

- Users shall be able to select one, multiple, or all available payment mechanisms. 

- An "ALL" option shall be available at the top of the dropdown. 

- Selecting "ALL" shall automatically select all available Payment Mechanism values. 

- Deselecting any individual value after selecting "ALL" shall automatically remove the "ALL" selection. 

- The selected values shall be used as filter criteria for data retrieval and reporting. 

# Validation 

- The system shall accept only values available in the Payment Mechanism Master Table. 

- Duplicate selections shall not be permitted. 

- If the field is mandatory, the system shall display an appropriate validation message when no value is selected. 

- The "ALL" option shall not be stored as a separate value in the database, it shall be interpreted as all available Payment Mechanism values. 

# **Bank Name** 

# **Data Source** 

- The **Bank Name** dropdown shall be populated from the **Scheme Bank Table,** using the **Bank Name** column. 

- The **Bank Name** field shall be displayed as a **single-select dropdown** . 

- The field represents the **bank to which the Credit MIS belongs** . 

- Only active bank records from the Scheme Bank Master Table shall be displayed in the dropdown. 

- The system shall retrieve the latest bank names from the source table based on the configured refresh mechanism. 

# **Behaviour** 

- The **Bank Name** field shall be displayed as a dropdown list. 

- Users shall be able to select a bank name to filter and view the corresponding Credit MIS records. 

- The dropdown shall display bank names in alphabetical order unless otherwise specified by business requirements. 

- The selected bank name shall be used as a filter criterion for data retrieval and reporting. 

# **Validation** 

- The system shall accept only valid bank names available in the Scheme Bank Master Table. 

- Inactive or deleted bank names shall not be displayed for selection. 

- If the field is mandatory, the system shall display an appropriate validation message when no bank name is selected. 

- Manual entry of values outside the dropdown list shall not be permitted. 

# **Bank Account Number** 

# **Data Source** 

- The **Bank Account Number** dropdown shall be populated from the **Scheme Bank Table,** using the **Account No** column. 

- The field represents the **bank account number to which the Credit MIS belongs** . 

- Only active bank account numbers from the Scheme Bank Master Table shall be available for selection. 

# **Behaviour** 

- The **Bank Account Number** field shall be displayed as a **single-select dropdown** . 

- Users shall be allowed to select only one bank account number at a time. 

- The selected bank account number shall be used as a filter criterion for data retrieval and processing. 

- If the **Bulk** option is enabled under the **Processing Option** , the Bank Account Number field shall become mandatory during the **Column Mapping** process. 

# **Validation** 

- Only valid bank account numbers available in the Scheme Bank Master Table shall be selectable. 

- Multiple selections shall not be permitted. 

- If the **Bulk** processing option is selected and no bank account number is chosen during column mapping, the system shall display an appropriate validation message. 

- Inactive or deleted bank account numbers shall not be displayed in the dropdown. 

# **Account Category** 

# **Data Source** 

- The **Account Category** field shall be maintained as a master/reference value and shall contain the following options: 

   - **Scheme Account** 

   - **Pool Account** 

- The selected value identifies the nature of the bank account associated with the Credit MIS. 

# **Behaviour** 

- The **Account Category** field shall be displayed as a **single-select dropdown** . 

- Users shall be required to specify whether the bank account is a **Scheme Account** or a **Pool Account** . 

- **Scheme Account** indicates that the account receives credits related to a specific scheme's transactions. 

- **Pool Account** indicates that the account receives credits pertaining to all scheme transactions. 

- The selected Account Category shall be used for transaction processing, mapping, validation, and reporting purposes where applicable. 

# **Validation** 

- Only one Account Category can be selected at a time. 

- The Account Category field shall be mandatory. 

- Users shall not be allowed to proceed without selecting an Account Category. 

- Only valid values configured in the master/reference list shall be accepted by the system. 

# **Scheme Code** 

# **Data Source** 

- The **Scheme Code** dropdown shall be populated from the **Scheme Master Table,** using the **Scheme Code** column. 

- The dropdown shall display all active scheme codes maintained in the Scheme Master. 

- The selected scheme code(s) shall be used in downstream processes, including **matching logic** and **fund utilization** . 

# **Behaviour** 

- The **Scheme Code** field shall be displayed as a **multi-select dropdown** . 

- The field shall be **enabled only when the Account Category is selected as "Scheme Account"** . 

- The field shall be **disabled and not applicable when the Account Category is selected as "Pool Account"** . 

- Users shall be able to select one or more scheme codes when the field is enabled. 

- The selected scheme code(s) shall be considered during reconciliation, matching logic, fund utilization, and related processing activities. 

# **Validation** 

- Only valid scheme codes available in the Scheme Master Table shall be available for selection. 

- Multiple scheme code selections shall be allowed. 

- When **Account Category = Scheme Account** , at least one Scheme Code shall be selected. 

- When **Account Category = Pool Account** , the Scheme Code field shall remain disabled and no value shall be captured. 

- Inactive or deleted scheme codes shall not be displayed in the dropdown. 

# **Asset Class** 

# **Data Source** 

- The **Asset Class** dropdown shall be populated from the **Scheme Master Table** , using the **Asset Class** column. 

- Only active asset class values maintained in the Scheme Master Table shall be displayed in the dropdown. 

- The selected asset class(es) shall be used in downstream processing, reporting, and reconciliation activities. 

# **Behaviour** 

- The **Asset Class** field shall be displayed as a **single-select dropdown** . 

- The field shall be **enabled only when the Account Category is selected as "Scheme Account"** . 

- The field shall be **disabled when the Account Category is selected as "Pool Account"** . 

- Asset Class selection shall support subsequent processing activities, including matching logic and fund utilization. 

# **Validation** 

- Only valid asset class values available in the Scheme Master Table shall be selectable. 

- When **Account Category = Scheme Account** , field shall be displayed as a **single-select dropdown** . 

- When **Account Category = Pool Account** , the Asset Class field shall remain disabled and no value shall be captured. 

- The Asset Class field shall not accept values outside the configured master data. 

- Inactive asset class values shall not be displayed. 

# **File Format** 

# **Data Source** 

- The **Credit MIS File Format** field shall be maintained as a predefined master list within the application. 

   - The following file formats shall be available for selection: 

DBF, XLS, XLSX, PSV, CSV, TXT, XXD 

- These formats represent the common Credit MIS file types received from banks and payment aggregators during daily BAU operations. 

# **Behaviour** 

- The **Credit MIS File Format** field shall be displayed as a **single-select dropdown** . 

- Users shall be allowed to select only one file format at a time. 

- Multiple selections shall not be permitted. 

- The selected file format shall determine the processing, validation, and ingestion rules applicable to the uploaded Credit MIS file. 

- The field shall support Credit MIS files received from various banks and payment aggregators. 

# **Validation** 

- Only values available in the predefined format list shall be selectable. 

- Users shall not be allowed to select more than one file format. 

- The uploaded file format shall match the selected Credit MIS File Format. 

- An appropriate validation message shall be displayed if the uploaded file format does not match the selected format. 

- The field shall be mandatory. 

# **Row and column Start:** 

# **Header Position (Row, Column)** 

# **Data Source** 

- The **Header Position** field shall be a user-defined input field used to identify the starting position of the Credit MIS header within the uploaded file. 

- Different banks and payment aggregators may provide Credit MIS files with varying row and column starting positions. 

- This field shall capture both the **Row Number** and **Column Number** in a single input field. 

# **Behaviour** 

- The **Header Position** field shall accept two numeric values separated by a comma (,). 

- The value before the comma shall represent the **Row Number** . 

- The value after the comma shall represent the **Column Number** . 

- The system shall automatically allow only a single comma separator within the field. 

- Users shall enter the position in the format: 

`o` 1,2 `o` 12,4 `o` 25,8 

- The entered position shall be used during file parsing and column mapping to identify the header starting location within the Credit MIS file. 

# **Validation** 

- The field shall accept only numeric values and a single comma separator. 

- Alphabetic characters, special characters, and multiple commas shall not be permitted. 

- Both Row Number and Column Number shall be mandatory. 

- Values entered before and after the comma must be positive integers greater than zero. 

- The system shall display an appropriate validation message if the input format is invalid. 

- The accepted format shall be: 

   - Row Number, Column Number. 

# **Instrument Status** 

# **Data Source** 

- The **Instrument Status** field shall be maintained as a predefined dropdown list within the application. 

- The dropdown shall contain the following values: 

   - **C (Credit)** 

   - **D (Debit)** 

- This field is intended for scenarios where the Credit MIS file does not explicitly provide a transaction status indicator. 

# **Behaviour** 

- The **Instrument Status** field shall be displayed as a **single-select dropdown** . 

- Users shall be allowed to select only one value at a time. 

- 

- 

- 

   - Multiple selections shall not be permitted. 

   - The field shall be **optional (not mandatory)** . 

   - If the uploaded Credit MIS file already contains a transaction status column, the system shall consider the status provided in the file. 

- If the Credit MIS file does not contain a transaction status indicator, the selected Instrument Status value shall be applied to all records in the file. 

- When **C (Credit)** is selected, all records in the file shall be treated as **successful transactions** . 

- When **D (Debit)** is selected, all records in the file shall be treated as **failed transactions** . 

# **Validation** 

- Only the predefined values **C (Credit)** and **D (Debit)** shall be available for selection. 

- The system shall not allow multiple selections. 

- The field may be left blank if the transaction status is available within the uploaded file. 

- If provided, the selected value shall be applied uniformly to all records in the file when a status column is not available. 

# **Failure Reason Code** 

# **Data Source** 

- The **Failure Reason Code** dropdown shall be populated from the **Reversal Remarks Table** , using the **Reversal Code** column. 

- Only active reversal codes shall be available for selection. 

- Failure case only updates the reason code. In case, success is not applicable. 

- The selected Failure Reason Code shall be used when the Credit MIS file does not contain a failure/reversal reason code. 

# **Behaviour** 

- The **Failure Reason Code** field shall be displayed as a **single-select dropdown** . 

- Multiple selections shall not be permitted. 

- Failure reason codes are typically provided as part of the Credit MIS file. 

- If the Credit MIS file contains a Failure Reason Code, the system shall use the value available in the file and ignore the configured Failure Reason Code. 

- If the Credit MIS file does not contain a Failure Reason Code, the configured Failure Reason Code shall be applied to all applicable records in the file. 

- When **Instrument Status = C (Credit)** : 

   - The Failure Reason Code field shall be disabled. 

   - Any previously selected Failure Reason Code shall be automatically cleared. 

- When **Instrument Status = D (Debit)** : 

   - The Failure Reason Code field shall be enabled for selection. 

- When **Instrument Status is not selected** , the Failure Reason Code field shall remain enabled. 

# **Validation** 

- Only valid Reversal Codes from the Reversal Remarks Table shall be selectable. 

- Only one Failure Reason Code can be selected at a time. 

- The field shall not allow multiple selections. 

- The field shall be disabled when Instrument Status is set to **C (Credit)** . 

- Any selected Failure Reason Code shall be removed when Instrument Status changes from **D (Debit)** to **C (Credit)** . 

- Inactive or deleted reversal codes shall not be displayed in the dropdown. 

# **Text separator:** 

The system shall provide a **File Separator** field to enable users to define the delimiter used within the file. The field shall accept only **special characters** , including but not limited to **pipe (|), hyphen (-), comma (,), slash (/), space, tab (vbTab), dollar sign ($), tilde (~), and circumflex accent (^)** . Single selectable and multi select is not applicable. CSV and TEXT and XXD file format options are enable in this separator. 

# **File Separator** 

# **Data Source** 

- The **File Separator** field shall be maintained as a predefined list of supported delimiter characters within the application. 

- The field is applicable only for file formats where delimiters are required to parse file contents correctly. 

# **Behaviour** 

- The **File Separator** field shall be displayed as a **single-select dropdown** . 

- Users shall be allowed to select only one separator value at a time. 

- Multiple selections shall not be permitted. 

- The field shall be enabled only when the selected **Credit MIS File Format** is: 

   - **CSV, TXT, XXD** 

- The field shall remain disabled for all other file formats (DBF, XLS, XLSX, PSV, PDF). 

- The selected separator shall be used by the system during file parsing and data extraction. 

# **Supported Separator Values** 

The dropdown shall contain the following special character options: 

Pipe (|), Hyphen (-), Comma (,), Slash (/), Space ( ), Tab (vbTab), Dollar Sign ($), Tilde (~), Circumflex Accent (^) 

# **Validation** 

- Only one separator value can be selected. 

- Multiple selections shall not be permitted. 

- Only predefined separator values shall be available for selection. 

- The File Separator field shall be enabled only for CSV, TXT, and XXD file formats. 

- If a separator is selected and the file cannot be parsed using the configured delimiter, the system shall display an appropriate validation error message. 

- Invalid characters outside the predefined list shall not be accepted. 

# **Date & Time update:** 

# Brief Description 

The Date & Time Update feature allows authorized users to manually update or overwrite the credit date and time when the uploaded Credit MIS file does not contain valid date/time information. This functionality is controlled through a toggle switch in Processing Control to ensure proper governance and prevent unauthorized modifications. 

# Data Source 

- Primary Source: Credit MIS file uploaded during processing. 

- Manual Source: User input through the Credit Date & Time Update menu when the feature is enabled. 

- Control Source: Processing Control configuration (On/Off toggle). 

- By default, the processing control is OFF only. 

# Behaviour 

- Toggle ON 

   - Users can access the Credit Date & Time Update menu. 

   - Users are allowed to enter, update, or overwrite the credit date and time. 

   - The manually entered value will be used for further processing. 

- Toggle OFF 

   - Users cannot update or overwrite the credit date and time. 

   - The system will use only the date and time available in the uploaded Credit MIS file. 

   - The Credit Date & Time Update menu should be disabled or read-only. 

# Validation 

1. Credit date and time must be provided in a valid system-supported format. 

2. Date and time cannot be blank when a manual update is submitted. 

3. Future date/time values should not be allowed (based on business rules). 

4. Manual update is permitted only when the Date & Time Update toggle is ON. 

5. Users without the required authorization should not be able to modify the credit date and time. 

6. All manual updates should be logged in the audit trail, including: 

   - User ID 

   - Previous value 

   - Updated value 

   - Date and time of modification 

7. If the toggle is OFF, any attempt to update the credit date/time must be rejected with an appropriate validation message. 

Validation Message (Toggle OFF): _"Credit Date & Time Update is disabled. Manual modification is not allowed."_ 

# **Reconciliation Type** 

# **Brief Description** 

The **Reconciliation Type** field is used to identify whether the selected bank account is utilized for **Subscription Collection** or **Liability Payments** . When **Liability** is selected, the user must additionally specify the liability transaction category from the available options. 

# **Data Source** 

- User-selected value from the **Reconciliation Type** control. 

- Available options: 

   - **Subscription** 

   - **Liability** 

- When **Liability** is selected, the liability category is selected from a dropdown list: 

   - Redemption 

   - Dividend 

   - Refund 

   - Brokerage 

- Configuration maintained within the application master/setup data. 

# **Behaviour** 

# **Subscription** 

- User selects **Subscription** . 

- No additional transaction type selection is required. 

- The account is treated as a subscription collection account for reconciliation processing. 

- Liability category dropdown remains hidden or disabled. 

# **Liability** 

- User selects **Liability** . 

- A liability category dropdown is displayed and becomes mandatory. 

- User must choose one of the configured liability categories: 

   - Redemption 

   - Dividend 

   - Refund 

   - Brokerage 

- The selected category is used during reconciliation and transaction processing. 

# **Validation** 

# **1. Reconciliation Type is Mandatory** 

- The user must select either **Subscription** or **Liability** . 

# **Validation Message:** 

Please select a Reconciliation Type. 

# **2. Liability Category is Mandatory** 

- Applicable only when **Liability** is selected. 

# **Validation Message:** 

Please select a Liability Type. 

# **3. Valid Liability Category** 

- The selected liability type must exist in the configured list of liability categories. 

# **Validation Message:** 

Invalid Liability Type selected. 

# **4. Successful Save** 

- The selected reconciliation type and liability category (if applicable) are saved successfully. 

# **Validation Message:** 

Reconciliation Type updated successfully. 

# **5. Change of Reconciliation Type** 

- If the user changes from **Liability** to **Subscription** , any previously selected liability category should be cleared automatically. 

# **6. Read-Only Mode (if applicable)** 

- Users without update permissions can view but cannot modify the reconciliation type. 

# **Validation Message:** 

You are not authorized to modify the Reconciliation Type. 

# **<u>EMAIL Mode – Credit MIS Email Monitoring</u>** 

# **Objective** 

The system shall monitor the configured email inbox for incoming credit MIS emails and automatically identify relevant emails based on the predefined email subject pattern. Upon successful identification, the system shall extract and process the attached credit MIS for further validation and downstream processing. 

# **Data Processing** 

1. The system continuously monitors the designated email inbox configured for bank statement ingestion. 

2. For each incoming email, the system reads the email metadata, including: 

   - Subject 

   - Sender email address 

   - Received date and time 

   - Attachments 

3. The system compares the email subject against the configured subject pattern. 

4. If the subject matches the configured pattern: 

   - The email is classified as a credit MIS email. 

   - Attachments are extracted for processing. 

   - Relevant email and attachment details are recorded in the audit log. 

5. If the subject does not match the configured pattern: 

   - The email is ignored and excluded from credit MIS processing. 

6. Processed emails are marked according to the configured post-processing action (for example, move to processed folder, archive, or flag as processed). 

# **System Behaviour** 

- When **EMAIL** mode is selected, only email-related configuration options shall be enabled. 

- The system shall monitor the configured mailbox at scheduled intervals or in real time, as configured. 

- The system shall identify credit MIS emails using the configured email subject pattern. 

- The system shall process only emails that satisfy the configured identification criteria. 

- The system shall support processing multiple matching emails received within the same monitoring cycle. 

- The system shall prevent duplicate processing of previously processed emails. 

- The system shall generate logs for successful, failed, and skipped email processing events. 

- The system shall notify users or administrators when email retrieval or attachment processing failures occur. 

# **Validation Rules** 

1. A valid email inbox configuration must be available before monitoring begins. 

2. The email subject must match the configured subject pattern. 

3. The email must contain at least one supported attachment, if attachment processing is required. 

4. Duplicate emails or previously processed emails must not be reprocessed. 

5. The system shall validate that retrieved attachments are accessible and not corrupted. 

6. Any email that fails subject pattern validation shall be marked as non-qualifying and excluded from processing. 

7. Errors encountered during email retrieval, attachment extraction, or processing shall be logged with appropriate error messages. 

8. Audit records shall be maintained for all processed and rejected emails. 

# **From Email ID** 

# **Objective** 

The system shall provide the capability to configure and validate the sender email ID(s) from which banks or payment aggregators send credit MIS files. The configuration shall support both **Auto Trigger** and **Manual Trigger** modes to ensure that files are accepted only from authorized email sources. 

# **Data Processing** 

The user configures the sender email ID information based on the selected trigger mode. 

When **Auto Trigger** mode is selected: 

- The system allows configuration of only one sender email ID. 

- Incoming emails are validated against the configured sender email ID. 

When **Manual Trigger** mode is selected: 

- The system allows configuration of one or more sender email IDs. 

- The system stores all configured email IDs as authorized senders. 

During email processing, the sender's email address is extracted from the incoming email. 

The extracted sender email address is compared against the configured authorized sender email ID(s). 

Only emails received from authorized sender email ID(s) proceed to further processing. 

# **System Behaviour** 

The system shall provide a field to capture sender email ID information. 

The system shall support two configuration modes: 

   - **Auto Trigger** : Single sender email ID allowed. 

   - **Manual Trigger** : Multiple sender email IDs allowed. 

- When Auto Trigger is selected, the system shall restrict the configuration to one email ID only. 

- When Manual Trigger is selected, the system shall allow users to add, edit, and remove multiple email IDs. 

- The system shall validate incoming emails against the configured sender email ID(s). 

- Emails received from unauthorized sender email IDs shall be rejected from processing. 

- The system shall maintain an audit trail of configured sender email IDs and any changes made to the configuration. 

- The system shall log successful and failed sender email validation events. 

# **Validation Rules** 

1. Sender email ID is mandatory. 

2. The email ID must be in a valid email format (for example: example@bank.com). 

3. Leading and trailing spaces shall be removed automatically before validation. 

4. Duplicate email IDs shall not be allowed. 

5. In **Auto Trigger** mode: 

   - Only one sender email ID can be configured. 

   - The system shall display a validation error if more than one email ID is entered. 

6. In **Manual Trigger** mode: 

   - Multiple sender email IDs can be configured. 

   - Each email ID must be unique and valid. 

7. Incoming emails must originate from one of the configured sender email ID(s). 

8. Emails received from unconfigured or unauthorized sender email IDs shall be flagged and excluded from processing. 

9. Any modification to sender email ID configuration shall be captured in the audit log with user details, date, and timestamp. 

# Receiver Email ID 

# Objective 

The system shall provide the capability to configure one or more receiver email IDs used for receiving credit MIS files from banks or payment aggregators. All configured receiver email IDs must belong to the @atronline.com domain and pass basic email validation before being saved. 

# Data Processing 

1. The user enters one or more receiver email IDs. 

2. The system validates each email ID for: 

   - Correct email format. 

   - Mandatory @atronline.com domain. 

3. The system stores all valid receiver email IDs in the configuration repository. 

4. The configured receiver email IDs are used for email receipt, monitoring, and processing activities. 

5. Any additions, modifications, or removals of receiver email IDs are recorded in the audit log. 

# System Behaviour 

- The system shall provide a field to capture Receiver Email ID(s). 

- The system shall allow configuration of a single email ID or multiple email IDs. 

- The system shall restrict receiver email IDs to the @atronline.com domain only. 

- The system shall support adding, editing, and removing receiver email IDs. 

- The system shall display appropriate validation messages for invalid email formats or unsupported domains. 

- The system shall prevent duplicate receiver email IDs from being configured. 

- The system shall maintain an audit trail of all configuration changes. 

- The system shall use the configured receiver email ID(s) during email monitoring and processing operations. 

# Validation Rules 

1. Receiver Email ID is mandatory. 

2. The email ID must conform to a valid email format. 

3. The email domain must be @atronline.com. 

   - Valid Examples: 

      - <u>creditmis@atronline.com; b_arun@atronline.com</u> 

      - <u>collections@atronline.com; b.arun@atronline.com</u> 

      - bankstatements@atronline.com 

4. Email IDs with domains other than @atronline.com shall be rejected. 

   - Invalid Examples: 

      - creditmis@gmail.com 

   - collections@bank.com 

5. The system shall allow one or multiple receiver email IDs to be configured. 

6. Duplicate email IDs shall not be allowed. 

7. Leading and trailing spaces shall be automatically trimmed before validation. 

8. Blank or null email ID entries shall not be accepted. 

9. At least one valid receiver email ID must be configured before the email setup can be activated. 

- 10.All additions, updates, and deletions of receiver email IDs shall be logged with user ID, date, and timestamp for audit purposes. 

# Email Subject 

# Objective 

The system shall provide the capability to configure one or more email subject patterns that are used to identify and process credit MIS emails received from banks or payment aggregators. The email subject serves as the primary identifier for qualifying emails for further processing. 

# Data Processing 

1. The user configures one or more email subject values or subject patterns. 

2. The system stores the configured subjects as valid identifiers for email processing. 

3. Upon receipt of an email, the system extracts the email subject line. 

4. The extracted subject is compared against the configured subject values/patterns. 

5. If a match is found, the email is classified as a valid bank credit MIS email and proceeds for further processing. 

6. If no match is found, the email is excluded from processing. 

7. All configured subject values are maintained in the configuration repository and referenced during email monitoring. 

# System Behaviour 

- The system shall provide a field to capture Email Subject(s). 

- The system shall allow users to configure one or multiple subject values/patterns. 

- The system shall use the configured subject values as the primary email identification criteria. 

- The system shall allow users to add, edit, and remove subject configurations. 

- The system shall prevent duplicate subject values from being configured. 

- The system shall support subject values containing keywords, reference numbers, bank names, dates, or other identifying information. 

- The system shall compare incoming email subjects against all configured subject values/patterns. 

- The system shall maintain an audit trail for subject creation, modification, and deletion activities. 

# Validation Rules 

1. Email Subject is mandatory. 

2. The subject value must contain a minimum of 5 characters. 

3. Duplicate subject values shall not be allowed. 

4. Leading and trailing spaces shall be automatically trimmed before validation. 

5. Blank or null subject values shall not be accepted. 

6. The system shall allow configuration of one or multiple subject values. 

7. Subject values shall be stored exactly as entered after validation. 

8. The system shall reject special entries consisting only of spaces or unsupported characters. 

9. At least one valid email subject must be configured before the email configuration can be activated. 

- 10.Any changes to configured subject values shall be recorded in the audit log with user ID, date, and timestamp. 

# Examples 

# Valid Subjects 

- Daily Collection MIS 

- Bank Statement ATR 

- Credit MIS Report 

- HDFC Settlement File 

- ICICI Collection Report 

# Invalid Subjects 

- MIS _(less than 5 characters)_ 

- Blank value 

- Duplicate of an already configured subject 

# **File Name Pattern** 

# Objective 

The system shall provide the capability to configure one or more file name patterns that uniquely identify Credit MIS files attached to incoming emails. Since sender and receiver may exchange multiple emails for different business purposes, the file name shall be used as an additional filtering criterion to ensure that only the relevant Credit MIS attachment is processed. The system shall support pattern-based matching to ignore dynamic portions of file names such as dates, timestamps, sequence numbers, or batch identifiers. 

# Data Processing 

1. The user configures one or more file name patterns associated with Credit MIS files. 

2. The system stores the configured file name patterns as valid attachment identification criteria. 

3. When an email is identified through sender, receiver, and subject validation, the system extracts the attachment name(s). 

4. The system compares each attachment name against the configured file name patterns. 

5. During comparison, the system ignores dynamic portions such as: 

   - Date values 

   - Time values 

   - Timestamps 

   - Sequence numbers 

   - Batch identifiers 

6. If an attachment file name contains a configured pattern, the attachment is classified as a valid Credit MIS file. 

7. If multiple attachments exist, only those matching configured file name patterns are selected for processing. 

8. Attachments that do not match any configured file name pattern are ignored. 

9. All matching and non-matching file name validation results are recorded in the audit log. 

# System Behaviour 

- The system shall provide a field to capture File Name Pattern(s). 

- The system shall allow configuration of one or multiple file name patterns. 

- The system shall use a "Contains" search mechanism to identify matching files. 

- The system shall ignore dynamic portions of the file name during matching. 

- The system shall support processing emails containing multiple attachments. 

- The system shall select only attachments matching the configured file name pattern(s). 

- The system shall prevent duplicate file name patterns from being configured. 

- The system shall allow users to add, edit, and remove file name patterns. 

- The system shall maintain an audit trail for all file name pattern configuration changes. 

- The system shall support multiple file name patterns for different banks, payment aggregators, or MIS file formats. 

# Validation Rules 

1. File Name Pattern is mandatory. 

2. The system shall allow one or multiple file name patterns. 

3. Duplicate file name patterns shall not be allowed. 

4. Leading and trailing spaces shall be automatically trimmed before validation. 

5. Blank or null values shall not be accepted. 

6. The file name pattern must contain at least 3 characters. 

7. Pattern matching shall be performed using a Contains search method. 

8. Dynamic values such as dates, timestamps, sequence numbers, and batch identifiers shall not be considered during identification. 

9. At least one valid file name pattern must be configured before enabling emailbased file processing. 

- 10.All additions, modifications, and deletions of file name patterns shall be recorded in the audit log with user ID, date, and timestamp. 

# Examples 

|Configured File Name Pattern|Incoming File Name|Result|
|---|---|---|
|CreditMIS|CreditMIS_20260825_103000.xlsx|Matched|
|HDFC_MIS|HDFC_MIS_25Aug2026.csv|Matched|
|Settlement_Report|Settlement_Report_20260825_120501.xls|Matched|
|ICICI_Credit|ICICI_Credit_001_20260825.xlsx|Matched|
|CreditMIS|Daily_Collection_Report.xlsx|Not Matched|



Sample Identification Logic 

- Configured Pattern: CreditMIS 

- Incoming File Name: CreditMIS_20260825_103000.xlsx 

- Ignored Portion: 20260825_103000 

- Matching Value: CreditMIS 

- Result: Valid Credit MIS Attachment 

This ensures that even when the filename changes daily due to date/time suffixes, the system can consistently identify and process the correct Credit MIS file attachment. 

# **File Format ZIP** 

# **Objective** 

The system shall provide a mandatory configuration to define whether the Credit MIS file is expected as a ZIP file and, if so, whether it is password-protected. This configuration enables the system to correctly identify, validate, and process ZIP attachments received through email. 

# **Data Processing** 

1. The user selects the ZIP file format option during configuration. 

2. The system stores the selected ZIP type as part of the email ingestion setup. 

3. During email processing, the system validates the attachment format against the configured ZIP option. 

4. Based on the selected option: 

   - **No ZIP** : The system expects the attachment in its original format (e.g., XLSX, XLS, CSV). 

   - **ZIP Without Password** : The system expects a ZIP file and extracts its contents without requiring a password. 

   - **ZIP With Password** : The system expects a password-protected ZIP file and uses the configured password to extract the contents. 

5. If ZIP extraction is successful, the extracted file(s) proceed to subsequent validation and processing. 

6. Any ZIP format mismatch or extraction failure is logged and flagged for review. 

# **System Behaviour** 

- The system shall provide a mandatory field named **File Format ZIP** . 

- The system shall allow only one of the following options to be selected: 

   - **No ZIP** 

   - **ZIP Without Password** 

   - **ZIP With Password** 

- The system shall not allow multiple selections. 

- The system shall default to no selection and require the user to explicitly choose one option. 

- When **ZIP With Password** is selected: 

   - A **Password** field shall be displayed. 

   - The password field shall be mandatory. 

   - The password field shall support **Eye Open / Eye Close** functionality to show or hide the password. 

- When **No ZIP** or **ZIP Without Password** is selected: 

   - The password field shall remain hidden and disabled. 

- The system shall validate incoming attachments against the selected ZIP option before processing. 

- The system shall maintain an audit trail for ZIP configuration updates. 

# **Validation Rules** 

1. **File Format ZIP** selection is mandatory. 

2. Only **one option** can be selected at a time. 

3. Multi-selection shall not be permitted. 

4. One of the following values must be selected: 

   - No ZIP 

   - ZIP Without Password 

   - ZIP With Password 

5. If **ZIP With Password** is selected: 

   - Password field is mandatory. 

   - Blank or null password values shall not be accepted. 

   - Password shall be stored securely according to security standards. 

6. If **No ZIP** or **ZIP Without Password** is selected: 

   - Password field shall not be available for input. 

7. The received attachment format must match the configured ZIP option. 

8. If a password-protected ZIP file is received and the configured password is incorrect, the file shall be rejected and logged. 

9. If a non-ZIP file is received when a ZIP option is configured, the attachment shall fail validation. 

- 10.All configuration changes and validation failures shall be recorded in the audit log with user ID, date, and timestamp. 

# **Example Scenarios** 

# **Scenario 1: No ZIP** 

- Configuration: **No ZIP** 

- Received File: CreditMIS.xlsx 

- Result: ✅ Processed Successfully 

# **Scenario 2: ZIP Without Password** 

- Configuration: **ZIP Without Password** 

- Received File: CreditMIS.zip 

- Result: ✅ ZIP Extracted and Processed 

# **Scenario 3: ZIP With Password** 

- Configuration: **ZIP With Password** 

- Password: MIS@123 

- Received File: CreditMIS.zip (password protected) 

- Result: ✅ ZIP Extracted Using Configured Password and Processed 

# **Scenario 4: Invalid Password** 

- Configuration: **ZIP With Password** 

- Password: MIS@123 

- Received File: CreditMIS.zip (protected with a different password) 

- Result: ✅ Extraction Failed, Error Logged, File Not Processed. 

Refer to the Email PRD document - ??? 

# **<u>MODE AUTO:</u>** 

# **Auto Download Configuration** 

# **Objective** 

The system shall provide an **Auto Download** option to automatically retrieve Credit MIS files from a configured URL at predefined frequencies without manual intervention. The configuration shall capture the URL, User ID, Password, and Re-enter Password credentials required to access and download the Credit MIS files securely. 

# **Data Processing** 

1. The user selects the **Auto Download** option. 

2. The system captures and stores: 

   - URL 

   - User ID 

   - Password 

# `o` Re-enter Password 

3. The system validates the entered credentials before saving the configuration. 

4. Based on the configured frequency, the system automatically connects to the specified URL. 

5. The system authenticates using the configured User ID and Password. 

6. Upon successful authentication, the system searches for the latest available Credit MIS file(s). 

7. The system downloads the file(s) and stores them in the designated location for further processing. 

8. Download status, file details, and processing results are recorded in the audit log. 

9. Any authentication failure, URL access issue, or file download error is logged and notified to the appropriate user or administrator. 

# **System Behaviour** 

- The system shall provide an **Auto Download** configuration option. 

- The system shall allow users to enter: 

   - URL 

   - User ID 

   - Password 

   - Re-enter Password 

- The system shall support automatic file retrieval from the configured URL. 

- The system shall execute downloads based on the configured frequency schedule. 

- The system shall authenticate using the configured credentials before downloading files. 

- The system shall support downloading multiple Credit MIS files if available. 

- Password and Re-enter Password fields shall support **Eye Open / Eye Close** functionality. 

- Password values shall be masked by default. 

- The system shall securely store authentication credentials. 

- The system shall maintain an audit trail of configuration changes and download activities. 

- The system shall prevent file duplication by identifying previously downloaded files. 

# **Validation Rules** 

1. **URL** is mandatory. 

2. URL must be in a valid format. 

   - Example: 

      - https://mis.bank.com/download 

      - https://portal.paymentaggregator.com/reports 

3. **User ID** is mandatory. 

4. **Password** is mandatory. 

5. **Re-enter Password** is mandatory. 

6. Password and Re-enter Password must match. 

7. The system shall not allow configuration to be saved if passwords do not match. 

8. Leading and trailing spaces shall be removed from URL and User ID fields. 

9. URL must contain a valid protocol (http:// or https://). 

- 10.Blank or null values are not permitted for any mandatory field. 

- 11.Credentials shall be stored in encrypted/secured format. 

- 12.The system shall validate URL accessibility during configuration save, if connectivity is available. 

- 13.Previously configured URLs shall not be duplicated for the same setup. 

- 14.All configuration changes shall be recorded with user ID, date, and timestamp in the audit log. 

# Field Definition 

|**Field**|**Type**|**Mandatory **|**Description**|
|---|---|---|---|
|URL|Text Box|Yes|URL from where Credit MIS files are<br>downloaded|
|User ID|Text Box|Yes|Login ID for URL authentication|



|**Field**|**Type**|**Mandatory **|**Description**|
|---|---|---|---|
|Password|Password<br>Field|Yes|Password used for authentication|
|Re-enter<br>Password|Password<br>Field|Yes|Confirmation of password entry|



# **Example Scenario** 

# **Configuration:** 

- URL: https://reports.bank.com/creditmis 

- User ID: atr_user 

- Password: ****** 

- Re-enter Password: ****** 

# **Result:** 

- System connects to the URL at the configured frequency. 

- User credentials are validated. 

- Latest Credit MIS file is downloaded automatically. 

- Download activity is logged for audit and tracking purposes. 

# **File Name:** 

File name is important to pick the file from GCB / file pickup process. These modes are Auto, API and Email already tracking in file name, it is help to upload the file belongs to precisely. 

Auto – The system is downloading the file from specific URL and rename should be done as per upload process. 

Email - The system already defines the sender & receiver email ID along with subject of the email and file name also. This is assisted to upload the files. 

API – The files are sharing through API from external services. This is also tracking the file, and it gets upload into the system. 

Manual – This mode is different from the uploading process because of user place the files manually in specific path likely (GCB or file pick up path). The file name capture provision required, and file name may match as prefix or suffix or contains. 1<sup>st</sup> the file must be read and identify the mapped logic against the configuration.  If the multiple 

mapped logics are qualified against the pickup file then the file name logic pattern utilize in the process. 

# **File Name** 

# **Brief Description** 

The **File Name** field is used to accurately identify and map incoming Credit MIS files to the appropriate configuration during the file pickup and upload process. For **Auto, API, and Email** modes, the file name is generally tracked as part of the source integration process. However, for **Manual** mode, users place files directly into the designated pickup location (GCB/File Pickup Path), and therefore file name pattern identification becomes a critical factor for selecting the correct configuration. 

The system shall support file name pattern matching using: 

- Prefix 

- Suffix 

- Contains 

- Exact Match (recommended) 

When multiple configurations qualify for the same file, the configured file name pattern shall be used as the final identifier to determine the appropriate mapping logic. 

# **Data Source** 

- User-defined configuration during Credit MIS setup. 

- Incoming file name from: 

   - Auto Mode (Downloaded file from URL) 

   - Email Mode (Email attachment) 

   - API Mode (API-uploaded file) 

   - Manual Mode (File manually placed in pickup location) 

# **Behaviour** 

# **Auto Mode** 

- The system downloads the file from the configured URL. 

- The downloaded file may be renamed according to the upload process standard. 

- The file name is captured and stored for mapping validation. 

# **Email Mode** 

- The system identifies emails based on configured: 

   - Sender Email ID 

   - Receiver Email ID 

   - Email Subject 

- The attachment file name is additionally validated against the configured file name pattern before processing. 

# **API Mode** 

- Files received through API integration are tracked using the incoming file name. 

- The file name is validated against the configured pattern before upload. 

# **Manual Mode** 

- Users manually place files into the configured pickup location. 

- The system shall first evaluate all available Credit MIS configurations. 

- The uploaded file content shall be validated against configured mapping rules. 

- If multiple configurations satisfy the file mapping criteria, the system shall utilize the configured File Name pattern to determine the correct configuration. 

- File name matching can be performed using: 

   - Prefix Match 

   - Suffix Match 

   - Contains Match 

   - Exact Match 

# **Configuration Priority** 

1. File Structure Validation 

2. Header Mapping Validation 

3. Data Mapping Validation 

4. File Name Pattern Matching (when multiple mappings qualify) 

# **Validation** 

# **Mandatory Validation** 

- File Name configuration is mandatory for Manual mode. 

- For Auto, Email, and API modes, File Name configuration is optional but recommended. 

# **Pattern Validation** 

- Minimum length: 3 characters. 

- Maximum length: 50 characters. 

- File name pattern shall support: 

   - Alphabets (A-Z) 

   - Numerics (0-9) 

   - Underscore (_) 

   - Hyphen (-) 

   - Space 

   - Special characters commonly used in file names. 

# **Duplicate Validation** 

- Same file name pattern cannot be configured multiple times under the same Bank Account and Credit MIS configuration. 

# **Matching Validation** 

- System shall support: 

   - Starts With (Prefix) 

   - Ends With (Suffix) 

   - Contains 

   - Exact Match 

# **Case Sensitivity** 

- File name comparison shall be performed in a case-insensitive manner. 

# Validation Message 

|**Scenario**|**Message**|
|---|---|
|File Name Pattern is blank|File Name Pattern is required.|
|File Name Pattern length less than 3 characters|Minimum 3 characters are required.|



|**Scenario**|**Message**|
|---|---|
|Duplicate File Name Pattern exists|File Name Pattern already exists.|
|Uploaded file does not match configured<br>pattern|File Name does not match the<br>configured pattern.|
|Multiple configurations matched and file name|Unable to identify unique configuration|
|could not determine unique mapping|based on File Name Pattern.|
|Invalid characters entered|Invalid File Name Pattern.|



# **Acceptance Criteria** 

# **AC1** 

Given the user is configuring Credit MIS, When Manual mode is selected, Then the system shall allow File Name Pattern configuration. 

# **AC2** 

Given a file is received through Auto, API, or Email mode, When the file is picked up, Then the system shall validate the incoming file name against the configured pattern. 

# **AC3** 

Given multiple configurations qualify for the same file, When File Name Pattern is configured, Then the system shall use the File Name Pattern to identify the applicable configuration. 

# **AC4** 

Given Prefix matching is configured, When the file name starts with the configured value, Then the file shall be mapped successfully. 

# **AC5** 

Given Suffix matching is configured, When the file name ends with the configured value, Then the file shall be mapped successfully. 

# **AC6** 

Given Contains matching is configured, When the configured text exists anywhere in the file name, Then the file shall be mapped successfully. 

# **AC7** 

Given Exact Match is configured, When the incoming file name exactly matches the configured value, Then the file shall be mapped successfully. 

# **AC8** 

Given no matching File Name Pattern is found, When the file pickup process executes, Then the file shall be moved to exception handling, and an appropriate error message shall be logged. 

# **AC9** 

Given the file name contains upper- or lower-case characters, when validation is performed, Then the system shall evaluate the file name in a case-insensitive manner. 

# **AC10** 

Given duplicate File Name Patterns are entered under the same configuration, When the user clicks Save, Then the system shall prevent saving and display an appropriate validation message. 

# Acceptance Criteria – Save Functionality 

- Mandatory fields validation 

   - Mandatory fields must be validated before saving. 

   - Save button is enabled only after mandatory fields are populated. 

- Successful save confirmation 

   - Configuration is saved successfully after validation. 

   - A success confirmation message is displayed. 

   - User is redirected back to the Credit MIS Summary page. 

   - Newly created configuration appears in the summary grid. 

- Business rules enforcement 

   - Only authorized users can create a Credit MIS Configuration. 

   - Duplicate configurations are validated as per business rules. 

   - Newly created record inherits the default status defined by the business process (e.g., _Waiting for Approval_ ). 

   - After successful save, the summary grid refreshes automatically. 

- 

- Field-specific acceptance criteria 

   - Mode: Mandatory; only one mode selectable; hidden fields not validated or saved. 

   - Feed Option: Populated from master table; only active options displayed; selected option saved. 

   - Payment Aggregator Code: Mandatory; only active codes selectable; no free-text entry allowed. 

   - Payment Mechanism: Multi-select allowed; “ALL” option interpreted as all values; duplicates not permitted. 

   - Bank Name & Account Number: Must be valid from master tables; inactive/deleted values not displayed; account number mandatory in bulk processing. 

   - Account Category: Mandatory; only one value selectable (Scheme or Pool). 

   - Scheme Code: Mandatory when Account Category = Scheme Account; disabled when Pool Account. 

   - Asset Class: Mandatory when Scheme Account; disabled when Pool Account. 

   - File Format: Mandatory; must match uploaded file format; only one selectable. 

   - File Separator: Enabled only for CSV, TXT, XXD formats; must be from predefined list. 

   - Date & Time Update: Allowed only when toggle is ON; future dates not permitted; audit trail required. 

   - Instrument Status & Failure Reason Code: If Debit selected, Failure Reason Code must be enabled and valid; disabled when Credit is selected. 

- Reconciliation Type: Mandatory; if Liability selected, Liability Category must also be selected and valid. 

Perfect — let’s turn the **Save option acceptance criteria** into a structured **QA/UAT checklist** . This way, testers can validate each condition step by step during execution. 

# **📝 QA/UAT Checklist – Save Functionality** 

# **1. Mandatory Fields** 

- Verify that the **Save button** is disabled until all mandatory fields are populated. 

- Confirm that required fields (Mode, Feed Option, Payment Aggregator Code, Account Category, File Format, etc.) trigger validation messages if left blank. 

# **2. Authorization** 

- Ensure only authorized users can access the Add (+) and Save functionality. 

- Attempt save as unauthorized user → system should block with appropriate error. 

# **3. Duplicate Configurations** 

- Try saving a configuration identical to an existing one → system should reject with a duplicate error. 

- Confirm that unique configurations are saved successfully. 

# **4. Business Rules** 

- Verify that only **active values** from master tables (Bank Name, Feed Option, Payment Aggregator Code, etc.) are selectable. 

- Confirm that inactive/deleted values are not displayed. 

- Check that newly created records inherit the **default status** (e.g., Waiting for Approval). 

- Ensure the summary grid refreshes automatically after save. 

# **5. Field Dependencies** 

- **Scheme Code** : Mandatory only when Account Category = Scheme Account. Disabled when Pool Account. 

- **Asset Class** : Enabled only when Account Category = Scheme Account. Disabled when Pool Account. 

- **Reconciliation Type** : Mandatory. If Liability selected, Liability Category must also be chosen. 

- **Instrument Status** : If Debit selected, Failure Reason Code must be enabled and validated. Disabled when Credit is selected. 

- **Bulk Processing** : Bank Account Number becomes mandatory. 

# **6. File Format & Separator** 

- Uploaded file format must match the selected Credit MIS File Format. 

- File Separator field enabled only for CSV, TXT, XXD formats. 

- Ensure only predefined separator values are accepted. 

# **7. Date & Time Update** 

- Toggle OFF → Save should reject manual date/time updates. 

- Toggle ON → Allow manual entry but reject future dates. 

- Confirm audit trail logs: User ID, previous value, updated value, timestamp. 

# **8. Successful Save** 

- After successful validation: 

   - Configuration record is saved. 

   - Success confirmation message is displayed. 

   - User is redirected back to the Credit MIS Summary page. 

   - Newly created configuration appears in the summary grid. 

