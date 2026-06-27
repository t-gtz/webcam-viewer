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
