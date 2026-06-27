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
