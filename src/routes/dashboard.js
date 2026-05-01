const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const upload = require('../upload');
const slugify = require('slugify');
const { isPasswordSet, requireSetup, requireAuth } = require('../auth');

const BCRYPT_ROUNDS = 12;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

function makeSlug(text) {
  return slugify(text, { lower: true, strict: true, trim: true });
}

function uniqueTourSlug(name, excludeId = null) {
  let base = makeSlug(name);
  let slug = base;
  let i = 1;
  while (true) {
    const existing = db.prepare('SELECT id FROM tours WHERE slug = ?').get(slug);
    if (!existing || existing.id === excludeId) break;
    slug = `${base}-${i++}`;
  }
  return slug;
}

function uniqueRoomSlug(tourId, name, excludeId = null) {
  let base = makeSlug(name);
  let slug = base;
  let i = 1;
  while (true) {
    const existing = db.prepare('SELECT id FROM rooms WHERE tour_id = ? AND slug = ?').get(tourId, slug);
    if (!existing || existing.id === excludeId) break;
    slug = `${base}-${i++}`;
  }
  return slug;
}

function unlinkFile(imagePath) {
  if (!imagePath) return;
  try {
    // dashboard.js lives in src/routes/ — go up two levels to reach public/
    const uploadsDir = path.resolve(path.join(__dirname, '..', '..', 'public', 'uploads'));
    const resolved = path.resolve(path.join(__dirname, '..', '..', 'public', imagePath));
    if (!resolved.startsWith(uploadsDir + path.sep) && resolved !== uploadsDir) return;
    fs.unlinkSync(resolved);
  } catch (e) { /* file may not exist */ }
}

// GET /dashboard/setup
router.get('/setup', (req, res) => {
  if (isPasswordSet()) return res.redirect('/dashboard/login');
  res.render('dashboard/setup', { title: 'Create Password', error: null });
});

// POST /dashboard/setup
router.post('/setup', (req, res) => {
  if (isPasswordSet()) return res.redirect('/dashboard');
  const { password, confirm } = req.body;
  if (!password || password.length < 8) {
    return res.render('dashboard/setup', { title: 'Create Password', error: 'Password must be at least 8 characters.' });
  }
  if (password !== confirm) {
    return res.render('dashboard/setup', { title: 'Create Password', error: 'Passwords do not match.' });
  }
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  db.prepare("INSERT INTO settings (key, value) VALUES ('password_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(hash);
  req.session.authenticated = true;
  req.session.save(() => res.redirect('/dashboard'));
});

// GET /dashboard/login
router.get('/login', (req, res) => {
  if (!isPasswordSet()) return res.redirect('/dashboard/setup');
  if (req.session && req.session.authenticated) return res.redirect('/dashboard');
  res.render('dashboard/login', { title: 'Login', error: null });
});

// POST /dashboard/login
router.post('/login', loginLimiter, (req, res) => {
  if (!isPasswordSet()) return res.redirect('/dashboard/setup');
  const { password } = req.body;
  const row = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get();
  if (!row || !bcrypt.compareSync(password || '', row.value)) {
    return res.render('dashboard/login', { title: 'Login', error: 'Incorrect password.' });
  }
  const returnTo = req.session.returnTo || '/dashboard';
  req.session.regenerate((err) => {
    if (err) return res.render('dashboard/login', { title: 'Login', error: 'Session error. Please try again.' });
    req.session.authenticated = true;
    req.session.save(() => res.redirect(returnTo));
  });
});

// POST /dashboard/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/dashboard/login'));
});

// All routes below require authentication
router.use(requireAuth);

