# Salesforce-to-EAM Infrastructure Ticketing System

Salesforce-to-EAM Infrastructure Ticketing System is a proof-of-concept Salesforce application designed to modernize municipal public works requests by bridging citizen-reported infrastructure anomalies with a backend Enterprise Asset Management (EAM) system.

## Documentation

For project scope, requirements, and architecture details, please refer to the internal documentation:

- [Product Requirements Document (PRD)](PRD.md)
- [Technical Design Document](TDD.md)

## Installation

You will need a Salesforce Developer Edition Org, Salesforce CLI (SFDX) installed, and Visual Studio Code with the Salesforce Extension Pack.

```bash
git clone https://github.com/darman84/salesforce-eam-ticketing.git
cd salesforce-eam-ticketing
sf org login web --set-default
sf project deploy start
```

Manual Configuration (Post-Deployment):

- Create standard queues: `Signs Maintenance Queue`, `Utility Operations Queue`, `Pavement & Streets Queue` and assign `Asset_Issue__c` as a supported object.
- Update Assignment nodes in the `Asset_Issue_Routing_and_Sync` Flow with your Queue IDs and activate the Flow.
- Create a "Build Your Own (Aura)" Experience Cloud site. Place the `assetIssueReporter` component on the home page.
- Create a new Standard Page named `Ticket Status` (URL slug: `ticket-status`) and place the `assetIssueTracker` component on it.
- Grant the Site Guest User Apex Class Access to both `AssetIssueFacade` and `AssetIssueTrackerController`.
- Enable "Track Activities" on the `Asset_Issue__c` object in Object Manager.
- Set the appropriate time zone on the Experience Cloud site.

## Usage

The application features a public-facing portal for citizens to intake and track infrastructure issues:

1. Navigate to the Experience Cloud site and fill out the mobile-responsive form — including asset type, severity, description, optional contact email, optional photo uploads, and an interactive Leaflet.js-powered map for geolocation.
2. Submit the form. A spinner appears while the system polls for the generated EAM Tracking ID (up to 10 seconds). The ID is displayed on the confirmation screen once available.
3. A background Queueable Apex job integrates the submission with the external EAM system asynchronously. Upon success, a confirmation email is sent to the submitter (if provided) containing the EAM Tracking ID and a link to the public tracker.
4. The submitter can visit `<site-url>/s/ticket-status?id=<EAM-ID>` at any time to view full ticket details, including status, technician notes, and attached photos.
5. When the ticket status is updated by the EAM system (via the REST API), an automated status notification email is sent to the submitter.

Run the test suite to verify behavior:

```bash
sf apex run test --class-names AssetIssueFacade_Test AssetIssueTrackerController_Test EAMIntegration_Test EAMStatusUpdateAPI_Test --result-format human --code-coverage
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
