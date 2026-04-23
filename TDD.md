# Technical Design Document

## Architecture Overview

- **Frontend:** Lightning Web Components (LWC), HTML, CSS, JavaScript, Leaflet.js
- **Backend:** Apex (Queueable, Invocable, REST API, HttpCalloutMock), Record-Triggered Flows
- **Database:** Salesforce Custom Objects (`Asset_Issue__c`), Salesforce Files (`ContentVersion`, `ContentDocumentLink`)

## Data Model

- **Object/Table:** `Asset_Issue__c`
  - `Asset_Type__c` - `Picklist` - Categorizes the issue (Signage, Water/Sewer, Pavement) and drives routing.
  - `Severity__c` - `Picklist` - Indicates the urgency (Routine, Urgent, Emergency).
  - `Description__c` - `Long Text Area` - Stores the detailed description of the reported issue.
  - `Submitter_Email__c` - `Email` - Captures the submitter's email address for status update notifications.
  - `EAM_Status__c` - `Text(255)` - Tracks the operational status returned from the external EAM system. Defaults to **"New"** on record creation. Accepts any string value pushed by the EAM via `EAMStatusUpdateAPI`. _(Note: A conversion to a Picklist was attempted but reverted due to conflicts with existing data)._
  - `EAM_Tech_Notes__c` - `Long Text Area` - Stores notes from the internal technicians via EAM.
  - `Sync_Status__c` - `Picklist` - Tracks the integration status with the external EAM (Pending, Success, Failed).
  - `External_EAM_ID__c` - `Text` - Stores the unique identifier returned from the EAM system (Unique, External ID).
  - `Location__c` - `Geolocation` - Stores the exact latitude and longitude of the issue.

## Components & Logic

- **`assetIssueReporter` (LWC):** Provides the mobile-responsive form and interactive map for issue submission. Uses a `preferCanvas: true` Leaflet map with stacked `L.circleMarker` pins to bypass Lightning Web Security (LWS) DOM-injection restrictions. Client-side logic allows users to sequentially append and remove photo uploads, which are Base64 encoded before submission. Gathers inputs and submits a JSON payload to the Apex facade, bypassing standard Guest User CRUD constraints. After submission, polls `AssetIssueTrackerController.pollForTrackingId` up to 10 times (1-second intervals) with a visual spinner until the EAM Tracking ID is returned, then displays it on the confirmation screen alongside an open-source GitHub reference link.
- **`assetIssueTracker` (LWC):** A public-facing ticket status page placed at `/s/ticket-status` in Experience Cloud. Accepts an EAM Tracking ID via URL query parameter (`?id=`) using `CurrentPageReference` wire, calls `AssetIssueTrackerController.getIssueDetails`, and renders ticket status, asset type, severity, description, technician notes, and a photo gallery. Images are delivered as Base64 data URIs to bypass Experience Cloud guest file-access restrictions.
- **`Asset_Issue_Routing_and_Sync` (Flow):** An After-Save Record-Triggered Flow (`CreateAndUpdate`) with three branches: (1) **New Record** — routes to the correct departmental queue and calls the EAM integration; (2) **Sync Success** — sends the confirmation email when `Sync_Status__c` changes to `Success` and `Submitter_Email__c` is populated; (3) **Status Updated** — sends a status update email when `EAM_Status__c` changes and `Submitter_Email__c` is populated.
- **`AssetIssueFacade.cls`:** An Apex class running `without sharing` to safely insert `Asset_Issue__c` records and attach files (`ContentVersion` via `FirstPublishLocationId`) for guest users. Sets `ContentDocumentLink.Visibility = 'AllUsers'` post-insertion for community file access. Methods: `createIssueWithFiles` and `createIssueWithFilesFromJson`. Enforces allowlisted picklist values, max file count (5), max file size (4 MB), and permitted MIME types (JPEG, PNG).
- **`AssetIssueTrackerController.cls`:** An Apex class running `without sharing` to serve the public tracker LWC. `getIssueDetails` returns an `IssueDetailsWrapper` with full ticket fields and Base64-encoded image data URIs. `pollForTrackingId` returns the `External_EAM_ID__c` for a given record ID to support the submission polling loop.
- **`EAMIntegrationRouter.cls`:** Contains an `@InvocableMethod` to bridge the declarative Flow automation with the programmatic Queueable Apex. Enqueues the `EAMCalloutService`.
- **`EAMCalloutService.cls`:** A Queueable Apex job that serializes the record data into a JSON payload and performs a POST callout to the external EAM endpoint, subsequently updating the `Sync_Status__c` and `External_EAM_ID__c` based on the HTTP response. Supports chunked bulk processing up to `MAX_CALLOUTS` per execution to respect governor limits.
- **`EAMStatusUpdateAPI.cls`:** A `@RestResource` global Apex class exposing a `PATCH /EAM/StatusUpdate/` endpoint for the external EAM system to push status and technician note updates back into Salesforce.
- **`EAM_Mock_Endpoint`:** A Named Credential that securely authenticates and points to the external EAM API (currently `https://postman-echo.com/post`).

