import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import LEAFLET_RES from '@salesforce/resourceUrl/Leaflet';

// Fallback center: Plano, TX
const FALLBACK_CENTER = { lat: 33.0198, lng: -96.6989 };
const FALLBACK_ZOOM = 13;

export default class AssetIssueReporter extends LightningElement {
    @track showForm = true;
    @track showUpload = false;
    @track mapMarkers = [];

    recordId;
    latitude;
    longitude;

    // Leaflet state
    leafletLoaded = false;
    mapInitialized = false;
    map;
    marker;

    renderedCallback() {
        if (this.leafletLoaded) {
            // Initialize map if not yet done and container exists
            if (!this.mapInitialized) {
                const container = this.template.querySelector('[data-map]');
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
                const Lref = window.L || (typeof L !== 'undefined' ? L : null);
                if (!Lref) {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Map Error',
                            message: 'Leaflet did not initialize. Static resource may be missing or blocked.',
                            variant: 'error'
                        })
                    );
                    return;
                }

                const container = this.template.querySelector('[data-map]');
                if (!container) {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Map Error',
                            message: 'Map container not found in DOM.',
                            variant: 'error'
                        })
                    );
                    return;
                }
                // Delay init slightly to ensure DOM is stable in Experience Builder preview
                setTimeout(() => {
                    try {
                        // eslint-disable-next-line no-undef
                        if (typeof L === 'undefined' && !window.L) {
                            this.dispatchEvent(
                                new ShowToastEvent({
                                    title: 'Map Error',
                                    message: 'Leaflet library not available after load. Static resource may be blocked.',
                                    variant: 'error'
                                })
                            );
                            return;
                        }
                        this.initMap(container);
                    } catch (err) {
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Map Init Error',
                                message: err && err.message ? err.message : 'Unknown error initializing map',
                                variant: 'error'
                            })
                        );
                    }
                }, 100);

                // Ensure controls accessibility set when component finishes rendering
                setTimeout(() => {
                    try {
                        this.setControlAria();
                    } catch (e) {
                        // ignore
                    }
                }, 300);
            })
            .catch((err) => {
                const msg = err && err.message ? err.message : 'Failed to load map library from static resource.';
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Map Load Error',
                        message: msg,
                        variant: 'error'
                    })
                );
            });
    }

    initMap(container) {
        // Center-set placement pattern using lightning-map-safe interactions only.
        // We will avoid third-party pan/drag handling under Lightning Web Security
        // by disabling Leaflet dragging and double-click zoom, and using a "Set Pin at Center" action.
        container.style.height = '320px';

        // eslint-disable-next-line no-undef
        this.map = L.map(container, {
            zoomControl: true,
            attributionControl: false,
            keyboard: false,
            // Re-enable dragging safely; keep other potentially problematic features disabled
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            dragging: true,
            tap: false,
            inertia: false
        }).setView(
            [this.latitude ?? FALLBACK_CENTER.lat, this.longitude ?? FALLBACK_CENTER.lng],
            FALLBACK_ZOOM
        );

        // eslint-disable-next-line no-undef
        // Use retina-aware tiles when devicePixelRatio > 1 to improve sharpness on high-DPI displays.
        // OpenStreetMap tile servers support @2x tiles via the 'tileLayer' URL pattern used below from providers that offer retina tiles.
        // We'll compute the appropriate tile URL and tileSize based on devicePixelRatio.
        const isRetina = (window.devicePixelRatio && window.devicePixelRatio > 1);
        const tileUrl = isRetina
            ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' // fallback if provider doesn't have @2x; alternative providers may be used
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        const tileOptions = {
            subdomains: ['a', 'b', 'c'],
            maxZoom: 19
        };

        // For providers that offer retina tiles via @2x, Leaflet supports detectRetina option.
        // We'll use detectRetina which requests higher-res tiles when available and adjusts tileSize internally.
        tileOptions.detectRetina = true;

        L.tileLayer(tileUrl, tileOptions).addTo(this.map);

        // Ensure map center is accurate after initial render and expose a programmatic center getter
        try {
            // Trigger a size invalidation and small pan to force internal center calculation in Leaflet
            this.map.invalidateSize();
            const cur = this.map.getCenter && this.map.getCenter();
            if (cur && typeof cur.lat === 'number' && typeof cur.lng === 'number') {
                // no-op; center available
            }
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

        this.drawCanvasMarker = (lat, lng) => {
            // Remove any previous circle marker
            if (this.canvasMarker) {
                try {
                    this.canvasLayer.removeLayer(this.canvasMarker);
                } catch (e) {
                    // ignore
                }
                this.canvasMarker = null;
            }
            // eslint-disable-next-line no-undef
            const circle = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#1b96ff',
                weight: 2,
                fillColor: '#1b96ff',
                fillOpacity: 0.9,
                interactive: false
            });
            this.canvasMarker = circle.addTo(this.canvasLayer);
        };

        // Click-to-place: draw canvas marker and update state
        this.map.on('click', function (e) {
            if (!e || !e.latlng) return;
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            comp.drawCanvasMarker(lat, lng);
            comp.applyLocation(lat, lng);
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
        } catch (e) {
            try {
                this.map.invalidateSize();
            } catch (e2) {
                // ignore
            }
        }

        // Re-run invalidateSize on window resize/orientationchange with debounce
        let resizeTimeout = null;
        const onResize = () => {
            try {
                if (resizeTimeout) clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    try {
                        if (this.map) this.map.invalidateSize(true);
                    } catch (e) {
                        // ignore
                    }
                }, 250);
            } catch (e) {
                // ignore
            }
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        this.mapInitialized = true;
    }

    // Legacy image-based marker removed. Use canvas-based drawCanvasMarker everywhere.
    setMarker(lat, lng, fromUserInteraction = false) {
        try {
            // Remove any legacy marker if present
            if (this.marker && this.map) {
                try {
                    this.map.removeLayer(this.marker);
                } catch (e) {
                    // no-op
                }
                this.marker = null;
            }
            // Draw the canvas marker instead
            if (typeof this.drawCanvasMarker === 'function') {
                this.drawCanvasMarker(lat, lng);
            }
            this.applyLocation(lat, lng);
            if (fromUserInteraction) {
                try {
                    this.map.setView([lat, lng], this.map.getZoom() || FALLBACK_ZOOM, { animate: true });
                } catch (e) {
                    // no-op
                }
            }
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
                title: 'Reported Location'
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
                                title: 'Reported Location'
                            }
                        ];
                    }
                },
                () => {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Location Error',
                            message: 'Please enable location services.',
                            variant: 'warning'
                        })
                    );
                }
            );
        } else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Location Error',
                    message: 'Geolocation is not supported by this browser.',
                    variant: 'warning'
                })
            );
        }
    }

    clearPin() {
        if (this.marker && this.map) {
            try {
                this.map.removeLayer(this.marker);
            } catch (e) {
                // no-op
            }
        }
        this.marker = null;
        this.latitude = null;
        this.longitude = null;
        this.mapMarkers = [];
        if (this.map) {
            try {
                this.map.setView([FALLBACK_CENTER.lat, FALLBACK_CENTER.lng], FALLBACK_ZOOM);
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
                        title: 'Map Status',
                        message: 'Map not initialized yet.',
                        variant: 'warning'
                    })
                );
                return;
            }
            // Ensure map is ready and has getCenter
            const center = typeof this.map.getCenter === 'function' ? this.map.getCenter() : null;
            if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
                // Draw canvas-based marker at center and update state
                this.drawCanvasMarker(center.lat, center.lng);
                this.applyLocation(center.lat, center.lng);
                const msg = `Marker placed at center (${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}).`;
                this.dispatchEvent(new ShowToastEvent({ title: 'Map Status', message: msg, variant: 'success' }));
            } else {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Map Error',
                        message: 'Map not ready yet. Please try again in a moment.',
                        variant: 'warning'
                    })
                );
            }
        } catch (e) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Map Error',
                    message: 'Unexpected error while placing pin.',
                    variant: 'error'
                })
            );
        }
    }

    // Zoom and drag toggle controls for both desktop and mobile
    zoomIn() {
        try {
            if (this.map) this.map.setZoom((this.map.getZoom() || FALLBACK_ZOOM) + 1);
        } catch (e) {
            // ignore
        }
    }
    zoomOut() {
        try {
            if (this.map) this.map.setZoom((this.map.getZoom() || FALLBACK_ZOOM) - 1);
        } catch (e) {
            // ignore
        }
    }

    toggleDrag() {
        try {
            if (!this.map) return;
            const enabled = this.map.options.dragging;
            if (enabled) {
                this.map.dragging.disable();
            } else {
                this.map.dragging.enable();
            }
            this.dispatchEvent(new ShowToastEvent({ title: 'Map', message: `Dragging ${enabled ? 'disabled' : 'enabled'}`, variant: 'info' }));
        } catch (e) {
            // no-op
        }
    }

    // Accessibility helpers: add ARIA labels to controls for screen readers (no DOM changes here; buttons already have titles/alternative-text)
    setControlAria() {
        try {
            const controls = this.template.querySelectorAll('.map-controls lightning-button');
            controls.forEach((btn) => {
                try {
                    // ensure accessible name
                    const label = btn.label || btn.title || btn.getAttribute('title') || 'Map control';
                    btn.setAttribute('aria-label', label);
                } catch (e) {
                    // ignore
                }
            });
        } catch (e) {
            // ignore
        }
    }

    handleSubmit(event) {
        event.preventDefault();
        const fields = event.detail.fields;

        // Custom Validation
        if (!fields.Asset_Type__c || !fields.Severity__c || !fields.Description__c) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Please fill out all required fields.',
                    variant: 'error'
                })
            );
            return;
        }

        // Inject selected coordinates into the Salesforce fields before saving
        if (this.latitude != null && this.longitude != null) {
            fields.Location__Latitude__s = this.latitude;
            fields.Location__Longitude__s = this.longitude;
        }

        this.template.querySelector('lightning-record-edit-form').submit(fields);
    }

    handleSuccess(event) {
        this.recordId = event.detail.id;
        this.showForm = false;
        this.showUpload = true; // Transition to Step 2
        this.dispatchEvent(new ShowToastEvent({ title: 'Success', message: 'Issue Logged!', variant: 'success' }));
    }

    handleUploadFinished(event) {
        const uploadedFiles = event.detail.files.length;
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: `${uploadedFiles} photo(s) attached.`,
                variant: 'success'
            })
        );
    }

    handleError(event) {
        // Surface record save errors in Experience Cloud to diagnose missing permissions/FLS/validation rules
        let message = 'Save failed.';
        try {
            if (event?.detail?.message) {
                message = event.detail.message;
            } else if (event?.detail?.output?.errors?.length) {
                message = event.detail.output.errors.map((e) => e.message).join(' ');
            } else if (event?.detail?.output?.fieldErrors) {
                const fieldMsgs = Object.values(event.detail.output.fieldErrors)
                    .flat()
                    .map((e) => e.message);
                if (fieldMsgs.length) message = fieldMsgs.join(' ');
            }
        } catch (e) {
            // no-op, keep default message
        }
        this.dispatchEvent(new ShowToastEvent({ title: 'Error', message, variant: 'error' }));
    }

    resetWizard() {
        this.dispatchEvent(
            new ShowToastEvent({ title: 'Complete', message: 'Thank you for your report.', variant: 'success' })
        );
        this.showUpload = false;
        this.recordId = null;
        this.mapMarkers = [];
        this.latitude = null;
        this.longitude = null;
        this.marker = null;
        this.showForm = true; // Return to start
    }
}
