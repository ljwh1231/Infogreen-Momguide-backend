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

/*
    > admin이 꿀팁/이벤트를 작성하는 api
    > POST /api/tipEvent/post
    > form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), expirationDate(만료 일자), postImage(이미지), isTip(팁이면 true, 이벤트면 false)
      content는 없을 경우 빈 string "" 보낼 것
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "invalied file(image only)": 이미지가 아닌 파일이 넘어옴
          "s3 store failed": s3 버켓에 이미지 저장 실패
          "post add failed": 작성 실패
      }
    > result: {
        db안에 생성된 회원정보가 전달
    }
*/
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

        if (!req.fields.title || !req.fields.subtitle || !req.fields.content || !req.fields.expirationDate || !req.files.postImage
                || typeof req.files.postImage === 'undefined' || !req.fields.isTip) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (req.fields.isTip !== 'true' && req.fields.isTip !== 'false') {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!moment(req.fields.expirationDate).isValid()) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        postObj.title = req.fields.title;
        postObj.subtitle = req.fields.subtitle;
        postObj.content = req.fields.content;
        postObj.expirationDate = moment(req.fields.expirationDate);

        if (req.fields.isTip === 'true') {
            db.HoneyTip.findAll({
                limit: 1,
                where: {},
                order: [[ 'created_at', 'DESC' ]]
            }).then((result) => {
                let nextIndex = 0;
                if (result.length === 0) {
                    nextIndex = 1;
                } else {
                    nextIndex = result[0].dataValues.index + 1;
                }

                if (!(req.files.postImage.type ===  'image/gif' 
                        || req.files.postImage.type === 'image/jpg' 
                        || req.files.postImage.type === 'image/png'
                        || req.files.postImage.type === 'image/jpeg')) {
                    res.status(400).json({
                        error: "invalid file(only image)"
                    });
                } else {
                    params.Key = "tip-images/" + nextIndex.toString() + getExtension(req.files.postImage.name);
                    params.Body = require('fs').createReadStream(req.files.postImage.path);
                    postObj.photoUrl = config.s3Url + params.Key;
                }

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
                    nextIndex = result[0].dataValues.index + 1;
                }

                if (!(req.files.postImage.type ===  'image/gif' 
                        || req.files.postImage.type === 'image/jpg' 
                        || req.files.postImage.type === 'image/png'
                        || req.files.postImage.type === 'image/jpeg')) {
                    res.status(400).json({
                        error: "invalid file(only image)"
                    });
                } else {
                    params.Key = "event-images/" + nextIndex.toString() + getExtension(req.files.postImage.name);
                    params.Body = require('fs').createReadStream(req.files.postImage.path);
                    postObj.photoUrl = config.s3Url + params.Key;
                }

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