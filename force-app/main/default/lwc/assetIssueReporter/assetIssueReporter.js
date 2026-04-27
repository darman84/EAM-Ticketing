import { LightningElement, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { loadScript, loadStyle } from "lightning/platformResourceLoader";
import LEAFLET_RES from "@salesforce/resourceUrl/Leaflet";
import createIssueFromJson from "@salesforce/apex/AssetIssueFacade.createIssueWithFilesFromJson";
import pollForTrackingId from "@salesforce/apex/AssetIssueTrackerController.pollForTrackingId";

// Fallback center: Plano, TX
const FALLBACK_CENTER = { lat: 33.0198, lng: -96.6989 };
const FALLBACK_ZOOM = 13;

export default class AssetIssueReporter extends LightningElement {
  @track showForm = true;
  @track showUpload = false;
  @track mapMarkers = [];

  // Client-side form state
  @track form = {
    category: "",
    assetType: "",
    severity: "",
    description: "",
    submitterEmail: ""
  };
  @track filePreviews = [];
  submitting = false;
  trackingId = null;

  // Constants for categories and issues
  ISSUE_CATEGORIES = [
    { label: "Storm Water/Drainage", value: "Storm Water/Drainage" },
    { label: "Streets and Traffic", value: "Streets and Traffic" },
    { label: "Trash & Recycling", value: "Trash & Recycling" },
    {
      label: "Utilities (Water and Sewer)",
      value: "Utilities (Water and Sewer)"
    }
  ];

  ISSUE_TYPES_BY_CATEGORY = {
    "Storm Water/Drainage": [
      {
        label: "Erosion/Creek Maintenance",
        value: "Erosion/Creek Maintenance",
        description:
          "Use this request type to report any erosion or creek maintenance issues."
      },
      {
        label: "Flooding Issues",
        value: "Flooding Issues",
        description: "Use this request type to report any flooding issues."
      },
      {
        label: "Pollutant Discharge into Drainage System",
        value: "Pollutant Discharge into Drainage System",
        description:
          "Unauthorized discharge of detergent, fertilizer, filter backwash, oil, grease, paint, yard waste or chemicals into the stormwater system."
      }
    ],
    "Streets and Traffic": [
      {
        label: "ADA Access Issues",
        value: "ADA Access Issues",
        description:
          "Use this request type to report any Americans with Disabilities Act (ADA) access issues."
      },
      {
        label: "Construction on Streets",
        value: "Construction on Streets",
        description:
          "Use this request type to report any concerns associated with construction on streets."
      },
      {
        label: "Curb Repair",
        value: "Curb Repair",
        description:
          "Use this request type to report any curbs that are in need of repair or maintenance."
      },
      {
        label: "Litter or Debris on Street",
        value: "Litter or Debris on Street",
        description:
          "Report litter or debris that is in street/roadway. If this is an emergency after hours that needs immediate attention, please call Ridgeview Pump Station at 972-727-1623."
      },
      {
        label: "Median/Right Of Way Maintenance",
        value: "Median/Right Of Way Maintenance",
        description:
          "Use this request type to report any medians or public right of way that is in need of maintenance."
      },
      {
        label: "Parking Signage Concerns",
        value: "Parking Signage Concerns",
        description:
          "Use this request type to report any parking signage concerns."
      },
      {
        label: "School Zone Signals",
        value: "School Zone Signals",
        description:
          "Use this request type to report any issues with school zone signals."
      },
      {
        label: "Screening Wall Maintenance",
        value: "Screening Wall Maintenance",
        description:
          "Use this request type to report any screening walls that are in need of repair or maintenance."
      },
      {
        label: "Storm Related Issues",
        value: "Storm Related Issues",
        description:
          "If this is an emergency call 911. Otherwise, use this request type to report any storm-related issues such as flooded street, ice on roadway, tree blocking street, etc."
      },
      {
        label: "Street Sign Issues",
        value: "Street Sign Issues",
        description: "Use this request type to report any street sign issues."
      },
      {
        label: "Traffic Safety",
        value: "Traffic Safety",
        description:
          "Use this to request a study of any Traffic Safety Issues related to signs, markings, or traffic signals. This is NOT to report damaged items."
      },
      {
        label: "Traffic Signal Issues",
        value: "Traffic Signal Issues",
        description:
          "Please call the following numbers to report traffic signal flashing or dark. 7am to 5pm weekdays – 972-769-4160. After hours call 972-727-1623."
      },
      {
        label: "Street Marking Issue",
        value: "Street Marking Issue",
        description:
          "Use this to report any problems with existing street markings, like crosswalks or lane markings."
      },
      {
        label: "Sidewalk Repair Request",
        value: "Sidewalk Repair Request",
        description:
          "Use this request type to report any issues that require sidewalk repair."
      },
      {
        label: "Pothole Report",
        value: "Pothole Report",
        description:
          "Use this request to report any potholes that are in need of repair."
      }
    ],
    "Trash & Recycling": [
      {
        label: "Bulk Waste Violation",
        value: "Bulk Waste Violation",
        description:
          "This includes - out of cycle trash piles, large brush, or bulky waste."
      },
      {
        label: "Cart Replacement - Damaged or Change Size",
        value: "Cart Replacement - Damaged or Change Size",
        description:
          'Report if a trash or recycle cart needs to be replaced because it is damaged or a different size is needed. Please specify "Trash" or "Recycle" or "Both" and what size is needed ("Same" or "Other").'
      },
      {
        label: "Hazardous Waste",
        value: "Hazardous Waste",
        description: "Mercury thermometer or thermostat pick up request"
      },
      {
        label: "Household Hazardous Waste Collection",
        value: "Household Hazardous Waste Collection",
        description: "Schedule Household Chemical Collection"
      },
      {
        label: "Missed Collection",
        value: "Missed Collection",
        description: "Report missed trash or recycle service"
      }
    ],
    "Utilities (Water and Sewer)": [
      {
        label: "Locate Meters",
        value: "Locate Meters",
        description: "Use this request to locate any water meters."
      },
      {
        label: "Sewer Stoppage/Overflow",
        value: "Sewer Stoppage/Overflow",
        description:
          "For large volume of flow please call the numbers below: 7am-5pm weekdays - call 972-769-4160 After hours - call 972-727-1623"
      },
      {
        label: "Water Leaks",
        value: "Water Leaks",
        description:
          "DO NOT ENTER Water Leak information here. Please call the following numbers to report a water leak so that we can promptly respond. 7am-5pm weekdays - call 972-769-4160. After hours - call 972-727-1623."
      },
      {
        label: "Water Meter Boxes/Lids",
        value: "Water Meter Boxes/Lids",
        description:
          "Use this request type to report any issues with a water meter box or a water meter box lid."
      },
      {
        label: "Water Quality",
        value: "Water Quality",
        description: "Use this request type to report any water quality issues."
      },
      {
        label: "Water Shut Off Request (non-emergency)",
        value: "Water Shut Off Request (non-emergency)",
        description:
          "Call 972-769-4160 for emergency shut off during normal business hours (Monday-Friday, 8:00am-5:00pm). Call 972-727-1623 for emergency shut off after normal business hours."
      },
      {
        label: "Fire Hydrant Issue",
        value: "Fire Hydrant Issue",
        description:
          "Use this request type to report any issues with a fire hydrant."
      }
    ]
  };

  get categoryOptions() {
    return this.ISSUE_CATEGORIES;
  }

  get assetTypeOptions() {
    if (
      this.form.category &&
      this.ISSUE_TYPES_BY_CATEGORY[this.form.category]
    ) {
      return this.ISSUE_TYPES_BY_CATEGORY[this.form.category];
    }
    return [];
  }

  get isAssetTypeDisabled() {
    return !this.form.category;
  }

  get selectedIssueDescription() {
    if (this.form.category && this.form.assetType) {
      const options = this.ISSUE_TYPES_BY_CATEGORY[this.form.category];
      const selected = options.find((opt) => opt.value === this.form.assetType);
      return selected ? selected.description : "";
    }
    return "";
  }

  get severityOptions() {
    return [
      { label: "Routine", value: "Routine" },
      { label: "Urgent", value: "Urgent" },
      { label: "Emergency", value: "Emergency" }
    ];
  }

  recordId;
  latitude;
  longitude;

  // Leaflet state
  leafletLoaded = false;
  mapInitialized = false;
  map;

  renderedCallback() {
    if (this.leafletLoaded) {
      // Initialize map if not yet done and container exists
      if (!this.mapInitialized) {
        const container = this.template.querySelector("[data-map]");
        if (container) {
          this.initMap(container);
        }
      }
      return;
    }

    // Load Leaflet JS/CSS once from Static Resource
    // NOTE: Your static resource has a top-level 'dist' folder. Adjust paths accordingly.
    Promise.all([
      loadStyle(this, `${LEAFLET_RES}/dist/leaflet.css`),
      loadScript(this, `${LEAFLET_RES}/dist/leaflet.js`)
    ])
      .then(() => {
        this.leafletLoaded = true;

        // Confirm Leaflet loaded and proceed
        // eslint-disable-next-line no-undef
        const Lref = window.L || (typeof L !== "undefined" ? L : null);
        if (!Lref) {
          this.dispatchEvent(
            new ShowToastEvent({
              title: "Map Error",
              message:
                "Leaflet did not initialize. Static resource may be missing or blocked.",
              variant: "error"
            })
          );
          return;
        }

        // Original Leaflet init handled successfully

        const container = this.template.querySelector("[data-map]");
        if (!container) {
          this.dispatchEvent(
            new ShowToastEvent({
              title: "Map Error",
              message: "Map container not found in DOM.",
              variant: "error"
            })
          );
          return;
        }
        // Delay init slightly to ensure DOM is stable in Experience Builder preview
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
          try {
            if (typeof L === "undefined" && !window.L) {
              this.dispatchEvent(
                new ShowToastEvent({
                  title: "Map Error",
                  message:
                    "Leaflet library not available after load. Static resource may be blocked.",
                  variant: "error"
                })
              );
              return;
            }
            this.initMap(container);
          } catch (err) {
            this.dispatchEvent(
              new ShowToastEvent({
                title: "Map Init Error",
                message:
                  err && err.message
                    ? err.message
                    : "Unknown error initializing map",
                variant: "error"
              })
            );
          }
        }, 100);

        // Ensure controls accessibility set when component finishes rendering
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
          try {
            this.setControlAria();
            // eslint-disable-next-line no-unused-vars
          } catch (e) {
            // ignore
          }
        }, 300);
      })
      .catch((err) => {
        const msg =
          err && err.message
            ? err.message
            : "Failed to load map library from static resource.";
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Map Load Error",
            message: msg,
            variant: "error"
          })
        );
      });
  }

  initMap(container) {
    // Center-set placement pattern using lightning-map-safe interactions only.
    // We will avoid third-party pan/drag handling under Lightning Web Security
    // by disabling Leaflet dragging and double-click zoom, and using a "Set Pin at Center" action.
    container.style.height = "320px";

    // eslint-disable-next-line no-undef
    this.map = L.map(container, {
      preferCanvas: true,
      zoomControl: true,
      attributionControl: false,
      keyboard: false,
      // Re-enable dragging safely; keep other potentially problematic features disabled
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      // Disable dragging by default because Lightning Web Security restricts rangeParent access during Leaflet's drag event selection clearing
      dragging: false,
      tap: false,
      inertia: false
    }).setView(
      [
        this.latitude ?? FALLBACK_CENTER.lat,
        this.longitude ?? FALLBACK_CENTER.lng
      ],
      FALLBACK_ZOOM
    );

    // Use retina-aware tiles when devicePixelRatio > 1 to improve sharpness on high-DPI displays.
    // OpenStreetMap tile servers support @2x tiles via the 'tileLayer' URL pattern used below from providers that offer retina tiles.
    // We'll compute the appropriate tile URL and tileSize based on devicePixelRatio.
    const isRetina = window.devicePixelRatio && window.devicePixelRatio > 1;
    const tileUrl = isRetina
      ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" // fallback if provider doesn't have @2x; alternative providers may be used
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const tileOptions = {
      subdomains: ["a", "b", "c"],
      maxZoom: 19
    };

    // For providers that offer retina tiles via @2x, Leaflet supports detectRetina option.
    // We'll use detectRetina which requests higher-res tiles when available and adjusts tileSize internally.
    tileOptions.detectRetina = true;

    // eslint-disable-next-line no-undef
    L.tileLayer(tileUrl, tileOptions).addTo(this.map);

    // Ensure map center is accurate after initial render and expose a programmatic center getter
    try {
      // Trigger a size invalidation and small pan to force internal center calculation in Leaflet
      this.map.invalidateSize();
      const cur = this.map.getCenter && this.map.getCenter();
      if (cur && typeof cur.lat === "number" && typeof cur.lng === "number") {
        // no-op; center available
      }
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // swallow errors
    }

    // Add a subtle crosshair overlay via CSS class (handled in HTML template container)
    // and rely on a button to commit the center as the pin.
    // Implement Canvas-based marker layer to avoid Leaflet image/icon pipeline which Experience Cloud rewrites.
    const comp = this;

    // Create a lightweight canvas overlay for markers and helper to draw a circle marker
    // eslint-disable-next-line no-undef
    this.canvasLayer = L.layerGroup().addTo(this.map);

    // LWS-safe pin: two stacked circleMarkers via Leaflet's internal Canvas
    // renderer (preferCanvas: true). L.divIcon/L.marker are avoided because
    // they rely on el.innerHTML which LWS sandboxes and silently discards.
    this.drawPinMarker = (lat, lng) => {
      // Remove any previous pin markers
      if (this.canvasMarker) {
        try {
          this.canvasLayer.removeLayer(this.canvasMarker);
          // eslint-disable-next-line no-unused-vars
        } catch (e) {
          // ignore
        }
        this.canvasMarker = null;
      }
      if (this._innerPinMarker) {
        try {
          this.canvasLayer.removeLayer(this._innerPinMarker);
          // eslint-disable-next-line no-unused-vars
        } catch (e) {
          // ignore
        }
        this._innerPinMarker = null;
      }
      // Outer: bold red filled circle with white border
      // eslint-disable-next-line no-undef
      this.canvasMarker = L.circleMarker([lat, lng], {
        radius: 12,
        color: "#ffffff",
        weight: 2.5,
        fillColor: "#dc3545",
        fillOpacity: 1,
        interactive: false
      }).addTo(this.canvasLayer);
      // Inner: small white dot for pin "eye" contrast
      // eslint-disable-next-line no-undef
      this._innerPinMarker = L.circleMarker([lat, lng], {
        radius: 4,
        color: "transparent",
        weight: 0,
        fillColor: "#ffffff",
        fillOpacity: 0.9,
        interactive: false
      }).addTo(this.canvasLayer);
    };
    // Alias kept for any remaining call-sites
    this.drawCanvasMarker = this.drawPinMarker;

    // Track pointer start to distinguish intentional clicks from drags
    let startX = 0,
      startY = 0;
    let isDraggingMap = false;
    let lastPanX = 0,
      lastPanY = 0;

    const handleDown = (e) => {
      // Ignore multi-touch for custom simple pan
      if (e.touches && e.touches.length > 1) return;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;
      lastPanX = clientX;
      lastPanY = clientY;
      isDraggingMap = true;
    };

    const handleMove = (e) => {
      if (!isDraggingMap || !comp.map) return;

      e.preventDefault(); // Prevent native browser scrolling/selection
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const dx = clientX - lastPanX;
      const dy = clientY - lastPanY;

      if (dx !== 0 || dy !== 0) {
        // Pan by delta pixels smoothly
        comp.map.panBy([-dx, -dy], { animate: false });
      }

      lastPanX = clientX;
      lastPanY = clientY;
    };

    const handleUp = () => {
      isDraggingMap = false;
    };

    // Attach custom drag listeners to bypass Leaflet's crashing native LWS selection hooks
    // Bind exclusively to container rather than global window/document to ensure strict LWS compliance
    container.addEventListener("mousedown", handleDown);
    container.addEventListener("mousemove", handleMove);
    container.addEventListener("mouseup", handleUp);
    container.addEventListener("mouseleave", handleUp);

    container.addEventListener("touchstart", handleDown);
    container.addEventListener("touchmove", handleMove);
    container.addEventListener("touchend", handleUp);
    container.addEventListener("touchcancel", handleUp);

    // Click-to-place: draw canvas marker and update state
    // Use native DOM event to bypass LWS dropping Leaflet synthetic clicks
    container.addEventListener("click", function (e) {
      // If mouse moved more than 4 pixels, consider it a drag/pan, not a click
      const dx = Math.abs((e.clientX || 0) - startX);
      const dy = Math.abs((e.clientY || 0) - startY);
      if (dx > 4 || dy > 4) {
        return;
      }

      try {
        if (!comp.map || !comp.map.mouseEventToLatLng) return;
        const latlng = comp.map.mouseEventToLatLng(e);
        if (latlng) {
          comp.drawCanvasMarker(latlng.lat, latlng.lng);
          comp.applyLocation(latlng.lat, latlng.lng);
        }
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        // Ignore unexpected map projection errors
      }
    });

    // Initialize existing lat/lng if present
    if (this.latitude && this.longitude) {
      this.setMarker(this.latitude, this.longitude, false);
      this.map.setView([this.latitude, this.longitude], FALLBACK_ZOOM);
    }

    // Force Leaflet to recalculate pixel ratios and request correct-resolution tiles
    try {
      // try immediate invalidation with true to force re-render and detect DPR scaling issues
      this.map.invalidateSize(true);
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      try {
        this.map.invalidateSize();
        // eslint-disable-next-line no-unused-vars
      } catch (e2) {
        // ignore
      }
    }

    // Re-run invalidateSize on window resize/orientationchange with debounce
    let resizeTimeout = null;
    const onResize = () => {
      try {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        resizeTimeout = setTimeout(() => {
          try {
            if (this.map) this.map.invalidateSize(true);
            // eslint-disable-next-line no-unused-vars
          } catch (e) {
            // ignore
          }
        }, 250);
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    this.mapInitialized = true;
  }

  // Legacy image-based marker removed. Use canvas-based drawCanvasMarker everywhere.
  setMarker(lat, lng, fromUserInteraction = false) {
    try {
      // Draw the premium pin marker
      if (typeof this.drawPinMarker === "function") {
        this.drawPinMarker(lat, lng);
      }
      this.applyLocation(lat, lng);
      if (fromUserInteraction) {
        try {
          this.map.setView([lat, lng], this.map.getZoom() || FALLBACK_ZOOM, {
            animate: true
          });
          // eslint-disable-next-line no-unused-vars
        } catch (e) {
          // no-op
        }
      }
      // eslint-disable-next-line no-unused-vars
    } catch (err) {
      // Fallback: still set location state even if drawing fails
      this.applyLocation(lat, lng);
    }
  }

  applyLocation(lat, lng) {
    this.latitude = lat;
    this.longitude = lng;
    this.mapMarkers = [
      {
        location: { Latitude: this.latitude, Longitude: this.longitude },
        title: "Reported Location"
      }
    ];
  }

  // Grab hardware GPS coordinates and place/move the Leaflet marker
  getLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          // If map is not ready yet, just store and map will use fallback; else set marker
          if (this.map) {
            this.setMarker(lat, lng, true);
            this.map.setView([lat, lng], FALLBACK_ZOOM);
          } else {
            this.latitude = lat;
            this.longitude = lng;
            this.mapMarkers = [
              {
                location: { Latitude: lat, Longitude: lng },
                title: "Reported Location"
              }
            ];
          }
        },
        () => {
          this.dispatchEvent(
            new ShowToastEvent({
              title: "Location Error",
              message: "Please enable location services.",
              variant: "warning"
            })
          );
        }
      );
    } else {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Location Error",
          message: "Geolocation is not supported by this browser.",
          variant: "warning"
        })
      );
    }
  }

  clearPin() {
    if (this.canvasMarker && this.canvasLayer) {
      try {
        this.canvasLayer.removeLayer(this.canvasMarker);
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        // no-op
      }
    }
    if (this._innerPinMarker && this.canvasLayer) {
      try {
        this.canvasLayer.removeLayer(this._innerPinMarker);
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        // no-op
      }
    }
    this.canvasMarker = null;
    this._innerPinMarker = null;

    this.latitude = null;
    this.longitude = null;
    this.mapMarkers = [];
    if (this.map) {
      try {
        this.map.setView(
          [FALLBACK_CENTER.lat, FALLBACK_CENTER.lng],
          FALLBACK_ZOOM
        );
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        // ignore
      }
    }
  }

  // New helper: set pin at current map center (avoids direct pan/drag paths)
  setPinAtCenter() {
    try {
      if (!this.map) {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Map Status",
            message: "Map not initialized yet.",
            variant: "warning"
          })
        );
        return;
      }
      // Ensure map is ready and has getCenter
      const center =
        typeof this.map.getCenter === "function" ? this.map.getCenter() : null;
      if (
        center &&
        typeof center.lat === "number" &&
        typeof center.lng === "number"
      ) {
        // Draw premium pin marker at center and update state
        this.drawPinMarker(center.lat, center.lng);
        this.applyLocation(center.lat, center.lng);
        const msg = `Marker placed at center (${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}).`;
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Map Status",
            message: msg,
            variant: "success"
          })
        );
      } else {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Map Error",
            message: "Map not ready yet. Please try again in a moment.",
            variant: "warning"
          })
        );
      }
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Map Error",
          message: "Unexpected error while placing pin.",
          variant: "error"
        })
      );
    }
  }

  // Zoom and drag toggle controls for both desktop and mobile
  zoomIn() {
    try {
      if (this.map) this.map.setZoom((this.map.getZoom() || FALLBACK_ZOOM) + 1);
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // ignore
    }
  }
  zoomOut() {
    try {
      if (this.map) this.map.setZoom((this.map.getZoom() || FALLBACK_ZOOM) - 1);
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // ignore
    }
  }

  // Accessibility helpers: add ARIA labels to controls for screen readers (no DOM changes here; buttons already have titles/alternative-text)
  setControlAria() {
    try {
      const controls = this.template.querySelectorAll(
        ".action-bar lightning-button, .action-bar lightning-button-icon"
      );
      controls.forEach((btn) => {
        try {
          // ensure accessible name
          const label =
            btn.label ||
            btn.title ||
            btn.getAttribute("title") ||
            "Map control";
          btn.setAttribute("aria-label", label);
          // eslint-disable-next-line no-unused-vars
        } catch (e) {
          // ignore
        }
      });
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // ignore
    }
  }

  // Form input handlers (normalize/trim values)
  onFieldChange = (e) => {
    const { name } = e.target;
    // Some base components (combobox) put value on event.detail.value; prefer that when present
    let raw =
      e && e.detail && typeof e.detail.value !== "undefined"
        ? e.detail.value
        : e && e.target && typeof e.target.value !== "undefined"
          ? e.target.value
          : null;
    let val = typeof raw === "string" ? raw.trim() : raw;
    if (name in this.form) {
      // keep empty string for UI binding; optional fields coerced to null on submit
      this.form = { ...this.form, [name]: val || "" };
    }
  };

  // Handle file selection and preview — appends to existing list (no full replace)
  onFilesSelected = async (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    const MAX_FILES = 5;
    // Determine how many slots remain
    const remaining = MAX_FILES - this.filePreviews.length;
    if (remaining <= 0) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "File Limit Reached",
          message: `You can upload a maximum of ${MAX_FILES} photos. Remove a file to add another.`,
          variant: "warning"
        })
      );
      return;
    }

    // Filter out files already in the list (by name) and cap to remaining slots
    const existingNames = new Set(this.filePreviews.map((fp) => fp.name));
    const incoming = files
      .filter((f) => !existingNames.has(f.name))
      .slice(0, remaining);

    if (!incoming.length) return;

    // Warn if selection had to be trimmed to fit the remaining slots
    if (incoming.length > remaining) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "File Limit Reached",
          message: `You can upload a maximum of ${MAX_FILES} photos. Only the first ${remaining} file(s) were added.`,
          variant: "warning"
        })
      );
    }

    const newPreviews = await Promise.all(
      incoming.map(async (f) => {
        const base64 = await this.readFileAsBase64(f);
        return {
          name: f.name,
          type: f.type,
          size: f.size,
          sizeLabel: this.humanSize(f.size),
          base64
        };
      })
    );
    // Append new previews; freeze reference to trigger reactive re-render
    this.filePreviews = [...this.filePreviews, ...newPreviews];
  };

  // Remove a single file from the list by name
  removeFile = (e) => {
    const nameToRemove = e.currentTarget.dataset.name;
    this.filePreviews = this.filePreviews.filter(
      (fp) => fp.name !== nameToRemove
    );
  };

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          resolve(result); // may include data:*;base64, prefix; Apex strips if present
        } else {
          reject(new Error("Unexpected file read result"));
        }
      };
      reader.readAsDataURL(file);
    });
  }

  humanSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    const thresh = 1024;
    if (bytes < thresh) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while (bytes >= thresh && u < units.length - 1);
    return `${bytes.toFixed(1)} ${units[u]}`;
  }

  async submitIssue() {
    // Read values using detail-aware getter
    const getVal = (k) => {
      const v =
        this.form && Object.prototype.hasOwnProperty.call(this.form, k)
          ? this.form[k]
          : "";
      return typeof v === "string" ? v.trim() : (v ?? "");
    };
    const assetType = getVal("assetType");
    const severity = getVal("severity");
    const description = getVal("description");

    if (!assetType || !severity || !description) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Error",
          message:
            "Please complete all required fields: Asset Type, Severity, and Description.",
          variant: "error"
        })
      );
      return;
    }

    this.submitting = true;
    try {
      // Assemble a plain data object
      const files = Array.isArray(this.filePreviews)
        ? this.filePreviews.map((fp) => ({
            fileName: fp?.name || "",
            contentType: fp?.type || "",
            base64Data: fp?.base64 || ""
          }))
        : [];

      const req = {
        assetType,
        severity,
        description,
        latitude: typeof this.latitude === "number" ? this.latitude : null,
        longitude: typeof this.longitude === "number" ? this.longitude : null,
        submitterEmail: (() => {
          const s =
            this.form && typeof this.form.submitterEmail === "string"
              ? this.form.submitterEmail.trim()
              : "";
          return s || null;
        })(),
        files
      };

      // Hard-coerce to a fully plain object by reconstructing via object spread on JSON clone
      const liveReq = { ...JSON.parse(JSON.stringify(req)) };

      // Call the JSON-string overload to bypass any Experience Cloud proxy serialization
      const reqJson = JSON.stringify(liveReq);
      const res = await createIssueFromJson({ reqJson });

      if (res && res.success) {
        this.recordId = res.issueId;

        // Wait for async backend integration to generate Tracking ID
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          attempts++;
          // eslint-disable-next-line @lwc/lwc/no-async-operation, no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 1000));
          try {
            // eslint-disable-next-line no-await-in-loop
            const polledId = await pollForTrackingId({
              recordId: this.recordId
            });
            if (polledId) {
              this.trackingId = polledId;
              break;
            }
            // eslint-disable-next-line no-unused-vars
          } catch (pollErr) {
            // ignore
          }
        }

        this.showForm = false;
        this.showUpload = true;
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Success",
            message: "Issue Logged!",
            variant: "success"
          })
        );
      } else {
        const msg = res && res.message ? res.message : "Submission failed.";
        this.dispatchEvent(
          new ShowToastEvent({ title: "Error", message: msg, variant: "error" })
        );
      }
    } catch (err) {
      let msg = "Submission failed.";
      try {
        msg = err?.body?.message || err?.message || msg;
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        /* ignore */
      }
      this.dispatchEvent(
        new ShowToastEvent({ title: "Error", message: msg, variant: "error" })
      );
    } finally {
      this.submitting = false;
    }
  }

  resetWizard() {
    this.dispatchEvent(
      new ShowToastEvent({
        title: "Complete",
        message: "Thank you for your report.",
        variant: "success"
      })
    );
    this.showUpload = false;
    this.recordId = null;
    this.mapMarkers = [];
    this.latitude = null;
    this.longitude = null;
    this.canvasMarker = null;
    this._innerPinMarker = null;
    this.drawPinMarker = null;
    this.mapInitialized = false;
    this.map = null;
    this.filePreviews = [];
    this.trackingId = null;
    this.form = {
      assetType: "",
      severity: "",
      description: "",
      submitterEmail: ""
    };
    this.showForm = true; // Return to start
  }
}
