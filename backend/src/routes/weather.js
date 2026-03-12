const express = require('express');
const router = express.Router();
const { getAll } = require('../controllers/weatherController');

router.get('/all', getAll);

module.exports = router;
