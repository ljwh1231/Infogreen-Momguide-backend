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
    > GET /api/event/postList?state=total&page=1
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
router.get('/postList', (req, res) => {
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

/*
    > 유저가 이벤트에 댓글을 작성하는 api
    > POST /api/event/comment
    > req.body.content로 댓글 내용, req.body.eventIndex로 해당 이벤트의 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": 존재하지 않는 포스트
          "no such member": 존재하지 않는 회원
          "unauthorized request": 권한 없는 접근
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/comment', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.content) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Event.findOne({
            where: {
                index: req.body.eventIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
                return;
            } else {
                const event = result;

                db.MemberInfo.findOne({
                    index: token.index
                }).then(async (result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such member"
                        });
                    } else {
                        const member = result;
                        
                        const comment = await db.Comment.create({
                            content: req.body.content,
                        });

                        event.addComment(comment);
                        member.addComment(comment);

                        res.json(comment);
                    }
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
    > 유저가 이벤트에 작성한 댓글을 삭제하는 api(대댓글도 똑같으므로 같은 api로 사용한다.)
    > DELETE /api/event/comment
    > req.body.index로 댓글의 index, req.body.eventIndex로 해당 이벤트의 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "comment delete failed": 댓글 삭제 실패
          "unauthorized request": 권한 없는 접근
      }
    > success: {
        true: 성공적으로 댓글을 삭제
      }
*/
router.delete('/comment', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Comment.findOne({
            where: {
                index: req.body.index,
                member_info_index: token.index,
                event_index: req.body.eventIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such comment"
                });
                return;
            } else {
                if (result.dataValues.isDeleted) {
                    res.status(400).json({
                        error: "already deleted"
                    });
                    return;
                }

                db.Comment.update(
                    {
                        content: "삭제된 댓글입니다.",
                        isDeleted: true
                    },
                    {
                        where: {
                            index: req.body.index,
                            member_info_index: token.index,
                            event_index: req.body.eventIndex
                        }
                    }
                ).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "comment delete failed"
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
        
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > 유저가 이벤트에 작성한 댓글을 수정하는 api(대댓글도 똑같으므로 같은 api로 사용한다.)
    > PUT /api/event/comment
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.content로 수정 내용, req.body.index로 댓글의 index, req.body.eventIndex로 해당 꿀팁의 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "comment edit failed": 댓글 수정 실패
          "unauthorized request": 권한 없는 접근
      }
    > success: {
        true: 성공적으로 댓글을 수정
      }
*/
router.put('/comment', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Comment.findOne({
            where: {
                index: req.body.index,
                member_info_index: token.index,
                event_index: req.body.eventIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such comment"
                });
                return;
            } else {
                if (result.dataValues.isDeleted) {
                    res.status(400).json({
                        error: "already deleted"
                    });
                    return;
                }

                db.Comment.update(
                    {
                        content: req.body.content,
                    },
                    {
                        where: {
                            index: req.body.index,
                            member_info_index: token.index,
                            event_index: req.body.eventIndex
                        }
                    }
                ).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "comment edit failed"
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
        
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > 유저가 이벤트 댓글에 대댓글을 작성하는 api
    > POST /api/event/childComment
    > req.body.content로 댓글 내용, req.body.commentIndex로 해당 댓글의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "no such post": 존재하지 않는 포스트
          "no such member": 존재하지 않는 회원
          "unauthorized request": 권한 없는 접근
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/childComment', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.content) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Comment.findOne({
            where: {
                index: req.body.commentIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such comment"
                });
                return;
            } else  {
                result.increment("childNum");
                const parentIndex = result.dataValues.index;

                db.Event.findOne({
                    where: {
                        index: result.dataValues.event_index
                    }
                }).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                        return;
                    } else {
                        const event = result;

                        db.MemberInfo.findOne({
                            where: {
                                index: token.index
                            }
                        }).then(async (result) => {
                            if (!result) {
                                res.status(424).json({
                                    error: "no such member"
                                });
                                return;
                            } else {
                                const member = result;

                                const childComment = await db.Comment.create({
                                    content: req.body.content,
                                    parentIndex: parentIndex
                                });
                            
                                event.addComment(childComment);
                                member.addComment(childComment);
                            
                                res.json(childComment);
                                return;
                            }
                        });
                    }
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
    > 이벤트 포스트 하나의 본문과 그 딸린 댓글들을 불러오는 api
    > GET /api/event/post?index=1
    > req.query.index 해당 팁의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": 존재하지 않는 포스트
          "find error": db에 있는 정보를 가져오는 데에 문제 발생
          "unauthorized request": 권한 없는 접근
      }
    > [
        댓글 정보를 배열로 전달. 각 댓글 객체 안의 creator 객체로 작성자의 정보를 전달.(이미 삭제된 댓글의 경우 작성자 정보가 빈 객체로 전달.)
      ]
*/
router.get('/post', (req, res) => {
    if (!req.query.index) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.Event.findOne({
        where: {
            index: req.query.index
        }
    }).then((event) => {
        if (!event) {
            res.status(424).json({
                error: "no such post"
            });
            return;
        } else {
            event.getComments().then(async (comments) => {
                if (!comments) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    for (let i=0; i<comments.length; ++i) {
                        if (comments[i].dataValues.isDeleted) {
                            comments[i].dataValues.creator = {};
                        } else {
                            await db.MemberInfo.findOne({
                                attributes: [
                                    'index', 'nickName', 'photoUrl', 'gender', 'memberBirthYear', 'memberBirthMonth', 'memberBirthDay',
                                    'hasChild', 'childBirthYear', 'childBirthMonth', 'childBirthDay'
                                ],
                                where: {
                                    index: comments[i].dataValues.member_info_index
                                }
                            }).then((result) => {
                                if (!result) {
                                    res.status(424).json({
                                        error: "find error"
                                    });
                                    return;
                                } else {
                                    comments[i].dataValues.creator = result.dataValues;
                                }
                            });
                        }
                    }
                    res.json(comments);
                    return;
                }
            });
        }
    });
});

/*
    > 이벤트 포스트의 특정 댓글의 대댓글들을 불러오는 api
    > GET /api/event/childComment?index=1
    > req.query.index 해당 댓글의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "not proper comment": 적절하지 않은 댓글(이벤트가 아닌 꿀팁의 댓글이거나 대댓글을 불러올 경우)
          "find error": db에 있는 정보를 가져오는 데에 문제 발생
          "unauthorized request": 권한 없는 접근
      }
    > [
        댓글 정보를 배열로 전달. 각 댓글 객체 안의 creator 객체로 작성자의 정보를 전달.(이미 삭제된 댓글의 경우 작성자 정보가 빈 객체로 전달.)
      ]
*/
router.get('/childComment', (req, res) => {
    if (!req.query.index) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.Comment.findOne({
        where: {
            index: Number(req.query.index)
        }
    }).then((comment) => {
        if (!comment) {
            res.status(424).json({
                error: "no such comment"
            });
            return;
        } else if (comment.dataValues.honey_tip_index !== null || comment.dataValues.parentIndex !== null) {
            res.status(424).json({
                error: "not proper comment"
            });
            return;
        } else {
            db.Comment.findAll({
                where: {
                    parentIndex: comment.dataValues.index
                }
            }).then(async (childComments) => {
                if (!childComments) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    for (let i=0; i<childComments.length; ++i) {
                        if (childComments[i].dataValues/isDeleted){
                            childComments[i].dataValues.creator = {};
                        } else {
                            await db.MemberInfo.findOne({
                                attributes: [
                                    'index', 'nickName', 'photoUrl', 'gender', 'memberBirthYear', 'memberBirthMonth', 'memberBirthDay',
                                    'hasChild', 'childBirthYear', 'childBirthMonth', 'childBirthDay'
                                ],
                                where: {
                                    index: childComments[i].dataValues.member_info_index
                                }
                            }).then((result) => {
                                if (!result) {
                                    res.status(424).json({
                                        error: "find error"
                                    });
                                    return;
                                } else {
                                    childComments[i].dataValues.creator = result.dataValues;
                                }
                            });
                        }
                    }
                    res.json(childComments);
                    return;
                }
            });
        }
    });
});

