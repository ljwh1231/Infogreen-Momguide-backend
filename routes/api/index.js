const express = require('express');
const router = express.Router();

router.use('/product', require('./product'));
router.use('/roadNameAddress', require('./roadNameAddress'));
router.use('/auth', require('./auth'));
router.use('/ask', require('./ask'));
router.use('/review', require('./review'));

module.exports = router;