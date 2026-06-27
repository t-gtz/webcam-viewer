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
