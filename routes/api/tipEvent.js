const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const jwt = require('jsonwebtoken');
const formidable = require('express-formidable');
const moment = require('moment');
require('moment-timezone');

const db = require("../../models/index");
const config = require('../../config/config');

// function to get extension in filename
function getExtension(fileName) {
    var list = fileName.split('.');
    return '.' + list[list.length-1];
}

// function to decode user token
function decodeToken(token) {

    if (!token) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    token = token.substring(7);

    const promise = new Promise(
        (resolve, reject) => {
            jwt.verify(token, config.jwtSecret, (err, decoded) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(decoded);
                }
            })
        }
    );

    return promise;
}

// admin이 꿀팁/이벤트에 글을 작성하는 api
router.post('/post', formidable(), (req, res) => {
    let token = req.headers['authorization'];

    const params = {
        Bucket: config.s3Bucket,
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    postObj = {};

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (token.index !== 1) {
            res.status(403).json({
                error: "unauthorized request"
            });
            return;
        }

        if (!req.fields.title || !req.fields.subtitle || !req.fields.content || !req.fields.expirationDate || !req.fields.postImage
                || typeof req.files.postImage === 'undefined') {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        postObj.title = req.fields.title;
        postObj.subtitle = req.fields.subtitle;
        postObj.content = req.fields.content;
        postObj.expirationDate = moment(req.fields.expirationDate);

        if (req.query.isTip) {
            db.HoneyTip.findAll({
                limit: 1,
                where: {},
                order: [[ 'created_at', 'DESC' ]]
            }).then((result) => {
                let nextIndex = 0;
                if (result.length === 0) {
                    nextIndex = 1;
                } else {
                    nextIndex = result[0].dataValues.index;
                }

                params.Key = "tip-images/" + nextIndex.toString() + getExtension(req.files.postImage.name);
                params.Body = require('fs').createReadStream(req.files.postImage.path);
                postObj.photoUrl = config.s3Url + params.Key;

                s3.putObject(params, (err, data) => {
                    if (err) {
                        res.status(424).json({
                            error: "s3 store failed"
                        });
                        return;
                    } else {
                        db.HoneyTip.create(
                            postObj
                        ).done((result) => {
                            if (!result) {
                                res.status(424).json({
                                    error: "post add failed"
                                });
                            } else {
                                res.json(result);
                                return;
                            }
                        });
                    }
                });
            });
        } else {
            db.Event.findAll({
                limit: 1,
                where: {},
                order: [[ 'created_at', 'DESC' ]]
            }).then((result) => {
                let nextIndex = 0;
                if (result.length === 0) {
                    nextIndex = 1;
                } else {
                    nextIndex = result[0].dataValues.index;
                }

                params.Key = "event-images/" + nextIndex.toString() + getExtension(req.files.postImage.name);
                params.Body = require('fs').createReadStream(req.files.postImage.path);
                postObj.photoUrl = config.s3Url + params.Key;

                s3.putObject(params, (err, data) => {
                    if (err) {
                        res.status(424).json({
                            error: "s3 store failed"
                        });
                        return;
                    } else {
                        db.Event.create(
                            postObj
                        ).done((result) => {
                            if (!result) {
                                res.status(424).json({
                                    error: "post add failed"
                                });
                            } else {
                                res.json(result);
                                return;
                            }
                        });
                    }
                });
            });
        }

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

module.exports = router;