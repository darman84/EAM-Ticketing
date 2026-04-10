# Salesforce-to-EAM Infrastructure Ticketing System
## Overview
This repository contains a proof-of-concept Salesforce application designed to modernize municipal public works requests. It provides a seamless bridge between citizen-reported infrastructure anomalies (via a public Salesforce Experience Cloud site) and a backend Enterprise Asset Management (EAM) system.

The application utilizes a custom Lightning Web Component (LWC) for rapid data entry, declarative Flow automation for departmental routing, and asynchronous Apex for robust external REST API integration.

## Key Features
  * **Public Intake Portal:** A mobile-responsive LWC form featuring a premium light theme with glass-morphism, accessible to unauthenticated guest users. The LWC sends a JSON payload to an Apex facade (system context) for record creation and file attachment; it does not use lightning-record-edit-form or lightning-file-upload.
  * **Interactive Map Location:** Integrates Leaflet.js for graphical location selection. Built to bypass Lightning Web Security (LWS) restrictions via manual DOM container rendering, container-scoped native JavaScript event listeners (for drag and click events), and a lightweight canvas-based marker layer, avoiding synthetic event proxy issues.
  * **Automated Triage:** Record-Triggered Flows automatically route new issues to the correct maintenance queue (Signage, Water/Sewer, Pavement) based on the asset type.
  * **Asynchronous Integration:** A Queueable Apex process constructs a JSON payload and performs an HTTP POST callout to an external EAM endpoint without impacting the user's UI transaction.
  * **Bulkified Architecture:** The Apex integration is designed to handle up to 100 simultaneous record insertions without violating Salesforce callout governor limits.

## Architecture & Technologies
  * **Platform:** Salesforce Service Cloud / Experience Cloud
  * **Frontend:** Lightning Web Components (LWC), HTML, CSS, JavaScript, Leaflet.js
  * **Backend:** Apex (Queueable, Invocable, HttpCalloutMock)
  * **Automation:** Record-Triggered Flows (After-Save)
  * **Security:** Named Credentials, Guest User Profile FLS

## Repository Structure

```text
force-app/main/default/
├── classes/
│   ├── EAMCalloutService.cls       # Queueable callout logic
│   ├── EAMIntegrationRouter.cls    # Invocable bridge for Flow
│   ├── EAMIntegration_Test.cls     # Test coverage suite
│   └── MockHttpResponseGenerator.cls # Callout mock for testing
├── flows/
│   └── Asset_Issue_Routing_and_Sync.flow-meta.xml
├── lwc/
│   └── assetIssueReporter/         # Public intake form component (JSON -> Apex facade; no record-edit-form/file-upload)
├── objects/
│   └── Asset_Issue__c/             # Custom data model
└── namedCredentials/
    └── EAM_Mock_Endpoint.namedCredential-meta.xml
```

## Installation & Deployment
### Prerequisites
  * A Salesforce Developer Edition Org
  * Salesforce CLI (SFDX) installed
  * Visual Studio Code with the Salesforce Extension Pack

### Deployment Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/darman84/salesforce-eam-ticketing.git
    cd salesforce-eam-ticketing
    ```

2.  **Authorize your Developer Org:**

    ```bash
    sf org login web --set-default
    ```

3.  **Deploy the source code:**

    ```bash
    sf project deploy start
    ```

4.  **Manual Configuration (Post-Deployment):**

      * **Queues:** Create three standard queues (`Signs Maintenance Queue`, `Utility Operations Queue`, `Pavement & Streets Queue`) and assign `Asset_Issue__c` as a supported object.
      * **Flow:** Open the `Asset_Issue_Routing_and_Sync` Flow, update the Assignment nodes with your specific Queue IDs, and Activate the Flow.
      * **Experience Cloud:** 
        - Create a "Build Your Own (Aura)" public site, place the `assetIssueReporter` component on the page. 
        - In the Site Guest User profile, grant Apex Class Access to `AssetIssueFacade` (covers both methods).
        - Time zone: set the Guest User time zone to your target locale (e.g., America/Chicago) to ensure expected date rendering.
        - Note: The LWC uses a JSON-to-Apex facade; Guest object Edit/file permissions are not required for submission.

## Testing

This project includes a comprehensive Apex test suite ensuring bulkification and handling of HTTP responses.

To run the tests via the Salesforce CLI:

```bash
sf apex run test --class-names EAMIntegration_Test --result-format human --code-coverage
```

*Note: The test suite utilizes `HttpCalloutMock` to simulate 200 OK and 500 Error server responses. No actual external HTTP requests are made during test execution.*

## License

This project is open-source and available under the [MIT License](https://www.google.com/search?q=LICENSE).