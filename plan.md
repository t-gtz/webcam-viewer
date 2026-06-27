# 3D Globe Toggle — Implementation Plan

This plan details how to add a 3D Globe view (using `globe.gl` and `supercluster`) alongside the existing Leaflet flat map, allowing users to toggle between them. It is tailored to fit the current architecture of the **Webcam Viewer** project.

---

## Current Project Context & Key Integration Insights

1. **Monolithic Styling (`src/App.css`)**:
   The project does not use CSS modules or CSS-in-JS. All rules, including `.pulse-marker` and `.custom-cluster-icon`, live in `src/App.css`. Rather than introducing a new styles directory, we will keep and extend the marker/toggle styles directly in `src/App.css` to preserve the project's current styling pattern.

2. **Map Unmounting Problem**:
   In `src/App.jsx`, the map view is unmounted when a webcam is selected (`selectedWebcam ? <VideoPlayer /> : <MapComponent />`). This causes the Leaflet map to reset its zoom/center every time a user goes back to the map.
   **Solution**: We will change `src/App.jsx` to toggle visibility via a `.hidden` CSS class instead of unmounting the map. This keeps both the Leaflet and Globe map instances alive, preserving zoom levels, centering, and allowing Globe.gl's "fly-to" camera transitions to function properly when selecting webcams.

3. **Cluster Classes Alignment**:
   `src/App.css` already styles `.custom-cluster-icon` with tiers (`.small` 36px, `.medium` 46px, `.large` 64px). We will update the plan to use `.custom-cluster-icon` for both Leaflet and Globe.gl, ensuring 100% identical styling.

---

## File overview

We will organize the code using existing conventions and standard directories:

```
src/
├── components/
│   ├── LeafletMap.jsx        rename from MapComponent.jsx — no logic changes, uses shared utils
│   ├── GlobeMap.jsx          new — 3D Globe view
│   └── MapToggle.jsx         new — premium Sci-Fi theme mode toggle
├── hooks/
│   └── useSupercluster.js    new — cluster hook for globe view
├── utils/
│   └── markerUtils.js        new — shared DOM elements factory for markers/clusters
└── App.css                   modified — added toggle styles & unified cluster styles
```

---

## Phase 1 — Consolidate CSS in `src/App.css`

Open `src/App.css` and verify that the pulse marker styles exist. Add support for `.custom-cluster-icon` and define the floating `MapToggle` layout:

```css
/* Add to src/App.css */

/* Unified Cluster styling for Leaflet and Globe */
.custom-cluster-icon, .cluster-icon {
  background: linear-gradient(135deg, var(--accent), #7afcff);
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  color: white;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
}
.custom-cluster-icon.small, .cluster-icon.small { width: 36px; height: 36px; font-size: 12px; }
.custom-cluster-icon.medium, .cluster-icon.medium { width: 46px; height: 46px; font-size: 14px; }
.custom-cluster-icon.large, .cluster-icon.large { width: 64px; height: 64px; font-size: 16px; }

/* Hide utility to prevent map unmounting */
.hidden {
  display: none !important;
}

/* Glassmorphic Sci-Fi Map Toggle */
.map-toggle-container {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  background: rgba(10, 20, 40, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 217, 255, 0.3);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 20px rgba(0, 217, 255, 0.15);
}

.map-toggle-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-toggle-btn.active {
  background: var(--accent);
  color: var(--primary-dark);
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.4);
}

.map-toggle-btn:hover:not(.active) {
  color: white;
  background: rgba(255, 255, 255, 0.08);
}
```

---

## Phase 2 — Build `src/utils/markerUtils.js`

This utility provides unified DOM element creators.

