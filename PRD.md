# Product Requirements Document

## Goal

- **What:** A Salesforce-to-EAM Infrastructure Ticketing System using Experience Cloud, Lightning Web Components, and asynchronous Apex integration.
- **Why:** To modernize municipal public works requests by bridging citizen/field-reported infrastructure issues in Salesforce with backend Enterprise Asset Management (EAM) systems, reducing manual data entry and automating routing. **Note: This project is intended to be a replacement for Fix It Plano.**

## Requirements

### Must Have

- Public Intake Portal via an Experience Cloud site for unauthenticated guest users.
- Mobile-Responsive UI with a custom Lightning Web Component (LWC) featuring client-side validation and a premium light theme.
- Interactive Map Location using LWS-compliant Leaflet map integration with a stacked `L.circleMarker` approach utilizing Leaflet's internal Canvas renderer.
- Guest-Safe Submission Path using an Apex facade running in system context to avoid CRUD/file permission constraints.
- File Attachment Support allowing citizens to sequentially append and individually remove up to 5 photos (JPEG/PNG, max 4 MB each) with submissions, stored as Salesforce Files and accessible by guest users via Base64 encoded delivery.
- Automated Triage & Notifications via Salesforce Flow to route records to specific departmental queues (Signage, Water/Sewer, Pavement) and send status update emails to submitters.
- EAM Tracking ID surfaced to citizen after submission via a polling mechanism (up to 10 seconds) on the confirmation screen.
- Open-Source Reference link to the GitHub repository is provided on the final confirmation screen.
- Confirmation Email sent only after successful EAM sync, containing the generated EAM Tracking ID and a deep-link URL to the public ticket status page.
- Status Update Email sent on every `EAM_Status__c` change, including the EAM Tracking ID and a deep-link to the tracker.
- Public Ticket Status Page at `/s/ticket-status?id=<EAM_ID>` displaying full ticket details (status, asset type, severity, description, tech notes, and photo gallery) via the `assetIssueTracker` LWC.
- Asynchronous EAM Integration via Apex REST callouts for pushing JSON payloads without disrupting user experience.
- Bulk Data Resilience to support operations of up to 100 records per transaction without exceeding governor limits.

### Nice to Have

- Bi-directional syncing (EAM to Salesforce updates) - Currently out of scope.
- Authenticated citizen portals (Citizen login/accounts) - Currently out of scope.
- Integration with a live production EAM (currently utilizing a mock endpoint).

## User Flow

1. Citizen or field tech submits an infrastructure issue via the mobile-friendly public web form (LWC), including dropping a pin on an interactive Leaflet map and optionally attaching photos.
2. The system's Apex facade safely records the issue and any file attachments in system context, configuring file visibility for guest access.
3. Salesforce automatically routes the ticket to the correct maintenance queue based on asset type, while a background Queueable Apex job syncs the ticket to the external EAM system and updates the `Sync_Status__c` and `External_EAM_ID__c`.
4. The submission UI polls for the EAM Tracking ID (up to 10 seconds) and displays it on the confirmation screen.
5. Once the EAM sync succeeds, the citizen receives a confirmation email with their EAM Tracking ID and a link to view their ticket online.
6. The citizen can visit the public `/s/ticket-status` page at any time to view their ticket status, technician notes, and attached photos.
7. When technicians update the ticket status via the EAM system, the citizen receives an automated status update notification email.
