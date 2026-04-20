import { LightningElement } from "lwc";
import getIssueStatus from "@salesforce/apex/AssetIssueTrackerController.getIssueStatus";

export default class AssetIssueTracker extends LightningElement {
  trackingId = "";
  statusResult = "";

  handleInputChange(event) {
    this.trackingId = event.target.value;
  }

  checkStatus() {
    if (this.trackingId) {
      getIssueStatus({ trackingId: this.trackingId })
        .then((result) => {
          this.statusResult = result;
        })
        .catch(() => {
          this.statusResult = "Error fetching status";
        });
    }
  }
}
