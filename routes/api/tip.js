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

async function putImage(file, folderName, fileName) {
    const params = {
        Bucket: config.s3Bucket,
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    if (!(file.type ===  'image/gif' 
            || file.type === 'image/jpg' 
            || file.type === 'image/png'
            || file.type === 'image/jpeg')) {
        res.status(400).json({
            error: "invalid file(only image)"
        });
        return;
    } else {
        params.Key = folderName + fileName + getExtension(file.name);
        params.Body = require('fs').createReadStream(file.path);
    }

    await s3.putObject(params, (err, data) => {
        if (err){
            res.status(424).json({
                error: "s3 store failed"
            });
            return;
        }
    })

    return params.Key;
}


/*
    > admin이 꿀팁을 작성하는 api
    > POST /api/tip/post
    > form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), titleImage(표지 이미지), contentImage(내용 이미지)
      content는 없을 경우 빈 string "" 보낼 것
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "invalied file(image only)": 이미지가 아닌 파일이 넘어옴
          "s3 store failed": s3 버켓에 이미지 저장 실패
          "post add failed": 작성 실패
      }
    > result: {
        db안에 생성된 포스트 정보 전달
    }
*/
router.post('/post', formidable(), (req, res) => {
    let token = req.headers['authorization'];

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

        if (!req.fields.title || !req.fields.subtitle || !req.fields.content || !req.files.titleImage || typeof req.files.titleImage === 'undefined' 
                || !req.files.contentImage || typeof req.files.contentImage === 'undefined') {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        postObj.title = req.fields.title;
        postObj.subtitle = req.fields.subtitle;
        postObj.content = req.fields.content;

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

            putImage(req.files.titleImage, 'tip-images/title-images/', nextIndex).then(key => {
                postObj.titleImageUrl = config.s3Url + key;

                putImage(req.files.contentImage, 'tip-images/content-images/', nextIndex).then(key => {
                    postObj.contentImageUrl = config.s3Url + key;
                    
                    db.HoneyTip.create(
                        postObj
                    ).then((result) => {
                        if (!result) {
                            res.status(424).json({
                                error: "post add failed"
                            });
                        } else {
                            res.json(result);
                            return;
                        }
                    });
                });
            });
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > admin이 꿀팁/이벤트를 수정하는 api
    > PUT /api/tipEvent/post?index=1?isTip=true
    > form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), expirationDate(만료 일자), 
      content는 없을 경우 빈 string "" 보낼 것, req.query.isTip으로 팁인지 이벤트인지 여부 전달.(팁이면 true, 이벤트면 false), 해당하는 포스트의 index를 req.query.index로 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "invalied file(image only)": 이미지가 아닌 파일이 넘어옴
          "no such post": 해당 포스트는 존재하지 않음
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실해
          "s3 store failed": s3 버켓에 이미지 저장 실패
          "post update failed": 수정 실패
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.put('/post', formidable(), (req, res) => {
    let token = req.headers['authorization'];

    const addParams = {
        Bucket: config.s3Bucket,
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    const deleteParams = {
        Bucket: config.s3Bucket,
        Key: null,
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
                || typeof req.files.postImage === 'undefined' || !req.query.isTip) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (req.query.isTip !== 'true' && req.query.isTip !== 'false') {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!moment(req.fields.expirationDate).isValid() || !moment(req.fields.expirationDate).isAfter(moment())) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        postObj.title = req.fields.title;
        postObj.subtitle = req.fields.subtitle;
        postObj.content = req.fields.content;
        postObj.expirationDate = moment(req.fields.expirationDate);

        if (!(req.files.postImage.type ===  'image/gif' 
                || req.files.postImage.type === 'image/jpg' 
                || req.files.postImage.type === 'image/png'
                || req.files.postImage.type === 'image/jpeg')) {
            res.status(400).json({
                error: "invalid file(only image)"
            });
        }

        if (req.query.isTip === 'true') {
            db.HoneyTip.findOne({
                where: {
                    index: Number(req.query.index),
                }
            }).then((result) => {
                if (!result) {
                    req.status(424).json({
                        error: "no such post"
                    });
                    return;
                } else {
                    deleteParams.Key = "tip-images/" + result.dataValues.index.toString() + getExtension(result.dataValues.photoUrl);
                    s3.deleteObject(deleteParams, (err, data) => {
                        if (err) {
                            req.status(424).json({
                                error: "s3 delete failed"
                            });
                            return;
                        } else {
                            addParams.Key = "tip-images/" + result.dataValues.index.toString() + getExtension(req.files.postImage.name);
                            addParams.Body = require('fs').createReadStream(req.files.postImage.path);
                            postObj.photoUrl = config.s3Url + addParams.Key;

                            s3.putObject(addParams, (err, data) => {
                                if (err) {
                                    req.status(424).json({
                                        error: "s3 add failed"
                                    });
                                    return;
                                } else {
                                    db.HoneyTip.update(
                                        postObj,
                                        {
                                            where: {
                                                index: result.dataValues.index
                                            }
                                        }
                                    ).then((result) => {
                                        if (!result) {
                                            req.status(424).json({
                                                error: "post update failed"
                                            });
                                            return;
                                        } else {
                                            res.json({
                                                success: true
                                            });
                                            return;
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        } else {
            db.Event.findOne({
                where: {
                    index: Number(req.query.index),
                }
            }).then((result) => {
                if (!result) {
                    req.status(424).json({
                        error: "no such post"
                    });
                    return;
                } else {
                    deleteParams.Key = "event-images/" + result.dataValues.index.toString() + getExtension(result.dataValues.photoUrl);
                    s3.deleteObject(deleteParams, (err, data) => {
                        if (err) {
                            req.status(424).json({
                                error: "s3 delete failed"
                            });
                            return;
                        } else {
                            addParams.Key = "event-images/" + result.dataValues.index.toString() + getExtension(req.files.postImage.name);
                            addParams.Body = require('fs').createReadStream(req.files.postImage.path);
                            postObj.photoUrl = config.s3Url + addParams.Key;

                            s3.putObject(addParams, (err, data) => {
                                if (err) {
                                    req.status(424).json({
                                        error: "s3 add failed"
                                    });
                                    return;
                                } else {
                                    db.Event.update(
                                        postObj,
                                        {
                                            where: {
                                                index: result.dataValues.index
                                            }
                                        }
                                    ).then((result) => {
                                        if (!result) {
                                            req.status(424).json({
                                                error: "post update failed"
                                            });
                                            return;
                                        } else {
                                            res.json({
                                                success: true
                                            });
                                            return;
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > admin이 꿀팁/이벤트를 삭제하는 api
    > DELETE /api/tipEvent/post?index=1?isTip=true
    > req.query.index로 삭제하고자 하는 포스트의 index, req.query.isTip으로 팁인지 이벤트인지의 여부를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "no such post": 해당 포스트는 존재하지 않음
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실패
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.delete('/post', (req, res) => {
    let token = req.headers['authorization'];

    const params = {
        Bucket: config.s3Bucket,
        Key: null
    };

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

        if (!req.query.isTip) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (req.query.isTip !== 'true' && req.query.isTip !== 'false') {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (req.query.isTip === 'true') {
            db.HoneyTip.findOne({
                where: {
                    index: Number(req.query.index)
                }
            }).then((result) => {
                if (!result) {
                    res.status(424).json({
                        error: "no such post"
                    });
                    return;
                } else {
                    params.Key = "tip-images/" + result.dataValues.index.toString() + getExtension(result.dataValues.photoUrl);
                    s3.deleteObject(params, (err, data) => {
                        if (err) {
                            res.status(424).json({
                                error: "s3 delete failed"
                            });
                            return;
                        } else {
                            db.HoneyTip.destroy({
                                where: {
                                    index: Number(req.query.index)
                                }
                            }).then((result) => {
                                if (!result) {
                                    res.status(424).json({
                                        error: "post delete failed"
                                    });
                                    return;
                                } else {
                                    res.json({
                                        success: true
                                    });
                                }
                            });
                        }
                    });
                }
            });
        } else {
            db.Event.findOne({
                where: {
                    index: Number(req.query.index)
                }
            }).then((result) => {
                if (!result) {
                    res.status(424).json({
                        error: "no such post"
                    });
                    return;
                } else {
                    params.Key = "event-images/" + result.dataValues.index.toString() + getExtension(result.dataValues.photoUrl);
                    s3.deleteObject(params, (err, data) => {
                        if (err) {
                            res.status(424).json({
                                error: "s3 delete failed"
                            });
                            return;
                        } else {
                            db.Event.destroy({
                                where: {
                                    index: Number(req.query.index)
                                }
                            }).then((result) => {
                                if (!result) {
                                    res.status(424).json({
                                        error: "post delete failed"
                                    });
                                    return;
                                } else {
                                    res.json({
                                        success: true
                                    });
                                }
                            });
                        }
                    });
                }
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