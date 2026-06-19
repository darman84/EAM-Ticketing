import { createElement } from "lwc";
import AssetTriageDashboard from "c/assetTriageDashboard";
import { getRecord } from "lightning/uiRecordApi";
import getNearbyHistoricalIssues from "@salesforce/apex/AssetTriageController.getNearbyHistoricalIssues";

// Mocking Apex wire adapter
jest.mock(
  "@salesforce/apex/AssetTriageController.getNearbyHistoricalIssues",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter(jest.fn())
    };
  },
  { virtual: true }
);

const MOCK_GET_RECORD = {
  fields: {
    Name: { value: "ISSUE-001" },
    Location__Latitude__s: { value: 33.0198 },
    Location__Longitude__s: { value: -96.6989 },
    Description__c: { value: "Current issue description" }
  }
};

const MOCK_HISTORICAL = [
  {
    Name: "ISSUE-002",
    Location__Latitude__s: 33.02,
    Location__Longitude__s: -96.7,
    Severity__c: "Urgent",
    EAM_Status__c: "Completed"
  }
];

describe("c-asset-triage-dashboard", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  async function flushPromises() {
    return Promise.resolve();
  }

  it("renders map markers from current and historical issues", async () => {
    const element = createElement("c-asset-triage-dashboard", {
      is: AssetTriageDashboard
    });
    element.recordId = "001_TEST";
    document.body.appendChild(element);

    getRecord.emit(MOCK_GET_RECORD);
    getNearbyHistoricalIssues.emit(MOCK_HISTORICAL);

    await flushPromises();

    const mapEl = element.shadowRoot.querySelector("lightning-map");
    expect(mapEl).not.toBeNull();
    expect(mapEl.mapMarkers.length).toBe(2);
    expect(mapEl.mapMarkers[0].title).toBe("Current Issue: ISSUE-001");
    expect(mapEl.mapMarkers[1].title).toBe("Historical: ISSUE-002");
  });

  it("renders empty state when no data", async () => {
    const element = createElement("c-asset-triage-dashboard", {
      is: AssetTriageDashboard
    });
    document.body.appendChild(element);

    await flushPromises();

    const mapEl = element.shadowRoot.querySelector("lightning-map");
    expect(mapEl).toBeNull();

    const pEl = element.shadowRoot.querySelector("p");
    expect(pEl.textContent).toBe("Loading map or no spatial data available.");
  });

  it("handles getRecord error safely", async () => {
    const element = createElement("c-asset-triage-dashboard", {
      is: AssetTriageDashboard
    });
    document.body.appendChild(element);

    getRecord.error();

    await flushPromises();

    const mapEl = element.shadowRoot.querySelector("lightning-map");
    expect(mapEl).toBeNull();
  });

  it("handles getNearbyHistoricalIssues error safely", async () => {
    const element = createElement("c-asset-triage-dashboard", {
      is: AssetTriageDashboard
    });
    document.body.appendChild(element);

    getRecord.emit(MOCK_GET_RECORD);
    getNearbyHistoricalIssues.error();

    await flushPromises();

    const mapEl = element.shadowRoot.querySelector("lightning-map");
    expect(mapEl).not.toBeNull();
    expect(mapEl.mapMarkers.length).toBe(1); // Only current issue
  });
});
