### PRD.md

# Product Requirements Document

## Goal

- **What:** A comprehensive Salesforce-to-EAM Infrastructure Ticketing System featuring a public Experience Cloud intake portal, an internal Service Cloud dispatch console, and asynchronous API integrations.
- **Why:** To modernize municipal public works requests by bridging citizen/field-reported infrastructure issues in Salesforce with backend Enterprise Asset Management (EAM) systems, reducing manual data entry, automating Omni-Channel routing for supervisors, and maintaining robust CI/CD deployment pipelines. **Note: This project is intended to be a replacement for Fix It Plano.**

## Requirements

### Must Have

**Phase 1: Public Intake & Tracking**

- Public Intake Portal via an Experience Cloud site for unauthenticated guest users.
- Mobile-Responsive UI with a custom Lightning Web Component (LWC) featuring client-side validation.
- Interactive Map Location using LWS-compliant Leaflet map integration (`L.circleMarker`).
- Guest-Safe Submission Path using an Apex facade running in system context.
- File Attachment Support allowing up to 5 photos (JPEG/PNG, max 4 MB each), accessible by guest users via Base64 encoded delivery.
- Automated Triage & Notifications via Salesforce Flow to route records to departmental queues.
- EAM Tracking ID surfaced to citizen via a polling mechanism.
- Status Update Emails sent on every `EAM_Status__c` change.
- Public Ticket Status Page at `/s/ticket-status?id=<EAM_ID>` displaying full ticket details and photo gallery.

**Phase 2: Service Cloud Triage & DevOps**

- **Omni-Channel Routing:** Implementation of Service Cloud Omni-Channel to automatically push incoming `Asset_Issue__c` records to available supervisors based on queue assignment (Signage, Water/Sewer, Pavement).
- **Internal Triage Dashboard LWC:** A custom Lightning Web Component deployed in the Service Console that displays the selected issue's spatial location on a map alongside historical maintenance context for accurate dispatching.
- **Dispatch API Sync:** Asynchronous Apex integration (Queueable) that pushes the finalized dispatch details to the mock EAM system.
- **CI/CD Pipeline:** A GitHub Actions workflow configured to automatically format, lint, test, and deploy code to the Salesforce org upon merges to the main branch.

### Nice to Have

- Bi-directional syncing (EAM to Salesforce updates) - _Currently handled via REST endpoint._
- Authenticated citizen portals (Citizen login/accounts) - _Out of scope._
- Integration with a live production EAM (currently utilizing a mock endpoint).

## User Flow

1. Citizen or field tech submits an infrastructure issue via the mobile-friendly public web form (LWC), dropping a pin on a Leaflet map and attaching photos.
2. The Apex facade safely records the issue in system context. Salesforce routes the ticket to the correct maintenance queue based on asset type.
3. The citizen receives their tracking ID and a confirmation email to view their ticket status online.
4. **[Internal]** A public works supervisor logs into the Service Console and goes active on Omni-Channel.
5. **[Internal]** The new ticket is routed to the supervisor's workspace. They review the issue using the **Asset Triage Dashboard** to analyze spatial data and historical context.
6. **[Internal]** The supervisor approves and dispatches the ticket. A background Queueable Apex job syncs this dispatch event to the external EAM system.
7. When field technicians update the ticket status via the EAM system, the EAM pushes the update back to Salesforce via a REST API, which emails the citizen.
