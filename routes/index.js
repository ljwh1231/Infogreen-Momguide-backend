const express = require('express');
const router = express.Router();

router.use('/', require('./api'));
console.log('debug1');
module.exports = router;