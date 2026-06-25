import React from 'react';

export default function WebcamList({
  webcams,
  onSelectWebcam,
  onToggleFavorite,
  favorites,
  selectedWebcam,
  isLoading
}) {
  if (isLoading) {
    return <div className="webcam-list-loading">Lädt Webcams...</div>;
  }

  if (webcams.length === 0) {
    return <div className="webcam-list-empty">Keine Webcams gefunden.</div>;
  }

  return (
    <div className="webcam-list">
      {webcams.map(cam => (
        <div 
          key={cam.id} 
          className={`webcam-list-item ${selectedWebcam?.id === cam.id ? 'selected' : ''}`}
          onClick={() => onSelectWebcam(cam)}
        >
          <div className="webcam-list-item-header">
            <h4>{cam.name}</h4>
            <button 
              className={`favorite-icon ${favorites.has(cam.id) ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(cam.id);
              }}
            >
              {favorites.has(cam.id) ? '★' : '☆'}
            </button>
          </div>
          <div className="webcam-list-item-details">
            <span>
              {cam.source === 'earthcam' && <span className="earthcam-badge">🌍 EarthCam</span>}{' '}
              {cam.city}, {cam.country}
            </span>
            <span className={`status-dot ${cam.is_active !== false ? 'online' : 'offline'}`} title={cam.is_active !== false ? 'Online' : 'Offline'}></span>
          </div>
        </div>
      ))}
    </div>
  );
}
