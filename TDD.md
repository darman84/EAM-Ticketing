# Technical Design Document

## Architecture Overview

- **Frontend:** Lightning Web Components (LWC), HTML, CSS, JavaScript, Leaflet.js
- **Backend:** Apex (Queueable, Invocable, REST API, HttpCalloutMock), Record-Triggered Flows, Omni-Channel
- **Database:** Salesforce Custom Objects (`Asset_Issue__c`), Salesforce Files (`ContentVersion`, `ContentDocumentLink`)
- **DevOps:** GitHub Actions, Salesforce CLI (SFDX), ESLint, Prettier

## Data Model

- **Object/Table:** `Asset_Issue__c`
  - `Asset_Type__c` - `Picklist` - Categorizes the issue (Signage, Water/Sewer, Pavement) and drives routing.
  - `Severity__c` - `Picklist` - Indicates the urgency.
  - `Description__c` - `Long Text Area` - Stores the detailed description.
  - `Submitter_Email__c` - `Email` - Captures the submitter's email address.
  - `EAM_Status__c` - `Text(255)` - Tracks the operational status returned from the external EAM system.
  - `EAM_Tech_Notes__c` - `Long Text Area` - Stores notes from the internal technicians.
  - `Sync_Status__c` - `Picklist` - Tracks the integration status (Pending, Success, Failed).
  - `External_EAM_ID__c` - `Text` - Stores the unique identifier returned from the EAM system.
  - `Location__c` - `Geolocation` - Stores the exact latitude and longitude of the issue.

## Components & Logic

- **`assetIssueReporter` (LWC):** Mobile-responsive public form with Leaflet map. Uses `preferCanvas: true` to bypass LWS restrictions. Polls for tracking ID post-submission.
- **`assetIssueTracker` (LWC):** Public-facing ticket status page rendering details and Base64-encoded images.
- **`assetTriageDashboard` (LWC) [Phase 2]:** Internal Service Console component. Uses `lightning-map` or standard Leaflet to display the `Location__c` of the active `Asset_Issue__c` record, alongside wire adapters fetching historical data for the same `Asset_Type__c` in that geographical area to assist supervisors with dispatch decisions.
- **Omni-Channel Routing [Phase 2]:** Service Cloud configuration mapping the three primary queues (Signs, Utility, Pavement) to routing configurations, enabling automatic pushing of records to available console users.
- **`Asset_Issue_Routing_and_Sync` (Flow):** Routes to departmental queues. Triggers email alerts on status changes.
- **`AssetIssueFacade.cls`:** Apex class running `without sharing` to safely insert records/files for guest users.
- **`AssetIssueTrackerController.cls`:** Serves the public tracker LWC.
- **`EAMCalloutService.cls`:** Queueable Apex job for outbound JSON POST/PATCH callouts to the EAM endpoint. Updated to handle both initial creation syncs and supervisor "Dispatch" sync events.
- **`EAMStatusUpdateAPI.cls`:** `@RestResource` exposing a `PATCH /EAM/StatusUpdate/` endpoint for the EAM system to push updates back into Salesforce.

## DevOps & CI/CD [Phase 2]

- **GitHub Actions (`.github/workflows/deploy.yml`):** Automates the release cycle.
  - **Triggers:** On pull request to `main` and push to `main`.
  - **Jobs:** 1. Installs SFDX CLI. 2. Runs `npm run lint` and Prettier checks. 3. Authenticates to Salesforce using the `SFDX_AUTH_URL` repository secret. 4. Executes all local Apex tests. 5. Deploys metadata using `sf project deploy start`.

## Email Templates

- **`New_Issue_Confirmation`:** Sent on successful sync. Includes tracker deep-link.
- **`Status_Update_Notification`:** Sent on `EAM_Status__c` change.

## Security Model

- Guest-accessible Apex runs `without sharing` with strict input allowlisting.
- `ContentDocumentLink.Visibility` set to `'AllUsers'`. Image data encoded as Base64.
- Service Cloud permissions heavily restricted via Permission Sets for internal supervisor access to the `assetTriageDashboard`.

## Test Coverage

| Class                              | Key Scenarios                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `AssetIssueFacade_Test`            | No-file submission, file attachment, validation errors, invalid picklists, oversize files. |
| `AssetIssueTrackerController_Test` | `getIssueDetails`, `pollForTrackingId` logic.                                              |
| `EAMIntegration_Test`              | Successful sync, failed sync, bulk insert, dispatch update syncs.                          |
| `EAMStatusUpdateAPI_Test`          | Success, empty body, missing ID, invalid JSON.                                             |
