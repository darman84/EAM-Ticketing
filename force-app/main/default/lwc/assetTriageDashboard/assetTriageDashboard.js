import { LightningElement, api, wire } from "lwc";
import { getRecord } from "lightning/uiRecordApi";
import getNearbyHistoricalIssues from "@salesforce/apex/AssetTriageController.getNearbyHistoricalIssues";

const FIELDS = [
  "Asset_Issue__c.Name",
  "Asset_Issue__c.Location__Latitude__s",
  "Asset_Issue__c.Location__Longitude__s",
  "Asset_Issue__c.Description__c"
];

export default class AssetTriageDashboard extends LightningElement {
  @api recordId;
  mapMarkers = [];
  currentIssue;
  historicalIssues;

  @wire(getRecord, { recordId: "$recordId", fields: FIELDS })
  wiredRecord({ error, data }) {
    if (data) {
      this.currentIssue = data;
      this.updateMap();
    } else if (error) {
      console.error("Error loading record", error);
    }
  }

  @wire(getNearbyHistoricalIssues, { recordId: "$recordId" })
  wiredNearbyIssues({ error, data }) {
    if (data) {
      this.historicalIssues = data;
      this.updateMap();
    } else if (error) {
      console.error("Error loading historical issues", error);
    }
  }

  updateMap() {
    let markers = [];
    if (
      this.currentIssue &&
      this.currentIssue.fields.Location__Latitude__s.value
    ) {
      markers.push({
        location: {
          Latitude: this.currentIssue.fields.Location__Latitude__s.value,
          Longitude: this.currentIssue.fields.Location__Longitude__s.value
        },
        title:
          "Current Issue: " +
          (this.currentIssue.fields.Name.value || "New Issue"),
        description: this.currentIssue.fields.Description__c.value || "",
        icon: "custom:custom26" // Red pin for current
      });
    }

    if (this.historicalIssues && this.historicalIssues.length > 0) {
      this.historicalIssues.forEach((issue) => {
        markers.push({
          location: {
            Latitude: issue.Location__Latitude__s,
            Longitude: issue.Location__Longitude__s
          },
          title: "Historical: " + (issue.Name || "Unknown"),
          description: `Severity: ${issue.Severity__c} | Status: ${issue.EAM_Status__c}`,
          icon: "standard:location" // Standard pin for historical
        });
      });
    }

    this.mapMarkers = markers;
  }
}
