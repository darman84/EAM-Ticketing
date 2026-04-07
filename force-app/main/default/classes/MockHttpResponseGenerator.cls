@isTest
public class MockHttpResponseGenerator implements HttpCalloutMock {
    private Integer statusCode;

    // Constructor lets us define the status code in our test methods
    public MockHttpResponseGenerator(Integer statusCode) {
        this.statusCode = statusCode;
    }

    public HTTPResponse respond(HTTPRequest req) {
        HttpResponse res = new HttpResponse();
        res.setHeader('Content-Type', 'application/json');
        res.setBody('{"status": "received"}');
        res.setStatusCode(this.statusCode);
        return res;
    }
}