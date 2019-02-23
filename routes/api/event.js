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
    const list = fileName.split('.');
    return '.' + list[list.length-1];
}

// function to decode user token
function decodeToken(res, token) {

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

async function putImage(res, file, folderName, fileName) {
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

// function to delete an image in s3 bucket
async function deleteImage(res, folderName, fileName, fileUrl) {
    const params = {
        Bucket: config.s3Bucket,
        Key: null,
    };

    params.Key = folderName + fileName + getExtension(fileUrl);

    await s3.deleteObject(params, (err, data) => {
        if (err){
            res.status(424).json({
                error: "s3 delete failed"
            });
            return;
        }
    });

    return params.Key;
}

/*
    > admin이 이벤트를 작성하는 api
    > POST /api/event/post
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), expirationDate(만료 날짜), titleImage(표지 이미지), contentImage(내용 이미지)
      content는 없을 경우 빈 string "" 보낼 것. exirationDate의 형식은 "YYYY MM DD HH:MM:SS"(ex> 2019-02-20 00:00:00)
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

    moment.tz.setDefault("Asia/Seoul");
    postObj = {};

    decodeToken(res, token).then((token) => {
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
                || !req.files.contentImage || typeof req.files.contentImage === 'undefined' || !req.fields.expirationDate) {
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
        postObj.expirationDate = moment(req.fields.expirationDate).format("YYYY-MM-DD HH:MM:SS");
        
        db.Event.findAll({
            limit: 1,
            where: {},
            order: [[ 'index', 'DESC' ]]
        }).then((result) => {
            let nextIndex = 0;
            if (result.length === 0) {
                nextIndex = 1;
            } else {
                nextIndex = result[0].dataValues.index + 1;
            }

            putImage(res, req.files.titleImage, 'event-images/title-images/', nextIndex).then(key => {
                postObj.titleImageUrl = config.s3Url + key;

                putImage(res, req.files.contentImage, 'event-images/content-images/', nextIndex).then(key => {
                    postObj.contentImageUrl = config.s3Url + key;
                    
                    db.Event.create(
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
    > admin이 이벤트를 수정하는 api
    > PUT /api/event/post?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), expirationDate(만료 일자) titleImage(표지 사진), contentImage(내용 사진) 
      content는 없을 경우 빈 string "" 보낼 것, exirationDate의 형식은 "YYYY MM DD HH:MM:SS"(ex> 2019-02-20 00:00:00),
      해당하는 포스트의 index를 req.query.index로 전달
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

    moment.tz.setDefault("Asia/Seoul");
    postObj = {};

    decodeToken(res, token).then((token) => {
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
                || !req.files.contentImage || typeof req.files.contentImage === 'undefined' || !req.fields.expirationDate) {
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
        postObj.expirationDate = moment(req.fields.expirationDate).format("YYYY-MM-DD HH:MM:SS");
        
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
                deleteImage(res, 'event-images/title-images/', result.dataValues.index.toString(), result.dataValues.titleImageUrl).then(key => {
                    deleteImage(res, 'event-images/content-images/', result.dataValues.index.toString(), result.dataValues.contentImageUrl).then(key => {
                        putImage(res, req.files.titleImage, 'event-images/title-images/', result.dataValues.index.toString()).then(key => {
                            postObj.titleImageUrl = config.s3Url + key;

                            putImage(res, req.files.contentImage, 'event-images/content-images/', result.dataValues.index.toString()).then(key => {
                                postObj.contentImageUrl = config.s3Url + key;

                                db.Event.update(
                                    postObj,
                                    {
                                        where: {
                                            index: result.dataValues.index
                                        }
                                    }
                                ).then((result) => {
                                    if (!result) {
                                        res.status(424).json({
                                            error: "post update failed"
                                        });
                                        return;
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                    }
                                });
                            });
                        });
                    });
                });
            }
        });
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > admin이 이벤트를 삭제하는 api
    > DELETE /api/event/post?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.query.index로 삭제하고자 하는 포스트의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "no such post": 해당 포스트는 존재하지 않음
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실패
          "post delete failed": 포스트 삭제 실패
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.delete('/post', (req, res) => {
    let token = req.headers['authorization'];
    
    decodeToken(res, token).then((token) => {
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

        db.Event.findOne({
            where: Number(req.query.index)
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
            } else {
                deleteImage(res, 'event-images/title-images/', result.dataValues.index.toString(), result.dataValues.titleImageUrl).then(key => {
                    deleteImage(res, 'event-images/content-images/', result.dataValues.index.toString(), result.dataValues.contentImageUrl).then(key => {
                        db.Event.destroy({
                            where: {
                                index: result.dataValues.index
                            }
                        }).then((result) => {
                            if (!result) {
                                res.status(424).json({
                                    error: "post delete failed"
                                });
                            } else {
                                res.json({
                                    success: true
                                });
                            }
                        });
                    });
                });
            }
        });
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > 이벤트 목록 불러오는 api
    > GET /api/event/post?state=total&page=1
    > req.query.page로 해당 페이지 넘버를 전달, req.query.state로 보기 옵션을 전달(total은 전체, progress는 진행 중인 이벤트, finished는 종료된 이벤트)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "find error": 탐색 오류
      }
    > {
        Data: [] (제품 정보 배열)
        totalPages: 전체 페이지 수
        nextNum: 다음 페이지에서 보여야할 포스트 수
      }
*/
router.get('/post', (req, res) => {
    let limit = 12;
    const currentDate = moment();

    moment.tz.setDefault("Asia/Seoul");

    if (!req.query.page) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    if (req.query.state === 'total') {
        db.Event.findAndCountAll({
            where: {}
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "find error"
                });
                return;
            }
    
            let totalNum = result.count;
            let totalPages = Math.ceil(totalNum/limit);
            let nextNum = 0;
    
            db.Event.findAll({
                where: {},
                limit: limit,
                offset: limit * (Number(req.query.page)-1),
                attributes: ['title', 'subtitle', 'titleImageUrl', 'expirationDate', 'created_at']
            }).then((result) => {
                if (!result) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    if (Number(req.query.page) === (totalPages - 1)) {
                        nextNum = totalNum % limit;
                    } else if (Number(req.query.page) >= totalPages) {
                        nextNum = 0;
                    } else {
                        nextNum = limit;
                    }
                    res.json({Data: result, totalPages: totalPages, nextNum: nextNum});
                    return;
                }
            });
        });
    } else if (req.query.state === 'progress') {
        db.Event.findAndCountAll({
            where: {
                expirationDate: { 
                    $gte: currentDate
                }
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "find error"
                });
                return;
            }
    
            let totalNum = result.count;
            let totalPages = Math.ceil(totalNum/limit);
            let nextNum = 0;
    
            db.Event.findAll({
                where: {
                    expirationDate: { 
                        $gte: currentDate
                    }
                },
                limit: limit,
                offset: limit * (Number(req.query.page)-1),
                attributes: ['title', 'subtitle', 'titleImageUrl', 'expirationDate', 'created_at']
            }).then((result) => {
                if (!result) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    if (Number(req.query.page) === (totalPages - 1)) {
                        nextNum = totalNum % limit;
                    } else if (Number(req.query.page) >= totalPages) {
                        nextNum = 0;
                    } else {
                        nextNum = limit;
                    }
                    res.json({Data: result, totalPages: totalPages, nextNum: nextNum});
                    return;
                }
            });
        });
    } else if (req.query.state === 'finished') {
        db.Event.findAndCountAll({
            where: {
                expirationDate: { 
                    $lt: currentDate
                }
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "find error"
                });
                return;
            }
    
            let totalNum = result.count;
            let totalPages = Math.ceil(totalNum/limit);
            let nextNum = 0;
    
            db.Event.findAll({
                where: {
                    expirationDate: { 
                        $lt: currentDate
                    }
                },
                limit: limit,
                offset: limit * (Number(req.query.page)-1),
                attributes: ['title', 'subtitle', 'titleImageUrl', 'expirationDate', 'created_at']
            }).then((result) => {
                if (!result) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    if (Number(req.query.page) === (totalPages - 1)) {
                        nextNum = totalNum % limit;
                    } else if (Number(req.query.page) >= totalPages) {
                        nextNum = 0;
                    } else {
                        nextNum = limit;
                    }
                    res.json({Data: result, totalPages: totalPages, nextNum: nextNum});
                    return;
                }
            });
        });
    } else {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }
    
});

module.exports = router;