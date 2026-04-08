import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AssetIssueReporter extends LightningElement {
    @track showForm = true;
    @track showUpload = false;
    @track mapMarkers = [];

    recordId;
    latitude;
    longitude;

    // Grab hardware GPS coordinates
    getLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.latitude = position.coords.latitude;
                    this.longitude = position.coords.longitude;
                    this.mapMarkers = [{
                        location: { Latitude: this.latitude, Longitude: this.longitude },
                        title: 'Reported Location'
                    }];
                },
                (error) => {
                    this.dispatchEvent(new ShowToastEvent({ title: 'Location Error', message: 'Please enable location services.', variant: 'warning' }));
                }
            );
        }
    }

    handleSubmit(event) {
        event.preventDefault();
        const fields = event.detail.fields;

        // Custom Validation
        if (!fields.Asset_Type__c || !fields.Severity__c || !fields.Description__c) {
            this.dispatchEvent(new ShowToastEvent({ title: 'Error', message: 'Please fill out all required fields.', variant: 'error' }));
            return;
        }

        // Inject hardware coordinates into the Salesforce fields before saving
        if (this.latitude && this.longitude) {
            fields.Location__Latitude__s = this.latitude;
            fields.Location__Longitude__s = this.longitude;
        }

        this.template.querySelector('lightning-record-edit-form').submit(fields);
    }

    handleSuccess(event) {
        this.recordId = event.detail.id;
        this.showForm = false;
        this.showUpload = true; // Transition to Step 2
    }

    handleUploadFinished(event) {
        const uploadedFiles = event.detail.files.length;
        this.dispatchEvent(new ShowToastEvent({ title: 'Success', message: `${uploadedFiles} photo(s) attached.`, variant: 'success' }));
    }

    resetWizard() {
        this.dispatchEvent(new ShowToastEvent({ title: 'Complete', message: 'Thank you for your report.', variant: 'success' }));
        this.showUpload = false;
        this.recordId = null;
        this.mapMarkers = [];
        this.latitude = null;
        this.longitude = null;
        this.showForm = true; // Return to start
    }
}