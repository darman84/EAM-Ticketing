### PRD.md

# Product Requirements Document

## Goal

- **What:** A comprehensive Salesforce-to-EAM Infrastructure Ticketing System featuring a public Experience Cloud intake portal, an internal Service Cloud dispatch console, and asynchronous API integrations.
- **Why:** To modernize municipal public works requests by bridging citizen/field-reported infrastructure issues in Salesforce with backend Enterprise Asset Management (EAM) systems, reducing manual data entry, automating Omni-Channel routing for supervisors, and maintaining robust CI/CD deployment pipelines. **Note: This project is intended to be a replacement for Fix It Plano.**

## Requirements

### Must Have

**Public Intake & Tracking**

- Public Intake Portal via an Experience Cloud site for unauthenticated guest users.
- Mobile-Responsive UI with a custom Lightning Web Component (LWC) featuring client-side and server-side validation.
- Interactive Map Location using LWS-compliant Leaflet map integration with canvas-based `L.circleMarker` rendering and custom drag/pan handlers.
- Guest-Safe Submission Path using an Apex facade (`AssetIssueFacade`) running in system context, with a JSON-string overload to bypass Experience Cloud proxy serialization.
- File Attachment Support allowing up to 5 photos (JPEG/PNG, max 4 MB each), accessible by guest users via Base64 encoded delivery with `ContentDocumentLink.Visibility` set to `AllUsers`.
- Structured Issue Categorization across 4 categories (Storm Water/Drainage, Streets and Traffic, Trash & Recycling, Utilities) with 30 specific issue types driving queue-based routing.
- Automated Triage & Notifications via a record-triggered Salesforce Flow that routes records to departmental queues (`Signs_Maintenance_Queue`, `Utility_Operations_Queue`, `Pavement_Streets_Queue`) based on `Asset_Type__c`.
- EAM Tracking ID surfaced to citizen via a polling mechanism after form submission.
- Status Update Emails sent on `EAM_Status__c` change when a submitter email is present, plus a confirmation email on successful EAM sync.
- Public Ticket Status Page at `/s/ticket-status?id=<EAM_ID>` displaying full ticket details and Base64-encoded photo gallery.

**Service Cloud Triage & DevOps**

- **Omni-Channel Routing:** Implementation of Service Cloud Omni-Channel with 3 departmental queues, a `QueueRoutingConfig` (LEAST_ACTIVE model), a `ServiceChannel` (`Asset_Issue`), and a `ServicePresenceStatus` (`Available - Asset Issues`) to automatically push incoming `Asset_Issue__c` records to available supervisors.
- **Internal Triage Dashboard LWC:** A custom Lightning Web Component (`assetTriageDashboard`) deployed on the `Asset_Issue__c` Record Page in the Service Console. Displays the selected issue's spatial location on a `lightning-map` alongside nearby historical maintenance context (same asset type, within 2 miles) for accurate dispatching. Powered by `AssetTriageController.getNearbyHistoricalIssues` using GEOLOCATION SOQL queries.
- **Dispatch API Sync:** A Flow-triggered `InvocableMethod` (`EAMIntegrationRouter`) that enqueues an asynchronous `EAMCalloutService` Queueable job. The Queueable handles both initial creation syncs (POST) and dispatch update syncs (PATCH) against the mock EAM endpoint via Named Credential, with chunking/chaining for bulk operations (100 records per execution).
- **EAM Status Update REST API:** A `@RestResource` endpoint (`PATCH /EAM/StatusUpdate/*`) for the EAM system to push status updates and technician notes back into Salesforce.
- **CI/CD Pipeline:** A GitHub Actions workflow (`.github/workflows/deploy.yml`) configured to automatically lint, format, test, and deploy code to the Salesforce org on pushes and pull requests to the `main` branch.

### Nice to Have

- Bi-directional syncing (EAM to Salesforce updates) - _Currently handled via REST endpoint._
- Authenticated citizen portals (Citizen login/accounts) - _Out of scope._
- Integration with a live production EAM (currently utilizing a mock endpoint).

## User Flow

1. Citizen or field tech submits an infrastructure issue via the mobile-friendly public web form (LWC), selecting from 4 categories and 30 issue types, dropping a pin on a Leaflet map, and optionally attaching up to 5 photos.
2. The Apex facade (`AssetIssueFacade`) safely records the issue in system context with server-side validation. A record-triggered Flow routes the ticket to the correct maintenance queue (`Signs_Maintenance_Queue`, `Utility_Operations_Queue`, or `Pavement_Streets_Queue`) based on asset type matching.
3. The Flow triggers an asynchronous `EAMCalloutService` Queueable job via `EAMIntegrationRouter`. On successful EAM sync, the citizen receives their tracking ID and a confirmation email. The citizen can also poll for their tracking ID immediately after form submission.
4. A public works supervisor logs into the Service Console and goes active on Omni-Channel.
5. The new ticket is routed to the supervisor's workspace via Omni-Channel. They review the issue using the **Asset Triage Dashboard** to analyze spatial data and nearby historical context (same asset type within 2 miles).
6. The supervisor dispatches the ticket. A Queueable Apex job syncs the dispatch update (PATCH) to the external EAM system.
7. When field technicians update the ticket status via the EAM system, the EAM pushes the update back to Salesforce via the `PATCH /EAM/StatusUpdate/*` REST API, which triggers a status update email to the citizen (when a submitter email is present).
