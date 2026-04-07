public without sharing class AssetIssueTrackerController {
    
    @AuraEnabled
    public static String getIssueStatus(String trackingId) {
        if (String.isBlank(trackingId)) {
            return 'Invalid ID';
        }
        
        List<Asset_Issue__c> issues = [SELECT Sync_Status__c 
                                       FROM Asset_Issue__c 
                                       WHERE External_EAM_ID__c = :trackingId 
                                       LIMIT 1];
        
        if (issues.isEmpty()) {
            return 'Not Found';
        }
        
        return issues[0].Sync_Status__c;
    }
}