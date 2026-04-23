/**
 * Tests for AssetIssueTrackerController
 * Covers getIssueDetails (found, not found, blank input) and pollForTrackingId
 * (found, not found, blank input). File attachment coverage included.
 */
@IsTest
private class AssetIssueTrackerController_Test {
  @TestSetup
  static void setupData() {
    Asset_Issue__c issue = new Asset_Issue__c(
      Asset_Type__c = 'Signage',
      Severity__c = 'Routine',
      Description__c = 'Cracked sign on Main St.',
      External_EAM_ID__c = 'EAM-TEST-001',
      EAM_Status__c = 'In Progress',
      EAM_Tech_Notes__c = 'Crew dispatched.'
    );
    insert issue;
  }

  // ─── getIssueDetails ──────────────────────────────────────────────────────

  @IsTest
  static void testGetIssueDetails_Found() {
    Test.startTest();
    AssetIssueTrackerController.IssueDetailsWrapper result = AssetIssueTrackerController.getIssueDetails(
      'EAM-TEST-001'
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
    System.assertEquals(
      'EAM-TEST-001',
      result.trackingId,
      'Tracking ID should match'
    );
    System.assertEquals('In Progress', result.status, 'Status should match');
    System.assertEquals('Signage', result.assetType, 'Asset type should match');
    System.assertEquals('Routine', result.severity, 'Severity should match');
    System.assertEquals(
      'Crew dispatched.',
      result.techNotes,
      'Tech notes should match'
    );
    System.assertEquals(
      'Cracked sign on Main St.',
      result.description,
      'Description should match'
    );
    System.assertNotEquals(
      null,
      result.imageUrls,
      'Image URL list should not be null'
    );
    System.assertEquals(
      0,
      result.imageUrls.size(),
      'No images attached, list should be empty'
    );
  }

  @IsTest
  static void testGetIssueDetails_StatusDefaultsToNew_WhenNoEAMStatus() {
    Asset_Issue__c issue = new Asset_Issue__c(
      Asset_Type__c = 'Pavement',
      Severity__c = 'Urgent',
      Description__c = 'Road damage',
      External_EAM_ID__c = 'EAM-TEST-002'
      // EAM_Status__c intentionally omitted
    );
    insert issue;

    Test.startTest();
    AssetIssueTrackerController.IssueDetailsWrapper result = AssetIssueTrackerController.getIssueDetails(
      'EAM-TEST-002'
    );
    Test.stopTest();

    System.assertEquals(
      'New',
      result.status,
      'Status should default to New when null'
    );
  }

  @IsTest
  static void testGetIssueDetails_NotFound() {
    Test.startTest();
    AssetIssueTrackerController.IssueDetailsWrapper result = AssetIssueTrackerController.getIssueDetails(
      'EAM-DOES-NOT-EXIST'
    );
    Test.stopTest();

    System.assertEquals(
      null,
      result,
      'Result should be null for an unknown ID'
    );
  }

  @IsTest
  static void testGetIssueDetails_BlankId() {
    Test.startTest();
    AssetIssueTrackerController.IssueDetailsWrapper resNull = AssetIssueTrackerController.getIssueDetails(
      null
    );
    AssetIssueTrackerController.IssueDetailsWrapper resEmpty = AssetIssueTrackerController.getIssueDetails(
      ''
    );
    Test.stopTest();

    System.assertEquals(null, resNull, 'Null input should return null');
    System.assertEquals(
      null,
      resEmpty,
      'Empty string input should return null'
    );
  }

  @IsTest
  static void testGetIssueDetails_WithAttachedImage() {
    Asset_Issue__c issue = [
      SELECT Id
      FROM Asset_Issue__c
      WHERE External_EAM_ID__c = 'EAM-TEST-001'
      LIMIT 1
    ];

    // Attach a tiny PNG directly via ContentVersion
    ContentVersion cv = new ContentVersion();
    cv.Title = 'test-image';
    cv.PathOnClient = 'test-image.png';
    cv.VersionData = Blob.valueOf('fakepngbytes');
    cv.FirstPublishLocationId = issue.Id;
    insert cv;

    Test.startTest();
    AssetIssueTrackerController.IssueDetailsWrapper result = AssetIssueTrackerController.getIssueDetails(
      'EAM-TEST-001'
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
    System.assertEquals(
      1,
      result.imageUrls.size(),
      'One image URL should be returned'
    );
    System.assert(
      result.imageUrls[0].startsWith('data:'),
      'URL should be a Base64 data URI'
    );
  }

  // ─── pollForTrackingId ────────────────────────────────────────────────────

  @IsTest
  static void testPollForTrackingId_Found() {
    Asset_Issue__c issue = [
      SELECT Id
      FROM Asset_Issue__c
      WHERE External_EAM_ID__c = 'EAM-TEST-001'
      LIMIT 1
    ];

    Test.startTest();
    String polled = AssetIssueTrackerController.pollForTrackingId(issue.Id);
    Test.stopTest();

    System.assertEquals(
      'EAM-TEST-001',
      polled,
      'Should return the External EAM ID'
    );
  }

  @IsTest
  static void testPollForTrackingId_NotYetAssigned() {
    Asset_Issue__c issue = new Asset_Issue__c(
      Asset_Type__c = 'Pavement',
      Severity__c = 'Routine',
      Description__c = 'No EAM ID yet'
      // External_EAM_ID__c intentionally omitted
    );
    insert issue;

    Test.startTest();
    String polled = AssetIssueTrackerController.pollForTrackingId(issue.Id);
    Test.stopTest();

    System.assertEquals(
      null,
      polled,
      'Should return null when EAM ID not yet set'
    );
  }

  @IsTest
  static void testPollForTrackingId_BlankId() {
    Test.startTest();
    String resNull = AssetIssueTrackerController.pollForTrackingId(null);
    String resEmpty = AssetIssueTrackerController.pollForTrackingId('');
    Test.stopTest();

    System.assertEquals(null, resNull, 'Null input should return null');
    System.assertEquals(
      null,
      resEmpty,
      'Empty string input should return null'
    );
  }
}
