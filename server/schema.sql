-- Webcams Tabelle
CREATE TABLE IF NOT EXISTS webcams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    country TEXT,
    city TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    stream_url TEXT NOT NULL,
    stream_type TEXT DEFAULT 'http', -- hls, rtmp, http, mjpeg
    thumbnail_path TEXT,
    is_active BOOLEAN DEFAULT 1,
    category TEXT, -- traffic, nature, city, beach, other
    source TEXT, -- builtin, manual, import
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Favoriten (Optional - kann auch nur lokal sein)
CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webcam_id TEXT NOT NULL UNIQUE REFERENCES webcams(id),
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Einstellungen (App-Konfiguration)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_webcams_active ON webcams(is_active);
CREATE INDEX IF NOT EXISTS idx_webcams_city ON webcams(city, country);
CREATE INDEX IF NOT EXISTS idx_webcams_category ON webcams(category);

-- Sample-Daten (beim ersten Start)
INSERT OR IGNORE INTO webcams 
(id, name, city, country, latitude, longitude, stream_url, stream_type, category, source)
VALUES
('de-berlin-002', 'NASA TV Live', 'Space', 'USA', 28.5721, -80.6480, 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8', 'hls', 'other', 'builtin'),
('de-hamburg-002', 'Test Stream 1', 'Hamburg', 'Deutschland', 53.5511, 9.9850, 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 'hls', 'city', 'builtin'),
('de-munich-002', 'Akamai Live Test', 'München', 'Deutschland', 48.1351, 11.5820, 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', 'hls', 'city', 'builtin'),
('de-cologne-002', 'Test Stream 2', 'Köln', 'Deutschland', 50.9413, 6.9581, 'https://moctobpltc-i.akamaihd.net/hls/live/571329/eight/playlist.m3u8', 'hls', 'city', 'builtin'),
('ch-zurich-002', 'Apple Test Stream', 'Zürich', 'Schweiz', 47.3769, 8.5472, 'http://devimages.apple.com/iphone/samples/bipbop/bipbopall.m3u8', 'hls', 'city', 'builtin'),
('at-vienna-002', 'Wien Live', 'Wien', 'Österreich', 48.2082, 16.3738, 'https://test-streams.mux.dev/test_001/stream.m3u8', 'hls', 'city', 'builtin');
