import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AssetIssueReporter extends LightningElement {

    handleSubmit(event) {
        event.preventDefault(); // Stop standard submission
        const fields = event.detail.fields;

        // Custom Validation: Ensure no fields are null
        if (!fields.Asset_Type__c || !fields.Severity__c || !fields.Description__c) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'All fields are required to submit an issue.',
                    variant: 'error'
                })
            );
            return;
        }

        // If validation passes, submit the form
        this.template.querySelector('lightning-record-edit-form').submit(fields);
    }

    handleSuccess() {
        // Dispatch Success Toast
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Issue Logged Successfully',
                variant: 'success'
            })
        );

        // Reset the form fields
        const inputFields = this.template.querySelectorAll('lightning-input-field');
        if (inputFields) {
            inputFields.forEach(field => {
                field.reset();
            });
        }
    }
}