/**
 * AssetIssueFacade
 * Runs in system context to create Asset_Issue__c records and attach files for Experience Cloud guest users.
 * Consolidates record creation and file upload into a single, secure Apex facade to avoid guest CRUD/file constraints.
 *
 * Usage (LWC):
 *  import createIssue from '@salesforce/apex/AssetIssueFacade.createIssueWithFiles';
 *  const req = { assetType, severity, description, latitude, longitude, submitterEmail, submitterPhone, files: [{fileName, contentType, base64Data}] };
 *  const res = await createIssue({ req });
 *
 * Security:
 *  - without sharing: required to bypass guest permissions and perform DML/ContentVersion creation in system context.
 *  - Strict input validation and field allowlisting to prevent arbitrary field injection.
 *  - User-facing errors are thrown as AuraHandledException with sanitized messages.
 *
 * Limits:
 *  - Enforces max file count and size to avoid governor/heap overages.
 *  - DML and SOQL are outside of loops; ContentVersion insert is bulked.
 */
public without sharing class AssetIssueFacade {

    // -----------------------------
    // Constants
    // -----------------------------
    private static final Integer MAX_FILES = 5;
    // Safe per-file size limit under common guest form uploads; ContentVersion supports up to ~37.5MB via Apex,
    // but Experience Cloud guest usage + base64 in LWC can bloat payloads. Keep conservative client/server caps.
    private static final Integer MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB
    private static final Set<String> ALLOWED_TYPES = new Set<String>{ 'image/jpeg', 'image/png' };
    private static final Set<String> ALLOWED_ASSET_TYPES = new Set<String>{ 'Signage', 'Water/Sewer', 'Pavement' };
    private static final Set<String> ALLOWED_SEVERITIES = new Set<String>{ 'Routine', 'Urgent', 'Emergency' };

    // -----------------------------
    // DTOs
    // -----------------------------
    public class FilePart {
        @AuraEnabled public String fileName;
        @AuraEnabled public String contentType;
        @AuraEnabled public String base64Data;

        public FilePart() {}
        public FilePart(String fileName, String contentType, String base64Data) {
            this.fileName = fileName;
            this.contentType = contentType;
            this.base64Data = base64Data;
        }
    }

    public class CreateIssueRequest {
        @AuraEnabled public String assetType;
        @AuraEnabled public String severity;
        @AuraEnabled public String description;
        @AuraEnabled public Decimal latitude;
        @AuraEnabled public Decimal longitude;
        @AuraEnabled public String submitterEmail;
        @AuraEnabled public String submitterPhone;
        @AuraEnabled public List<FilePart> files;

        public CreateIssueRequest() {}
    }

    public class CreateIssueResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String issueId;
        @AuraEnabled public List<String> contentVersionIds;
        @AuraEnabled public String message;

        public CreateIssueResult(Boolean success, String issueId, List<String> contentVersionIds, String message) {
            this.success = success;
            this.issueId = issueId;
            this.contentVersionIds = contentVersionIds;
            this.message = message;
        }
    }

    /**
     * Creates an Asset_Issue__c record and attaches provided files as ContentVersion, publishing them to the new record.
     * @param req Structured request with required fields and optional base64 files
     * @return CreateIssueResult with success flag, created record Id, and ContentVersion Ids if any
     * @throws AuraHandledException User-facing error with validation details
     */
    @AuraEnabled
    public static CreateIssueResult createIssueWithFiles(CreateIssueRequest req) {
        try {
            validateRequest(req);

            // Create the issue record with whitelisted fields only
            Asset_Issue__c issue = new Asset_Issue__c();
            issue.Asset_Type__c = req.assetType;
            issue.Severity__c = req.severity;
            issue.Description__c = req.description;

            // Geolocation: only set when both provided
            if (req.latitude != null && req.longitude != null) {
                issue.Location__Latitude__s = req.latitude;
                issue.Location__Longitude__s = req.longitude;
            }

            // Optional submitter fields (present in LWC)
            // These fields are referenced in the component; map them if they exist in the org.
            try {
                issue.put('Submitter_Email__c', req.submitterEmail);
                issue.put('Submitter_Phone__c', req.submitterPhone);
            } catch (Exception e) {
                // If fields do not exist, ignore silently to avoid runtime failure.
            }

            insert issue;

            // Prepare ContentVersion list if files provided
            List<ContentVersion> versions = new List<ContentVersion>();
            if (req.files != null && !req.files.isEmpty()) {
                Integer count = 0;
                for (FilePart f : req.files) {
                    count++;
                    if (count > MAX_FILES) break; // cap quietly
                    if (f == null) continue;

                    // Normalize and validate
                    String ct = (f.contentType == null) ? null : f.contentType.toLowerCase();
                    if (String.isBlank(f.base64Data) || String.isBlank(f.fileName) || String.isBlank(ct)) {
                        throw new AuraHandledException('Invalid file data. Each file requires a name, content type, and base64 content.');
                    }
                    if (!ALLOWED_TYPES.contains(ct)) {
                        throw new AuraHandledException('Unsupported file type. Only JPEG and PNG are allowed.');
                    }

                    // Some clients include a data URI prefix; strip if present
                    String b64 = f.base64Data;
                    Integer commaIdx = b64 != null ? b64.indexOf(',') : -1;
                    if (commaIdx > -1) {
                        b64 = b64.substring(commaIdx + 1);
                    }

                    Blob body;
                    try {
                        body = EncodingUtil.base64Decode(b64);
                    } catch (Exception e) {
                        throw new AuraHandledException('Unable to decode uploaded file content.');
                    }
                    if (body == null || body.size() == 0) {
                        throw new AuraHandledException('Uploaded file content is empty.');
                    }
                    if (body.size() > MAX_FILE_BYTES) {
                        throw new AuraHandledException('One or more files exceed the maximum allowed size of 4 MB.');
                    }

                    ContentVersion v = new ContentVersion();
                    v.VersionData = body;
                    v.PathOnClient = f.fileName;
                    v.Title = deriveTitle(f.fileName);
                    v.FirstPublishLocationId = issue.Id; // auto-link to the record
                    versions.add(v);
                }

                if (!versions.isEmpty()) {
                    insert versions;
                }
            }

            List<String> cvIds = new List<String>();
            for (ContentVersion v : versions) {
                cvIds.add(v.Id);
            }

            return new CreateIssueResult(true, String.valueOf(issue.Id), cvIds, 'Issue created successfully.');

        } catch (AuraHandledException ahe) {
            // Bubble up sanitized user-facing message
            throw ahe;
        } catch (DmlException dml) {
            throw new AuraHandledException('Unable to save your report. Please review the form and try again.');
        } catch (Exception e) {
            // Generic fallback without leaking internals
            throw new AuraHandledException('An unexpected error occurred. Please try again later.');
        }
    }

    /**
     * Overload that accepts a raw JSON string of CreateIssueRequest to avoid UI proxy/serialization issues.
     * @param reqJson JSON string matching CreateIssueRequest shape
     * @return CreateIssueResult with success flag and identifiers
     */
    @AuraEnabled
    public static CreateIssueResult createIssueWithFilesFromJson(String reqJson) {
        try {
            if (String.isBlank(reqJson)) {
                throw new AuraHandledException('Request is required.');
            }
            // Parse into a plain map, then map fields manually to the request DTO
            Map<String, Object> m = (Map<String, Object>) JSON.deserializeUntyped(reqJson);
            CreateIssueRequest req = new CreateIssueRequest();
            req.assetType = (String) m.get('assetType');
            req.severity = (String) m.get('severity');
            req.description = (String) m.get('description');

            Object lat = m.get('latitude');
            Object lng = m.get('longitude');
            req.latitude = (lat instanceof Decimal) ? (Decimal) lat : (lat instanceof Integer ? Decimal.valueOf((Integer)lat) : null);
            req.longitude = (lng instanceof Decimal) ? (Decimal) lng : (lng instanceof Integer ? Decimal.valueOf((Integer)lng) : null);

            req.submitterEmail = (String) m.get('submitterEmail');
            req.submitterPhone = (String) m.get('submitterPhone');

            List<Object> filesRaw = (List<Object>) m.get('files');
            if (filesRaw != null) {
                req.files = new List<FilePart>();
                for (Object o : filesRaw) {
                    Map<String, Object> fm = (Map<String, Object>) o;
                    FilePart fp = new FilePart(
                        (String) fm.get('fileName'),
                        (String) fm.get('contentType'),
                        (String) fm.get('base64Data')
                    );
                    req.files.add(fp);
                }
            }

            // Delegate to primary method
            return createIssueWithFiles(req);
        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (Exception e) {
            throw new AuraHandledException('Invalid request format.');
        }
    }

    // -----------------------------
    // Helpers
    // -----------------------------

    private static void validateRequest(CreateIssueRequest req) {
        if (req == null) {
            throw new AuraHandledException('Request is required.');
        }
        if (String.isBlank(req.assetType) || String.isBlank(req.severity) || String.isBlank(req.description)) {
            throw new AuraHandledException('Please complete all required fields: Asset Type, Severity, and Description.');
        }
        if (!ALLOWED_ASSET_TYPES.contains(req.assetType)) {
            throw new AuraHandledException('Invalid Asset Type selection.');
        }
        if (!ALLOWED_SEVERITIES.contains(req.severity)) {
            throw new AuraHandledException('Invalid Severity selection.');
        }

        // Basic email/phone sanity (non-blocking if empty)
        if (!String.isBlank(req.submitterEmail) && !looksLikeEmail(req.submitterEmail)) {
            throw new AuraHandledException('Please enter a valid email address.');
        }
        if (!String.isBlank(req.submitterPhone) && req.submitterPhone.length() > 40) {
            throw new AuraHandledException('Phone number appears too long.');
        }

        if (req.files != null && req.files.size() > MAX_FILES) {
            // We will allow but cap; still surface a warning to client if desired. For now, hard block to keep UX simple.
            throw new AuraHandledException('You can attach up to ' + String.valueOf(MAX_FILES) + ' files.');
        }
    }

    private static Boolean looksLikeEmail(String email) {
        // Simple pattern; avoid heavy regex for performance
        return email != null && email.contains('@') && email.contains('.') && email.length() <= 254;
    }

    private static String deriveTitle(String fileName) {
        if (String.isBlank(fileName)) return 'Attachment';
        Integer dot = fileName.lastIndexOf('.');
        return (dot > 0) ? fileName.substring(0, dot) : fileName;
    }
}