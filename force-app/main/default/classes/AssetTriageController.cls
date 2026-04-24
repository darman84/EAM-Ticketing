public with sharing class AssetTriageController {
  @AuraEnabled(cacheable=true)
  public static List<Asset_Issue__c> getNearbyHistoricalIssues(Id recordId) {
    List<Asset_Issue__c> currentRecords = [
      SELECT Id, Asset_Type__c, Location__Latitude__s, Location__Longitude__s
      FROM Asset_Issue__c
      WHERE Id = :recordId
      LIMIT 1
    ];

    if (
      currentRecords.isEmpty() ||
      currentRecords[0].Location__Latitude__s == null ||
      currentRecords[0].Location__Longitude__s == null
    ) {
      return new List<Asset_Issue__c>();
    }

    Asset_Issue__c currentRecord = currentRecords[0];

    return [
      SELECT
        Id,
        Name,
        Severity__c,
        EAM_Status__c,
        CreatedDate,
        Location__Latitude__s,
        Location__Longitude__s,
        Description__c,
        Asset_Type__c
      FROM Asset_Issue__c
      WHERE
        Asset_Type__c = :currentRecord.Asset_Type__c
        AND Id != :currentRecord.Id
        AND DISTANCE(
          Location__c,
          GEOLOCATION(:currentRecord.Location__Latitude__s,
            :currentRecord.Location__Longitude__s
          ),
          'mi'
        ) < 2.0
      ORDER BY CreatedDate DESC
      LIMIT 10
    ];
  }
}
