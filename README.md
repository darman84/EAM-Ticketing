# Salesforce-to-EAM Infrastructure Ticketing System

The Salesforce-to-EAM Infrastructure Ticketing System is an end-to-end municipal service
request platform built on the Salesforce platform. It provides a public-facing intake portal
where citizens submit infrastructure issues (potholes, water leaks, signage, etc.), routes
those requests to the appropriate departmental queues via Omni-Channel, and synchronizes
dispatch and status updates with a backend Enterprise Asset Management (EAM) system through
asynchronous Apex integrations. The platform supports photo attachments, interactive
map-based location selection, automated email notifications, and a CI/CD pipeline for
streamlined deployment. **This project is a prototype replacement for the City of Plano's
Fix It Plano system.**

**Live Demo:** [https://orgfarm-1d35f15b8b-dev-ed.develop.my.site.com/s](https://orgfarm-1d35f15b8b-dev-ed.develop.my.site.com/s)

## Documentation

For project scope, requirements, and architecture details, please refer to the internal documentation:

- [Product Requirements Document (PRD)](PRD.md)
- [Technical Design Document](TDD.md)

## Installation & CI/CD Pipeline

You will need a Salesforce Developer Edition Org, Salesforce CLI (SFDX) installed, and Visual Studio Code with the Salesforce Extension Pack.

```bash
git clone [https://github.com/darman84/eam-ticketing.git](https://github.com/darman84/eam-ticketing.git)
cd eam-ticketing
sf org login web --set-default
sf project deploy start
```

### Automated Deployment (GitHub Actions)

This repository is configured with a GitHub Actions CI/CD pipeline. Pushes and pull requests to the `main` branch automatically trigger code formatting (Prettier), linting (ESLint), and deployment with local Apex test execution to the target Salesforce org.

- Ensure you have configured the `SFDX_AUTH_URL` repository secret in GitHub to enable automated deployments.

### Manual Configuration (Post-Deployment):

- **Omni-Channel User Assignment:** Create Permission Sets granting access to the `Available - Asset Issues` Presence Status and assign them to your internal Service Console users. (Note: Core metadata including Queues, Queue Routing Configs, Service Channels, and Presence Statuses are automatically deployed via the CI/CD pipeline).
- **Service Console:** Add the custom `Asset Triage Dashboard` LWC to your `Asset_Issue__c` Record Page layout in the Service Console.
- **Experience Cloud:** Create a "Build Your Own (Aura)" Experience Cloud site. Place the `assetIssueReporter` component on the home page.
- Create a new Standard Page named `Ticket Status` (URL slug: `ticket-status`) and place the `assetIssueTracker` component on it.
- Grant the Site Guest User Apex Class Access to both `AssetIssueFacade` and `AssetIssueTrackerController`.
- Enable "Track Activities" on the `Asset_Issue__c` object in Object Manager.
- Set the appropriate time zone on the Experience Cloud site.
- Once activated, your public portal will be available at `https://<your-experience-site-domain>/s/` and the tracker at `https://<your-experience-site-domain>/s/ticket-status?id=<EAM-ID>`.

## Developer Workflow

This project includes pre-configured VS Code tasks (`.vscode/tasks.json`) to streamline development operations. You can run these directly from the Command Palette (`Tasks: Run Task`):

- **Retrieve / Deploy:** Standard commands to pull/push metadata.
- **Code Quality:** Format with Prettier and lint with ESLint.
- **Testing:** Run Apex unit tests or LWC unit tests.
- **Compound Workflows:** "Full Pre-Deploy Check" runs formatting, linting, tests, and deployment sequentially.

## Usage

1. Navigate to the Experience Cloud site and fill out the mobile-responsive form (category, asset type, severity, description, email, Leaflet.js map location, and optional photo uploads).
2. The UI polls for the generated EAM Tracking ID and displays it.
3. The submitter receives an automated email containing a deep-link to track the ticket at `/s/ticket-status?id=<EAM-ID>`.

**Internal Service Cloud Triage**

1. Internal supervisors log into the Salesforce Service Console and set their Omni-Channel presence status to "Available - Asset Issues".
2. Incoming `Asset_Issue__c` records are automatically routed to the correct departmental queues and pushed to available agents via Omni-Channel.
3. Supervisors utilize the **Asset Triage Dashboard** (LWC) on the `Asset_Issue__c` Record Page to view the issue's spatial location on a `lightning-map` alongside nearby historical maintenance data (same asset type, within 2 miles).
4. Supervisors dispatch the ticket, triggering a Queueable Apex job that syncs the dispatch status (PATCH) to the external EAM system.
5. External EAM updates are received via REST API (`PATCH /EAM/StatusUpdate/*`), triggering status update emails back to the citizen.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
