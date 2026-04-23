const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:tourSlug', (req, res) => {
  const tour = db.prepare('SELECT * FROM tours WHERE slug = ?').get(req.params.tourSlug);
  if (!tour) return res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Tour not found' });

  const rooms = db.prepare(`
    SELECT * FROM rooms WHERE tour_id = ?
    ORDER BY is_default DESC, created_at ASC
  `).all(tour.id);

  const hotspots = db.prepare(`
    SELECT h.*, r.name AS to_name
    FROM hotspots h
    JOIN rooms r ON r.id = h.to_room_id
    WHERE h.from_room_id IN (SELECT id FROM rooms WHERE tour_id = ?)
  `).all(tour.id);

  const scenesObj = {};
  for (const room of rooms) {
    if (!room.image_path) continue;
    const roomHotspots = hotspots
      .filter(h => h.from_room_id === room.id)
      .map(h => ({
        pitch: h.pitch,
        yaw: h.yaw,
        type: 'scene',
        text: h.text || h.to_name,
        sceneId: 'room-' + h.to_room_id
      }));

    scenesObj['room-' + room.id] = {
      title: room.name,
      type: 'equirectangular',
      panorama: '/' + room.image_path,
      pitch: room.initial_pitch,
      yaw: room.initial_yaw,
      hotSpots: roomHotspots
    };
  }

  const defaultRoom = rooms.find(r => r.is_default && r.image_path) || rooms.find(r => r.image_path);
  const firstScene = defaultRoom ? 'room-' + defaultRoom.id : null;

  res.render('tour', {
    title: tour.name,
    tour,
    rooms,
    scenes: JSON.stringify(scenesObj),
    firstScene
  });
});

module.exports = router;
