@isTest
public class EAMIntegration_Test {

    @isTest
    static void testSuccessfulSync() {
        // 1. Setup Mock for a 200 OK response
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(200));
        
        Asset_Issue__c issue = new Asset_Issue__c(
            Asset_Type__c = 'Signage',
            Severity__c = 'Urgent',
            Description__c = 'Test Success'
        );
        
        // 2. Execute
        Test.startTest();
        insert issue; // Triggers the Flow -> Enqueues the Job -> Makes the Callout
        Test.stopTest(); // Forces async Queueable job to finish
        
        // 3. Assert
        Asset_Issue__c result = [SELECT Sync_Status__c, External_EAM_ID__c FROM Asset_Issue__c WHERE Id = :issue.Id];
        System.assertEquals('Success', result.Sync_Status__c, 'Status should update to Success.');
        System.assertNotEquals(null, result.External_EAM_ID__c, 'External ID should be populated.');
    }

    @isTest
    static void testFailedSync() {
        // 1. Setup Mock for a 500 Error response
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(500));
        
        Asset_Issue__c issue = new Asset_Issue__c(
            Asset_Type__c = 'Water/Sewer',
            Severity__c = 'Routine',
            Description__c = 'Test Fail'
        );
        
        // 2. Execute
        Test.startTest();
        insert issue;
        Test.stopTest();
        
        // 3. Assert
        Asset_Issue__c result = [SELECT Sync_Status__c FROM Asset_Issue__c WHERE Id = :issue.Id];
        System.assertEquals('Failed', result.Sync_Status__c, 'Status should update to Failed.');
    }

@isTest
    static void testBulkInsert() {
        // 1. Setup Mock
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(200));
        
        // 2. Prepare 100 records (The absolute maximum for synchronous callouts)
        List<Asset_Issue__c> issues = new List<Asset_Issue__c>();
        for(Integer i = 0; i < 100; i++) {
            issues.add(new Asset_Issue__c(
                Asset_Type__c = 'Pavement',
                Severity__c = 'Routine',
                Description__c = 'Bulk Test ' + i
            ));
        }
        
        // 3. Execute
        Test.startTest();
        insert issues;
        Test.stopTest();
        
        // 4. Assert
        List<Asset_Issue__c> results = [SELECT Sync_Status__c FROM Asset_Issue__c];
        System.assertEquals(100, results.size(), '100 records should be processed.');
        System.assertEquals('Success', results[0].Sync_Status__c, 'Bulk records should succeed.');
    }
}