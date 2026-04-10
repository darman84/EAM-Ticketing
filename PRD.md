# Product Requirements Document (PRD)
## Salesforce-to-EAM Infrastructure Ticketing System

### 1. Executive Summary
**Objective:** Modernize municipal public works requests by bridging citizen/field-reported infrastructure issues in Salesforce Service Cloud with backend Enterprise Asset Management (EAM) systems.
**Value Proposition:** Reduces manual data entry, automates departmental routing, and provides real-time API integration with EAM endpoints.

### 2. Target Audience
* **Citizens & Field Techs:** Submit infrastructure issues via a mobile-responsive interface.
* **Call Center Agents:** Log issues internally on behalf of callers.
* **Public Works Staff (OpenGov Cartegraph):** Receive routed, formatted tickets seamlessly in their native system.

### 3. Key Features & Requirements
* **Public Intake Portal:** An Experience Cloud site allowing unauthenticated guest users to submit issues.
* **Mobile-Responsive UI:** A custom Lightning Web Component (LWC) for data entry with client-side validation and extensive custom styling for a premium user experience.
* **Interactive Map Location:** An intuitive, LWS-compliant Leaflet map integration allowing citizens to accurately pinpoint infrastructure issues without manual coordinate entry.
* **Guest-Safe Submission Path (System Context):** Record creation and file attachment are performed by an Apex facade running in system context. The LWC submits a JSON payload to Apex to avoid Guest CRUD/file permission constraints; lightning-record-edit-form and lightning-file-upload are not used.
* **Automated Triage:** Declarative routing (Salesforce Flow) assigning records to specific departmental queues (Signage, Water/Sewer, Pavement) based on asset type.
* **Asynchronous EAM Integration:** Apex-driven REST callouts pushing JSON payloads to the external EAM system without disrupting the user experience.
* **Bulk Data Resilience:** Architecture must support bulk data operations (up to 100 records per transaction) without exceeding Salesforce governor limits.

### 4. User Stories
* **US01:** As a citizen, I need a public, mobile-friendly web form to report an issue so that the city is notified immediately.
* **US02:** As a dispatcher, I need issues automatically routed to the correct maintenance queue (e.g., Pavement & Streets) so that I do not have to manually triage incoming tickets.
* **US03:** As an IT administrator, I need the Salesforce system to automatically sync new tickets to our external EAM system and log the success/failure status.

### 5. Out of Scope
* Bi-directional syncing (EAM to Salesforce updates).
* Authenticated citizen portals (Citizen login/accounts).
* Integration with a live production EAM (utilizing a mock endpoint for Proof-of-Concept).

### 6. Metrics for Success
* **System Performance:** 100% of LWC submissions process without UI latency.
* **Integration Reliability:** Automated integration handles 100-record bulk inserts without limit exceptions.
* **Code Quality:** Apex test classes maintain >75% coverage (targeting 100%).
