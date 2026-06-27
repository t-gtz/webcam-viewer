import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { buildMarkerEl, buildClusterEl } from '../utils/markerUtils';

export default function LeafletMap({
  webcams,
  onMarkerClick,
  selectedWebcam,
  favorites
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Trigger size recalculation when the map is revealed
  useEffect(() => {
    if (mapInstanceRef.current && !selectedWebcam) {
      // Small timeout to ensure display: block is active
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 50);
    }
  }, [selectedWebcam]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialisiere Karte nur einmal
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([51.1657, 10.4515], 5);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Erstelle oder hole die MarkerGroup einmal und Merke hinzugefügte IDs
    if (!map._markerGroup) {
      map._markerGroup = L.markerClusterGroup({
        maxClusterRadius: 80,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          const el = buildClusterEl(count);
          return L.divIcon({
            html: el,
            iconSize: [44, 44],
            className: 'custom-cluster-icon'
          });
        }
      });
      map.addLayer(map._markerGroup);
      map._addedIds = new Set();

      // Infinite-style load: wenn Karte bewegt wird, lade sichtbare Marker nach
      map.on('moveend', () => {
        addVisibleMarkers();
      });
    }

    const markerGroup = map._markerGroup;

    // Clear existing markers to force rebuilding with correct favorite/selection state
    markerGroup.clearLayers();
    map._addedIds.clear();

    // Hilfsfunktion: prüfe ob Punkt in sichtbaren Bounds
    const isInView = (cam) => {
      try {
        const latlng = L.latLng(cam.latitude, cam.longitude);
        return map.getBounds().contains(latlng);
      } catch (e) {
        return false;
      }
    };

    // Erzeuge einen individuellen DivIcon Marker mit Puls-Effekt using shared utils
    const createDivMarker = (cam) => {
      const el = buildMarkerEl(cam, {
        isFav: favorites.has(cam.id),
        isSelected: selectedWebcam?.id === cam.id
      });

      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: el,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([cam.latitude, cam.longitude], { icon });

      marker.bindPopup(
        `<div class="map-popup"><h4>${cam.name}</h4><p>${cam.city}, ${cam.country}</p><p class="status">${cam.is_active ? '🟢 Online' : '🔴 Offline'}</p></div>`,
        { maxWidth: 280 }
      );

      marker.on('click', () => onMarkerClick(cam));
      return marker;
    };

    // Füge Marker hinzu, aber nur für sichtbaren Bereich oder bis zu einer Chunk-Größe
    const addVisibleMarkers = (chunk = 80) => {
      if (!webcams || webcams.length === 0) return;
      const toAdd = [];
      for (let i = 0; i < webcams.length; i++) {
        const cam = webcams[i];
        if (map._addedIds.has(cam.id)) continue;
        if (isInView(cam)) {
          toAdd.push(cam);
          if (toAdd.length >= chunk) break;
        }
      }

      if (toAdd.length === 0) return;
      toAdd.forEach(cam => {
        const marker = createDivMarker(cam);
        markerGroup.addLayer(marker);
        map._addedIds.add(cam.id);
      });
    };

    // Initial: lade erste sichtbaren Marker und ein paar in der Nähe
    addVisibleMarkers(120);

  }, [webcams, onMarkerClick, selectedWebcam, favorites]);

  return (
    <div 
      ref={mapRef}
      className="map-container"
      style={{ height: '100%', width: '100%', zIndex: 1 }}
    />
  );
}
