# Technical Design Document

## Architecture Overview

- **Frontend:** Lightning Web Components (LWC), HTML, CSS, JavaScript, Leaflet.js
- **Backend:** Apex (Queueable, Invocable, HttpCalloutMock), Record-Triggered Flows
- **Database:** Salesforce Custom Objects (`Asset_Issue__c`)

## Data Model

- **Object/Table:** `Asset_Issue__c`
  - `Asset_Type__c` - `Picklist` - Categorizes the issue (Signage, Water/Sewer, Pavement) and drives routing.
  - `Severity__c` - `Picklist` - Indicates the urgency (Routine, Urgent, Emergency).
  - `Description__c` - `Long Text Area` - Stores the detailed description of the reported issue.
  - `Sync_Status__c` - `Picklist` - Tracks the integration status with the external EAM (Pending, Success, Failed).
  - `External_EAM_ID__c` - `Text` - Stores the unique identifier returned from the EAM system (Unique, External ID).
  - `Location__c` - `Geolocation` - Stores the exact latitude and longitude of the issue.

## Components & Logic

- **`assetIssueReporter` (LWC):** Provides the mobile-responsive form and interactive map for issue submission. Gathers inputs and submits a JSON payload to the Apex facade, bypassing standard Guest User CRUD constraints.
- **`Asset_Issue_Routing_and_Sync` (Flow):** An After-Save Record-Triggered Flow that evaluates the `Asset_Type__c` to route the record to the appropriate standard queue and invokes the `EAMIntegrationRouter` Apex class.
- **`AssetIssueFacade.cls`:** An Apex class running `without sharing` to safely insert records and attach files (`firstPublishLocationId`) for guest users without direct DML in the LWC. Methods: `createIssueWithFiles` and `createIssueWithFilesFromJson`.
- **`EAMIntegrationRouter.cls`:** Contains an `@InvocableMethod` to bridge the declarative Flow automation with the programmatic Queueable Apex. Enqueues the `EAMCalloutService`.
- **`EAMCalloutService.cls`:** A Queueable Apex job that serializes the record data into a JSON payload and performs a POST callout to the external EAM endpoint, subsequently updating the `Sync_Status__c` and `External_EAM_ID__c` based on the HTTP response.
- **`EAM_Mock_Endpoint`:** A Named Credential that securely authenticates and points to the external EAM API (currently `https://postman-echo.com/post`).

## Deployment

- Clone the repository and authorize the Salesforce Developer Org (`sf org login web --set-default`).
- Deploy the source code (`sf project deploy start`).
- Create three standard queues (`Signs Maintenance Queue`, `Utility Operations Queue`, `Pavement & Streets Queue`) for `Asset_Issue__c`.
- Update Assignment nodes in the `Asset_Issue_Routing_and_Sync` Flow to reference the created Queue IDs, and activate the Flow.
- Create a "Build Your Own (Aura)" Experience Cloud site and place the `assetIssueReporter` LWC. Provide the Site Guest User Apex Class Access for `AssetIssueFacade` and set the appropriate time zone.