```js
/**
 * Returns a .pulse-marker div ready to place on either Leaflet or Globe.
 * Caller must attach click listener.
 */
export function buildMarkerEl(cam, { isFav = false, isSelected = false } = {}) {
  const el = document.createElement('div');
  el.className = [
    'pulse-marker',
    cam.is_active ? 'online' : 'offline',
    isFav      ? 'fav'      : '',
    isSelected ? 'selected' : '',
  ].filter(Boolean).join(' ');
  
  el.innerHTML = '<span class="dot"></span><span class="pulse"></span>';
  el.title = cam.name;
  el.style.cursor = 'pointer';
  el.style.pointerEvents = 'auto';
  return el;
}

/**
 * Returns a .custom-cluster-icon div ready to place on either Leaflet or Globe.
 * Caller must attach click listener.
 */
export function buildClusterEl(pointCount) {
  const size =
    pointCount < 10  ? 'small'  :
    pointCount < 100 ? 'medium' : 'large';
  const el = document.createElement('div');
  el.className = `custom-cluster-icon ${size}`;
  el.textContent = pointCount;
  el.title = `${pointCount} webcams — click to zoom in`;
  el.style.cursor = 'pointer';
  el.style.pointerEvents = 'auto';
  return el;
}
```

---

## Phase 3 — Build `src/hooks/useSupercluster.js`

Manages Supercluster index calculations for GlobeMap.

```js
import { useRef, useEffect, useCallback } from 'react';
import Supercluster from 'supercluster';

export function useSupercluster(webcams) {
  const scRef = useRef(null);

  useEffect(() => {
    if (!webcams?.length) return;
    scRef.current = new Supercluster({ radius: 60, maxZoom: 14 });
    scRef.current.load(
      webcams.map(cam => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [cam.longitude, cam.latitude] },
        properties: { cam },
      }))
    );
  }, [webcams]);

  const getClusters = useCallback((zoom) => {
    if (!scRef.current) return [];
    return scRef.current.getClusters([-180, -85, 180, 85], zoom);
  }, []);

  const getExpansionZoom = useCallback((clusterId) =>
    Math.min(scRef.current?.getClusterExpansionZoom(clusterId) ?? 14, 14),
  []);

  return { getClusters, getExpansionZoom };
}
```

---

## Phase 4 — Build `src/components/GlobeMap.jsx`

Uses `globe.gl` library to render the interactive globe. To ensure it fits the Sci-Fi theme, we use a dark globe texture with a neon-blue atmosphere.

