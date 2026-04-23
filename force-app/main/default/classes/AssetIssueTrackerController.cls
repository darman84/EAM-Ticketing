public without sharing class AssetIssueTrackerController {
  public class IssueDetailsWrapper {
    @AuraEnabled
    public String trackingId;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public String assetType;
    @AuraEnabled
    public String severity;
    @AuraEnabled
    public String techNotes;
    @AuraEnabled
    public String description;
    @AuraEnabled
    public List<String> imageUrls;
  }

  @AuraEnabled
  public static IssueDetailsWrapper getIssueDetails(String trackingId) {
    if (String.isBlank(trackingId)) {
      return null;
    }

    List<Asset_Issue__c> issues = [
      SELECT
        Id,
        External_EAM_ID__c,
        EAM_Status__c,
        Asset_Type__c,
        Severity__c,
        EAM_Tech_Notes__c,
        Description__c
      FROM Asset_Issue__c
      WHERE External_EAM_ID__c = :trackingId
      LIMIT 1
    ];

    if (issues.isEmpty()) {
      return null;
    }

    Asset_Issue__c issue = issues[0];

    IssueDetailsWrapper result = new IssueDetailsWrapper();
    result.trackingId = issue.External_EAM_ID__c;
    result.status = String.isNotBlank(issue.EAM_Status__c)
      ? issue.EAM_Status__c
      : 'New';
    result.assetType = issue.Asset_Type__c;
    result.severity = issue.Severity__c;
    result.techNotes = issue.EAM_Tech_Notes__c;
    result.description = issue.Description__c;
    result.imageUrls = new List<String>();

    List<ContentDocumentLink> cdls = [
      SELECT ContentDocumentId
      FROM ContentDocumentLink
      WHERE LinkedEntityId = :issue.Id
    ];

    if (!cdls.isEmpty()) {
      Set<Id> docIds = new Set<Id>();
      for (ContentDocumentLink cdl : cdls) {
        docIds.add(cdl.ContentDocumentId);
      }

      List<ContentVersion> cvs = [
        SELECT Id, VersionData, FileExtension
        FROM ContentVersion
        WHERE ContentDocumentId IN :docIds AND IsLatest = TRUE
      ];

      for (ContentVersion cv : cvs) {
        String mimeType = 'image/png';
        if (String.isNotBlank(cv.FileExtension)) {
          String ext = cv.FileExtension.toLowerCase();
          if (ext == 'jpg' || ext == 'jpeg')
            mimeType = 'image/jpeg';
          else if (ext == 'gif')
            mimeType = 'image/gif';
        }
        String base64Data = EncodingUtil.base64Encode(cv.VersionData);
        result.imageUrls.add('data:' + mimeType + ';base64,' + base64Data);
      }
    }

    return result;
  }

  @AuraEnabled
  public static String pollForTrackingId(String recordId) {
    if (String.isBlank(recordId)) {
      return null;
    }
    List<Asset_Issue__c> issues = [
      SELECT External_EAM_ID__c
      FROM Asset_Issue__c
      WHERE Id = :recordId
      LIMIT 1
    ];
    if (issues.isEmpty()) {
      return null;
    }
    return issues[0].External_EAM_ID__c;
  }
}
