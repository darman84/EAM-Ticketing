@IsTest
private class EAMStatusUpdateAPI_Test {
  @TestSetup
  static void setup() {
    Asset_Issue__c issue = new Asset_Issue__c(
      Asset_Type__c = 'Street Sign Issues',
      Severity__c = 'Routine',
      Description__c = 'Test Issue',
      External_EAM_ID__c = 'EAM-12345'
    );
    insert issue;
  }

  @IsTest
  static void testUpdateStatus_Success() {
    RestRequest req = new RestRequest();
    RestResponse res = new RestResponse();

    req.requestURI = '/services/apexrest/EAM/StatusUpdate/';
    req.httpMethod = 'PATCH';
    String jsonBody = '{"external_eam_id": "EAM-12345", "status": "In Progress", "tech_notes": "Crew dispatched"}';
    req.requestBody = Blob.valueOf(jsonBody);

    RestContext.request = req;
    RestContext.response = res;

    Test.startTest();
    EAMStatusUpdateAPI.StatusUpdateResponse response = EAMStatusUpdateAPI.updateStatus();
    Test.stopTest();

    System.assertEquals(
      true,
      response.success,
      'Response should be successful.'
    );
    System.assertEquals(200, res.statusCode, 'Status code should be 200.');

    Asset_Issue__c updatedIssue = [
      SELECT EAM_Status__c, EAM_Tech_Notes__c
      FROM Asset_Issue__c
      WHERE External_EAM_ID__c = 'EAM-12345'
      LIMIT 1
    ];
    System.assertEquals(
      'In Progress',
      updatedIssue.EAM_Status__c,
      'Status should be updated.'
    );
    System.assertEquals(
      'Crew dispatched',
      updatedIssue.EAM_Tech_Notes__c,
      'Tech notes should be updated.'
    );
  }

  @IsTest
  static void testUpdateStatus_EmptyBody() {
    RestRequest req = new RestRequest();
    RestResponse res = new RestResponse();

    req.requestURI = '/services/apexrest/EAM/StatusUpdate/';
    req.httpMethod = 'PATCH';
    req.requestBody = null;

    RestContext.request = req;
    RestContext.response = res;

    Test.startTest();
    EAMStatusUpdateAPI.StatusUpdateResponse response = EAMStatusUpdateAPI.updateStatus();
    Test.stopTest();

    System.assertEquals(
      false,
      response.success,
      'Response should not be successful.'
    );
    System.assertEquals(
      400,
      res.statusCode,
      'Status code should be 400 for empty body.'
    );
  }

  @IsTest
  static void testUpdateStatus_MissingExternalId() {
    RestRequest req = new RestRequest();
    RestResponse res = new RestResponse();

    req.requestURI = '/services/apexrest/EAM/StatusUpdate/';
    req.httpMethod = 'PATCH';
    String jsonBody = '{"status": "In Progress"}'; // Missing external_eam_id
    req.requestBody = Blob.valueOf(jsonBody);

    RestContext.request = req;
    RestContext.response = res;

    Test.startTest();
    EAMStatusUpdateAPI.StatusUpdateResponse response = EAMStatusUpdateAPI.updateStatus();
    Test.stopTest();

    System.assertEquals(
      false,
      response.success,
      'Response should not be successful.'
    );
    System.assertEquals(
      400,
      res.statusCode,
      'Status code should be 400 for missing external ID.'
    );
  }

  @IsTest
  static void testUpdateStatus_NotFound() {
    RestRequest req = new RestRequest();
    RestResponse res = new RestResponse();

    req.requestURI = '/services/apexrest/EAM/StatusUpdate/';
    req.httpMethod = 'PATCH';
    String jsonBody = '{"external_eam_id": "INVALID-ID", "status": "In Progress"}';
    req.requestBody = Blob.valueOf(jsonBody);

    RestContext.request = req;
    RestContext.response = res;

    Test.startTest();
    EAMStatusUpdateAPI.StatusUpdateResponse response = EAMStatusUpdateAPI.updateStatus();
    Test.stopTest();

    System.assertEquals(
      false,
      response.success,
      'Response should not be successful.'
    );
    System.assertEquals(
      404,
      res.statusCode,
      'Status code should be 404 for missing record.'
    );
  }

  @IsTest
  static void testUpdateStatus_InvalidJson() {
    RestRequest req = new RestRequest();
    RestResponse res = new RestResponse();

    req.requestURI = '/services/apexrest/EAM/StatusUpdate/';
    req.httpMethod = 'PATCH';
    String jsonBody = '{"external_eam_id": "EAM-12345",'; // Bad format
    req.requestBody = Blob.valueOf(jsonBody);

    RestContext.request = req;
    RestContext.response = res;

    Test.startTest();
    EAMStatusUpdateAPI.StatusUpdateResponse response = EAMStatusUpdateAPI.updateStatus();
    Test.stopTest();

    System.assertEquals(
      false,
      response.success,
      'Response should not be successful.'
    );
    System.assertEquals(
      500,
      res.statusCode,
      'Status code should be 500 for parsing exception.'
    );
  }
}