```jsx
import React, { useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import { useSupercluster } from '../hooks/useSupercluster';
import { buildMarkerEl, buildClusterEl } from '../utils/markerUtils';

// Globe altitude ↔ zoom helpers
const altToZoom = (alt) =>
  Math.max(1, Math.min(14, Math.round(-Math.log2(Math.max(alt, 0.001)) + 5)));

const zoomToAlt = (zoom) =>
  Math.max(0.02, Math.pow(2, 5 - zoom));

export default function GlobeMap({ webcams, onMarkerClick, selectedWebcam, favorites }) {
  const containerRef = useRef(null);
  const globeInstanceRef = useRef(null);
  
  const { getClusters, getExpansionZoom } = useSupercluster(webcams);

  const onMarkerClickRef = useRef(onMarkerClick);
  const favoritesRef = useRef(favorites);
  const selectedRef = useRef(selectedWebcam);
  const updateMarkersRef = useRef(null);

  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);
  useEffect(() => { selectedRef.current = selectedWebcam; }, [selectedWebcam]);

  // Update HTML elements (markers & clusters) on the globe
  const updateMarkers = () => {
    const globe = globeInstanceRef.current;
    if (!globe) return;

    const zoom = altToZoom(globe.pointOfView().altitude);
    const points = getClusters(zoom);

    globe
      .htmlElementsData(points)
      .htmlLat(f => f.geometry.coordinates[1])
      .htmlLng(f => f.geometry.coordinates[0])
      .htmlAltitude(0.002)
      .htmlElement(f => {
        if (f.properties.cluster) {
          const el = buildClusterEl(f.properties.point_count);
          el.addEventListener('click', () => {
            const targetZoom = getExpansionZoom(f.properties.cluster_id);
            const [lng, lat] = f.geometry.coordinates;
            requestAnimationFrame(() =>
              globe.pointOfView({ lat, lng, altitude: zoomToAlt(targetZoom) }, 800)
            );
          });
          return el;
        }

        const cam = f.properties.cam;
        const el = buildMarkerEl(cam, {
          isFav: favoritesRef.current.has(cam.id),
          isSelected: selectedRef.current?.id === cam.id,
        });
        el.addEventListener('click', () => onMarkerClickRef.current(cam));
        return el;
      });
  };

  updateMarkersRef.current = updateMarkers;

  // Initialize Globe
  useEffect(() => {
    if (!containerRef.current) return;

    const globe = Globe()(containerRef.current)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundColor('rgba(0, 0, 0, 0)')
      .showAtmosphere(true)
      .atmosphereColor('#00d9ff') // Matching project's --accent color
      .atmospherePowerOf(3.5);

    globeInstanceRef.current = globe;

    // Trigger update on camera movement
    globe.onZoom(() => {
      if (updateMarkersRef.current) updateMarkersRef.current();
    });

    // Fit globe sizing
    const handleResize = () => {
      if (containerRef.current && globeInstanceRef.current) {
        globeInstanceRef.current
          .width(containerRef.current.clientWidth)
          .height(containerRef.current.clientHeight);
      }
    };
    
    // Initial size
    handleResize();

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (globeInstanceRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  // Update globe when webcams or favorites change
  useEffect(() => {
    if (globeInstanceRef.current) {
      updateMarkers();
    }
  }, [webcams, favorites, selectedWebcam]);

  // Fly to selected webcam (if one becomes selected while globe is rendering)
  useEffect(() => {
    if (selectedWebcam && globeInstanceRef.current) {
      requestAnimationFrame(() => {
        globeInstanceRef.current.pointOfView({
          lat: selectedWebcam.latitude,
          lng: selectedWebcam.longitude,
          altitude: 0.2
        }, 1000);
      });
    }
  }, [selectedWebcam]);

  return (
    <div 
      ref={containerRef} 
      className="globe-container" 
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
}
```

---

## Phase 5 — Build `src/components/MapToggle.jsx`

A simple controlled toggle element positioned floating on the map.

```jsx
import React from 'react';

export default function MapToggle({ mode, onChange }) {
  return (
    <div className="map-toggle-container">
      <button
        className={`map-toggle-btn ${mode === 'flat' ? 'active' : ''}`}
        onClick={() => onChange('flat')}
        aria-label="Switch to flat map"
      >
        🗺️ Flat Map
      </button>
      <button
        className={`map-toggle-btn ${mode === 'globe' ? 'active' : ''}`}
        onClick={() => onChange('globe')}
        aria-label="Switch to 3D globe"
      >
        🌐 3D Globe
      </button>
    </div>
  );
}
```

---

## Phase 6 — Integrate in `src/App.jsx`

Update `src/App.jsx` to implement the CSS toggle visibility feature, rendering both map views without unmounting.

