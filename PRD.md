# Product Requirements Document

## Goal

- **What:** A Salesforce-to-EAM Infrastructure Ticketing System using Experience Cloud, Lightning Web Components, and asynchronous Apex integration.
- **Why:** To modernize municipal public works requests by bridging citizen/field-reported infrastructure issues in Salesforce with backend Enterprise Asset Management (EAM) systems, reducing manual data entry and automating routing.

## Requirements

### Must Have

- Public Intake Portal via an Experience Cloud site for unauthenticated guest users.
- Mobile-Responsive UI with a custom Lightning Web Component (LWC) featuring client-side validation and a premium light theme.
- Interactive Map Location using LWS-compliant Leaflet map integration with canvas-based markers.
- Guest-Safe Submission Path using an Apex facade running in system context to avoid CRUD/file permission constraints.
- Automated Triage via Salesforce Flow to route records to specific departmental queues (Signage, Water/Sewer, Pavement).
- Asynchronous EAM Integration via Apex REST callouts for pushing JSON payloads without disrupting user experience.
- Bulk Data Resilience to support operations of up to 100 records per transaction without exceeding governor limits.

### Nice to Have

- Bi-directional syncing (EAM to Salesforce updates) - Currently out of scope.
- Authenticated citizen portals (Citizen login/accounts) - Currently out of scope.
- Integration with a live production EAM (currently utilizing a mock endpoint).

## User Flow

1. Citizen or field tech submits an infrastructure issue via the mobile-friendly public web form (LWC), including dropping a pin on an interactive Leaflet map.
2. The system's Apex facade safely records the issue and any file attachments in system context.
3. Salesforce automatically routes the ticket to the correct maintenance queue based on asset type, while a background Queueable Apex job syncs the ticket to the external EAM system and updates the success/failure status.
