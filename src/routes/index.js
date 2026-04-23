const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const tours = db.prepare(`
    SELECT t.*,
      COUNT(r.id) AS room_count,
      (SELECT r2.image_path FROM rooms r2 WHERE r2.tour_id = t.id AND r2.is_default = 1 LIMIT 1) AS cover_image
    FROM tours t
    LEFT JOIN rooms r ON r.tour_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();

  res.render('index', { title: 'Tours', tours });
});

module.exports = router;
