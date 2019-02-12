const express = require('express');
const router = express.Router();
const config = require('../../config/config');
const axios = require('axios');
const circularJson = require('circular-json');

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

    console.log(JSON.stringify({
        confmKey: config.roadNameAddressAPIKey,
        currentPage: Number(currentPage),
        countPerPage: Number(countPerPage),
        keyword: keyword,
        resultType: 'json'
    }));

    const dataObject = new FormData();
    dataObject.append('confmKey', config.roadNameAddressAPIKey);
    dataObject.append('currentPage', Number(currentPage));
    dataObject.append('countPerPage', Number(countPerPage));
    dataObject.append('keyword', keyword);
    dataObject.append(resultType, 'json');

    axios({
        method: 'post',
        url: 'http://www.juso.go.kr/addrlink/addrLinkApi.do',
        data: dataObject,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    }).then((roadRes) => {
        console.log(roadRes);
        res.json({
            data: roadRes.data
        });
    }).catch((err) => {
        res.status(400).json({
            message: 'API error'
        });
    });
});

module.exports = router;