/**
 * Tests for AssetIssueFacade
 * Covers happy paths (no files, with files), validation errors, and geolocation mapping.
 */
@IsTest
private class AssetIssueFacade_Test {

    @TestSetup
    static void setupData() {
        // No org data dependencies required for this facade
    }

    @IsTest
    static void shouldCreateIssue_WhenValidMinimalInput_NoFiles() {
        // Given
        AssetIssueFacade.CreateIssueRequest req = new AssetIssueFacade.CreateIssueRequest();
        req.assetType = 'Signage';
        req.severity = 'Routine';
        req.description = 'Pothole near the intersection';
        req.latitude = 33.0198;
        req.longitude = -96.6989;

        // When
        Test.startTest();
        AssetIssueFacade.CreateIssueResult res = AssetIssueFacade.createIssueWithFiles(req);
        Test.stopTest();

        // Then
        Assert.isTrue(res != null && res.success, 'Facade should return success');
        Assert.isTrue(String.isNotBlank(res.issueId), 'Facade should return created record Id');
        Assert.areEqual(0, (res.contentVersionIds == null ? 0 : res.contentVersionIds.size()), 'No files should be attached');

        Asset_Issue__c created = [SELECT Id, Asset_Type__c, Severity__c, Description__c, Location__Latitude__s, Location__Longitude__s
                                  FROM Asset_Issue__c WHERE Id = :res.issueId LIMIT 1];
        Assert.areEqual('Signage', created.Asset_Type__c, 'Asset type should match input');
        Assert.areEqual('Routine', created.Severity__c, 'Severity should match input');
        Assert.isTrue(created.Description__c.contains('Pothole'), 'Description should match input');
        Assert.areEqual(33.0198, created.Location__Latitude__s, 'Latitude should be set');
        Assert.areEqual(-96.6989, created.Location__Longitude__s, 'Longitude should be set');
    }

    @IsTest
    static void shouldCreateIssueAndAttachFiles_WhenValidJpegPng() {
        // Given
        AssetIssueFacade.CreateIssueRequest req = new AssetIssueFacade.CreateIssueRequest();
        req.assetType = 'Water/Sewer';
        req.severity = 'Urgent';
        req.description = 'Leaking hydrant';
        req.files = new List<AssetIssueFacade.FilePart>();

        // Minimal tiny payloads (few bytes) to simulate images
        String tinyPngB64 = EncodingUtil.base64Encode(Blob.valueOf('pngpayload'));
        String tinyJpgB64 = EncodingUtil.base64Encode(Blob.valueOf('jpgpayload'));

        req.files.add(new AssetIssueFacade.FilePart('hydrant1.png', 'image/png', tinyPngB64));
        req.files.add(new AssetIssueFacade.FilePart('hydrant2.jpg', 'image/jpeg', tinyJpgB64));

        // When
        Test.startTest();
        AssetIssueFacade.CreateIssueResult res = AssetIssueFacade.createIssueWithFiles(req);
        Test.stopTest();

        // Then
        Assert.isTrue(res != null && res.success, 'Facade should return success for valid files');
        Assert.isTrue(res.contentVersionIds != null && res.contentVersionIds.size() == 2, 'Two ContentVersion records expected');

        // Validate links exist by querying ContentDocumentLinks via the created record
        List<ContentDocumentLink> links = [
            SELECT Id, LinkedEntityId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :res.issueId
        ];
        Assert.isTrue(links.size() >= 2, 'Content should be linked to the created issue');
    }

    @IsTest
    static void shouldFail_WhenMissingRequiredFields() {
        // Given
        AssetIssueFacade.CreateIssueRequest req = new AssetIssueFacade.CreateIssueRequest();
        // no fields populated

        // When/Then
        Test.startTest();
        try {
            AssetIssueFacade.createIssueWithFiles(req);
            Assert.fail('Expected AuraHandledException for missing required fields');
        } catch (AuraHandledException ahe) {
            Assert.isTrue(ahe.getMessage().contains('required fields'), 'Message should indicate required fields missing');
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldFail_WhenInvalidPicklistValues() {
        // Given
        AssetIssueFacade.CreateIssueRequest req = new AssetIssueFacade.CreateIssueRequest();
        req.assetType = 'InvalidType';
        req.severity = 'Routine';
        req.description = 'Test';

        // When/Then
        Test.startTest();
        try {
            AssetIssueFacade.createIssueWithFiles(req);
            Assert.fail('Expected AuraHandledException for invalid asset type');
        } catch (AuraHandledException ahe) {
            Assert.isTrue(ahe.getMessage().contains('Invalid Asset Type'), 'Message should indicate invalid asset type');
        }
        Test.stopTest();

        // Invalid severity
        req.assetType = 'Pavement';
        req.severity = 'Bad';
        Test.startTest();
        try {
            AssetIssueFacade.createIssueWithFiles(req);
            Assert.fail('Expected AuraHandledException for invalid severity');
        } catch (AuraHandledException ahe) {
            Assert.isTrue(ahe.getMessage().contains('Invalid Severity'), 'Message should indicate invalid severity');
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldFail_WhenUnsupportedFileTypeOrOversize() {
        // Given: Unsupported content type
        AssetIssueFacade.CreateIssueRequest badTypeReq = new AssetIssueFacade.CreateIssueRequest();
        badTypeReq.assetType = 'Signage';
        badTypeReq.severity = 'Routine';
        badTypeReq.description = 'Test';
        badTypeReq.files = new List<AssetIssueFacade.FilePart>{
            new AssetIssueFacade.FilePart('doc.txt', 'text/plain', EncodingUtil.base64Encode(Blob.valueOf('hello')))
        };

        Test.startTest();
        try {
            AssetIssueFacade.createIssueWithFiles(badTypeReq);
            Assert.fail('Expected AuraHandledException for unsupported file type');
        } catch (AuraHandledException ahe) {
            Assert.isTrue(ahe.getMessage().contains('Unsupported file type'), 'Message should indicate unsupported type');
        }
        Test.stopTest();

        // Given: Oversize (create blob > 4 MB)
        Integer size = 4 * 1024 * 1024 + 1;
        Blob bigBlob = Blob.valueOf(String.valueOf(size).leftPad(size, 'a'));
        AssetIssueFacade.CreateIssueRequest oversizeReq = new AssetIssueFacade.CreateIssueRequest();
        oversizeReq.assetType = 'Pavement';
        oversizeReq.severity = 'Emergency';
        oversizeReq.description = 'Oversize file test';
        oversizeReq.files = new List<AssetIssueFacade.FilePart>{
            new AssetIssueFacade.FilePart('big.jpg', 'image/jpeg', EncodingUtil.base64Encode(bigBlob))
        };

        Test.startTest();
        try {
            AssetIssueFacade.createIssueWithFiles(oversizeReq);
            Assert.fail('Expected AuraHandledException for oversize file');
        } catch (AuraHandledException ahe) {
            Assert.isTrue(ahe.getMessage().contains('exceed'), 'Message should indicate size exceeded');
        }
        Test.stopTest();
    }
}