// GET /dashboard
router.get('/', (req, res) => {
  const tours = db.prepare(`
    SELECT t.*, COUNT(r.id) AS room_count
    FROM tours t
    LEFT JOIN rooms r ON r.tour_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();
  const totalRooms = db.prepare('SELECT COUNT(*) AS cnt FROM rooms').get().cnt;
  res.render('dashboard/index', { title: 'Dashboard', tours, totalRooms });
});

// GET /dashboard/tours/new
router.get('/tours/new', (req, res) => {
  res.render('dashboard/tour-form', { title: 'New Tour', tour: null, error: null });
});

// POST /dashboard/tours
router.post('/tours', (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.render('dashboard/tour-form', { title: 'New Tour', tour: null, error: 'Name is required' });
  }
  const slug = uniqueTourSlug(name.trim());
  db.prepare('INSERT INTO tours (name, slug, description) VALUES (?, ?, ?)').run(name.trim(), slug, description || '');
  res.redirect('/dashboard');
});

// GET /dashboard/tours/:id/edit
router.get('/tours/:id/edit', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.id);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  res.render('dashboard/tour-form', { title: 'Edit Tour', tour, error: null });
});

// PUT /dashboard/tours/:id
router.put('/tours/:id', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.id);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.render('dashboard/tour-form', { title: 'Edit Tour', tour, error: 'Name is required' });
  }
  const slug = uniqueTourSlug(name.trim(), tour.id);
  db.prepare('UPDATE tours SET name = ?, slug = ?, description = ? WHERE id = ?').run(name.trim(), slug, description || '', tour.id);
  res.redirect('/dashboard');
});

// DELETE /dashboard/tours/:id
router.delete('/tours/:id', (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms WHERE tour_id = ?').all(req.params.id);
  for (const room of rooms) unlinkFile(room.image_path);
  db.prepare('DELETE FROM tours WHERE id = ?').run(req.params.id);
  res.redirect('/dashboard');
});

// GET /dashboard/tours/:tourId/rooms
router.get('/tours/:tourId/rooms', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  const rooms = db.prepare('SELECT * FROM rooms WHERE tour_id = ? ORDER BY sort_order ASC, created_at ASC').all(tour.id);
  res.render('dashboard/rooms', { title: `Rooms — ${tour.name}`, tour, rooms });
});

// GET /dashboard/tours/:tourId/rooms/new
router.get('/tours/:tourId/rooms/new', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  res.render('dashboard/room-form', { title: 'New Room', tour, room: null, allRooms: [], hotspots: [], error: null });
});

// POST /dashboard/tours/:tourId/rooms
router.post('/tours/:tourId/rooms', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
    if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });

    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large. Maximum size is 100 MB.'
        : (err.message || 'File upload failed.');
      return res.render('dashboard/room-form', { title: 'New Room', tour, room: null, allRooms: [], hotspots: [], error: msg });
    }

    const { name, initial_pitch, initial_yaw, is_default } = req.body;
    if (!name || !name.trim()) {
      if (req.file) unlinkFile('uploads/' + req.file.filename);
      return res.render('dashboard/room-form', { title: 'New Room', tour, room: null, allRooms: [], hotspots: [], error: 'Room name is required' });
    }

    const slug = uniqueRoomSlug(tour.id, name.trim());
    const image_path = req.file ? 'uploads/' + req.file.filename : null;

    const existingRooms = db.prepare('SELECT COUNT(*) AS cnt FROM rooms WHERE tour_id = ?').get(tour.id).cnt;
    const setDefault = is_default === 'on' || existingRooms === 0;

    if (setDefault) {
      db.prepare('UPDATE rooms SET is_default = 0 WHERE tour_id = ?').run(tour.id);
    }

    const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM rooms WHERE tour_id = ?').get(tour.id).m || 0;

    db.prepare('INSERT INTO rooms (tour_id, name, slug, image_path, initial_pitch, initial_yaw, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      tour.id, name.trim(), slug, image_path,
      parseFloat(initial_pitch) || 0,
      parseFloat(initial_yaw) || 0,
      setDefault ? 1 : 0,
      maxOrder + 1
    );

    res.redirect(`/dashboard/tours/${tour.id}/rooms`);
  });
});

// GET /dashboard/tours/:tourId/rooms/:roomId/edit
router.get('/tours/:tourId/rooms/:roomId/edit', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND tour_id = ?').get(req.params.roomId, tour.id);
  if (!room) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Room not found' });

  const allRooms = db.prepare('SELECT * FROM rooms WHERE tour_id = ? AND id != ? ORDER BY name ASC').all(tour.id, room.id);
  const hotspots = db.prepare(`
    SELECT h.*, r.name AS to_name
    FROM hotspots h
    JOIN rooms r ON r.id = h.to_room_id
    WHERE h.from_room_id = ?
  `).all(room.id);

  res.render('dashboard/room-form', { title: `Edit Room — ${room.name}`, tour, room, allRooms, hotspots, error: null });
});

// PUT /dashboard/tours/:tourId/rooms/:roomId
router.put('/tours/:tourId/rooms/:roomId', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
    if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
    const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND tour_id = ?').get(req.params.roomId, tour.id);
    if (!room) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Room not found' });

    const allRooms = db.prepare('SELECT * FROM rooms WHERE tour_id = ? AND id != ? ORDER BY name ASC').all(tour.id, room.id);
    const hotspots = db.prepare('SELECT h.*, r.name AS to_name FROM hotspots h JOIN rooms r ON r.id = h.to_room_id WHERE h.from_room_id = ?').all(room.id);

    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large. Maximum size is 100 MB.'
        : (err.message || 'File upload failed.');
      return res.render('dashboard/room-form', { title: `Edit Room — ${room.name}`, tour, room, allRooms, hotspots, error: msg });
    }

    const { name, initial_pitch, initial_yaw, is_default } = req.body;
    if (!name || !name.trim()) {
      if (req.file) unlinkFile('uploads/' + req.file.filename);
      return res.render('dashboard/room-form', { title: `Edit Room — ${room.name}`, tour, room, allRooms, hotspots, error: 'Room name is required' });
    }

    const slug = uniqueRoomSlug(tour.id, name.trim(), room.id);
    let image_path = room.image_path;

    if (req.file) {
      unlinkFile(room.image_path);
      image_path = 'uploads/' + req.file.filename;
    }

    const setDefault = is_default === 'on';
    if (setDefault) {
      db.prepare('UPDATE rooms SET is_default = 0 WHERE tour_id = ?').run(tour.id);
    }

    db.prepare('UPDATE rooms SET name = ?, slug = ?, image_path = ?, initial_pitch = ?, initial_yaw = ?, is_default = ? WHERE id = ?').run(
      name.trim(), slug, image_path,
      parseFloat(initial_pitch) || 0,
      parseFloat(initial_yaw) || 0,
      setDefault ? 1 : (room.is_default || 0),
      room.id
    );

    res.redirect(`/dashboard/tours/${tour.id}/rooms/${room.id}/edit`);
  });
});

// DELETE /dashboard/tours/:tourId/rooms/:roomId
router.delete('/tours/:tourId/rooms/:roomId', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND tour_id = ?').get(req.params.roomId, tour.id);
  if (!room) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Room not found' });

  unlinkFile(room.image_path);
  db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);

  if (room.is_default) {
    const next = db.prepare('SELECT id FROM rooms WHERE tour_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1').get(tour.id);
    if (next) db.prepare('UPDATE rooms SET is_default = 1 WHERE id = ?').run(next.id);
  }

  res.redirect(`/dashboard/tours/${tour.id}/rooms`);
});

// POST /dashboard/tours/:tourId/rooms/:roomId/set-default
router.post('/tours/:tourId/rooms/:roomId/set-default', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND tour_id = ?').get(req.params.roomId, tour.id);
  if (!room) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Room not found' });

  db.prepare('UPDATE rooms SET is_default = 0 WHERE tour_id = ?').run(tour.id);
  db.prepare('UPDATE rooms SET is_default = 1 WHERE id = ?').run(room.id);

  res.redirect(`/dashboard/tours/${tour.id}/rooms`);
});

// POST /dashboard/tours/:tourId/rooms/:roomId/hotspots
router.post('/tours/:tourId/rooms/:roomId/hotspots', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND tour_id = ?').get(req.params.roomId, tour.id);
  if (!room) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Room not found' });

  const { to_room_id, pitch, yaw, text } = req.body;

  const toRoom = db.prepare('SELECT * FROM rooms WHERE id = ? AND tour_id = ?').get(to_room_id, tour.id);
  if (!toRoom) return res.status(400).render('error', { title: 'Error', status: 400, message: 'Invalid target room' });

  db.prepare('INSERT INTO hotspots (from_room_id, to_room_id, pitch, yaw, text) VALUES (?, ?, ?, ?, ?)').run(
    room.id, toRoom.id, parseFloat(pitch) || 0, parseFloat(yaw) || 0, text || ''
  );

  res.redirect(`/dashboard/tours/${tour.id}/rooms/${room.id}/edit`);
});

// POST /dashboard/tours/:tourId/rooms/:roomId/move-up
router.post('/tours/:tourId/rooms/:roomId/move-up', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND tour_id = ?').get(req.params.roomId, tour.id);
  if (!room) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Room not found' });

  const rooms = db.prepare('SELECT * FROM rooms WHERE tour_id = ? ORDER BY sort_order ASC, created_at ASC').all(tour.id);
  const idx = rooms.findIndex(r => r.id === room.id);
  if (idx > 0) {
    const prev = rooms[idx - 1];
    db.prepare('UPDATE rooms SET sort_order = ? WHERE id = ?').run(prev.sort_order, room.id);
    db.prepare('UPDATE rooms SET sort_order = ? WHERE id = ?').run(room.sort_order, prev.id);
  }
  res.redirect(`/dashboard/tours/${tour.id}/rooms`);
});

// POST /dashboard/tours/:tourId/rooms/:roomId/move-down
router.post('/tours/:tourId/rooms/:roomId/move-down', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.tourId);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND tour_id = ?').get(req.params.roomId, tour.id);
  if (!room) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Room not found' });

  const rooms = db.prepare('SELECT * FROM rooms WHERE tour_id = ? ORDER BY sort_order ASC, created_at ASC').all(tour.id);
  const idx = rooms.findIndex(r => r.id === room.id);
  if (idx < rooms.length - 1) {
    const next = rooms[idx + 1];
    db.prepare('UPDATE rooms SET sort_order = ? WHERE id = ?').run(next.sort_order, room.id);
    db.prepare('UPDATE rooms SET sort_order = ? WHERE id = ?').run(room.sort_order, next.id);
  }
  res.redirect(`/dashboard/tours/${tour.id}/rooms`);
});

// DELETE /dashboard/hotspots/:id
router.delete('/hotspots/:id', (req, res) => {
  const hotspot = db.prepare(`
    SELECT h.*, r.tour_id, r.id AS room_id
    FROM hotspots h
    JOIN rooms r ON r.id = h.from_room_id
    WHERE h.id = ?
  `).get(req.params.id);

  if (!hotspot) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Hotspot not found' });

  db.prepare('DELETE FROM hotspots WHERE id = ?').run(hotspot.id);
  res.redirect(`/dashboard/tours/${hotspot.tour_id}/rooms/${hotspot.room_id}/edit`);
});

module.exports = router;