```diff
-import MapComponent from './components/MapComponent';
+import LeafletMap from './components/LeafletMap';
+import GlobeMap from './components/GlobeMap';
+import MapToggle from './components/MapToggle';

export default function App() {
   ...
   const [sidebarOpen, setSidebarOpen] = useState(true);
+  const [mapMode, setMapMode] = useState(() => localStorage.getItem('mapMode') ?? 'flat');
+
+  const handleMapModeChange = (mode) => {
+    setMapMode(mode);
+    localStorage.setItem('mapMode', mode);
+  };

   ...

   return (
     <div className="app-container">
       ...
       <div className="app-body">
         ...
         <div className="main-content">
           {error && (
             <div className="error-banner">
               ⚠️ {error}
             </div>
           )}

-          {selectedWebcam ? (
-            <div className="webcam-view">
+          {/* Render Webcam Video view container when selected */}
+          {selectedWebcam && (
+            <div className="webcam-view">
               <div className="webcam-header">
                 <button 
                   className="back-button"
                   onClick={() => setSelectedWebcam(null)}
                 >
                   ← Zurück zur Karte
                 </button>
                 <h2>{selectedWebcam.name}</h2>
                 ...
               </div>
               <VideoPlayer webcam={selectedWebcam} />
               ...
             </div>
-          ) : (
-            <div className="map-view">
-              <MapComponent
-                webcams={displayWebcams}
-                onMarkerClick={handleSelectWebcam}
-                selectedWebcam={selectedWebcam}
-                favorites={favorites}
-              />
-            </div>
-          )}
+          )}
+
+          {/* Keep maps mounted and toggle visibility with .hidden class */}
+          <div className={`map-view ${selectedWebcam ? 'hidden' : ''}`}>
+            <MapToggle mode={mapMode} onChange={handleMapModeChange} />
+            
+            <div className={mapMode === 'flat' ? '' : 'hidden'} style={{ height: '100%', width: '100%' }}>
+              <LeafletMap
+                webcams={displayWebcams}
+                onMarkerClick={handleSelectWebcam}
+                selectedWebcam={selectedWebcam}
+                favorites={favorites}
+              />
+            </div>
+            
+            <div className={mapMode === 'globe' ? '' : 'hidden'} style={{ height: '100%', width: '100%' }}>
+              <GlobeMap
+                webcams={displayWebcams}
+                onMarkerClick={handleSelectWebcam}
+                selectedWebcam={selectedWebcam}
+                favorites={favorites}
+              />
+            </div>
+          </div>
         </div>
       </div>
       ...
     </div>
   );
}
```

---

## Phase 7 — Rename `MapComponent.jsx` → `LeafletMap.jsx`

We rename the file to `src/components/LeafletMap.jsx`. We adjust it to import the unified marker builders and listen to `selectedWebcam` changes to call `map.invalidateSize()` when the map view transitions back from hidden to visible.

### Implementation Checklist for `LeafletMap.jsx`:

1. Import DOM creators:
   ```js
   import { buildMarkerEl, buildClusterEl } from '../utils/markerUtils';
   ```
2. Refactor existing `createDivMarker` and `iconCreateFunction` to delegate element creation to the helpers. Since the helpers return a raw DOM element, pass them into `L.divIcon({ html: element })`.
3. Add `invalidateSize` trigger inside a `useEffect` watching `selectedWebcam`:
   ```js
   useEffect(() => {
     if (mapInstanceRef.current && !selectedWebcam) {
       // Small delay to ensure display: block is active
       setTimeout(() => {
         mapInstanceRef.current.invalidateSize();
       }, 50);
     }
   }, [selectedWebcam]);
   ```

---

## Installation

Run command:
```bash
npm install globe.gl supercluster
```

---

## Constraints Summary

| Item / Action | Reasoning & Purpose |
|---|---|
| Use CSS class `.hidden` in `App.jsx` | Keeps maps mounted, preserving Leaflet zoom/center and enabling Globe camera transitions. |
| Use `map.invalidateSize()` in `LeafletMap` | Re-aligns Leaflet map canvas bounds after transitioning from `display: none` back to visible. |
| ResizeObserver on `GlobeMap` | Auto-resizes the 3D globe to perfectly fit the viewport width/height dynamically. |
| Custom markers defined only in `App.css` | Unifies marker design completely between 2D Leaflet and 3D Globe views. |
| Atmosphere glow in `GlobeMap` (`#00d9ff`) | Matches the consolidated Sci-Fi design system colors. |
| Empty dependencies `[]` for Globe initialization | Ensures WebGL and canvas initialization run exactly once. |
