import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import VideoPlayer from './components/VideoPlayer';
import SearchBar from './components/SearchBar';
import WebcamList from './components/WebcamList';
import Sidebar from './components/Sidebar';
import './App.css';

export default function App() {
  const [webcams, setWebcams] = useState([]);
  const [selectedWebcam, setSelectedWebcam] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Lade Webcams beim Start
  useEffect(() => {
    fetchWebcams();
    loadFavorites();
  }, []);

  const fetchWebcams = async () => {
    try {
      setIsLoading(true);
      
      // Fetch local DB webcams
      const response = await fetch('/api/webcams?limit=500');
      const data = await response.json();
      let allWebcams = data.webcams || [];

      // Fetch EarthCam proxy API
      try {
        const earthcamResponse = await fetch('/api/earthcam');
        if (earthcamResponse.ok) {
          const earthcamData = await earthcamResponse.json();
          if (earthcamData.success && earthcamData.webcams) {
            allWebcams = [...allWebcams, ...earthcamData.webcams];
          }
        }
      } catch (ecErr) {
        console.warn('Failed to fetch EarthCam webcams:', ecErr);
      }

      setWebcams(allWebcams);
      setError(null);
    } catch (err) {
      setError(`Fehler beim Laden: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query, filters = {}) => {
    try {
      const params = new URLSearchParams({
        q: query,
        ...filters
      });

      const response = await fetch(`/api/search?${params}`);
      const results = await response.json();
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleSelectWebcam = (webcam) => {
    setSelectedWebcam(webcam);
  };

  const toggleFavorite = (webcamId) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(webcamId)) {
      newFavorites.delete(webcamId);
      // Optional: Server-seitig löschen
      fetch(`/api/favorites/${webcamId}`, { method: 'DELETE' });
      // Browser-Speicher
      localStorage.setItem(`favorite:${webcamId}`, 'false');
    } else {
      newFavorites.add(webcamId);
      // Optional: Server-seitig speichern
      fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webcamId })
      });
      // Browser-Speicher
      localStorage.setItem(`favorite:${webcamId}`, 'true');
    }
    setFavorites(newFavorites);
  };

  const loadFavorites = () => {
    const fav = new Set();
    webcams.forEach(w => {
      const isFav = localStorage.getItem(`favorite:${w.id}`) === 'true';
      if (isFav) fav.add(w.id);
    });
    setFavorites(fav);
  };

  const displayWebcams = searchResults.length > 0 ? searchResults : webcams;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>🎥 Webcam Viewer</h1>
          <p className="subtitle">Öffentliche Webcams interaktiv entdecken</p>
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          webcams={displayWebcams}
          onSearch={handleSearch}
          onSelectWebcam={handleSelectWebcam}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          selectedWebcam={selectedWebcam}
          isLoading={isLoading}
        />

        <div className="main-content">
          {error && (
            <div className="error-banner">
              ⚠️ {error}
            </div>
          )}

          {selectedWebcam ? (
            <div className="webcam-view">
              <div className="webcam-header">
                <button 
                  className="back-button"
                  onClick={() => setSelectedWebcam(null)}
                >
                  ← Zurück zur Karte
                </button>
                <h2>{selectedWebcam.name}</h2>
                <button
                  className={`favorite-button ${favorites.has(selectedWebcam.id) ? 'active' : ''}`}
                  onClick={() => toggleFavorite(selectedWebcam.id)}
                >
                  {favorites.has(selectedWebcam.id) ? '★' : '☆'} Favorit
                </button>
              </div>

              <VideoPlayer webcam={selectedWebcam} />

              <div className="webcam-info">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Stadt:</label>
                    <span>{selectedWebcam.city}</span>
                  </div>
                  <div className="info-item">
                    <label>Land:</label>
                    <span>{selectedWebcam.country}</span>
                  </div>
                  <div className="info-item">
                    <label>Status:</label>
                    <span className={selectedWebcam.is_active ? 'status-online' : 'status-offline'}>
                      {selectedWebcam.is_active ? '🟢 Online' : '🔴 Offline'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Kategorie:</label>
                    <span>{selectedWebcam.category || 'Sonstiges'}</span>
                  </div>
                </div>

                {selectedWebcam.description && (
                  <div className="description">
                    <p>{selectedWebcam.description}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="map-view">
              <MapComponent
                webcams={displayWebcams}
                onMarkerClick={handleSelectWebcam}
                selectedWebcam={selectedWebcam}
                favorites={favorites}
              />
            </div>
          )}
        </div>
      </div>

      <footer className="app-footer">
        <p>💾 Alle Daten sind lokal gespeichert | Keine Anmeldung erforderlich</p>
      </footer>
    </div>
  );
}
