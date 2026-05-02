const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { buildTourData } = require('../tour-data');

router.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

function recordView(req, tourId, roomId, isEmbed) {
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

  const { tour, rooms, scenesObj, firstScene } = data;
  const roomId = firstScene ? parseInt(firstScene.replace('room-', ''), 10) : null;
  recordView(req, tour.id, roomId, false);
  res.render('tour', {
    title: tour.name,
    tour,
    rooms,
    scenes: JSON.stringify(scenesObj),
    firstScene,
    embedMode: false,
    isAuthenticated: !!(req.session && req.session.userId)
  });
});

router.get('/:tourSlug/embed', (req, res) => {
  const data = buildTourData(req.params.tourSlug);
  if (!data) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });

  const { tour, rooms, scenesObj, firstScene } = data;
  const roomId = firstScene ? parseInt(firstScene.replace('room-', ''), 10) : null;
  recordView(req, tour.id, roomId, true);
  res.render('tour', {
    title: tour.name,
    tour,
    rooms,
    scenes: JSON.stringify(scenesObj),
    firstScene,
    embedMode: true,
    isAuthenticated: false
  });
});

module.exports = router;
