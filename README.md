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
- Create a "Build Your Own (Aura)" Experience Cloud site, place the `assetIssueReporter` component, grant the Site Guest User Apex Class Access to `AssetIssueFacade`, and set the appropriate time zone.

## Usage

The application features a public-facing portal for citizens to intake infrastructure issues:

1. Navigate to the Experience Cloud site.
2. Fill out the mobile-responsive LWC form, which includes providing the asset type, severity, description, and an interactive Leaflet.js-powered map for geolocation selection.
3. Submit the form. A background automated triage process evaluates the issue and routes it internally.
4. Internally, a Queueable Apex job processes the submission and integrates it with the external EAM system endpoint asynchronously.

Run the test suite to verify behavior:

```bash
sf apex run test --class-names EAMIntegration_Test --result-format human --code-coverage
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
