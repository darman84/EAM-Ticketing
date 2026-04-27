@isTest
public class EAMIntegration_Test {
  @isTest
  static void testSuccessfulSync() {
    // 1. Setup Mock for a 200 OK response
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(200));

    Asset_Issue__c issue = new Asset_Issue__c(
      Asset_Type__c = 'Street Sign Issues',
      Severity__c = 'Urgent',
      Description__c = 'Test Success'
    );

    // 2. Execute
    Test.startTest();
    insert issue; // Triggers the Flow -> Enqueues the Job -> Makes the Callout
    Test.stopTest(); // Forces async Queueable job to finish

    // 3. Assert
    Asset_Issue__c result = [
      SELECT Sync_Status__c, External_EAM_ID__c
      FROM Asset_Issue__c
      WHERE Id = :issue.Id
    ];
    System.assertEquals(
      'Success',
      result.Sync_Status__c,
      'Status should update to Success.'
    );
    System.assertNotEquals(
      null,
      result.External_EAM_ID__c,
      'External ID should be populated.'
    );
  }

  @isTest
  static void testFailedSync() {
    // 1. Setup Mock for a 500 Error response
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(500));

    Asset_Issue__c issue = new Asset_Issue__c(
      Asset_Type__c = 'Water Leaks',
      Severity__c = 'Routine',
      Description__c = 'Test Fail'
    );

    // 2. Execute
    Test.startTest();
    insert issue;
    Test.stopTest();

    // 3. Assert
    Asset_Issue__c result = [
      SELECT Sync_Status__c
      FROM Asset_Issue__c
      WHERE Id = :issue.Id
    ];
    System.assertEquals(
      'Failed',
      result.Sync_Status__c,
      'Status should update to Failed.'
    );
  }

  @isTest
  static void testBulkInsert() {
    // 1. Setup Mock
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(200));

    // 2. Prepare 100 records (The absolute maximum for synchronous callouts)
    List<Asset_Issue__c> issues = new List<Asset_Issue__c>();
    for (Integer i = 0; i < 100; i++) {
      issues.add(
        new Asset_Issue__c(
          Asset_Type__c = 'Pothole Report',
          Severity__c = 'Routine',
          Description__c = 'Bulk Test ' + i
        )
      );
    }

    // 3. Execute
    Test.startTest();
    insert issues;
    Test.stopTest();

    // 4. Assert
    List<Asset_Issue__c> results = [SELECT Sync_Status__c FROM Asset_Issue__c];
    System.assertEquals(
      100,
      results.size(),
      '100 records should be processed.'
    );
    System.assertEquals(
      'Success',
      results[0].Sync_Status__c,
      'Bulk records should succeed.'
    );
  }

  @isTest
  static void testChainedBulkInsert() {
    // 1. Setup Mock
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(200));

    // 2. Prepare records
    List<Asset_Issue__c> issues = new List<Asset_Issue__c>();
    for (Integer i = 0; i < 60; i++) {
      issues.add(
        new Asset_Issue__c(
          Asset_Type__c = 'Pothole Report',
          Severity__c = 'Routine',
          Description__c = 'Chained Bulk Test ' + i
        )
      );
    }

    // 3. Lower max callouts for test context to test chunking safely
    EAMCalloutService.MAX_CALLOUTS = 50;

    // 4. Execute
    Test.startTest();
    insert issues;
    Test.stopTest();

    // 5. Assert
    List<Asset_Issue__c> results = [
      SELECT Sync_Status__c
      FROM Asset_Issue__c
      WHERE Sync_Status__c = 'Success'
    ];
    System.assertEquals(
      50,
      results.size(),
      'Exactly 50 records should have processed in testing context due to test chaining bypass.'
    );
  }

  @isTest
  static void testDispatchUpdateSync() {
    // 1. Setup Mock for a 200 OK response
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(200));

    // 2. Pre-populate External_EAM_ID__c to simulate an already-synced record
    Asset_Issue__c issue = new Asset_Issue__c(
      Asset_Type__c = 'Street Sign Issues',
      Severity__c = 'Urgent',
      Description__c = 'Dispatch Update Test',
      External_EAM_ID__c = 'EAM-EXISTING-001'
    );
    insert issue;

    // 3. Directly enqueue the service as a dispatch update (PATCH scenario)
    Test.startTest();
    System.enqueueJob(new EAMCalloutService(new List<Id>{ issue.Id }));
    Test.stopTest();

    // 4. Assert — status should be Success and the External ID must be unchanged
    Asset_Issue__c result = [
      SELECT Sync_Status__c, External_EAM_ID__c
      FROM Asset_Issue__c
      WHERE Id = :issue.Id
    ];
    System.assertEquals(
      'Success',
      result.Sync_Status__c,
      'Dispatch update should succeed with a 200 response.'
    );
    System.assertEquals(
      'EAM-EXISTING-001',
      result.External_EAM_ID__c,
      'External ID must remain unchanged after a PATCH dispatch update.'
    );
  }
}
