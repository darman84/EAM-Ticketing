import { createElement } from "lwc";
import AssetIssueTracker from "c/assetIssueTracker";
import { CurrentPageReference } from "lightning/navigation";
import getIssueDetails from "@salesforce/apex/AssetIssueTrackerController.getIssueDetails";

// Mocking Apex method
jest.mock(
  "@salesforce/apex/AssetIssueTrackerController.getIssueDetails",
  () => {
    return {
      default: jest.fn()
    };
  },
  { virtual: true }
);

const MOCK_ISSUE = {
  status: "In Progress",
  assetType: "Pothole",
  severity: "Routine",
  techNotes: "Crew assigned.",
  description: "Large pothole.",
  imageUrls: ["data:image/png;base64,mockbase64"]
};

describe("c-asset-issue-tracker", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  async function flushPromises() {
    return Promise.resolve();
  }

  it("sets trackingId from CurrentPageReference and calls apex", async () => {
    getIssueDetails.mockResolvedValue(MOCK_ISSUE);

    const element = createElement("c-asset-issue-tracker", {
      is: AssetIssueTracker
    });
    document.body.appendChild(element);

    // Simulate CurrentPageReference
    CurrentPageReference.emit({
      state: { id: "TRACKING_123" }
    });

    await flushPromises();

    expect(getIssueDetails).toHaveBeenCalledWith({
      trackingId: "TRACKING_123"
    });

    // Check DOM for rendered details
    const statusEl = element.shadowRoot.querySelector(
      ".slds-text-color_success b"
    );
    expect(statusEl).not.toBeNull();
    expect(statusEl.textContent).toBe("In Progress");
  });

  it("handles check status click manually", async () => {
    getIssueDetails.mockResolvedValue(MOCK_ISSUE);

    const element = createElement("c-asset-issue-tracker", {
      is: AssetIssueTracker
    });
    document.body.appendChild(element);

    const inputEl = element.shadowRoot.querySelector("lightning-input");
    inputEl.value = "TRACKING_456";
    inputEl.dispatchEvent(new CustomEvent("change"));

    const buttonEl = element.shadowRoot.querySelector("lightning-button");
    buttonEl.click();

    await flushPromises();

    expect(getIssueDetails).toHaveBeenCalledWith({
      trackingId: "TRACKING_456"
    });
  });

  it("displays error when issue not found", async () => {
    getIssueDetails.mockResolvedValue(null);

    const element = createElement("c-asset-issue-tracker", {
      is: AssetIssueTracker
    });
    document.body.appendChild(element);

    CurrentPageReference.emit({
      state: { id: "INVALID_ID" }
    });

    await flushPromises();

    const errorEl = element.shadowRoot.querySelector(".slds-text-color_error");
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe("No ticket found for this ID.");
  });

  it("displays error on apex exception", async () => {
    getIssueDetails.mockRejectedValue(new Error("Apex error"));

    const element = createElement("c-asset-issue-tracker", {
      is: AssetIssueTracker
    });
    document.body.appendChild(element);

    CurrentPageReference.emit({
      state: { id: "ERROR_ID" }
    });

    await flushPromises();

    const errorEl = element.shadowRoot.querySelector(".slds-text-color_error");
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe("Error fetching details.");
  });
});
