const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');

const db = require("../../models/index");
const config = require('../../config/config');
const util = require('./util');

// 메인 페이지에 걸 꿀팁 3개 이벤트 2개
/*
    > 메인 페이지에 걸 꿀팁 3개 이벤트 2개를 가져오는 api
    > GET /api/main/tipEvent
    > req로 전달할 것 없음.
    > error: {
          "find error": db에서 정보를 찾는 데에 오류 발생
      }
    > {
        Tips: 꿀팁 최신순 3개
        Events: 이벤트 최신순 2개
      }
*/
router.get('/tipEvent', (req, res) => {

    db.HoneyTip.findAll({
        where: {},
        limit: 3,
        order: [['created_at', 'DESC']]
    }).then((tips) => {
        if (!tips) {
            res.status(424).json({
                error: 'find error'
            });
            return;
        } else {
            db.Event.findAll({
                where: {expirationDate: {$ne: null}},
                limit: 2,
                order: [['created_at', 'DESC']]
            }).then((events) => {
                if (!events) {
                    res.status(424).json({
                        error: 'find error'
                    });
                    return;
                } else {
                    res.json({Tips: tips, events: events});
                    return;
                }
            });
        }
    });

});

module.exports = router;