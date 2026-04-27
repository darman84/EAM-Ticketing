@isTest
public class AssetTriageController_Test {
  @TestSetup
  static void setupTestData() {
    // Create an initial record to test against
    Asset_Issue__c currentIssue = new Asset_Issue__c(
      Asset_Type__c = 'Street Sign Issues',
      Severity__c = 'Urgent',
      Description__c = 'Current Issue',
      Location__Latitude__s = 33.0198,
      Location__Longitude__s = -96.6989
    );
    insert currentIssue;

    // Create nearby historical records
    List<Asset_Issue__c> historicalIssues = new List<Asset_Issue__c>();
    for (Integer i = 0; i < 5; i++) {
      historicalIssues.add(
        new Asset_Issue__c(
          Asset_Type__c = 'Street Sign Issues',
          Severity__c = 'Routine',
          Description__c = 'Historical Issue ' + i,
          Location__Latitude__s = 33.0200, // Very close
          Location__Longitude__s = -96.7000
        )
      );
    }

    // Create far away record
    historicalIssues.add(
      new Asset_Issue__c(
        Asset_Type__c = 'Street Sign Issues',
        Severity__c = 'Routine',
        Description__c = 'Far Issue',
        Location__Latitude__s = 34.0000, // > 2 miles away
        Location__Longitude__s = -97.0000
      )
    );

    // Create different type record
    historicalIssues.add(
      new Asset_Issue__c(
        Asset_Type__c = 'Pothole Report',
        Severity__c = 'Urgent',
        Description__c = 'Different Type',
        Location__Latitude__s = 33.0198,
        Location__Longitude__s = -96.6989
      )
    );

    insert historicalIssues;
  }

  @isTest
  static void testGetNearbyHistoricalIssues() {
    Asset_Issue__c currentIssue = [
      SELECT Id
      FROM Asset_Issue__c
      WHERE Severity__c = 'Urgent' AND Location__Latitude__s = 33.0198
      LIMIT 1
    ];

    Test.startTest();
    List<Asset_Issue__c> results = AssetTriageController.getNearbyHistoricalIssues(
      currentIssue.Id
    );
    Test.stopTest();

    System.assertEquals(
      5,
      results.size(),
      'Should return exactly 5 nearby historical issues of the same type'
    );

    for (Asset_Issue__c issue : results) {
      System.assertNotEquals(
        'Far Issue',
        issue.Description__c,
        'Far issues should not be returned'
      );
      System.assertNotEquals(
        'Different Type',
        issue.Description__c,
        'Different asset types should not be returned'
      );
      System.assertEquals(
        'Street Sign Issues',
        issue.Asset_Type__c,
        'Asset type should match'
      );
    }
  }

  @isTest
  static void testGetNearbyHistoricalIssues_NoLocation() {
    // A record with no geolocation should immediately return an empty list
    Asset_Issue__c noLocIssue = new Asset_Issue__c(
      Asset_Type__c = 'Street Sign Issues',
      Severity__c = 'Routine',
      Description__c = 'No Location Issue'
      // Location__Latitude__s and Location__Longitude__s intentionally omitted
    );
    insert noLocIssue;

    Test.startTest();
    List<Asset_Issue__c> results = AssetTriageController.getNearbyHistoricalIssues(
      noLocIssue.Id
    );
    Test.stopTest();

    System.assertEquals(
      0,
      results.size(),
      'Record with no location should return an empty list.'
    );
  }

  @isTest
  static void testGetNearbyHistoricalIssues_InvalidId() {
    // A non-existent record ID should return an empty list gracefully
    Id fakeId = '001000000000000AAA';

    Test.startTest();
    List<Asset_Issue__c> results = AssetTriageController.getNearbyHistoricalIssues(
      fakeId
    );
    Test.stopTest();

    System.assertEquals(
      0,
      results.size(),
      'Invalid record ID should return an empty list without throwing.'
    );
  }
}
