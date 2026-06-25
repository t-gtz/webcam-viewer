const express = require('express');
const sqlite3 = require('sqlite3');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/webcams.db';

// Middleware
app.use(compression());
app.use(express.json());
app.use(cors());

// Datenbank initialisieren
let db;
function initDatabase() {
  return new Promise((resolve, reject) => {
    // Verzeichnis sicherstellen
    const dbDir = path.dirname(DB_PATH);
    fs.mkdir(dbDir, { recursive: true }).then(() => {
      db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) reject(err);
        else {
          // Schema prüfen & erstellen wenn nötig
          const schemaPath = path.join(__dirname, 'schema.sql');
          fs.readFile(schemaPath, 'utf8').then((schema) => {
            db.exec(schema, (err) => {
              if (err) reject(err);
              else resolve();
            });
          }).catch(reject);
        }
      });
    }).catch(reject);
  });
}

// ==================== API ENDPOINTS ====================

// GET /api/webcams - Alle Webcams (mit Pagination)
app.get('/api/webcams', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT * FROM webcams 
     WHERE is_active = 1
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [limit, offset],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ webcams: rows, count: rows.length });
    }
  );
});

// GET /api/webcams/:id - Einzelne Webcam
app.get('/api/webcams/:id', (req, res) => {
  db.get(
    'SELECT * FROM webcams WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    }
  );
});

// GET /api/search - Suchfunktion
app.get('/api/search', (req, res) => {
  const keyword = req.query.q || '';
  const city = req.query.city || '';
  const category = req.query.category || '';
  const limit = parseInt(req.query.limit) || 50;

  let query = `
    SELECT * FROM webcams 
    WHERE is_active = 1
  `;
  const params = [];

  if (keyword) {
    query += ` AND (name LIKE ? OR description LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (city) {
    query += ` AND city LIKE ?`;
    params.push(`%${city}%`);
  }

  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  query += ` ORDER BY name ASC LIMIT ?`;
  params.push(limit);

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/stream/:id - Stream-Info (für Frontend)
app.get('/api/stream/:id', (req, res) => {
  db.get(
    `SELECT id, name, stream_url, stream_type, thumbnail_path 
     FROM webcams WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Not found' });

      // Gebe Stream-Info zurück
      res.json({
        id: row.id,
        name: row.name,
        streamUrl: row.stream_url,
        streamType: row.stream_type,
        thumbnail: row.thumbnail_path 
          ? `/thumbnails/${row.thumbnail_path}` 
          : null
      });
    }
  );
});

// GET /api/earthcam - EarthCam proxy endpoint
app.get('/api/earthcam', async (req, res) => {
  try {
    const apiKey = process.env.EARTHCAM_API_KEY;
    const apiUrl = process.env.EARTHCAM_API_URL;

    // Check if API key is configured
    if (!apiKey || apiKey === 'your_earthcam_api_key_here') {
      console.warn("EarthCam API key not configured. Returning mock data.");
      // Return mock EarthCam data so the frontend has something to display
      return res.json({
        success: true,
        webcams: [
          {
            id: 'earthcam-nyc',
            name: 'EarthCam: Times Square',
            city: 'New York',
            country: 'USA',
            latitude: 40.7580,
            longitude: -73.9855,
            stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', // Mock HLS stream
            stream_type: 'hls',
            category: 'city',
            source: 'earthcam'
          },
          {
            id: 'earthcam-miami',
            name: 'EarthCam: Miami Beach',
            city: 'Miami',
            country: 'USA',
            latitude: 25.7906,
            longitude: -80.1300,
            stream_url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
            stream_type: 'hls',
            category: 'beach',
            source: 'earthcam'
          }
        ]
      });
    }

    // Example of how the real API fetch would look:
    /*
    const fetchResponse = await fetch(`${apiUrl}/cameras?api_key=${apiKey}`);
    const data = await fetchResponse.json();
    
    // Map EarthCam data to our internal format
    const mappedCameras = data.map(cam => ({
      id: `earthcam-${cam.id}`,
      name: cam.title,
      city: cam.location.city,
      country: cam.location.country,
      latitude: cam.lat,
      longitude: cam.lng,
      stream_url: cam.hls_url,
      stream_type: 'hls',
      category: 'other',
      source: 'earthcam'
    }));

    res.json({ success: true, webcams: mappedCameras });
    */

    // Fallback if key is provided but logic above is commented out:
    res.status(501).json({ error: "EarthCam integration is mocked. Uncomment fetch logic in server/index.cjs once API details are known." });

  } catch (err) {
    console.error('EarthCam API Error:', err);
    res.status(500).json({ error: 'Failed to fetch from EarthCam API' });
  }
});

// GET /api/thumbnails/:id - Thumbnail Download
app.get('/api/thumbnails/:id', (req, res) => {
  const thumbPath = path.join(__dirname, '../data/thumbnails', req.params.id);
  res.sendFile(thumbPath, (err) => {
    if (err) res.status(404).json({ error: 'Thumbnail not found' });
  });
});

// ==================== BROWSER STORAGE ENDPOINTS ====================
// Browser speichert Favoriten lokal (localStorage/IndexedDB)
// Optional: Server kann auch speichern

// GET /api/favorites - Alle Favoriten
app.get('/api/favorites', (req, res) => {
  db.all(
    `SELECT w.* FROM webcams w
     JOIN favorites f ON w.id = f.webcam_id
     ORDER BY f.added_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST /api/favorites - Favorit hinzufügen (optional, Server-side)
app.post('/api/favorites', express.json(), (req, res) => {
  const { webcamId } = req.body;

  db.run(
    'INSERT OR IGNORE INTO favorites (webcam_id) VALUES (?)',
    [webcamId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// DELETE /api/favorites/:id - Favorit entfernen
app.delete('/api/favorites/:id', (req, res) => {
  db.run(
    'DELETE FROM favorites WHERE webcam_id = ?',
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ==================== SETTINGS ====================

// GET /api/settings - App-Einstellungen
app.get('/api/settings', (req, res) => {
  db.all(
    'SELECT key, value FROM settings',
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const settings = {};
      rows.forEach(row => {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = row.value;
        }
      });

      res.json(settings);
    }
  );
});

// POST /api/settings - Settings aktualisieren
app.post('/api/settings', express.json(), (req, res) => {
  const { key, value } = req.body;

  db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, typeof value === 'object' ? JSON.stringify(value) : value],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ==================== STATIC FILES ====================

// Serve React SPA
app.use(express.static(path.join(__dirname, '../dist')));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Alle anderen Routes → index.html (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ==================== START ====================

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════════╗
    ║  🎥 Webcam Viewer Server                       ║
    ║                                                ║
    ║  🌐 Öffne: http://localhost:${PORT}             ║
    ║  📊 Health: http://localhost:${PORT}/health     ║
    ║  📁 Daten: ${DB_PATH}                          ║
    ║                                                ║
    ║  Kein Login erforderlich - direkter Zugriff    ║
    ╚════════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;
