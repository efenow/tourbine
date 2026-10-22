const express = require('express');
const router = express.Router();
const { publicLimiter } = require('../rate-limit');
const db = require('../db');
const { buildTourData } = require('../tour-data');

router.use(publicLimiter);

// Escape characters that would let user-controlled text break out of the
// inline <script> block on the tour page.
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

let lastPrune = 0;

// Keep the analytics table bounded. Runs at most once per hour, only when a
// tour is actually viewed, so an idle instance does no work.
function pruneOldViews() {
  if (Date.now() - lastPrune < 60 * 60 * 1000) return;
  lastPrune = Date.now();
  try {
    db.prepare("DELETE FROM tour_views WHERE viewed_at < datetime('now', '-90 days')").run();
  } catch (e) {
    // Pruning is best-effort; never block a tour view
  }
}

function recordView(req, tourId, roomId, isEmbed) {
  pruneOldViews();
  try {
    db.prepare(`
      INSERT INTO tour_views (tour_id, room_id, is_embed, user_agent, referer)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      tourId,
      roomId || null,
      isEmbed ? 1 : 0,
      req.get('user-agent') || '',
      req.get('referer') || ''
    );
  } catch (e) {
    // Analytics failures should not block the tour view
  }
}

router.get('/:tourSlug', (req, res) => {
  const data = buildTourData(req.params.tourSlug);
  if (!data) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });

  const { tour, rooms, scenesObj, roomDataObj, firstScene, firstRoomId } = data;
  const roomId = firstRoomId || (firstScene ? parseInt(firstScene.replace('room-', ''), 10) : null);
  recordView(req, tour.id, roomId, false);
  res.render('tour', {
    title: tour.name,
    tour,
    rooms,
    scenes: jsonForScript(scenesObj),
    roomData: jsonForScript(roomDataObj),
    firstScene,
    firstRoomId,
    embedMode: false,
    isAuthenticated: !!(req.session && req.session.userId)
  });
});

router.get('/:tourSlug/embed', (req, res) => {
  const data = buildTourData(req.params.tourSlug);
  if (!data) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });

  const { tour, rooms, scenesObj, roomDataObj, firstScene, firstRoomId } = data;
  const roomId = firstRoomId || (firstScene ? parseInt(firstScene.replace('room-', ''), 10) : null);
  recordView(req, tour.id, roomId, true);
  res.render('tour', {
    title: tour.name,
    tour,
    rooms,
    scenes: jsonForScript(scenesObj),
    roomData: jsonForScript(roomDataObj),
    firstScene,
    firstRoomId,
    embedMode: true,
    isAuthenticated: false
  });
});

module.exports = router;
