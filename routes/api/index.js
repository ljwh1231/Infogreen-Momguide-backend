const express = require('express');
const router = express.Router();

router.use('/product', require('./product'));
router.use('/roadNameAddress', require('./roadNameAddress'));

module.exports = router;