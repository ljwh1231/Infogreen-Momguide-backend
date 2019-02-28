const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const formidable = require('express-formidable');
const moment = require('moment');
require('moment-timezone');
const Sequelize = require('sequelize');

const db = require("../../models/index");
const config = require('../../config/config');
const util = require('./util');

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
        params.Key = folderName + fileName + util.getExtension(file.name);
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

    params.Key = folderName + fileName + util.getExtension(fileUrl);

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
    > admin이 이벤트/당첨자 발표를 작성하는 api
    > POST /api/event/post
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), titleImage(표지 이미지), contentImage(내용 이미지)
      content는 없을 경우 빈 string "" 보낼 것.
    > 선택정보: expirationDate(만료 날짜), exirationDate의 형식은 "YYYY MM DD HH:MM:SS"(ex> 2019-02-20 00:00:00),
      이벤트일 때만 만료 일자를 보내고 당첨자 발표일 땐 보내지 않기.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "invalied file(image only)": 이미지가 아닌 파일이 넘어옴
          "s3 store failed": s3 버켓에 이미지 저장 실패
          "post add failed": 작성 실패
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > result: {
        db안에 생성된 포스트 정보 전달
    }
*/
router.post('/post', formidable(), (req, res) => {
    let token = req.headers['authorization'];

    moment.tz.setDefault("Asia/Seoul");
    postObj = {};

    util.decodeToken(token, res).then((token) => {
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

        if (req.fields.expirationDate) {
            if (!moment(req.fields.expirationDate).isValid() || !moment(req.fields.expirationDate).isAfter(moment())) {
                res.status(400).json({
                    error: "invalid request"
                });
                return;
            } else {
                postObj.expirationDate = moment(req.fields.expirationDate).format("YYYY-MM-DD HH:MM:SS");
            }
        }

        postObj.title = req.fields.title;
        postObj.subtitle = req.fields.subtitle;
        postObj.content = req.fields.content;
        
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
                    ).catch(Sequelize.ValidationError, (err) => {
                        if (err) {
                            res.json({
                                error: 'validation error'
                            });
                            return;
                        }
                    }).then((result) => {
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
    > admin이 이벤트/당첨자발표를 수정하는 api
    > PUT /api/event/post?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), titleImage(표지 사진), contentImage(내용 사진) 
      content는 없을 경우 빈 string "" 보낼 것.
      해당하는 포스트의 index를 req.query.index로 전달
    > 선택정보: expirationDate(만료 일자), exirationDate의 형식은 "YYYY MM DD HH:MM:SS"(ex> 2019-02-20 00:00:00)
      이벤트일 때만 만료 일자를 보내고 당첨자 발표일 땐 보내지 않기.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "invalied file(image only)": 이미지가 아닌 파일이 넘어옴
          "no such post": 해당 포스트는 존재하지 않음
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실해
          "s3 store failed": s3 버켓에 이미지 저장 실패
          "post update failed": 수정 실패
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.put('/post', formidable(), (req, res) => {
    let token = req.headers['authorization'];  

    moment.tz.setDefault("Asia/Seoul");
    postObj = {};

    util.decodeToken(token, res).then((token) => {
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

        if (req.fields.expirationDate) {
            if (!moment(req.fields.expirationDate).isValid() || !moment(req.fields.expirationDate).isAfter(moment())) {
                res.status(400).json({
                    error: "invalid request"
                });
                return;
            } else {
                postObj.expirationDate = moment(req.fields.expirationDate).format("YYYY-MM-DD HH:MM:SS");
            }
        }

        postObj.title = req.fields.title;
        postObj.subtitle = req.fields.subtitle;
        postObj.content = req.fields.content;
        
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
                                ).catch(Sequelize.ValidationError, (err) => {
                                    if (err) {
                                        res.json({
                                            error: 'validation error'
                                        });
                                        return;
                                    }
                                }).then((result) => {
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
    > admin이 이벤트/당첨자발표를 삭제하는 api
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
    
    util.decodeToken(token, res).then((token) => {
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
    > 이벤트/당첨자발표 목록 불러오는 api
    > GET /api/event/postList?state=total&order=latest&page=1
    > req.query.page로 해당 페이지 넘버를 전달, req.query.state로 보기 옵션을 전달(total은 전체, progress는 진행 중인 이벤트, finished는 종료된 이벤트, winner는 당첨자발표)
      req.query.order로 정렬 방식을 전달(latest가 최신순, recommend는 추천순)
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
    let showCondition = {};

    if (req.query.state === 'total') {
        showCondition = {expirationDate: {$ne: null}};
    } else if (req.query.state === 'progress') {
        showCondition = {expirationDate: {$gte: currentDate}};
    } else if (req.query.state === 'finished') {
        showCondition = {expirationDate: {$lt: currentDate}};
    } else if (req.query.state === 'winner') {
        showCondition = {expirationDate: null};
    } else {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    moment.tz.setDefault("Asia/Seoul");

    if (!req.query.page || !req.query.order) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    if ((req.query.order !== 'latest') && (req.query.order !== 'recommend')) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.Event.findAndCountAll({
        where: showCondition
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

        if (req.query.order === 'latest') {
            db.Event.findAll({
                where: showCondition,
                limit: limit,
                offset: limit * (Number(req.query.page)-1),
                attributes: ['index', 'title', 'subtitle', 'titleImageUrl', 'expirationDate', 'created_at'],
                order: [['created_at', 'DESC']]
            }).then(async (result) => {
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
                    } else if (result.length === 0) {
                        nextNum = 0;
                    } else {
                        nextNum = limit;
                    }
                    res.json({Data: result, totalPages: totalPages, nextNum: nextNum});
                    return;
                }
            });
        } else if (req.query.order === 'recommend') {
            db.Event.findAll({
                where: showCondition,
                attributes: ['index', 'title', 'subtitle', 'titleImageUrl', 'expirationDate', 'created_at']
            }).then(async (events) => {
                if (!events) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    for (let i=0; i<events.length; ++i) {
                        const likeList = await events[i].getLikeOrHates();
                        events[i].dataValues.likeCount = likeList.length;
                    }
                    events.sort((event1, event2) => {
                        return event1.dataValues.likeCount > event2.dataValues.likeCount ? -1
                            : (event1.dataValues.likeCount < event2.dataValues.likeCount ? 1 : 0)
                    });

                    if (Number(req.query.page) === totalPages) {
                        eventsSliced = events.slice(((Number(req.query.page))-1) * limit, events.length);
                    } else {
                        eventsSliced = events.slice(((Number(req.query.page))-1) * limit, Number(req.query.page) * limit);
                    }

                    if (Number(req.query.page) === (totalPages - 1)) {
                        nextNum = totalNum % limit;
                    } else if (Number(req.query.page) >= totalPages) {
                        nextNum = 0;
                    } else {
                        nextNum = limit;
                    }
                    res.json({Data: eventsSliced, totalPages: totalPages, nextNum: nextNum});
                    return;
                }
            });
        }
    });
});

/*
    > 유저가 이벤트/당첨자발표에 댓글을 작성하는 api
    > POST /api/event/comment
    > req.body.content로 댓글 내용, req.body.eventIndex로 해당 포스트 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": 존재하지 않는 포스트
          "no such member": 존재하지 않는 회원
          "unauthorized request": 권한 없는 접근
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/comment', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
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
                    where: {
                        index: token.index
                    }
                }).then(async (result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such member"
                        });
                    } else {
                        const member = result;
                        
                        const comment = await db.Comment.create({
                            content: req.body.content,
                        }).catch(Sequelize.ValidationError, (err) => {
                            if (err) {
                                res.json({
                                    error: 'validation error'
                                });
                                return;
                            }
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
    > 유저가 이벤트/당첨자발표에 작성한 댓글을 삭제하는 api(대댓글도 똑같으므로 같은 api로 사용한다.)
    > DELETE /api/event/comment
    > req.body.index로 댓글의 index, req.body.eventIndex로 해당 포스트 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "comment delete failed": 댓글 삭제 실패
          "unauthorized request": 권한 없는 접근
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > success: {
        true: 성공적으로 댓글을 삭제
      }
*/
router.delete('/comment', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
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
                ).catch(Sequelize.ValidationError, (err) => {
                    if (err) {
                        res.json({
                            error: 'validation error'
                        });
                        return;
                    }
                }).then((result) => {
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
    > 유저가 이벤트/당첨자발표에 작성한 댓글을 수정하는 api(대댓글도 똑같으므로 같은 api로 사용한다.)
    > PUT /api/event/comment
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.content로 수정 내용, req.body.index로 댓글의 index, req.body.eventIndex로 해당 포스트의 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "comment edit failed": 댓글 수정 실패
          "unauthorized request": 권한 없는 접근
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > success: {
        true: 성공적으로 댓글을 수정
      }
*/
router.put('/comment', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
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
                ).catch(Sequelize.ValidationError, (err) => {
                    if (err) {
                        res.json({
                            error: 'validation error'
                        });
                        return;
                    }
                }).then((result) => {
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
    > 유저가 이벤트/당첨자발표 댓글에 대댓글을 작성하는 api
    > POST /api/event/childComment
    > req.body.content로 댓글 내용, req.body.commentIndex로 해당 댓글의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "no such post": 존재하지 않는 포스트
          "no such member": 존재하지 않는 회원
          "unauthorized request": 권한 없는 접근
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/childComment', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
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
                                }).catch(Sequelize.ValidationError, (err) => {
                                    if (err) {
                                        res.json({
                                            error: 'validation error'
                                        });
                                        return;
                                    }
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
    > 이벤트/당첨자발표 포스트 하나의 본문과 그 딸린 댓글들을 불러오는 api
    > GET /api/event/post?index=1&order=latest&page=1
    > req.query.index 해당 팁의 index를 전달, req.query.page에 해당 페이지 넘버를 전달
      req.query.order로 정렬 순서 전달.(latest: 최신순, recommend: 추천순)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": 존재하지 않는 포스트
          "find error": db에 있는 정보를 가져오는 데에 문제 발생
          "unauthorized request": 권한 없는 접근
      }
    > {
        event: 이벤트/당첨자발표 본문,
        comments: 댓글 정보를 배열로 전달. 각 댓글 객체 안의 creator 객체로 작성자의 정보를 전달.(이미 삭제된 댓글의 경우 작성자 정보가 빈 객체로 전달.)
            like, hate는 로그인한 유저가 해당 댓글에 좋아요/싫어요를 했는지의 여부를 전달. 만약 둘 다 하지 않았거나 로그인하지 않은 상태라면 둘 다 false를 전달.
        totalPages: 전체 페이지
      }
*/
router.get('/post', (req, res) => {
    const limit = 10;
    
    if (!req.query.index || !req.query.page || !req.query.order) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    if (req.query.order !== 'latest' && req.query.order !== 'recommend') {
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
            event.getComments({
                where: {
                    parentIndex: null
                }
            }).then(async (comments) => {
                if (!comments) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    const totalNum = comments.length;
                    const totalPages = Math.ceil(comments.length/limit);
                    let sortedComments;

                    if (req.query.order === 'latest') {
                        sortedComments = await event.getComments({
                            where: {parentIndex: null},
                            limit: limit,
                            offset: limit * (Number(req.query.page)-1),
                            order: [['created_at', 'DESC']]
                        });
                    } else if (req.query.order === 'recommend') {
                        sortedComments = await event.getComments({
                            where: {parentIndex: null},
                            limit: limit,
                            offset: limit * (Number(req.query.page)-1),
                            order: [['likeNum', 'DESC']]
                        });
                    }

                    for (let i=0; i<sortedComments.length; ++i) {
                        let like = false;
                        let hate = false;

                        if (req.headers['authorization']) {
                            const token = await util.decodeToken(req.headers['authorization'], res).catch((error) => {
                                res.status(403).json({
                                    error: "unauthorized request"
                                });
                                return;
                            });

                            if (!token.index || !token.email || !token.nickName) {
                                res.status(400).json({
                                    error: "invalid request"
                                });
                                return;
                            }

                            const likeOrHate = await db.LikeOrHate.findAll({
                                where: {
                                    member_info_index: token.index,
                                    comment_index: sortedComments[i].dataValues.index
                                }
                            });

                            if (likeOrHate.length === 1) {
                                if (likeOrHate[0].dataValues.assessment) {
                                    like = true;
                                } else {
                                    hate = true;
                                }
                            } else if (likeOrHate.length === 2) {
                                like = true;
                                hate = true;
                            }
                        }

                        if (sortedComments[i].dataValues.isDeleted) {
                            sortedComments[i].dataValues.creator = {};
                        } else {
                            await db.MemberInfo.findOne({
                                attributes: [
                                    'index', 'nickName', 'photoUrl', 'gender', 'memberBirthYear', 'memberBirthMonth', 'memberBirthDay',
                                    'hasChild', 'childBirthYear', 'childBirthMonth', 'childBirthDay'
                                ],
                                where: {
                                    index: sortedComments[i].dataValues.member_info_index
                                }
                            }).then((result) => {
                                if (!result) {
                                    res.status(424).json({
                                        error: "find error"
                                    });
                                    return;
                                } else {
                                    sortedComments[i].dataValues.creator = result.dataValues;
                                    sortedComments[i].dataValues.like = like;
                                    sortedComments[i].dataValues.hate = hate;
                                }
                            });
                        }
                    }
                    res.json({event: event, comments: sortedComments, totalPages: totalPages, totalNum: totalNum});
                    return;
                }
            });
        }
    });
});

/*
    > 이벤트/당첨자발표 포스트의 특정 댓글의 대댓글들을 불러오는 api
    > GET /api/event/childComment?index=1&page=1
    > req.query.index 해당 댓글의 index를 전달, req.query.page에 해당 페이지 넘버를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "not proper comment": 적절하지 않은 댓글(이벤트가 아닌 꿀팁의 댓글이거나 대댓글을 불러올 경우)
          "find error": db에 있는 정보를 가져오는 데에 문제 발생
          "unauthorized request": 권한 없는 접근
      }
    > {
        childComments: 대댓글 정보를 배열로 전달. 각 댓글 객체 안의 creator 객체로 작성자의 정보를 전달.(이미 삭제된 댓글의 경우 작성자 정보가 빈 객체로 전달.)
            like, hate는 로그인한 유저가 해당 댓글에 좋아요/싫어요를 했는지의 여부를 전달. 만약 둘 다 하지 않았거나 로그인하지 않은 상태라면 둘 다 false를 전달.
        totalPages: 전체 페이지
      }
*/
router.get('/childComment', (req, res) => {
    const limit = 10;

    if (!req.query.index || !req.query.page) {
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
                    const totalPages = Math.ceil(childComments.length/limit);
                    const pagedChildComments = await db.Comment.findAll({
                        where: {
                            parentIndex: comment.dataValues.index
                        },
                        limit: limit,
                        offset: limit * (Number(req.query.page)-1)
                    });

                    for (let i=0; i<pagedChildComments.length; ++i) {
                        let like = false;
                        let hate = false;

                        if (req.headers['authorization']) {
                            const token = await util.decodeToken(req.headers['authorization'], res).catch((error) => {
                                res.status(403).json({
                                    error: "unauthorized request"
                                });
                                return;
                            });

                            if (!token.index || !token.email || !token.nickName) {
                                res.status(400).json({
                                    error: "invalid request"
                                });
                                return;
                            }

                            const likeOrHate = await db.LikeOrHate.findAll({
                                where: {
                                    member_info_index: token.index,
                                    comment_index: pagedChildComments[i].dataValues.index
                                }
                            });

                            if (likeOrHate.length === 1) {
                                if (likeOrHate[0].dataValues.assessment) {
                                    like = true;
                                } else {
                                    hate = true;
                                }
                            } else if (likeOrHate.length === 2) {
                                like = true;
                                hate = true;
                            }
                        }

                        if (pagedChildComments[i].dataValues.isDeleted){
                            pagedChildComments[i].dataValues.creator = {};
                        } else {
                            await db.MemberInfo.findOne({
                                attributes: [
                                    'index', 'nickName', 'photoUrl', 'gender', 'memberBirthYear', 'memberBirthMonth', 'memberBirthDay',
                                    'hasChild', 'childBirthYear', 'childBirthMonth', 'childBirthDay'
                                ],
                                where: {
                                    index: pagedChildComments[i].dataValues.member_info_index
                                }
                            }).then((result) => {
                                if (!result) {
                                    res.status(424).json({
                                        error: "find error"
                                    });
                                    return;
                                } else {
                                    pagedChildComments[i].dataValues.creator = result.dataValues;
                                    pagedChildComments[i].dataValues.like = like;
                                    pagedChildComments[i].dataValues.hate = hate;
                                }
                            });
                        }
                    }
                    res.json({childComments: pagedChildComments, totalPages: totalPages});
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

    util.decodeToken(token, res).then((token) => {
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

/*
    > 유저가 해당 이벤트/당첨자발표 포스트를 열었을 때 좋아요를 했는지 안했는지 체크하는 api
    > GET /api/event/post/like?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.query.index로 확인하고자 하는 이벤트의 index 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such event": 존재하지 않는 이벤트
          "unauthorized request": 권한 없는 접근
      }
    > like: {
        true: 유저가 이 이벤트/당첨자발표에 좋아요를 했음
        false: 유저가 이 이벤트/당첨자발표에 좋아요를 하지 않았음
      }
*/
router.get('/post/like', (req, res) => {
    if (!req.headers['authorization']) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Event.findOne({
            where: {
                index: Number(req.query.index)
            }
        }).then((event) => {
            if (!event) {
                res.status(424).json({
                    error: "no such event"
                });
                return;
            } else {
                db.LikeOrHate.findOne({
                    where: {
                        member_info_index: token.index,
                        event_index: Number(req.query.index),
                        assessment: true
                    }
                }).then((result) => {
                    if (!result) {
                        res.json({
                            like: false
                        });
                        return;
                    } else {
                        res.json({
                            like: true
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

module.exports = router;