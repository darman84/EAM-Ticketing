public class EAMIntegrationRouter {
    
    @InvocableMethod(label='Sync to EAM' description='Passes Asset Issue ID to Queueable job for external sync')
    public static void routeToEAM(List<Id> issueIds) {
        // Enqueue the job and pass the list of IDs
        System.enqueueJob(new EAMCalloutService(issueIds));
    }
}