## Email Templates

Both templates are **Lightning Email Templates** (`uiType: SFX`) using Handlebars (`{{{...}}}`) merge syntax:

- **`New_Issue_Confirmation`:** Sent on `Sync_Status__c = Success`. Includes EAM Tracking ID, asset type, severity, description, and a deep-link to the tracker (`/s/ticket-status?id={{{Asset_Issue__c.External_EAM_ID__c}}}`).
- **`Status_Update_Notification`:** Sent on `EAM_Status__c` change. Includes EAM Tracking ID, new status, technician notes, and the same deep-link.

## Security Model

- All guest-accessible Apex runs `without sharing` with strict input allowlisting to prevent field injection.
- `ContentDocumentLink.Visibility` is explicitly set to `'AllUsers'` to enable community file access.
- Image data is encoded as Base64 data URIs server-side to prevent Experience Cloud file-sharing permission bypasses from breaking `<img>` tags for unauthenticated users.
- Email alerts are conditionally gated on `Submitter_Email__c` being non-null to prevent Flow failures during Apex test execution.

## Test Coverage

| Class                              | Key Scenarios                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AssetIssueFacade_Test`            | No-file submission, file attachment, validation errors, invalid picklists, oversize/wrong-type files, JSON overload |
| `AssetIssueTrackerController_Test` | `getIssueDetails` (found, not found, blank, image Base64 URI), `pollForTrackingId` (found, not yet assigned, blank) |
| `EAMIntegration_Test`              | Successful sync, failed sync, bulk insert (100 records), chained bulk insert                                        |
| `EAMStatusUpdateAPI_Test`          | Success, empty body, missing ID, record not found, invalid JSON                                                     |

## Deployment

- Clone the repository and authorize the Salesforce Developer Org (`sf org login web --set-default`).
- Deploy the source code (`sf project deploy start`).
- Create three standard queues (`Signs Maintenance Queue`, `Utility Operations Queue`, `Pavement & Streets Queue`) for `Asset_Issue__c`.
- Update Assignment nodes in the `Asset_Issue_Routing_and_Sync` Flow to reference the created Queue IDs, and activate the Flow.
- Create a "Build Your Own (Aura)" Experience Cloud site. Place the `assetIssueReporter` LWC on the home page. Create a new Standard Page named `Ticket Status` (URL slug: `ticket-status`) and place the `assetIssueTracker` LWC on it.
- Grant the Site Guest User Apex Class Access to both `AssetIssueFacade` and `AssetIssueTrackerController`.
- Enable "Track Activities" on the `Asset_Issue__c` object in Object Manager.
- After activation, the public portal is accessible at `https://<your-site-domain>/s/` and the tracker at `https://<your-site-domain>/s/ticket-status?id=<EAM-ID>`.

## Development Tools

The project contains a `.vscode/tasks.json` file for standardized developer workflows. This includes pre-configured tasks accessible via the VS Code Command Palette for pulling/deploying metadata, formatting with Prettier, linting with ESLint, and executing unit tests, all of which can be orchestrated sequentially using the "Full Pre-Deploy Check" compound workflow.
