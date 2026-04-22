import { LightningElement, wire, track } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import getIssueDetails from "@salesforce/apex/AssetIssueTrackerController.getIssueDetails";

export default class AssetIssueTracker extends LightningElement {
  @track trackingId = "";
  @track issueDetails = null;
  @track error = "";

  @wire(CurrentPageReference)
  getStateParameters(currentPageReference) {
    if (
      currentPageReference &&
      currentPageReference.state &&
      currentPageReference.state.id
    ) {
      this.trackingId = currentPageReference.state.id;
      this.checkStatus();
    }
  }

  handleInputChange(event) {
    this.trackingId = event.target.value;
  }

  checkStatus() {
    this.issueDetails = null;
    this.error = "";
    if (this.trackingId) {
      getIssueDetails({ trackingId: this.trackingId })
        .then((result) => {
          if (result) {
            this.issueDetails = { ...result };
          } else {
            this.error = "No ticket found for this ID.";
          }
        })
        .catch((e) => {
          this.error = "Error fetching details.";
          console.error(e);
        });
    }
  }
}
