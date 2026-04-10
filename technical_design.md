# Technical Design Document (TDD)
## Salesforce-to-EAM Infrastructure Ticketing System

### 1. Executive Summary
This document outlines the technical architecture for the Salesforce-to-EAM Infrastructure Ticketing System. This solution serves as a proof-of-concept for the City of Plano to capture public works issues via a public-facing portal, route them internally using Salesforce automation, and seamlessly transmit the data to an external Enterprise Asset Management (EAM) system via asynchronous REST APIs.

### 2. System Architecture
The system utilizes a hybrid approach of declarative automation and programmatic integration, ensuring maintainability while meeting complex integration requirements.

**Workflow:**
1. **Intake:** Unauthenticated users submit issues via an Experience Cloud site hosting a custom Lightning Web Component (LWC).
2. **Submission (System Context via Apex Facade):** The LWC constructs a JSON payload and calls an Apex facade method running in system context, which performs record creation and file attachment. This avoids Guest User CRUD/file-permission constraints. The LWC does not use `lightning-record-edit-form` or `lightning-file-upload`.
3. **Storage:** Data is committed to the custom `Asset_Issue__c` object.
4. **Routing:** An After-Save Record-Triggered Flow assigns the record to the appropriate internal maintenance queue.
5. **Integration Handoff:** The Flow invokes a bridging Apex class.
6. **Callout:** A Queueable Apex job serializes the data into JSON and POSTs it to the external EAM system endpoint.
7. **Confirmation:** The Queueable job processes the HTTP response and updates the `Sync_Status__c` and `External_EAM_ID__c` on the Salesforce record.

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
* **Apex Class Access:** Grant Site Guest User Apex Class Access to `AssetIssueFacade` (covers both facade methods).
* **Guest CRUD/FLS:** The LWC no longer performs direct DML or native file upload; Guest `Edit` is not required for submission. If picklists are rendered from static options (current approach), Guest FLS is minimal; if dynamic field reads are added later, ensure appropriate read access.
* **Time Zone (Display):** Set the Site Guest User’s time zone (e.g., America/Chicago) to ensure expected timestamp rendering; Salesforce stores datetime in UTC and renders per viewer’s time zone.

### 5. User Interface (Lightning Web Component)
**Component Name:** `assetIssueReporter`
* **Framework:** Custom form markup (no `lightning-record-edit-form`).
* **Map Integration:** Utilizes Leaflet.js for interactive geocoordinate selection. To comply with Lightning Web Security (LWS) restrictions, the map container is entirely managed by manual DOM assignments (`lwc:dom="manual"`). It uses container-scoped native JavaScript event listeners for click and drag interactions to bypass LWS synthetic event distortions, and employs a canvas layer (`L.layerGroup` and `L.circleMarker`) for map pins.
* **Submission Path:** The component gathers inputs (including optional files as base64) and submits a JSON payload to an Apex facade running in system context. The facade creates the `Asset_Issue__c` record and attaches files using `ContentVersion` (`FirstPublishLocationId`).
* **Validation:** Client-side validation ensures required fields (Asset_Type__c, Severity__c, Description__c) are present; server-side validation is enforced by the facade as well.
* **UX/Feedback:** Includes a modern, light-themed UI with glass-morphism effects. Features loading states, and on success displays a success state and advances to a finish screen; reset logic accurately clears the form and removes the map canvas marker for subsequent submissions.
* **Availability:** Exposed to `lightning__HomePage`, `lightning__RecordPage`, `lightning__AppPage`, and `lightningCommunity__Page`.

### 6. Declarative Automation
**Flow Name:** `Asset_Issue_Routing_and_Sync`
* **Trigger:** Record-Triggered, A record is created.
* **Context:** After-Save (Actions and Related Records).
* **Routing Logic:** Utilizes a Decision element branching on `Asset_Type__c`. Updates the `OwnerId` to one of three standard Queues (Signs Maintenance Queue, Utility Operations Queue, Pavement & Streets Queue).
* **Extensibility:** Executes the `EAMIntegrationRouter` Apex Action passing the `$Record.Id`.

### 7. Programmatic Integration
#### 7.0 Apex Facade (System Context)
* **Class:** `AssetIssueFacade`
* **Methods:**
  * `@AuraEnabled CreateIssueResult createIssueWithFiles(CreateIssueRequest req)` — primary typed DTO entry (retained).
  * `@AuraEnabled CreateIssueResult createIssueWithFilesFromJson(String reqJson)` — resilient overload that parses a JSON string into the DTO; recommended for Experience Cloud to avoid client-side Proxy/marshalling issues.
* **Behavior:** Validates allowlisted fields; inserts `Asset_Issue__c`; attaches files via `ContentVersion (FirstPublishLocationId = issue.Id)`; returns result DTO with record and file IDs.
* **Security:** `without sharing` to run in system context; strict field allowlisting; sanitized `AuraHandledException` messages.

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