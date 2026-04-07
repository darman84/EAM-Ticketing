public class EAMCalloutService implements Queueable, Database.AllowsCallouts {
    
    private List<Id> recordIds;
    
    // Constructor to accept IDs from the Flow
    public EAMCalloutService(List<Id> ids) {
        this.recordIds = ids;
    }

    public void execute(QueueableContext context) {
        List<Asset_Issue__c> issuesToUpdate = new List<Asset_Issue__c>();
        
        // Query the records passed in
        List<Asset_Issue__c> issues = [SELECT Id, Asset_Type__c, Severity__c, Description__c 
                                       FROM Asset_Issue__c 
                                       WHERE Id IN :recordIds];
        
        Http http = new Http();
        
        for (Asset_Issue__c issue : issues) {
            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:EAM_Mock_Endpoint');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            
            // Construct the JSON Payload
            Map<String, Object> payload = new Map<String, Object>{
                'system_source' => 'Salesforce_Service_Cloud',
                'issue_id' => issue.Id,
                'department' => issue.Asset_Type__c,
                'priority_level' => issue.Severity__c,
                'field_notes' => issue.Description__c,
                'timestamp' => Datetime.now().formatGmt('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'')
            };
            
            req.setBody(JSON.serialize(payload));
            
            try {
                HttpResponse res = http.send(req);
                
                if (res.getStatusCode() == 200) {
                    issue.Sync_Status__c = 'Success';
                    // Use the Salesforce ID to guarantee uniqueness in bulk processing
                    issue.External_EAM_ID__c = 'EAM-MOCK-' + issue.Id;
                } else {
                    issue.Sync_Status__c = 'Failed';
                }
            } catch (Exception e) {
                System.debug('Callout Error: ' + e.getMessage());
                issue.Sync_Status__c = 'Failed';
            }
            
            issuesToUpdate.add(issue);
        }
        
        if (!issuesToUpdate.isEmpty()) {
            update issuesToUpdate;
        }
    }
}