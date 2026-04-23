const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', '..', 'data');
const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(path.join(dataDir, 'tourbine.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tour_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    image_path TEXT DEFAULT NULL,
    initial_pitch REAL DEFAULT 0,
    initial_yaw REAL DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
    UNIQUE (tour_id, slug)
  );

  CREATE TABLE IF NOT EXISTS hotspots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_room_id INTEGER NOT NULL,
    to_room_id INTEGER NOT NULL,
    pitch REAL DEFAULT 0,
    yaw REAL DEFAULT 0,
    text TEXT DEFAULT '',
    FOREIGN KEY (from_room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (to_room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );
`);

module.exports = db;
