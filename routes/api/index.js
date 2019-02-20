const express = require('express');
const router = express.Router();

router.use('/product', require('./product'));
router.use('/roadNameAddress', require('./roadNameAddress'));
router.use('/auth', require('./auth'));

module.exports = router;