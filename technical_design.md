# Technical Design Document (TDD)
## Salesforce-to-EAM Infrastructure Ticketing System

### 1. Executive Summary
This document outlines the technical architecture for the Salesforce-to-EAM Infrastructure Ticketing System. This solution serves as a proof-of-concept for the City of Plano to capture public works issues via a public-facing portal, route them internally using Salesforce automation, and seamlessly transmit the data to an external Enterprise Asset Management (EAM) system via asynchronous REST APIs.

### 2. System Architecture
The system utilizes a hybrid approach of declarative automation and programmatic integration, ensuring maintainability while meeting complex integration requirements.

**Workflow:**
1. **Intake:** Unauthenticated users submit issues via an Experience Cloud site hosting a custom Lightning Web Component (LWC).
2. **Storage:** Data is committed to the custom `Asset_Issue__c` object.
3. **Routing:** An After-Save Record-Triggered Flow assigns the record to the appropriate internal maintenance queue.
4. **Integration Handoff:** The Flow invokes a bridging Apex class.
5. **Callout:** A Queueable Apex job serializes the data into JSON and POSTs it to the external EAM system endpoint.
6. **Confirmation:** The Queueable job processes the HTTP response and updates the `Sync_Status__c` and `External_EAM_ID__c` on the Salesforce record.

### 3. Data Model
**Custom Object:** `Asset_Issue__c`
* **Visibility:** Public Read/Write (Internal), Create-Only (External Guest via Site)
* **Search:** Enabled

| Field Label | API Name | Data Type | Properties |
| :--- | :--- | :--- | :--- |
| Asset Type | `Asset_Type__c` | Picklist | Values: Signage, Water/Sewer, Pavement |
| Severity | `Severity__c` | Picklist | Values: Routine, Urgent, Emergency |
| Description | `Description__c` | Long Text Area | Length: 32,000 |
| Sync Status | `Sync_Status__c` | Picklist | Values: Pending, Success, Failed. Default: Pending |
| External EAM ID | `External_EAM_ID__c` | Text | Length: 255, External ID: True, Unique: True |
| Location | `Location__c` | Geolocation | Latitude/Longitude (Decimals) |

### 4. Security & Access Control
* **Public Portal:** Hosted via an Experience Cloud "Build Your Own (Aura)" site.
* **Guest User Profile:** The Public Ticketing Profile is granted `Create` permissions on the `Asset_Issue__c` object.
* **Field-Level Security (FLS):** The Guest User Profile is explicitly granted `Edit` access to `Asset_Type__c`, `Severity__c`, `Description__c`, and `Location__c` to allow data insertion via the LWC. It does *not* have access to modify the Sync Status or External ID.

### 5. User Interface (Lightning Web Component)
**Component Name:** `assetIssueReporter`
* **Framework:** HTML template leveraging `lightning-record-edit-form`.
* **Validation:** Client-side JavaScript intercepts the `onsubmit` event to verify no fields are null. Form submission is aborted, and a toast error is fired if validation fails.
* **UX/Feedback:** Upon `onsuccess`, fires a positive `ShowToastEvent` and utilizes `this.template.querySelectorAll` to seamlessly reset the input fields for the next submission without requiring a page reload.
* **Availability:** Exposed to `lightning__HomePage`, `lightning__RecordPage`, `lightning__AppPage`, and `lightningCommunity__Page`.

### 6. Declarative Automation
**Flow Name:** `Asset_Issue_Routing_and_Sync`
* **Trigger:** Record-Triggered, A record is created.
* **Context:** After-Save (Actions and Related Records).
* **Routing Logic:** Utilizes a Decision element branching on `Asset_Type__c`. Updates the `OwnerId` to one of three standard Queues (Signs Maintenance Queue, Utility Operations Queue, Pavement & Streets Queue).
* **Extensibility:** Executes the `EAMIntegrationRouter` Apex Action passing the `$Record.Id`.

### 7. Programmatic Integration
#### 7.1 Named Credential
* **Label:** `EAM_Mock_Endpoint`
* **Endpoint:** `https://postman-echo.com/post`
* **Authentication:** Custom External Credential (Anonymous for Mocking)

#### 7.2 Apex Architecture
* **`EAMIntegrationRouter.cls`:**
  * Contains an `@InvocableMethod` to expose the programmatic layer to Flow Builder.
  * Accepts a `List<Id>` and enqueues the `EAMCalloutService` job.
* **`EAMCalloutService.cls`:**
  * Implements `Queueable` and `Database.AllowsCallouts`.
  * Queries records passed via constructor.
  * Formats target schema (`system_source`, `issue_id`, `department`, `priority_level`, `field_notes`, `timestamp`).
  * Processes `HttpResponse`. On a 200 OK, sets `Sync_Status__c = 'Success'` and generates a guaranteed unique External ID using the Salesforce Record ID (`EAM-MOCK-` + `issue.Id`). Performs an efficient DML update on the queried list.

### 8. System Limits & Bulkification Constraints
* **Synchronous DML:** Handled natively by bulkified Flow trigger architecture.
* **Callout Governor Limits:** Salesforce enforces a strict maximum of 100 HTTP callouts per transaction. Because the external EAM system API schema expects a single JSON object per request (rather than an array), the asynchronous Queueable class is hard-capped at processing batches of 100 records. 
* *Future Architecture Consideration:* To support >100 simultaneous record creations, the Queueable class must be refactored to utilize Queueable Chaining, or the external EAM API must be updated to accept bulk JSON arrays to reduce the required callout count.

### 9. Quality Assurance & Testing
* **Mock Environment:** Utilizes `MockHttpResponseGenerator.cls` implementing `HttpCalloutMock` to safely simulate 200 and 500 status codes without internet dependency.
* **Test Class:** `EAMIntegration_Test.cls`
  * `testSuccessfulSync()`: Verifies positive Flow routing and Queueable execution. Asserts external ID generation.
  * `testFailedSync()`: Verifies error handling and `Sync_Status__c` rollback to 'Failed'.
  * `testBulkInsert()`: Inserts 100 records simultaneously to verify the architecture stays below SOQL, DML, and Callout governor limits, avoiding `System.LimitException` and `DUPLICATE_VALUE` errors.