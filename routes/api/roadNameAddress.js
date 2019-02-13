const express = require('express');
const router = express.Router();
const config = require('../../config/config');
const request = require('request');
const queryString = require('querystring');

/*
 * GET /api/roadNameAddress
 * QUERY SAMPLE: ?currentPage=1&countPerPage=10&keyword=서대문구창천동
 */

router.get('/', (req, res) => {
    const { currentPage, countPerPage, keyword } = req.query;
    if(typeof currentPage === 'undefined' || typeof countPerPage === 'undefined' || typeof keyword === 'undefined') {
        res.status(400).json({
            message: 'parameter is missing'
        });
    }
    if(isNaN(Number(currentPage)) || isNaN(Number(countPerPage))) {
        res.status(400).json({
            message: 'currentPage and countPerPage must be integer'
        });
    }

    const form = {
        confmKey: config.roadNameAddressAPIKey,
        currentPage: Number(currentPage),
        countPerPage: Number(countPerPage),
        keyword: keyword,
        resultType: 'json'
    };
    const formData = queryString.stringify(form);

    request({
        headers: {
            'Content-Length': formData.length,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        uri: 'http://www.juso.go.kr/addrlink/addrLinkApi.do',
        body: formData,
        method: 'POST'
    }, (err, response, body) => {
        res.send(body);
    });
});

module.exports = router;