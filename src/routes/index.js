const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db');

router.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

router.get('/', (req, res) => {
  const tours = db.prepare(`
    SELECT t.*,
      COUNT(r.id) AS room_count,
      COALESCE(
        t.cover_image_path,
        (SELECT r2.image_path FROM rooms r2 WHERE r2.tour_id = t.id AND r2.is_default = 1 AND r2.image_path IS NOT NULL LIMIT 1),
        (SELECT r3.image_path FROM rooms r3 WHERE r3.tour_id = t.id AND r3.image_path IS NOT NULL ORDER BY r3.sort_order ASC, r3.created_at ASC LIMIT 1)
      ) AS cover_image
    FROM tours t
    LEFT JOIN rooms r ON r.tour_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();

  res.render('index', { title: 'Tours', tours });
});

module.exports = router;