/*
    > 유저가 이벤트 신청하는 api
    > POST /api/event/application
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.eventIndex로 신청하고자 하는 이벤트 인덱스 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
          "additional info necessary": 추가 정보가 없음. 입력 요망.
          "no such event": 존재하지 않는 이벤트
          "expired event": 이미 만료된 이벤트
          "application add failed": 이벤트 신청 실패
          "unauthorized request": 권한 없는 접근
      }
    > success: {
        true: 성공적으로 신청 완료
      }
*/
router.post('/application', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.eventIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        }).then((member) => {
            if (!member) {
                res.status(424).json({
                    error: "no such member"
                });
                return;
            } else {
                if (member.dataValues.name === null || member.dataValues.phoneNum === null || member.dataValues.postalCode === null
                        || member.dataValues.addressRoad === null || member.dataValues.addressSpec === null) {
                    res.status(400).json({
                        error: "additional info necessary"
                    });
                    return;
                }

                db.Event.findOne({
                    where: {
                        index: req.body.eventIndex
                    }
                }).then((event) => {
                    if (!event) {
                        req.status(424).json({
                            error: "no such event"
                        });
                        return;
                    } else {
                        if (event.dataValues.expirationDate > moment()) {
                            res.status(400).json({
                                error: "expired event"
                            });
                            return;
                        }

                        const application = member.addEvents(event);

                        if (!application) {
                            res.status(424).json({
                                error: "application add failed"
                            });
                            return;
                        } else {
                            res.json({
                                success: true
                            });
                            return;
                        }
                    }
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

module.exports = router;