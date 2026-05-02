const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');

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
    cover_image_path TEXT DEFAULT NULL,
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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tour_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tour_id INTEGER NOT NULL,
    room_id INTEGER DEFAULT NULL,
    is_embed INTEGER DEFAULT 0,
    user_agent TEXT DEFAULT '',
    referer TEXT DEFAULT '',
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
  );
`);

// Safe migrations — these are no-ops if the column already exists
try { db.exec('ALTER TABLE rooms ADD COLUMN sort_order INTEGER DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE tours ADD COLUMN cover_image_path TEXT DEFAULT NULL'); } catch (e) {}

// Backfill sort_order for existing rows that are still 0 (set to rowid so existing tours get stable order)
db.exec(`
  UPDATE rooms SET sort_order = id WHERE sort_order = 0
`);

// Create an initial admin user from legacy password if no users exist yet
const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
if (userCount === 0) {
  const legacy = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get();
  if (legacy && legacy.value) {
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
      'admin',
      legacy.value,
      'admin'
    );
  }
}

module.exports = db;
