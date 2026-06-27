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
