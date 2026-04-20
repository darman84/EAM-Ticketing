@RestResource(urlMapping='/EAM/StatusUpdate/*')
global without sharing class EAMStatusUpdateAPI {
  global class StatusUpdateRequest {
    public String external_eam_id;
    public String status;
    public String tech_notes;
  }

  global class StatusUpdateResponse {
    public Boolean success;
    public String message;
  }

  @HttpPatch
  global static StatusUpdateResponse updateStatus() {
    RestRequest req = RestContext.request;
    StatusUpdateResponse res = new StatusUpdateResponse();

    try {
      if (req.requestBody == null) {
        res.success = false;
        res.message = 'Request body is empty.';
        RestContext.response.statusCode = 400;
        return res;
      }

      StatusUpdateRequest parsedReq = (StatusUpdateRequest) JSON.deserialize(
        req.requestBody.toString(),
        StatusUpdateRequest.class
      );

      if (String.isBlank(parsedReq.external_eam_id)) {
        res.success = false;
        res.message = 'Missing external_eam_id.';
        RestContext.response.statusCode = 400;
        return res;
      }

      List<Asset_Issue__c> issues = [
        SELECT Id, EAM_Status__c, EAM_Tech_Notes__c
        FROM Asset_Issue__c
        WHERE External_EAM_ID__c = :parsedReq.external_eam_id
        LIMIT 1
      ];

      if (issues.isEmpty()) {
        res.success = false;
        res.message =
          'Asset Issue not found for External EAM ID: ' +
          parsedReq.external_eam_id;
        RestContext.response.statusCode = 404;
        return res;
      }

      Asset_Issue__c issue = issues[0];
      issue.EAM_Status__c = parsedReq.status;
      issue.EAM_Tech_Notes__c = parsedReq.tech_notes;

      update issue;

      res.success = true;
      res.message = 'Status successfully updated.';
      RestContext.response.statusCode = 200;
    } catch (Exception e) {
      res.success = false;
      res.message = 'Internal server error: ' + e.getMessage();
      RestContext.response.statusCode = 500;
    }

    return res;
  }
}
