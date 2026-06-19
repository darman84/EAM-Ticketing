import { createElement } from "lwc";
import AssetIssueReporter from "c/assetIssueReporter";
import createIssueFromJson from "@salesforce/apex/AssetIssueFacade.createIssueWithFilesFromJson";
import pollForTrackingId from "@salesforce/apex/AssetIssueTrackerController.pollForTrackingId";

// Mock Apex methods
jest.mock(
  "@salesforce/apex/AssetIssueFacade.createIssueWithFilesFromJson",
  () => {
    return { default: jest.fn() };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/AssetIssueTrackerController.pollForTrackingId",
  () => {
    return { default: jest.fn() };
  },
  { virtual: true }
);

describe("c-asset-issue-reporter", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  async function flushPromises() {
    return Promise.resolve();
  }

  beforeEach(() => {
    window.L = {
      map: jest.fn().mockReturnValue({
        setView: jest.fn().mockReturnThis(),
        invalidateSize: jest.fn(),
        getCenter: jest.fn(),
        setZoom: jest.fn(),
        getZoom: jest.fn(),
        mouseEventToLatLng: jest.fn()
      }),
      layerGroup: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        removeLayer: jest.fn()
      }),
      tileLayer: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis()
      }),
      circleMarker: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis()
      })
    };
  });

  it("renders form initially", () => {
    const element = createElement("c-asset-issue-reporter", {
      is: AssetIssueReporter
    });
    document.body.appendChild(element);

    const title = element.shadowRoot.querySelector("h1.title");
    expect(title).not.toBeNull();
    expect(title.textContent).toBe("Report Infrastructure Issue");
  });

  it("updates assetType options when category changes", async () => {
    const element = createElement("c-asset-issue-reporter", {
      is: AssetIssueReporter
    });
    document.body.appendChild(element);

    await flushPromises();

    const combos = element.shadowRoot.querySelectorAll("lightning-combobox");
    const categoryCombo = combos[0];
    categoryCombo.value = "Streets and Traffic";
    categoryCombo.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Streets and Traffic" } })
    );

    await flushPromises();

    const assetTypeCombo =
      element.shadowRoot.querySelectorAll("lightning-combobox")[1];
    expect(assetTypeCombo.disabled).toBe(false);
  });

  it("submits issue successfully and polls for tracking ID", async () => {
    jest.useFakeTimers();
    // Mock successful submission
    createIssueFromJson.mockResolvedValue({
      success: true,
      issueId: "RECORD_ID_123"
    });

    // Mock polling
    pollForTrackingId.mockResolvedValue("EAM-123");

    const element = createElement("c-asset-issue-reporter", {
      is: AssetIssueReporter
    });
    document.body.appendChild(element);

    await flushPromises();

    // Fill form
    const combos = element.shadowRoot.querySelectorAll("lightning-combobox");
    const categoryCombo = combos[0];
    categoryCombo.value = "Streets and Traffic";
    categoryCombo.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Streets and Traffic" } })
    );

    await flushPromises();

    const assetTypeCombo =
      element.shadowRoot.querySelectorAll("lightning-combobox")[1];
    assetTypeCombo.value = "Pothole Report";
    assetTypeCombo.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Pothole Report" } })
    );

    const severityCombo =
      element.shadowRoot.querySelectorAll("lightning-combobox")[2];
    severityCombo.value = "Routine";
    severityCombo.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Routine" } })
    );

    const descInput = element.shadowRoot.querySelector("lightning-textarea");
    descInput.value = "Test description";
    descInput.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Test description" } })
    );

    // Mock geolocation check (map initialization might not fully run in JSDOM but we can set latitude)
    // Actually we just click submit directly
    const submitBtn = element.shadowRoot.querySelector(".submit-btn");
    submitBtn.click();

    await flushPromises();

    expect(createIssueFromJson).toHaveBeenCalled();

    // Advance polling promises
    await flushPromises(); // flush createIssueFromJson

    // The code uses setTimeout(..., 1000) in a while loop
    jest.advanceTimersByTime(1000);
    await flushPromises(); // flush setTimeout and pollForTrackingId
    await flushPromises(); // flush next state updates

    expect(pollForTrackingId).toHaveBeenCalled();

    // Verify success view is shown
    const successTitle = element.shadowRoot.querySelector(".success-title");
    expect(successTitle).not.toBeNull();
    expect(successTitle.textContent).toBe("Issue Reported Successfully!");

    jest.useRealTimers();
  });

  it("shows error toast if form is incomplete", async () => {
    const element = createElement("c-asset-issue-reporter", {
      is: AssetIssueReporter
    });
    document.body.appendChild(element);

    await flushPromises();

    // Mock ShowToastEvent
    const toastHandler = jest.fn();
    element.addEventListener("lightning__showtoast", toastHandler);

    // Submit empty form
    const submitBtn = element.shadowRoot.querySelector(".submit-btn");
    submitBtn.click();

    await flushPromises();

    expect(toastHandler).toHaveBeenCalled();
    const toastEvent = toastHandler.mock.calls[0][0];
    expect(toastEvent.detail.title).toBe("Error");
    expect(toastEvent.detail.message).toMatch(
      /Please complete all required fields/
    );
  });
});
