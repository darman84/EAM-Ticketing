# Technical Design Document

## Architecture Overview

- **Frontend:** Lightning Web Components (LWC), HTML, CSS, JavaScript, Leaflet.js
- **Backend:** Apex (Queueable, Invocable, REST API, HttpCalloutMock), Record-Triggered Flows, Omni-Channel, Named Credentials
- **Database:** Salesforce Custom Objects (`Asset_Issue__c`), Salesforce Files (`ContentVersion`, `ContentDocumentLink`)
- **DevOps:** GitHub Actions, Salesforce CLI (SFDX), ESLint, Prettier

## Data Model

- **Object/Table:** `Asset_Issue__c`
  - `Asset_Type__c` - `Picklist` - Categorizes the issue across 4 categories (Storm Water/Drainage, Streets and Traffic, Trash & Recycling, Utilities (Water and Sewer)) with 30 specific issue types, and drives routing by matching against the 3 departmental queues (Signage, Water/Sewer, Pavement).
  - `Severity__c` - `Picklist` - Indicates the urgency (Routine, Urgent, Emergency).
  - `Description__c` - `Long Text Area` - Stores the detailed description.
  - `Submitter_Email__c` - `Email` - Captures the submitter's email address.
  - `Submitter_Phone__c` - `Phone` - Captures the submitter's phone number (optional).
  - `EAM_Status__c` - `Text(255)` - Tracks the operational status returned from the external EAM system.
  - `EAM_Tech_Notes__c` - `Long Text Area` - Stores notes from the internal technicians.
  - `Sync_Status__c` - `Picklist` - Tracks the integration status (Pending, Success, Failed).
  - `External_EAM_ID__c` - `Text` - Stores the unique identifier returned from the EAM system.
  - `Location__c` - `Geolocation` - Stores the exact latitude and longitude of the issue.

## Components & Logic

- **`assetIssueReporter` (LWC):** Mobile-responsive public form with Leaflet map. Uses `preferCanvas: true` and canvas-based circle markers to bypass LWS restrictions. Organizes issue types by category for user-friendly selection. Polls for tracking ID post-submission via `AssetIssueTrackerController.pollForTrackingId`.
- **`assetIssueTracker` (LWC):** Public-facing ticket status page rendering details and Base64-encoded images. Reads the `id` URL parameter via `CurrentPageReference` to load issue details.
- **`assetTriageDashboard` (LWC):** Internal Service Console component deployed on the `Asset_Issue__c` Record Page. Uses the `lightning-map` base component to display the `Location__c` of the active `Asset_Issue__c` record. Fetches record fields via `getRecord` wire adapter and queries nearby historical issues (same asset type, within 2 miles) via `AssetTriageController.getNearbyHistoricalIssues` to assist supervisors with dispatch decisions.
- **Omni-Channel Routing:** Service Cloud configuration including 3 Queues (`Signs_Maintenance_Queue`, `Utility_Operations_Queue`, `Pavement_Streets_Queue`), a `QueueRoutingConfig` (`Asset_Issue_Routing`, LEAST_ACTIVE model), a `ServiceChannel` (`Asset_Issue`), and a `ServicePresenceStatus` (`Available - Asset Issues`) for automatic push of records to available console users.
- **`Asset_Issue_Routing_and_Sync` (Flow):** Record-triggered after-save flow on `Asset_Issue__c` (CreateAndUpdate). On create, routes to departmental queues based on `Asset_Type__c`. On EAM status change (with submitter email present), sends status update email. On sync success, sends new submission confirmation email. Invokes `EAMIntegrationRouter` to trigger outbound EAM sync.
- **`AssetIssueFacade.cls`:** Apex class running `without sharing` to safely insert records/files for guest users. Provides `createIssueWithFiles` (typed DTO) and `createIssueWithFilesFromJson` (JSON string overload to bypass Experience Cloud proxy serialization). Validates asset types, severities, file types/sizes, and email format.
- **`AssetIssueTrackerController.cls`:** Serves the public tracker LWC via `getIssueDetails` (returns full issue details with Base64-encoded image data URIs) and provides `pollForTrackingId` used by the reporter component post-submission.
- **`AssetTriageController.cls`:** `with sharing` Apex controller for the triage dashboard. Provides `getNearbyHistoricalIssues` which uses a GEOLOCATION SOQL query with DISTANCE to find historical issues of the same asset type within 2 miles, ordered by recency (limit 10).
- **`EAMIntegrationRouter.cls`:** Lightweight `InvocableMethod` bridge (`routeToEAM`) that accepts a list of `Asset_Issue__c` IDs from the Flow and enqueues an `EAMCalloutService` Queueable job.
- **`EAMCalloutService.cls`:** Queueable Apex job for outbound JSON POST/PATCH callouts to the EAM endpoint via Named Credential (`callout:EAM_Mock_Endpoint`). Processes up to 100 records per execution, chaining additional Queueable jobs for overflow. Handles both initial creation syncs (POST, generating a mock External EAM ID) and supervisor dispatch updates (PATCH, when `External_EAM_ID__c` already exists).
- **`MockHttpResponseGenerator.cls`:** `HttpCalloutMock` implementation used by `EAMIntegration_Test` to simulate EAM endpoint responses with configurable HTTP status codes.
- **`EAMStatusUpdateAPI.cls`:** `@RestResource` exposing a `PATCH /EAM/StatusUpdate/*` endpoint for the EAM system to push status updates and technician notes back into Salesforce.

## DevOps & CI/CD

- **GitHub Actions (`.github/workflows/deploy.yml`):** Automates the release cycle.
  - **Triggers:** On push to `main` and pull request to `main`.
  - **Jobs:** 1. Checkout and install Node.js 18. 2. Run `npm ci`. 3. Run `npm run lint` and `npm run prettier:verify`. 4. Install Salesforce CLI. 5. Authenticate to Salesforce using the `SFDX_AUTH_URL` repository secret. 6. Deploy metadata using `sf project deploy start --test-level RunLocalTests`.

## Email Templates

- **`New_Issue_Confirmation`:** Sent on successful sync. Includes tracker deep-link.
- **`Status_Update_Notification`:** Sent on `EAM_Status__c` change.

## Security Model

- Guest-accessible Apex runs `without sharing` with strict input allowlisting.
- `ContentDocumentLink.Visibility` set to `'AllUsers'`. Image data encoded as Base64.
- Service Cloud permissions heavily restricted via Permission Sets for internal supervisor access to the `assetTriageDashboard`.

## Test Coverage

| Class                              | Key Scenarios                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `AssetIssueFacade_Test`            | No-file submission, file attachment, validation errors, invalid picklists, oversize files, JSON string input, invalid JSON.               |
| `AssetIssueTrackerController_Test` | `getIssueDetails` (found, not found, blank ID, with images, status default), `pollForTrackingId` (found, not assigned, blank ID).         |
| `AssetTriageController_Test`       | Nearby historical issues (same type, within 2 mi), no location returns empty, invalid record ID returns empty.                            |
| `EAMIntegration_Test`              | Successful sync, failed sync, bulk insert (100 records), chained bulk insert (60 records with callout cap), dispatch update (PATCH) sync. |
| `EAMStatusUpdateAPI_Test`          | Success, empty body, missing external ID, record not found (404), invalid JSON (500).                                                     |
