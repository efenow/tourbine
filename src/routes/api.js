const express = require('express');
const { publicLimiter } = require('../rate-limit');
const { buildTourData, listTours } = require('../tour-data');

const router = express.Router();

router.use(publicLimiter);

router.get('/tours', (req, res) => {
  res.json({ tours: listTours() });
});

router.get('/tours/:slug', (req, res) => {
  const data = buildTourData(req.params.slug);
  if (!data) return res.status(404).json({ error: 'Tour not found' });

  const { tour, rooms, hotspots, scenesObj, firstScene } = data;
  res.json({
    tour,
    rooms,
    hotspots,
    scenes: scenesObj,
    firstScene
  });
});

module.exports = router;
