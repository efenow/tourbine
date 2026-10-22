const express = require('express');
const router = express.Router();
const { publicLimiter } = require('../rate-limit');
const { listTours } = require('../tour-data');

router.use(publicLimiter);

router.get('/', (req, res) => {
  res.render('index', { title: 'Tours', tours: listTours() });
});

module.exports = router;
