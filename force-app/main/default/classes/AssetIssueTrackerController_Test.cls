@isTest
private class AssetIssueTrackerController_Test {
  @testSetup
  static void setup() {
    Asset_Issue__c issue = new Asset_Issue__c(
      Asset_Type__c = 'Signage',
      Severity__c = 'Routine',
      Description__c = 'Test Tracking',
      External_EAM_ID__c = 'EAM-12345',
      EAM_Status__c = 'In Progress'
    );
    insert issue;
  }

  @isTest
  static void testGetIssueStatus_Found() {
    Test.startTest();
    String status = AssetIssueTrackerController.getIssueStatus('EAM-12345');
    Test.stopTest();

    System.assertEquals('In Progress', status, 'Status should be In Progress.');
  }

  @isTest
  static void testGetIssueStatus_NotFound() {
    Test.startTest();
    String status = AssetIssueTrackerController.getIssueStatus('EAM-NOPE');
    Test.stopTest();

    System.assertEquals(
      'Not Found',
      status,
      'Status should be Not Found for missing ID.'
    );
  }

  @isTest
  static void testGetIssueStatus_Blank() {
    Test.startTest();
    String status1 = AssetIssueTrackerController.getIssueStatus(null);
    String status2 = AssetIssueTrackerController.getIssueStatus('');
    Test.stopTest();

    System.assertEquals(
      'Invalid ID',
      status1,
      'Status should be Invalid ID for null.'
    );
    System.assertEquals(
      'Invalid ID',
      status2,
      'Status should be Invalid ID for empty string.'
    );
  }
}
